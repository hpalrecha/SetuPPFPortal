import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";

// Staff are onboarded through the Pulse platform: this modal generates a
// partner-tagged Pulse registration link. Once the person registers on Pulse,
// is approved, and is granted Setu access there, they appear in this portal
// under this partner automatically.
const inviteSchema = z.object({
  role: z.enum(["PARTNER_STAFF", "DETAILING_PARTNER"]),
  email: z
    .string()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface AddStaffModalProps {
  partnerId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function AddStaffModal({
  partnerId,
  onSuccess,
  onClose,
}: AddStaffModalProps) {
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
      role: "PARTNER_STAFF",
      email: "",
    },
  });

  const handleSubmit = async (data: InviteFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/partners/${partnerId}/staff/pulse-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          role: data.role,
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-staff">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Staff register through P91 Pulse. After approval and Setu access
            being granted there, they will appear under your partner account here.
          </DialogDescription>
        </DialogHeader>

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

            <DialogFooter className="gap-2">
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
              <Button
                type="button"
                onClick={onSuccess}
                data-testid="button-done-invite"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-staff-role">
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PARTNER_STAFF">Installer (Partner Staff)</SelectItem>
                        <SelectItem value="DETAILING_PARTNER">Detailing Partner</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  data-testid="button-cancel-add-staff"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  data-testid="button-submit-add-staff"
                >
                  {isLoading ? "Generating..." : "Generate Invite Link"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
