import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address")
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/forgot-password', {
        email: data.email
      });

      if (response.ok) {
        setEmailSent(true);
        toast({
          title: "Reset Link Sent",
          description: "Please check your email for the password reset link.",
          variant: "default"
        });
      } else {
        throw new Error("Failed to send reset email");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reset email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10 px-4">
      <div className="w-full max-w-md">
        {/* SetuPPF Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Pulse VAS</h1>
          <p className="text-muted-foreground mt-2">PPF Installation Management Portal</p>
        </div>

        {/* Forgot Password Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <button
                onClick={() => setLocation("/login")}
                className="p-1 hover:bg-muted rounded"
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              Forgot Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!emailSent ? (
              <>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      {...form.register("email")}
                      data-testid="input-forgot-email"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-send-reset-link"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-green-600 dark:text-green-400">
                  <Shield className="h-12 w-12 mx-auto mb-4" />
                </div>
                <h3 className="text-lg font-semibold">Reset Link Sent!</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.
                </p>
                <Button 
                  onClick={() => setLocation("/login")}
                  variant="outline"
                  className="w-full"
                  data-testid="button-back-to-login-success"
                >
                  Back to Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}