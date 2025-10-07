import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api";

const partnerSchema = z.object({
  displayName: z.string().min(1, "Partner name is required"),
  type: z.enum(["STUDIO", "INSTALLER"], {
    required_error: "Partner type is required",
  }),
  contactPersonName: z.string().min(1, "Contact person name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  active: z.boolean(),
  canViewJobCardPrice: z.boolean().optional(),
  serviceCategoryIds: z.array(z.string()).optional(),
  brandIds: z.array(z.string()).optional(),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface EditPartnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  partner?: any;
}

export function EditPartnerModal({
  open,
  onOpenChange,
  onSuccess,
  partner,
}: EditPartnerModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!partner;

  // Fetch service categories
  const { data: serviceCategories = [] } = useQuery<any[]>({
    queryKey: ['/api/service-categories'],
    enabled: open,
  });

  // Fetch brands
  const { data: brands = [] } = useQuery<any[]>({
    queryKey: ['/api/p91/brand'],
    enabled: open,
  });

  // Fetch partner service categories when editing
  const { data: partnerCategories } = useQuery<{ serviceCategoryIds: string[]; brandIds?: string[] }>({
    queryKey: ['/api/partners', partner?.id, 'service-categories'],
    enabled: open && isEditing && !!partner?.id,
  });

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      displayName: "",
      type: "INSTALLER",
      contactPersonName: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      active: true,
      canViewJobCardPrice: false,
      serviceCategoryIds: [],
      brandIds: [],
    },
  });

  // Update form when partner prop or categories change
  useEffect(() => {
    if (partner && open) {
      // For editing: only reset the form when partnerCategories is loaded
      if (partnerCategories !== undefined) {
        form.reset({
          displayName: partner.displayName || "",
          type: partner.type || "INSTALLER",
          contactPersonName: partner.contactPersonName || "",
          phone: partner.phone || "",
          email: partner.email || "",
          address: partner.address || "",
          city: partner.city || "",
          state: partner.state || "",
          pincode: partner.pincode || "",
          active: partner.active ?? true,
          canViewJobCardPrice: partner.canViewJobCardPrice ?? false,
          serviceCategoryIds: partnerCategories.serviceCategoryIds || [],
          brandIds: partnerCategories.brandIds || [],
        });
      }
    } else if (!partner && open) {
      form.reset({
        displayName: "",
        type: "INSTALLER",
        contactPersonName: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        active: true,
        canViewJobCardPrice: false,
        serviceCategoryIds: [],
        brandIds: [],
      });
    }
  }, [partner, open, form, partnerCategories]);

  const onSubmit = async (data: PartnerFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/partners/${partner.id}` : "/api/partners";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} partner`);
      }

      toast({
        title: "Success",
        description: `Partner ${isEditing ? 'updated' : 'created'} successfully`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error saving partner:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} partner`,
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
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Partner</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partner Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter partner name"
                          {...field}
                          data-testid="input-partner-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partner Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          <SelectItem 
                            value="INSTALLER"
                            className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Installer
                          </SelectItem>
                          <SelectItem 
                            value="STUDIO"
                            className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Studio
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter phone number"
                          {...field}
                          data-testid="input-phone"
                        />
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
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email address"
                          {...field}
                          data-testid="input-email"
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

            {/* Service Categories */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Service Categories</h3>
              <p className="text-sm text-muted-foreground">
                Select the service categories this partner can handle
              </p>
              
              <FormField
                control={form.control}
                name="serviceCategoryIds"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {serviceCategories.map((category: any) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category.id}`}
                            checked={field.value?.includes(category.id) || false}
                            onCheckedChange={(checked) => {
                              const currentValues = field.value || [];
                              if (checked) {
                                field.onChange([...currentValues, category.id]);
                              } else {
                                field.onChange(currentValues.filter((id: string) => id !== category.id));
                              }
                            }}
                            data-testid={`checkbox-category-${category.code}`}
                          />
                          <label
                            htmlFor={`category-${category.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {category.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Brands */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Product Brands</h3>
              <p className="text-sm text-muted-foreground">
                Select the brands this partner deals with
              </p>
              
              <FormField
                control={form.control}
                name="brandIds"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {brands.map((brand: any) => (
                        <div key={brand.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand.id}`}
                            checked={field.value?.includes(brand.id) || false}
                            onCheckedChange={(checked) => {
                              const currentValues = field.value || [];
                              if (checked) {
                                field.onChange([...currentValues, brand.id]);
                              } else {
                                field.onChange(currentValues.filter((id: string) => id !== brand.id));
                              }
                            }}
                            data-testid={`checkbox-brand-${brand.id}`}
                          />
                          <label
                            htmlFor={`brand-${brand.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {brand.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status and Permissions */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Partner is currently active and can receive assignments
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Price Visibility Control - Only for STUDIO (Detailer) type */}
              {form.watch("type") === "STUDIO" && (
                <FormField
                  control={form.control}
                  name="canViewJobCardPrice"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-blue-50 dark:bg-blue-950">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Allow Job Card Price Visibility</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          When enabled, this Detailer can view Job Card prices. Installers never see prices.
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                          data-testid="switch-can-view-price"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

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
                data-testid="button-save-partner"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Add'} Partner`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}