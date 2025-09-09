import { useState } from "react";
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

const showroomSchema = z.object({
  name: z.string().min(1, "Showroom name is required"),
  dealershipId: z.string().min(1, "Dealership is required"),
  managerName: z.string().min(1, "Manager name is required"),
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

type ShowroomFormData = z.infer<typeof showroomSchema>;

interface CreateShowroomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showroom?: any;
}

export function CreateShowroomModal({
  open,
  onOpenChange,
  onSuccess,
  showroom,
}: CreateShowroomModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!showroom;

  const form = useForm<ShowroomFormData>({
    resolver: zodResolver(showroomSchema),
    defaultValues: {
      name: showroom?.name || "",
      dealershipId: showroom?.dealershipId || "",
      managerName: showroom?.managerName || "",
      contactEmail: showroom?.contactEmail || "",
      contactPhone: showroom?.contactPhone || "",
      address: showroom?.address || "",
      city: showroom?.city || "",
      state: showroom?.state || "",
      pincode: showroom?.pincode || "",
      createUser: false,
      userName: "",
      userEmail: "",
      userPhone: "",
      userPassword: "",
    },
  });

  // Fetch dealerships
  const { data: dealerships = [] } = useQuery({
    queryKey: ["/api/dealerships"],
    queryFn: async () => {
      const response = await fetch('/api/dealerships', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: open,
  });

  const onSubmit = async (data: ShowroomFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/showrooms/${showroom.id}` : "/api/showrooms";
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
      const { userName, userEmail, userPhone, userPassword, ...showroomData } = requestBody;
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(isEditing ? data : showroomData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} showroom`);
      }

      toast({
        title: "Success",
        description: `Showroom ${isEditing ? 'updated' : 'created'} successfully`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving showroom:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} showroom`,
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
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Showroom</DialogTitle>
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
                      <FormLabel>Showroom Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter showroom name"
                          {...field}
                          data-testid="input-showroom-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dealershipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealership</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Dealership" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealerships?.map((dealership: any) => (
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
              </div>
            </div>

            {/* Management Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Management Information</h3>
              
              <FormField
                control={form.control}
                name="managerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter showroom manager name"
                        {...field}
                        data-testid="input-manager-name"
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

            {/* Admin User Creation Section - Only show when creating new showroom */}
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
                          Create Showroom Manager User
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Create a manager user account for this showroom
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
                          <FormLabel>Manager Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter manager name"
                              {...field}
                              data-testid="input-manager-name"
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
                          <FormLabel>Manager Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter manager email"
                              {...field}
                              data-testid="input-manager-email"
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
                          <FormLabel>Manager Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter manager phone"
                              {...field}
                              data-testid="input-manager-phone"
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
                          <FormLabel>Manager Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter password (min 6 chars)"
                              {...field}
                              data-testid="input-manager-password"
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
                data-testid="button-save-showroom"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} Showroom`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}