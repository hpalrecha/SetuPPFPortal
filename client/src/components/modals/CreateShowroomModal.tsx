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
import { Switch } from "@/components/ui/switch";

const showroomSchema = z.object({
  name: z.string().min(1, "Showroom name is required"),
  dealershipId: z.string().min(1, "Dealership is required"),
  oemId: z.string().min(1, "OEM is required"),
  managerName: z.string().min(1, "Manager name is required"),
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
  
  // Ship To Address fields
  shipToAddressLine1: z.string().optional(),
  shipToCity: z.string().optional(),
  shipToState: z.string().optional(),
  shipToPincode: z.string().optional(),
  shipToGstin: z.string().optional(),
  
  // Billing configuration
  billDirectlyToShowroom: z.boolean().default(false),
  
  // Admin user creation fields
  createUser: z.boolean().default(false),
  userName: z.string().optional(),
  userEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  userPhone: z.string().optional(),
  userPassword: z.string().optional(),
  
  // Password reset fields for editing
  resetPassword: z.boolean().default(false),
  newPassword: z.string().optional(),
}).refine((data) => {
  if (data.createUser) {
    return data.userName && data.userName.length > 0 && 
           data.userEmail && data.userEmail.length > 0 &&
           data.userPassword && data.userPassword.length >= 6;
  }
  if (data.resetPassword) {
    return data.newPassword && data.newPassword.length >= 6;
  }
  return true;
}, {
  message: "When creating a user, name, email, and password (min 6 chars) are required. When resetting password, new password (min 6 chars) is required",
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
  const [billToSameAsShowroom, setBillToSameAsShowroom] = useState(false);
  const [shipToSameAsBillTo, setShipToSameAsBillTo] = useState(false);
  const isEditing = !!showroom;

  const form = useForm<ShowroomFormData>({
    resolver: zodResolver(showroomSchema),
    defaultValues: {
      name: showroom?.name || "",
      dealershipId: showroom?.dealershipId || "",
      oemId: showroom?.oemId || "",
      managerName: showroom?.managerName || "",
      contactEmail: showroom?.contactEmail || "",
      contactPhone: showroom?.contactPhone || "",
      address: showroom?.address || "",
      city: showroom?.city || "",
      state: showroom?.state || "",
      pincode: showroom?.pincode || "",
      billToAddressLine1: showroom?.billToAddress?.addressLine1 || "",
      billToCity: showroom?.billToAddress?.city || "",
      billToState: showroom?.billToAddress?.state || "",
      billToPincode: showroom?.billToAddress?.pincode || "",
      billToGstin: showroom?.billToAddress?.gstin || "",
      shipToAddressLine1: showroom?.shipToAddress?.addressLine1 || "",
      shipToCity: showroom?.shipToAddress?.city || "",
      shipToState: showroom?.shipToAddress?.state || "",
      shipToPincode: showroom?.shipToAddress?.pincode || "",
      shipToGstin: showroom?.shipToAddress?.gstin || "",
      billDirectlyToShowroom: showroom?.billDirectlyToShowroom || false,
      createUser: false,
      userName: "",
      userEmail: "",
      userPhone: "",
      userPassword: "",
      resetPassword: false,
      newPassword: "",
    },
  });
  
  // Watch dealershipId to fetch available OEMs for that dealership
  const selectedDealershipId = form.watch("dealershipId");

  // Query for existing showroom manager (for edit mode)
  const { data: showroomUsers } = useQuery({
    queryKey: ['/api/users', { showroomId: showroom?.id, role: 'SHOWROOM_MANAGER' }],
    enabled: isEditing && !!showroom?.id,
    queryFn: () => fetch(`/api/users?showroomId=${showroom?.id}&role=SHOWROOM_MANAGER`).then(res => res.json())
  });

  // Reset form when showroom data changes (for editing)
  useEffect(() => {
    if (showroom && open) {
      form.reset({
        name: showroom.name || "",
        dealershipId: showroom.dealershipId || "",
        oemId: showroom.oemId || "",
        managerName: showroom.managerName || "",
        contactEmail: showroom.contactEmail || "",
        contactPhone: showroom.contactPhone || "",
        address: showroom.address || "",
        city: showroom.city || "",
        state: showroom.state || "",
        pincode: showroom.pincode || "",
        createUser: false,
        userName: "",
        userEmail: "",
        userPhone: "",
        userPassword: "",
        resetPassword: false,
        newPassword: "",
      });
    } else if (!showroom && open) {
      // Reset to empty values for new showroom
      form.reset({
        name: "",
        dealershipId: "",
        oemId: "",
        managerName: "",
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
      });
    }
  }, [showroom, open, form]);

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
  
  // Fetch all OEMs to display names
  const { data: allOems = [] } = useQuery({
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
  
  // Get available OEMs for the selected dealership
  const selectedDealership = dealerships.find((d: any) => d.id === selectedDealershipId);
  const availableOemIds = selectedDealership?.oemIds || [];
  const availableOems = allOems.filter((oem: any) => availableOemIds.includes(oem.id));

  const onSubmit = async (data: ShowroomFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/showrooms/${showroom.id}` : "/api/showrooms";
      const method = isEditing ? "PUT" : "POST";
      
      // Prepare billToAddress and shipToAddress objects
      const billToAddress = (data.billToAddressLine1 || data.billToCity || data.billToState || data.billToPincode || data.billToGstin) ? {
        addressLine1: data.billToAddressLine1 || "",
        city: data.billToCity || "",
        state: data.billToState || "",
        pincode: data.billToPincode || "",
        gstin: data.billToGstin || ""
      } : null;

      const shipToAddress = (data.shipToAddressLine1 || data.shipToCity || data.shipToState || data.shipToPincode || data.shipToGstin) ? {
        addressLine1: data.shipToAddressLine1 || "",
        city: data.shipToCity || "",
        state: data.shipToState || "",
        pincode: data.shipToPincode || "",
        gstin: data.shipToGstin || ""
      } : null;

      // Prepare request body with admin user data if creating user or password reset data
      const requestBody = {
        ...data,
        billToAddress,
        shipToAddress,
        ...(data.createUser && (!isEditing || !showroomUsers || showroomUsers.length === 0) ? {
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
        } : {})
      };

      // Remove user fields from the main request body
      const { userName, userEmail, userPhone, userPassword, resetPassword, newPassword, billToAddressLine1, billToCity, billToState, billToPincode, billToGstin, shipToAddressLine1, shipToCity, shipToState, shipToPincode, shipToGstin, ...showroomData } = requestBody;
      
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
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        // Reset OEM selection when dealership changes
                        form.setValue("oemId", "");
                      }} value={field.value}>
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
              
              {/* OEM Selection - Only show OEMs from selected dealership */}
              {selectedDealershipId && (
                <div className="mt-4">
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
                            {availableOems.length > 0 ? (
                              availableOems.map((oem: any) => (
                                <SelectItem key={oem.id} value={oem.id}>
                                  {oem.name}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-sm text-muted-foreground">
                                No OEMs available for this dealership
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Billing Configuration Toggle */}
              <div className="mt-4">
                <FormField
                  control={form.control}
                  name="billDirectlyToShowroom"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Bill Jobs Directly to Showroom
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          When enabled, all Job Cards from this showroom will be billed directly to the showroom instead of following the dealership/OEM hierarchy.
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-bill-to-showroom"
                        />
                      </FormControl>
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

            {/* Bill To Address Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Bill To Address</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bill-to-same"
                    checked={billToSameAsShowroom}
                    onCheckedChange={(checked) => {
                      setBillToSameAsShowroom(checked as boolean);
                      if (checked) {
                        form.setValue('billToAddressLine1', form.getValues('address'));
                        form.setValue('billToCity', form.getValues('city'));
                        form.setValue('billToState', form.getValues('state'));
                        form.setValue('billToPincode', form.getValues('pincode'));
                      }
                    }}
                    data-testid="checkbox-bill-to-same"
                  />
                  <label htmlFor="bill-to-same" className="text-sm font-medium cursor-pointer select-none">
                    Same as Showroom Address
                  </label>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="billToAddressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter billing address"
                        {...field}
                        disabled={billToSameAsShowroom}
                        data-testid="input-bill-to-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="billToCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="City"
                          {...field}
                          disabled={billToSameAsShowroom}
                          data-testid="input-bill-to-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billToState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="State"
                          {...field}
                          disabled={billToSameAsShowroom}
                          data-testid="input-bill-to-state"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billToPincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Pincode"
                          {...field}
                          disabled={billToSameAsShowroom}
                          data-testid="input-bill-to-pincode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="billToGstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (GST Number)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter GST number"
                        {...field}
                        data-testid="input-bill-to-gstin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Ship To Address Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Ship To Address</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ship-to-same"
                    checked={shipToSameAsBillTo}
                    onCheckedChange={(checked) => {
                      setShipToSameAsBillTo(checked as boolean);
                      if (checked) {
                        form.setValue('shipToAddressLine1', form.getValues('billToAddressLine1'));
                        form.setValue('shipToCity', form.getValues('billToCity'));
                        form.setValue('shipToState', form.getValues('billToState'));
                        form.setValue('shipToPincode', form.getValues('billToPincode'));
                        form.setValue('shipToGstin', form.getValues('billToGstin'));
                      }
                    }}
                    data-testid="checkbox-ship-to-same"
                  />
                  <label htmlFor="ship-to-same" className="text-sm font-medium cursor-pointer select-none">
                    Same as Bill To
                  </label>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="shipToAddressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter shipping address"
                        {...field}
                        disabled={shipToSameAsBillTo}
                        data-testid="input-ship-to-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="shipToCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="City"
                          {...field}
                          disabled={shipToSameAsBillTo}
                          data-testid="input-ship-to-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shipToState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="State"
                          {...field}
                          disabled={shipToSameAsBillTo}
                          data-testid="input-ship-to-state"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shipToPincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Pincode"
                          {...field}
                          disabled={shipToSameAsBillTo}
                          data-testid="input-ship-to-pincode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="shipToGstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (GST Number)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter GST number"
                        {...field}
                        disabled={shipToSameAsBillTo}
                        data-testid="input-ship-to-gstin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

            {/* User Management Section - Only show when editing showroom */}
            {isEditing && (
              <div className="space-y-4 border-t pt-4">
                {showroomUsers && showroomUsers.length > 0 ? (
                  // Show password reset option if admin user exists
                  <>
                    {/* Display current admin user details */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                      <h4 className="font-medium text-sm mb-2">Current Showroom Manager:</h4>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p><span className="font-medium">Name:</span> {showroomUsers[0].name}</p>
                        <p><span className="font-medium">Email:</span> {showroomUsers[0].email}</p>
                        {showroomUsers[0].phone && (
                          <p><span className="font-medium">Phone:</span> {showroomUsers[0].phone}</p>
                        )}
                      </div>
                    </div>

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
                              Reset Showroom Manager Password
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Reset the password for the showroom manager user
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
                      name="createUser"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-create-user"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Create Showroom Manager User
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Create a new user account for this showroom's manager
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch("createUser") && (
                      <div className="pl-7 space-y-4">
                        <FormField
                          control={form.control}
                          name="userName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Manager Name *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter manager's full name"
                                  {...field}
                                  data-testid="input-user-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="userEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Manager Email *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder="Enter email address"
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
                                <FormLabel>Manager Phone</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter phone number"
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
                              <FormLabel>Manager Password *</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Enter password (min 6 chars)"
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