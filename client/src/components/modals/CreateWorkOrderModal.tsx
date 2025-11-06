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
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/hooks/use-auth";
import { ApiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Building, Store, Users } from "lucide-react";

const workOrderSchema = z.object({
  // Organization fields (for Super Admin)
  oemId: z.string().optional(),
  dealershipId: z.string().optional(), 
  showroomId: z.string().optional(),
  
  // Vehicle Information
  vehicleBrandId: z.string().min(1, "Vehicle brand is required"),
  vehicleModelId: z.string().min(1, "Vehicle model is required"),
  variant: z.string().optional(),
  regNo: z.string().optional(),
  
  // Service Information
  serviceId: z.string().min(1, "Service is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  salesPersonId: z.string().optional(),
  
  // Customer Information
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  customerAddress: z.string().optional(),
  notes: z.string().optional(),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

interface CreateWorkOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateWorkOrderModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkOrderModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isDealershipAdmin = user?.role === 'DEALERSHIP_ADMIN';

  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      quantity: 1,
      vehicleBrandId: "",
      vehicleModelId: "",
      serviceId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      oemId: "",
      dealershipId: "",
      showroomId: "",
    },
  });

  // Fetch OEMs for Super Admin
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
    enabled: isSuperAdmin,
    staleTime: 300000, // Cache for 5 minutes - OEMs rarely change
  });

  // Watch OEM selection to fetch dealerships
  const selectedOemId = form.watch("oemId");
  const { data: dealershipData } = useQuery<{ dealerships: any[]; total: number }>({
    queryKey: ["/api/dealerships", selectedOemId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships?oemId=${selectedOemId}&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: isSuperAdmin && !!selectedOemId,
    staleTime: 300000, // Cache for 5 minutes - dealerships rarely change
  });
  const dealerships = dealershipData?.dealerships || [];

  // Watch dealership selection to fetch showrooms  
  const selectedDealershipId = form.watch("dealershipId");
  const { data: showroomData } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms", selectedDealershipId, selectedOemId],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms?dealershipId=${selectedDealershipId}&oemId=${selectedOemId}&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: isSuperAdmin && !!selectedDealershipId && !!selectedOemId,
    staleTime: 300000, // Cache for 5 minutes - showrooms rarely change
  });
  const showrooms = showroomData?.showrooms || [];

  // Fetch showrooms for DEALERSHIP_ADMIN users
  const { data: dealershipShowroomData } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms", user?.dealershipId, user?.oemId],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms?dealershipId=${user?.dealershipId}&oemId=${user?.oemId}&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: isDealershipAdmin && !!user?.dealershipId && !!user?.oemId,
    staleTime: 300000, // Cache for 5 minutes - showrooms rarely change
  });
  const dealershipShowrooms = dealershipShowroomData?.showrooms || [];

  // Get the OEM ID for vehicle data fetching
  const finalOemId = isSuperAdmin ? selectedOemId : user?.oemId;
  
  // Fetch vehicle data (brands and models) based on OEM
  const { data: vehicleData = [] } = useQuery({
    queryKey: ["/api/vehicle-data", finalOemId],
    queryFn: async () => {
      const response = await fetch(`/api/vehicle-data/${finalOemId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch vehicle data');
      return response.json();
    },
    enabled: !!finalOemId,
    staleTime: 300000, // Cache for 5 minutes - vehicle data rarely changes
  });

  // Extract vehicle brands from vehicle data
  const vehicleBrands = vehicleData?.map((brand: any) => ({
    id: brand.id,
    name: brand.name
  })) || [];

  const selectedBrandId = form.watch("vehicleBrandId");
  // Extract vehicle models based on selected brand
  const vehicleModels = selectedBrandId ? 
    (vehicleData?.find((brand: any) => brand.id === selectedBrandId)?.models || []) : [];

  // Fetch services filtered by OEM context
  const { data: services = [] } = useQuery({
    queryKey: ["/api/services", finalOemId],
    queryFn: async () => {
      const url = finalOemId ? `/api/services?oemId=${finalOemId}` : '/api/services';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch services');
      return response.json();
    },
    enabled: !!finalOemId,
    staleTime: 300000, // Cache for 5 minutes - services rarely change
  });

  // Fetch sales persons based on selected showroom
  const finalShowroomId = isSuperAdmin ? form.watch("showroomId") : user?.showroomId;
  const { data: salesPersons = [] } = useQuery({
    queryKey: ["/api/sales-persons", finalShowroomId],
    queryFn: async () => {
      const url = finalShowroomId ? `/api/sales-persons?showroomId=${finalShowroomId}` : '/api/sales-persons';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch sales persons');
      return response.json();
    },
    enabled: !!finalShowroomId,
    staleTime: 300000, // Cache for 5 minutes - sales persons rarely change
  });

  const onSubmit = async (data: WorkOrderFormData) => {
    // For Super Admin, use selected values; for others, use user context
    let workOrderData;
    
    if (isSuperAdmin) {
      if (!data.oemId || !data.dealershipId || !data.showroomId) {
        toast({
          title: "Error", 
          description: "Please select OEM, Dealership, and Showroom",
          variant: "destructive",
        });
        return;
      }
      workOrderData = {
        ...data,
        oemId: data.oemId,
        dealershipId: data.dealershipId, 
        showroomId: data.showroomId,
      };
    } else if (isDealershipAdmin) {
      // DEALERSHIP_ADMIN: Must select showroom from their dealership
      if (!data.showroomId) {
        toast({
          title: "Error",
          description: "Please select a showroom",
          variant: "destructive",
        });
        return;
      }
      workOrderData = {
        ...data,
        oemId: user!.oemId,
        dealershipId: user!.dealershipId,
        showroomId: data.showroomId,
      };
    } else {
      // SHOWROOM_MANAGER and SALES_PERSON: Use their showroom
      if (!user?.showroomId || !user?.dealershipId || !user?.oemId) {
        toast({
          title: "Error",
          description: "User context missing",
          variant: "destructive",
        });
        return;
      }
      workOrderData = {
        ...data,
        oemId: user.oemId,
        dealershipId: user.dealershipId,
        showroomId: user.showroomId,
      };
    }

    setIsLoading(true);
    try {
      const response = await ApiClient.post("/api/work-orders", workOrderData);

      toast({
        title: "Success",
        description: "Work order created successfully and job card assigned to partner",
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error creating work order:", error);
      toast({
        title: "Error",
        description: "Failed to create work order",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-responsive max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Showroom Selection (Dealership Admin Only) */}
            {isDealershipAdmin && (
              <div className="space-y-4 p-4 border border-green-200 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 mb-4">
                  <Store className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-medium text-green-800">Select Showroom</h3>
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700">Required</Badge>
                </div>
                
                <FormField
                  control={form.control}
                  name="showroomId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-green-700">Showroom</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        data-testid="select-dealership-showroom"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select showroom for this work order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealershipShowrooms?.map((showroom: any) => (
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
              </div>
            )}

            {/* Organization Selection (Super Admin Only) */}
            {isSuperAdmin && (
              <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-medium text-blue-800">Organization Selection</h3>
                  <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">Admin Only</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="oemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-700">OEM</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("dealershipId", "");
                            form.setValue("showroomId", "");
                            form.setValue("vehicleBrandId", "");
                            form.setValue("vehicleModelId", "");
                          }}
                          value={field.value}
                          data-testid="select-oem"
                        >
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

                  <FormField
                    control={form.control}
                    name="dealershipId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-700">Dealership</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("showroomId", "");
                          }}
                          value={field.value}
                          disabled={!selectedOemId}
                          data-testid="select-dealership"
                        >
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

                  <FormField
                    control={form.control}
                    name="showroomId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-700">Showroom</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedDealershipId}
                          data-testid="select-showroom"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Showroom" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {showrooms?.map((showroom: any) => (
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
                </div>
              </div>
            )}

            {/* Vehicle Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Vehicle Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vehicleBrandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Brand</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("vehicleModelId", ""); // Reset model when brand changes
                        }}
                        value={field.value}
                        data-testid="select-vehicle-brand"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicleBrands?.map((brand: any) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleModelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedBrandId}
                        data-testid="select-vehicle-model"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicleModels?.map((model: any) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.modelName || model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="variant"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variant (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter variant"
                          {...field}
                          data-testid="input-variant"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="regNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number / VIN Number (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter registration or VIN number"
                          {...field}
                          data-testid="input-reg-no"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Service Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Service Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        data-testid="select-service"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {services?.map((service: any) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          data-testid="input-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="salesPersonId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Person (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-sales-person"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sales person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salesPersons?.map((person: any) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Customer Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter customer name"
                          {...field}
                          data-testid="input-customer-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter phone number"
                          {...field}
                          data-testid="input-customer-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        {...field}
                        data-testid="input-customer-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter customer address"
                        {...field}
                        data-testid="textarea-customer-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes"
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row space-y-2 sm:space-y-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                data-testid="button-cancel"
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-create-work-order"
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {isLoading ? "Creating..." : "Create Work Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
