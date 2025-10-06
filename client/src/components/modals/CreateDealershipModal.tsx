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
import { Textarea } from "@/components/ui/textarea";
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
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

const dealershipSchema = z.object({
  name: z.string().min(1, "Dealership name is required"),
  oemIds: z.array(z.string()).min(1, "At least one OEM must be selected"),
  adminOemId: z.string().optional(), // OEM for admin user
  contactPersonName: z.string().min(1, "Contact person name is required"),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  contactPhone: z.string().min(1, "Contact phone is required"),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  
  // Bill To Address fields
  billToAddressLine1: z.string().optional(),
  billToCity: z.string().optional(),
  billToState: z.string().optional(),
  billToPincode: z.string().optional(),
  billToGstin: z.string().optional(),
  
  // Admin user creation fields
  createUser: z.boolean().default(false),
  userName: z.string().optional(),
  userEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  userPhone: z.string().optional(),
  userPassword: z.string().optional(),
  
  // Password reset fields for editing
  resetPassword: z.boolean().default(false),
  newPassword: z.string().optional(),
  
  // Create admin user fields for existing entities without users
  createAdminUser: z.boolean().default(false),
  adminName: z.string().optional(),
  adminEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  adminPhone: z.string().optional(),
  adminPassword: z.string().optional(),
}).refine((data) => {
  if (data.createUser) {
    return data.userName && data.userName.length > 0 && 
           data.userEmail && data.userEmail.length > 0 &&
           data.userPassword && data.userPassword.length >= 6;
  }
  if (data.resetPassword) {
    return data.newPassword && data.newPassword.length >= 6;
  }
  if (data.createAdminUser) {
    return data.adminName && data.adminName.length > 0 && 
           data.adminEmail && data.adminEmail.length > 0 &&
           data.adminPassword && data.adminPassword.length >= 6;
  }
  return true;
}, {
  message: "When creating a user, name, email, and password (min 6 chars) are required. When resetting password, new password (min 6 chars) is required. When creating admin user, name, email, and password (min 6 chars) are required",
  path: ["createUser"]
});

type DealershipFormData = z.infer<typeof dealershipSchema>;

interface CreateDealershipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  dealership?: any;
}

