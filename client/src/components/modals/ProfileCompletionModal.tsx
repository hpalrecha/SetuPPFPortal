import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Mail, Phone, Loader2 } from "lucide-react";

interface ProfileCompletionModalProps {
  open: boolean;
  onComplete: () => void;
  user: any;
}

export function ProfileCompletionModal({ open, onComplete, user }: ProfileCompletionModalProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [emailOtp, setEmailOtp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileDataMutation = useMutation({
    mutationFn: async (data: { email?: string; phone?: string }) => {
      return apiRequest("/api/auth/update-profile-data", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile data updated",
        description: "You can now verify your contact information",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile data",
        variant: "destructive",
      });
    },
  });

  const sendEmailOtpMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/auth/send-email-otp", {
        method: "POST",
      });
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: "OTP Sent",
        description: "Check your email for the verification code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
  });

  const verifyEmailOtpMutation = useMutation({
    mutationFn: async (otp: string) => {
      return apiRequest("/api/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ otp }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Email Verified",
        description: "Your email has been verified successfully",
      });
      setStep(2);
      setEmailOtp("");
      setEmailSent(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  const sendSmsOtpMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/auth/send-sms-otp", {
        method: "POST",
      });
    },
    onSuccess: () => {
      setSmsSent(true);
      toast({
        title: "OTP Sent",
        description: "Check your phone for the verification code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
  });

  const verifySmsOtpMutation = useMutation({
    mutationFn: async (otp: string) => {
      return apiRequest("/api/auth/verify-sms-otp", {
        method: "POST",
        body: JSON.stringify({ otp }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Phone Verified",
        description: "Your phone number has been verified successfully",
      });
      setStep(3);
      setSmsOtp("");
      setSmsSent(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  const completeProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/auth/complete-profile", {
        method: "POST",
        body: JSON.stringify({ email, phone }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Completed",
        description: "Your profile has been completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete profile",
        variant: "destructive",
      });
    },
  });

  const handleEmailSubmit = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    // Update email if changed
    if (email !== user?.email) {
      await updateProfileDataMutation.mutateAsync({ email });
    }

    // Send OTP
    sendEmailOtpMutation.mutate();
  };

  const handleEmailVerify = () => {
    if (!emailOtp || emailOtp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }
    verifyEmailOtpMutation.mutate(emailOtp);
  };

  const handlePhoneSubmit = async () => {
    if (!phone) {
      toast({
        title: "Error",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    // Update phone if changed
    if (phone !== user?.phone) {
      await updateProfileDataMutation.mutateAsync({ phone });
    }

    // Send OTP
    sendSmsOtpMutation.mutate();
  };

  const handlePhoneVerify = () => {
    if (!smsOtp || smsOtp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }
    verifySmsOtpMutation.mutate(smsOtp);
  };

  const handleCompleteProfile = () => {
    completeProfileMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please verify your email and phone number to continue
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Steps */}
          <div className="flex justify-between items-center">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              {step > 1 ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
              <span className="text-sm font-medium">Email</span>
            </div>
            <div className="flex-1 h-px bg-border mx-2" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              {step > 2 ? <CheckCircle2 className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              <span className="text-sm font-medium">Phone</span>
            </div>
            <div className="flex-1 h-px bg-border mx-2" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>

          {/* Step 1: Email Verification */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={emailSent}
                  data-testid="input-email"
                />
              </div>

              {!emailSent ? (
                <Button
                  onClick={handleEmailSubmit}
                  disabled={sendEmailOtpMutation.isPending || updateProfileDataMutation.isPending}
                  className="w-full"
                  data-testid="button-send-email-otp"
                >
                  {sendEmailOtpMutation.isPending || updateProfileDataMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Verification Code"
                  )}
                </Button>
              ) : (
                <>
                  <div>
                    <Label htmlFor="emailOtp">Enter 6-Digit Code</Label>
                    <Input
                      id="emailOtp"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                      data-testid="input-email-otp"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEmailSent(false);
                        setEmailOtp("");
                      }}
                      className="flex-1"
                      data-testid="button-change-email"
                    >
                      Change Email
                    </Button>
                    <Button
                      onClick={handleEmailVerify}
                      disabled={verifyEmailOtpMutation.isPending}
                      className="flex-1"
                      data-testid="button-verify-email-otp"
                    >
                      {verifyEmailOtpMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Email"
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="link"
                    onClick={() => sendEmailOtpMutation.mutate()}
                    disabled={sendEmailOtpMutation.isPending}
                    className="w-full"
                    data-testid="button-resend-email-otp"
                  >
                    Resend Code
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 2: Phone Verification */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={smsSent}
                  data-testid="input-phone"
                />
              </div>

              {!smsSent ? (
                <Button
                  onClick={handlePhoneSubmit}
                  disabled={sendSmsOtpMutation.isPending || updateProfileDataMutation.isPending}
                  className="w-full"
                  data-testid="button-send-sms-otp"
                >
                  {sendSmsOtpMutation.isPending || updateProfileDataMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Verification Code"
                  )}
                </Button>
              ) : (
                <>
                  <div>
                    <Label htmlFor="smsOtp">Enter 6-Digit Code</Label>
                    <Input
                      id="smsOtp"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={smsOtp}
                      onChange={(e) => setSmsOtp(e.target.value.replace(/\D/g, ''))}
                      data-testid="input-sms-otp"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSmsSent(false);
                        setSmsOtp("");
                      }}
                      className="flex-1"
                      data-testid="button-change-phone"
                    >
                      Change Phone
                    </Button>
                    <Button
                      onClick={handlePhoneVerify}
                      disabled={verifySmsOtpMutation.isPending}
                      className="flex-1"
                      data-testid="button-verify-sms-otp"
                    >
                      {verifySmsOtpMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Phone"
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="link"
                    onClick={() => sendSmsOtpMutation.mutate()}
                    disabled={sendSmsOtpMutation.isPending}
                    className="w-full"
                    data-testid="button-resend-sms-otp"
                  >
                    Resend Code
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 3: Complete Profile */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-medium">Verification Complete!</p>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-2">
                  Your email and phone number have been successfully verified.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm font-medium">Email:</span>
                  <span className="text-sm text-muted-foreground">{email}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm font-medium">Phone:</span>
                  <span className="text-sm text-muted-foreground">{phone}</span>
                </div>
              </div>

              <Button
                onClick={handleCompleteProfile}
                disabled={completeProfileMutation.isPending}
                className="w-full"
                data-testid="button-complete-profile"
              >
                {completeProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  "Complete Profile"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
