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
  oemId: z.string().min(1, "OEM is required"),
  contactPersonName: z.string().min(1, "Contact person name is required"),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  contactPhone: z.string().min(1, "Contact phone is required"),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  
  // Admin user creation fields
  createUser: z.boolean().default(false),
  userName: z.string().optional(),
  userEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  userPhone: z.string().optional(),
  userPassword: z.string().optional(),
}).refine((data) => {
  if (data.createUser) {
    return data.userName && data.userName.length > 0 && 
           data.userEmail && data.userEmail.length > 0 &&
           data.userPassword && data.userPassword.length >= 6;
  }
  return true;
}, {
  message: "When creating a user, name, email, and password (min 6 chars) are required",
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
  const isEditing = !!dealership;

  const form = useForm<DealershipFormData>({
    resolver: zodResolver(dealershipSchema),
    defaultValues: {
      name: dealership?.name || "",
      oemId: dealership?.oemId || "",
      contactPersonName: dealership?.contactPersonName || "",
      contactEmail: dealership?.contactEmail || "",
      contactPhone: dealership?.contactPhone || "",
      address: dealership?.address || "",
      city: dealership?.city || "",
      state: dealership?.state || "",
      pincode: dealership?.pincode || "",
      createUser: false,
      userName: "",
      userEmail: "",
      userPhone: "",
      userPassword: "",
    },
  });

  // Reset form when dealership data changes (for editing)
  useEffect(() => {
    if (dealership) {
      form.reset({
        name: dealership.name || "",
        oemId: dealership.oemId || "",
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
      });
    } else {
      // Reset to empty values for new dealership
      form.reset({
        name: "",
        oemId: "",
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

  const onSubmit = async (data: DealershipFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/dealerships/${dealership.id}` : "/api/dealerships";
      const method = isEditing ? "PUT" : "POST";
      
      // Prepare request body with admin user data if creating user
      const requestBody = {
        ...data,
        ...(data.createUser && !isEditing ? {
          adminUserData: {
            name: data.userName,
            email: data.userEmail,
            phone: data.userPhone,
            password: data.userPassword
          }
        } : {})
      };

      // Remove user fields from the main request body
      const { userName, userEmail, userPhone, userPassword, ...dealershipData } = requestBody;
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(isEditing ? data : dealershipData),
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
                  name="oemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OEM</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select OEM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {oems?.map((oem: any) => (
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