export function CreateDealershipModal({
  open,
  onOpenChange,
  onSuccess,
  dealership,
}: CreateDealershipModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasAdminUser, setHasAdminUser] = useState(false);
  const isEditing = !!dealership;

  const form = useForm<DealershipFormData>({
    resolver: zodResolver(dealershipSchema),
    defaultValues: {
      name: dealership?.name || "",
      oemIds: dealership?.oemIds || [],
      adminOemId: "",
      contactPersonName: dealership?.contactPersonName || "",
      contactEmail: dealership?.contactEmail || "",
      contactPhone: dealership?.contactPhone || "",
      address: dealership?.address || "",
      city: dealership?.city || "",
      state: dealership?.state || "",
      pincode: dealership?.pincode || "",
      billToAddressLine1: dealership?.billToAddress?.addressLine1 || "",
      billToCity: dealership?.billToAddress?.city || "",
      billToState: dealership?.billToAddress?.state || "",
      billToPincode: dealership?.billToAddress?.pincode || "",
      billToGstin: dealership?.billToAddress?.gstin || "",
      createUser: false,
      userName: "",
      userEmail: "",
      userPhone: "",
      userPassword: "",
      resetPassword: false,
      newPassword: "",
      createAdminUser: false,
      adminName: "",
      adminEmail: "",
      adminPhone: "",
      adminPassword: "",
    },
  });

  // Reset form when dealership data changes (for editing)
  useEffect(() => {
    if (dealership && open) {
      console.log('Resetting form with dealership:', dealership);
      console.log('Dealership oemIds:', dealership.oemIds);
      form.reset({
        name: dealership.name || "",
        oemIds: dealership.oemIds || [],
        adminOemId: "",
        contactPersonName: dealership.contactPersonName || "",
        contactEmail: dealership.contactEmail || "",
        contactPhone: dealership.contactPhone || "",
        address: dealership.address || "",
        city: dealership.city || "",
        state: dealership.state || "",
        pincode: dealership.pincode || "",
        createUser: false,
        userName: "",
        userEmail: "",
        userPhone: "",
        userPassword: "",
        resetPassword: false,
        newPassword: "",
        createAdminUser: false,
        adminName: "",
        adminEmail: "",
        adminPhone: "",
        adminPassword: "",
      });
    } else if (!dealership && open) {
      // Reset to empty values for new dealership
      form.reset({
        name: "",
        oemIds: [],
        adminOemId: "",
        contactPersonName: "",
        contactEmail: "",
        contactPhone: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        createUser: false,
        userName: "",
        userEmail: "",
        userPhone: "",
        userPassword: "",
        resetPassword: false,
        newPassword: "",
        createAdminUser: false,
        adminName: "",
        adminEmail: "",
        adminPhone: "",
        adminPassword: "",
      });
    }
  }, [dealership, open, form]);

  // Fetch OEMs
  const { data: oems = [] } = useQuery({
    queryKey: ["/api/oems"],
    queryFn: async () => {
      const response = await fetch('/api/oems', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch OEMs');
      return response.json();
    },
    enabled: open,
  });

  // Check if dealership has admin user when editing
  const { data: dealershipUsers = [] } = useQuery({
    queryKey: ["/api/users", { dealershipId: dealership?.id }],
    queryFn: async () => {
      const response = await fetch(`/api/users?dealershipId=${dealership.id}&role=DEALERSHIP_ADMIN`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealership users');
      return response.json();
    },
    enabled: open && isEditing && !!dealership?.id,
  });

  // Update hasAdminUser state when dealership users data changes
  useEffect(() => {
    if (isEditing && dealershipUsers) {
      setHasAdminUser(dealershipUsers.length > 0);
    }
  }, [isEditing, dealershipUsers]);

  const onSubmit = async (data: DealershipFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/dealerships/${dealership.id}` : "/api/dealerships";
      const method = isEditing ? "PUT" : "POST";
      
      // Prepare billToAddress object
      const billToAddress = (data.billToAddressLine1 || data.billToCity || data.billToState || data.billToPincode || data.billToGstin) ? {
        addressLine1: data.billToAddressLine1 || "",
        city: data.billToCity || "",
        state: data.billToState || "",
        pincode: data.billToPincode || "",
        gstin: data.billToGstin || ""
      } : null;

      // Prepare request body with admin user data if creating user or password reset data
      const requestBody = {
        ...data,
        billToAddress,
        ...(data.createUser && !isEditing ? {
          adminUserData: {
            name: data.userName,
            email: data.userEmail,
            phone: data.userPhone,
            password: data.userPassword
          }
        } : {}),
        ...(data.resetPassword && isEditing ? {
          resetPasswordData: {
            newPassword: data.newPassword
          }
        } : {}),
        ...(data.createAdminUser && isEditing ? {
          createAdminUserData: {
            name: data.adminName,
            email: data.adminEmail,
            phone: data.adminPhone,
            password: data.adminPassword
          }
        } : {})
      };

      // Remove user fields from the main request body but keep createAdminUserData and resetPasswordData
      const { userName, userEmail, userPhone, userPassword, resetPassword, newPassword, createAdminUser, adminName, adminEmail, adminPhone, adminPassword, billToAddressLine1, billToCity, billToState, billToPincode, billToGstin, ...dealershipData } = requestBody;
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(isEditing ? requestBody : dealershipData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} dealership`);
      }

      toast({
        title: "Success",
        description: `Dealership ${isEditing ? 'updated' : 'created'} successfully`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving dealership:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} dealership`,
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
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Dealership</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealership Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter dealership name"
                          {...field}
                          data-testid="input-dealership-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="oemIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OEMs (Select multiple)</FormLabel>
                      <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                        {oems?.map((oem: any) => (
                          <div key={oem.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value?.includes(oem.id)}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, oem.id]);
                                } else {
                                  field.onChange(currentValue.filter((id: string) => id !== oem.id));
                                }
                              }}
                              data-testid={`checkbox-oem-${oem.id}`}
                            />
                            <label className="text-sm cursor-pointer" onClick={() => {
                              const currentValue = field.value || [];
                              const isChecked = currentValue.includes(oem.id);
                              if (isChecked) {
                                field.onChange(currentValue.filter((id: string) => id !== oem.id));
                              } else {
                                field.onChange([...currentValue, oem.id]);
                              }
                            }}>
                              {oem.name}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              
              <FormField
                control={form.control}
                name="contactPersonName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter contact person name"
                        {...field}
                        data-testid="input-contact-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter contact email"
                          {...field}
                          data-testid="input-contact-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter contact phone"
                          {...field}
                          data-testid="input-contact-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address Information</h3>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter full address"
                        {...field}
                        data-testid="textarea-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter city"
                          {...field}
                          data-testid="input-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter state"
                          {...field}
                          data-testid="input-state"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter pincode"
                          {...field}
                          data-testid="input-pincode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Admin User Creation Section - Only show when creating new dealership */}
            {!isEditing && (
              <div className="space-y-4 border-t pt-4">
                <FormField
                  control={form.control}
                  name="createUser"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-create-admin"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Create Dealership Admin User
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Create an admin user account for this dealership
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("createUser") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                    <FormField
                      control={form.control}
                      name="userName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter admin name"
                              {...field}
                              data-testid="input-admin-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="userEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter admin email"
                              {...field}
                              data-testid="input-admin-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="userPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter admin phone"
                              {...field}
                              data-testid="input-admin-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="userPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter password (min 6 chars)"
                              {...field}
                              data-testid="input-admin-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {/* User Management Section - Only show when editing dealership */}
            {isEditing && (
              <div className="space-y-4 border-t pt-4">
                {hasAdminUser ? (
                  // Show password reset option if admin user exists
                  <>
                    {/* Display current admin user details */}
                    {dealershipUsers && dealershipUsers.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                        <h4 className="font-medium text-sm mb-2">Current Dealership Admin:</h4>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <p><span className="font-medium">Name:</span> {dealershipUsers[0].name}</p>
                          <p><span className="font-medium">Email:</span> {dealershipUsers[0].email}</p>
                          {dealershipUsers[0].phone && (
                            <p><span className="font-medium">Phone:</span> {dealershipUsers[0].phone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="resetPassword"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-reset-password"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Reset Dealership Admin Password
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Reset the password for the dealership admin user
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch("resetPassword") && (
                      <div className="pl-7">
                        <FormField
                          control={form.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Enter new password (min 6 chars)"
                                  {...field}
                                  data-testid="input-new-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  // Show create admin user option if no admin user exists
                  <>
                    <FormField
                      control={form.control}
                      name="createAdminUser"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-create-admin-user"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Create Dealership Admin User
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Create an admin user account for this dealership
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch("createAdminUser") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                        <FormField
                          control={form.control}
                          name="adminName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Admin Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter admin name"
                                  {...field}
                                  data-testid="input-admin-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="adminEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Admin Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="Enter admin email"
                                  {...field}
                                  data-testid="input-admin-email"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="adminPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Admin Phone</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter admin phone"
                                  {...field}
                                  data-testid="input-admin-phone"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="adminPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Admin Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Enter password (min 6 chars)"
                                  {...field}
                                  data-testid="input-admin-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-save-dealership"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} Dealership`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}