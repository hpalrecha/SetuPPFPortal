import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [token, setToken] = useState<string>("");

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    // Get token from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (!tokenParam) {
      setIsValidToken(false);
      return;
    }

    setToken(tokenParam);
    
    // Validate the token
    const validateToken = async () => {
      try {
        const response = await apiRequest('GET', `/api/auth/validate-reset-token/${tokenParam}`);
        const data = await response.json();
        setIsValidToken(data.valid);
      } catch (error) {
        setIsValidToken(false);
      }
    };

    validateToken();
  }, []);

  const onSubmit = async (data: ResetPasswordForm) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/reset-password', {
        token,
        newPassword: data.newPassword
      });

      if (response.ok) {
        setResetSuccess(true);
        toast({
          title: "Password Reset Successfully",
          description: "Your password has been updated. You can now sign in with your new password.",
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reset password");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isValidToken === null) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Validating reset token...</p>
        </div>
      );
    }

    if (!isValidToken) {
      return (
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h3 className="text-lg font-semibold">Invalid or Expired Link</h3>
          <p className="text-sm text-muted-foreground">
            The password reset link is invalid or has expired. Please request a new one.
          </p>
          <Button 
            onClick={() => setLocation("/forgot-password")}
            className="w-full"
            data-testid="button-request-new-link"
          >
            Request New Reset Link
          </Button>
        </div>
      );
    }

    if (resetSuccess) {
      return (
        <div className="text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold">Password Reset Complete!</h3>
          <p className="text-sm text-muted-foreground">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <Button 
            onClick={() => setLocation("/login")}
            className="w-full"
            data-testid="button-goto-login"
          >
            Go to Sign In
          </Button>
        </div>
      );
    }

    return (
      <>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your new password below. Make sure it's secure and easy for you to remember.
        </p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password"
              {...form.register("newPassword")}
              data-testid="input-new-password"
            />
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              {...form.register("confirmPassword")}
              data-testid="input-confirm-password"
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
            data-testid="button-reset-password"
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10 px-4">
      <div className="w-full max-w-md">
        {/* SetuPPF Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SetuPPF</h1>
          <p className="text-muted-foreground mt-2">PPF Installation Management Portal</p>
        </div>

        {/* Reset Password Form */}
        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}