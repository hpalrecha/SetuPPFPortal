import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().optional(),
  isActive: z.boolean(),
  showServicePrices: z.boolean(),
  allowedStates: z.array(z.string()).optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface EditUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    isActive: boolean;
    showServicePrices?: boolean;
    allowedStates?: string[];
  } | null;
}

export function EditUserModal({
  open,
  onOpenChange,
  onSuccess,
  user,
}: EditUserModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      isActive: true,
      showServicePrices: true,
      allowedStates: [],
    },
  });

  useEffect(() => {
    if (user && open) {
      form.reset({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        password: "",
        isActive: user.isActive ?? true,
        showServicePrices: user.showServicePrices ?? true,
        allowedStates: user.allowedStates || [],
      });
    }
  }, [user, open, form]);

  const onSubmit = async (data: EditUserFormData) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const updateData: any = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        isActive: data.isActive,
        showServicePrices: data.showServicePrices,
      };
      
      if (data.password && data.password.length > 0) {
        updateData.password = data.password;
      }
      
      if (user.role === 'MANAGER') {
        updateData.allowedStates = data.allowedStates;
      }
      
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }

      toast({
        title: "User Updated",
        description: "User has been updated successfully.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details and settings. Role: {user.role.replace(/_/g, ' ')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-user-name" />
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
                    <Input type="email" {...field} data-testid="input-edit-user-email" />
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
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-user-phone" />
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
                  <FormLabel>New Password (leave blank to keep current)</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} placeholder="Enter new password..." data-testid="input-edit-user-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Deactivate to prevent user from logging in
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-edit-user-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="showServicePrices"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Show Service Prices</FormLabel>
                    <FormDescription>
                      Allow this user to see service prices in work orders and job cards
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-edit-show-service-prices"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {user.role === 'MANAGER' && (
              <FormField
                control={form.control}
                name="allowedStates"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Allowed States</FormLabel>
                      <FormDescription>
                        Select the states this manager can access
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto p-4 border rounded-md">
                      {INDIAN_STATES.map((state) => (
                        <FormField
                          key={state}
                          control={form.control}
                          name="allowedStates"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={state}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(state)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), state])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== state
                                            )
                                          )
                                    }}
                                    data-testid={`checkbox-edit-state-${state.toLowerCase().replace(/\s+/g, '-')}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {state}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
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
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="button-save-user">
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
