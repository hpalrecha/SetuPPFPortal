import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Mail, Phone, Loader2 } from "lucide-react";
import { GA4Events } from "@/lib/ga4";

interface ProfileCompletionModalProps {
  open: boolean;
  onComplete: () => void;
  user: any;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export function ProfileCompletionModal({ open, onComplete, user }: ProfileCompletionModalProps) {
  // Check if user needs additional details (dealership or showroom users)
  const needsAdditionalDetails = user?.role === 'DEALERSHIP_ADMIN' || user?.role === 'SHOWROOM_MANAGER';
  
  // Determine initial step based on verification status
  const getInitialStep = () => {
    if (!user?.emailVerified) return 1; // Start with email verification
    if (!user?.phoneVerified) return 2; // Email verified, start with phone verification
    if (needsAdditionalDetails) return 3; // Both verified, go to additional details
    return 4; // Both verified, no additional details needed, go to confirmation
  };
  
  const [step, setStep] = useState(getInitialStep());
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [emailOtp, setEmailOtp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  
  // Additional details for dealership/showroom users
  const [contactPersonName, setContactPersonName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  
  // GST number
  const [gstNumber, setGstNumber] = useState("");
  
  // Billing address (optional)
  const [hasDifferentBillingAddress, setHasDifferentBillingAddress] = useState(false);
  const [billToAddress, setBillToAddress] = useState("");
  const [billToCity, setBillToCity] = useState("");
  const [billToState, setBillToState] = useState("");
  const [billToPincode, setBillToPincode] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update step when user verification status changes
  useEffect(() => {
    const correctStep = getInitialStep();
    setStep(correctStep);
  }, [user?.emailVerified, user?.phoneVerified, needsAdditionalDetails]);

  const updateProfileDataMutation = useMutation({
    mutationFn: async (data: { email?: string; phone?: string }) => {
      return apiRequest("POST", "/api/auth/update-profile-data", data);
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
      return apiRequest("POST", "/api/auth/send-email-otp");
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
      return apiRequest("POST", "/api/auth/verify-email-otp", { otp });
    },
    onSuccess: async () => {
      // Invalidate auth query to refresh user data
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      GA4Events.verifyEmail();
      
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
      return apiRequest("POST", "/api/auth/send-sms-otp");
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
      return apiRequest("POST", "/api/auth/verify-sms-otp", { otp });
    },
    onSuccess: async () => {
      // Invalidate auth query to refresh user data
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      GA4Events.verifyPhone();
      
      toast({
        title: "Phone Verified",
        description: "Your phone number has been verified successfully",
      });
      // Go to additional details step for dealership/showroom users, otherwise go to complete
      setStep(needsAdditionalDetails ? 3 : 4);
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
      const profileData: any = { email, phone };
      
      // Include additional details for dealership/showroom users
      if (needsAdditionalDetails) {
        profileData.contactPersonName = contactPersonName;
        profileData.address = address;
        profileData.city = city;
        profileData.state = state;
        profileData.pincode = pincode;
        
        // Include GST number if provided
        if (gstNumber) {
          profileData.gstNumber = gstNumber;
        }
        
        // Always include billing address - either different or same as main address
        if (hasDifferentBillingAddress) {
          profileData.billToAddress = {
            addressLine1: billToAddress,
            city: billToCity,
            state: billToState,
            pincode: billToPincode,
            gstin: gstNumber
          };
        } else {
          // Copy main address to billing address
          profileData.billToAddress = {
            addressLine1: address,
            city: city,
            state: state,
            pincode: pincode,
            gstin: gstNumber
          };
        }
      }
      
      return apiRequest("POST", "/api/auth/complete-profile", profileData);
    },
    onSuccess: async () => {
      GA4Events.completeProfile(user?.role || 'unknown');
      
      toast({
        title: "Profile Completed",
        description: "Your profile has been completed successfully",
      });
      // Wait for the user data to be refetched
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Small delay to ensure the data is fully refreshed
      setTimeout(() => {
        onComplete();
      }, 100);
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
              {(step > 1 || user?.emailVerified) ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
              <span className="text-sm font-medium">Email</span>
            </div>
            <div className="flex-1 h-px bg-border mx-2" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              {(step > 2 || user?.phoneVerified) ? <CheckCircle2 className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              <span className="text-sm font-medium">Phone</span>
            </div>
            {needsAdditionalDetails && (
              <>
                <div className="flex-1 h-px bg-border mx-2" />
                <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step > 3 ? <CheckCircle2 className="h-5 w-5" /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>}
                  <span className="text-sm font-medium">Details</span>
                </div>
              </>
            )}
            <div className="flex-1 h-px bg-border mx-2" />
            <div className={`flex items-center gap-2 ${step >= (needsAdditionalDetails ? 4 : 3) ? 'text-primary' : 'text-muted-foreground'}`}>
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

          {/* Step 3: Additional Details (for dealership/showroom users) */}
          {step === 3 && needsAdditionalDetails && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="contactPersonName">Contact Person Name *</Label>
                <Input
                  id="contactPersonName"
                  type="text"
                  placeholder="Enter contact person name"
                  value={contactPersonName}
                  onChange={(e) => setContactPersonName(e.target.value)}
                  data-testid="input-contact-person-name"
                />
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="Enter street address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="input-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="Enter city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    data-testid="input-city"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State *</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger data-testid="select-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((stateName) => (
                        <SelectItem key={stateName} value={stateName}>
                          {stateName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  type="text"
                  placeholder="Enter pincode"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  data-testid="input-pincode"
                />
              </div>

              <div>
                <Label htmlFor="gstNumber">GST Number (Optional)</Label>
                <Input
                  id="gstNumber"
                  type="text"
                  placeholder="Enter GST number"
                  maxLength={15}
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  data-testid="input-gst-number"
                />
              </div>

              {/* Billing Address Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="differentBilling"
                    checked={hasDifferentBillingAddress}
                    onCheckedChange={(checked) => setHasDifferentBillingAddress(checked as boolean)}
                    data-testid="checkbox-different-billing"
                  />
                  <Label htmlFor="differentBilling" className="cursor-pointer">
                    Billing address is different from above
                  </Label>
                </div>

                {hasDifferentBillingAddress && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <div>
                      <Label htmlFor="billToAddress">Billing Address *</Label>
                      <Input
                        id="billToAddress"
                        type="text"
                        placeholder="Enter billing address"
                        value={billToAddress}
                        onChange={(e) => setBillToAddress(e.target.value)}
                        data-testid="input-bill-to-address"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billToCity">Billing City *</Label>
                        <Input
                          id="billToCity"
                          type="text"
                          placeholder="Enter city"
                          value={billToCity}
                          onChange={(e) => setBillToCity(e.target.value)}
                          data-testid="input-bill-to-city"
                        />
                      </div>

                      <div>
                        <Label htmlFor="billToState">Billing State *</Label>
                        <Select value={billToState} onValueChange={setBillToState}>
                          <SelectTrigger data-testid="select-bill-to-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {INDIAN_STATES.map((stateName) => (
                              <SelectItem key={stateName} value={stateName}>
                                {stateName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="billToPincode">Billing Pincode *</Label>
                      <Input
                        id="billToPincode"
                        type="text"
                        placeholder="Enter pincode"
                        maxLength={6}
                        value={billToPincode}
                        onChange={(e) => setBillToPincode(e.target.value.replace(/\D/g, ''))}
                        data-testid="input-bill-to-pincode"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={() => {
                  // Validate required fields
                  if (!contactPersonName || !address || !city || !state || !pincode) {
                    toast({
                      title: "Required Fields Missing",
                      description: "Please fill in all required fields",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validate billing address if different
                  if (hasDifferentBillingAddress && (!billToAddress || !billToCity || !billToState || !billToPincode)) {
                    toast({
                      title: "Billing Address Required",
                      description: "Please fill in all billing address fields",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setStep(4);
                }}
                className="w-full"
                data-testid="button-continue-to-complete"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 4: Complete Profile */}
          {step === 4 && (
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
                {needsAdditionalDetails && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">Contact Person:</span>
                      <span className="text-sm text-muted-foreground">{contactPersonName}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">Location:</span>
                      <span className="text-sm text-muted-foreground">{city}, {state} - {pincode}</span>
                    </div>
                    {hasDifferentBillingAddress && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm font-medium">Billing Address:</span>
                        <span className="text-sm text-muted-foreground">{billToCity}, {billToState} - {billToPincode}</span>
                      </div>
                    )}
                  </>
                )}
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
