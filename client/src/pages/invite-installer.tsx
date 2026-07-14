import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const inviteSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export default function InviteInstaller() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    registrationLink: string;
    expiresAt?: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = async (data: InviteFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/staff/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate invite link");
      }

      const result = await response.json();
      setInviteResult({
        registrationLink: result.registrationLink,
        expiresAt: result.expiresAt,
        emailSent: result.emailSent,
      });

      toast({
        title: "Invite link generated",
        description: result.emailSent
          ? "The invitation has also been emailed."
          : "Share the link with your staff member to register on Pulse.",
      });
    } catch (error: any) {
        console.error("Error generating staff invite:", error);
        toast({
            title: "Error",
            description: error.message || "Failed to generate invite link",
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteResult?.registrationLink) return;
    try {
      await navigator.clipboard.writeText(inviteResult.registrationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Select and copy the link manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invite Installer</h1>
          <p className="text-muted-foreground">Generate an invite link for an installer to join the platform.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Installer</CardTitle>
          <CardDescription>
            Installers register through P91 Pulse. After approval and Setu access
            being granted there, they will appear under your partner account here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteResult ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Registration link</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteResult.registrationLink}
                    className="text-xs"
                    data-testid="input-invite-link"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    data-testid="button-copy-invite-link"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {inviteResult.expiresAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Expires on {new Date(inviteResult.expiresAt).toLocaleDateString()}.
                  </p>
                )}
                {inviteResult.emailSent && (
                  <p className="text-xs text-muted-foreground mt-1">
                    The invitation has also been sent by email.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInviteResult(null);
                    form.reset();
                  }}
                  data-testid="button-new-invite"
                >
                  New Invite
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Send the invite link by email"
                          data-testid="input-staff-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                     type="submit"
                     disabled={isLoading}
                     data-testid="button-submit-add-staff"
                   >
                     {isLoading ? "Generating..." : "Generate Invite Link"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
