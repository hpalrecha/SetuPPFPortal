import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON', 'PARTNER_ADMIN', 'PARTNER_STAFF']),
  oemId: z.string().optional(),
  dealershipId: z.string().optional(),
  showroomId: z.string().optional(),
  partnerId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type UserFormData = z.infer<typeof userSchema>;

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "SALES_PERSON",
      isActive: true,
    },
  });

  const selectedRole = form.watch("role");

  // Fetch OEMs
  const { data: oems = [] } = useQuery({
    queryKey: ["/api/oems"],
    enabled: open && ['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole),
  });

  // Fetch Dealerships
  const { data: dealerships = [] } = useQuery({
    queryKey: ["/api/dealerships"],
    enabled: open && ['DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole),
  });

  // Fetch Showrooms
  const { data: showrooms = [] } = useQuery({
    queryKey: ["/api/showrooms"],
    enabled: open && ['SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole),
  });

  // Fetch Partners
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners"],
    enabled: open && ['PARTNER_ADMIN', 'PARTNER_STAFF'].includes(selectedRole),
  });

  const onSubmit = async (data: UserFormData) => {
    try {
      setIsLoading(true);
      
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }

      toast({
        title: "User Created",
        description: "User has been created successfully.",
      });

      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-user-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-user-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-user-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-user-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="OEM_ADMIN">OEM Admin</SelectItem>
                        <SelectItem value="DEALERSHIP_ADMIN">Dealership Admin</SelectItem>
                        <SelectItem value="SHOWROOM_MANAGER">Showroom Manager</SelectItem>
                        <SelectItem value="SALES_PERSON">Sales Person</SelectItem>
                        <SelectItem value="PARTNER_ADMIN">Partner Admin</SelectItem>
                        <SelectItem value="PARTNER_STAFF">Partner Staff</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Conditional fields based on role */}
            {['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole) && (
              <FormField
                control={form.control}
                name="oemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OEM {['OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole) ? '*' : ''}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-oem">
                          <SelectValue placeholder="Select OEM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(oems as any[]).map((oem: any) => (
                          <SelectItem key={oem.id} value={oem.id}>
                            {oem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {['DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole) && (
              <FormField
                control={form.control}
                name="dealershipId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dealership {['DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole) ? '*' : ''}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-dealership">
                          <SelectValue placeholder="Select Dealership" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(dealerships as any[]).map((dealership: any) => (
                          <SelectItem key={dealership.id} value={dealership.id}>
                            {dealership.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {['SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole) && (
              <FormField
                control={form.control}
                name="showroomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Showroom {['SHOWROOM_MANAGER', 'SALES_PERSON'].includes(selectedRole) ? '*' : ''}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-showroom">
                          <SelectValue placeholder="Select Showroom" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(showrooms as any[]).map((showroom: any) => (
                          <SelectItem key={showroom.id} value={showroom.id}>
                            {showroom.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {['PARTNER_ADMIN', 'PARTNER_STAFF'].includes(selectedRole) && (
              <FormField
                control={form.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-partner">
                          <SelectValue placeholder="Select Partner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(partners as any[]).map((partner: any) => (
                          <SelectItem key={partner.id} value={partner.id}>
                            {partner.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-create-user">
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
