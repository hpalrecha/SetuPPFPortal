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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const oemSchema = z.object({
  name: z.string().min(1, "OEM name is required"),
  brandCode: z.string().min(1, "Brand code is required"),
  description: z.string().optional(),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  
  // User creation fields
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

type OEMFormData = z.infer<typeof oemSchema>;

interface CreateOEMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  oem?: any;
}

export function CreateOEMModal({
  open,
  onOpenChange,
  onSuccess,
  oem,
}: CreateOEMModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!oem;

  const form = useForm<OEMFormData>({
    resolver: zodResolver(oemSchema),
    defaultValues: {
      name: oem?.name || "",
      brandCode: oem?.brandCode || "",
      description: oem?.description || "",
      contactEmail: oem?.contactEmail || "",
      contactPhone: oem?.contactPhone || "",
      address: oem?.address || "",
      createUser: false,
      userName: "",
      userEmail: "",
      userPhone: "",
      userPassword: "",
    },
  });

  const onSubmit = async (data: OEMFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/oems/${oem.id}` : "/api/oems";
      const method = isEditing ? "PUT" : "POST";
      
      // Prepare OEM data (exclude user creation fields)
      const oemData = {
        name: data.name,
        brandCode: data.brandCode,
        description: data.description,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
      };
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(oemData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} OEM`);
      }

      const createdOem = await response.json();
      
      // Create user if requested and we're creating a new OEM
      if (data.createUser && !isEditing && createdOem.id) {
        const userData = {
          name: data.userName,
          email: data.userEmail,
          phone: data.userPhone,
          password: data.userPassword,
          role: "OEM_ADMIN",
          oemId: createdOem.id,
        };
        
        const userResponse = await fetch("/api/users", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
          body: JSON.stringify(userData),
        });
        
        if (!userResponse.ok) {
          console.warn("OEM created but failed to create user");
        }
      }

      toast({
        title: "Success",
        description: `OEM ${isEditing ? 'updated' : 'created'} successfully${data.createUser && !isEditing ? ' with admin user' : ''}`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving OEM:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} OEM`,
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
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} OEM</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OEM Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter OEM name"
                        {...field}
                        data-testid="input-oem-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter brand code (e.g., HYD, TAT)"
                        {...field}
                        data-testid="input-brand-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter OEM description"
                      {...field}
                      data-testid="textarea-description"
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
                    <FormLabel>Contact Phone (Optional)</FormLabel>
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

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter OEM address"
                      {...field}
                      data-testid="textarea-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <>
                <Separator className="my-6" />
                
                <FormField
                  control={form.control}
                  name="createUser"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-create-user"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          Create OEM Admin User
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Create an admin user account for this OEM
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("createUser") && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                    <h4 className="text-sm font-medium">Admin User Details</h4>
                    
                    <FormField
                      control={form.control}
                      name="userName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter admin name"
                              {...field}
                              data-testid="input-user-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="userEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Enter admin email"
                                {...field}
                                data-testid="input-user-email"
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
                            <FormLabel>Phone (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter admin phone"
                                {...field}
                                data-testid="input-user-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="userPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter password (min 6 characters)"
                              {...field}
                              data-testid="input-user-password"
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
                data-testid="button-save-oem"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} OEM`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}