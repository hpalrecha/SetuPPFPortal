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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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
import { ApiClient, apiRequest } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Building, Store, Users, CheckCircle2, Send, FileText, Search } from "lucide-react";
import { useLocation } from "wouter";

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
  workOrderId?: string; // If provided, modal is in edit mode
  initialData?: any; // Pre-filled data for editing
  isLoading?: boolean; // Loading state for fetching initial data
}

export function CreateWorkOrderModal({
  open,
  onOpenChange,
  onSuccess,
  workOrderId,
  initialData,
  isLoading: isLoadingData,
}: CreateWorkOrderModalProps) {
  const isEditMode = !!workOrderId;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdWorkOrder, setCreatedWorkOrder] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dealershipSearch, setDealershipSearch] = useState("");
  const [showroomSearch, setShowroomSearch] = useState("");
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canSelectOrgHierarchy = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isDealershipAdmin = user?.role === 'DEALERSHIP_ADMIN';

  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: isEditMode && initialData ? {
      quantity: initialData.quantity || 1,
      vehicleBrandId: initialData.vehicleBrandId || "",
      vehicleModelId: initialData.vehicleModelId || "",
      serviceId: initialData.serviceId || "",
      variant: initialData.variant || "",
      regNo: initialData.regNo || "",
      customerName: initialData.customerName || "",
      customerPhone: initialData.customerPhone || "",
      customerEmail: initialData.customerEmail || "",
      customerAddress: initialData.customerAddress || "",
      notes: initialData.notes || "",
      oemId: initialData.oemId || "",
      dealershipId: initialData.dealershipId || "",
      showroomId: initialData.showroomId || "",
      salesPersonId: initialData.salesPersonId || "",
    } : {
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

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (isEditMode && initialData && open) {
      form.reset({
        quantity: initialData.quantity || 1,
        vehicleBrandId: initialData.vehicleBrandId || "",
        vehicleModelId: initialData.vehicleModelId || "",
        serviceId: initialData.serviceId || "",
        variant: initialData.variant || "",
        regNo: initialData.regNo || "",
        customerName: initialData.customerName || "",
        customerPhone: initialData.customerPhone || "",
        customerEmail: initialData.customerEmail || "",
        customerAddress: initialData.customerAddress || "",
        notes: initialData.notes || "",
        oemId: initialData.oemId || "",
        dealershipId: initialData.dealershipId || "",
        showroomId: initialData.showroomId || "",
        salesPersonId: initialData.salesPersonId || "",
      });
    }
  }, [isEditMode, initialData, open, form]);

  // Fetch OEMs for Super Admin, Admin, and Manager
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
    enabled: canSelectOrgHierarchy,
    staleTime: 300000, // Cache for 5 minutes - OEMs rarely change
  });

  // Watch OEM selection to fetch dealerships
  const selectedOemId = form.watch("oemId");
  const { data: dealershipData } = useQuery<{ dealerships: any[]; total: number }>({
    queryKey: ["/api/dealerships", selectedOemId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships?oemId=${selectedOemId}&limit=10000`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: canSelectOrgHierarchy && !!selectedOemId,
    staleTime: 300000, // Cache for 5 minutes - dealerships rarely change
  });
  const dealerships = dealershipData?.dealerships || [];

  // Watch dealership selection to fetch showrooms  
  const selectedDealershipId = form.watch("dealershipId");
  const { data: showroomData } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms", selectedDealershipId, selectedOemId],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms?dealershipId=${selectedDealershipId}&oemId=${selectedOemId}&limit=10000`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: canSelectOrgHierarchy && !!selectedDealershipId && !!selectedOemId,
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
  const finalOemId = canSelectOrgHierarchy ? selectedOemId : user?.oemId;
  
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

  const finalDealershipId = canSelectOrgHierarchy ? selectedDealershipId : user?.dealershipId;

  const { data: services = [] } = useQuery({
    queryKey: ["/api/services", finalOemId, finalDealershipId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (finalDealershipId) params.set('dealershipId', finalDealershipId);
      else if (finalOemId) params.set('oemId', finalOemId);
      const url = params.toString() ? `/api/services?${params.toString()}` : '/api/services';
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
    staleTime: 300000,
  });

  // Fetch sales persons based on selected showroom
  const selectedShowroomId = form.watch("showroomId");
  const finalShowroomId = (canSelectOrgHierarchy || isDealershipAdmin) ? selectedShowroomId : user?.showroomId;
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
    // For Super Admin, Admin, Manager, use selected values; for others, use user context
    let workOrderData;
    
    if (canSelectOrgHierarchy) {
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
      if (isEditMode) {
        // Update existing work order
        await apiRequest('PUT', `/api/work-orders/${workOrderId}`, workOrderData);
        
        toast({
          title: "Success",
          description: "Work order updated successfully",
        });
        
        onOpenChange(false);
        onSuccess();
      } else {
        // Create new work order
        const response = await ApiClient.post("/api/work-orders", workOrderData);
        
        // Store the created work order and show success dialog
        setCreatedWorkOrder(response);
        setShowSuccessDialog(true);
        form.reset();
      }
      
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} work order:`, error);
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} work order`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle submitting the draft work order
  const handleSubmitWorkOrder = async () => {
    if (!createdWorkOrder) return;
    
    setIsSubmitting(true);
    try {
      await apiRequest('POST', `/api/work-orders/${createdWorkOrder.id}/submit`);

      toast({
        title: "Success",
        description: "Work order submitted successfully",
      });

      setShowSuccessDialog(false);
      onOpenChange(false);
      setCreatedWorkOrder(null);
      onSuccess();
    } catch (error: any) {
      console.error("Error submitting work order:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit work order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle viewing the draft
  const handleViewDraft = () => {
    setShowSuccessDialog(false);
    onOpenChange(false);
    setCreatedWorkOrder(null);
    onSuccess();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-responsive max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Work Order' : 'Create Work Order'}</DialogTitle>
        </DialogHeader>

        {isLoadingData && isEditMode ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
              <p className="text-sm text-muted-foreground">Loading work order data...</p>
            </div>
          </div>
        ) : (
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
            {canSelectOrgHierarchy && (
              <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-medium text-blue-800">Organization Selection</h3>
                  <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">Required</Badge>
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
                    render={({ field }) => {
                      const filteredDealerships = dealerships?.filter((d: any) => 
                        d.name.toLowerCase().includes(dealershipSearch.toLowerCase())
                      ) || [];
                      
                      return (
                        <FormItem>
                          <FormLabel className="text-blue-700">Dealership</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("showroomId", "");
                              setDealershipSearch("");
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
                              <div className="flex items-center px-3 pb-2 sticky top-0 bg-white border-b">
                                <Search className="h-4 w-4 text-gray-400 mr-2" />
                                <Input
                                  placeholder="Search dealerships..."
                                  value={dealershipSearch}
                                  onChange={(e) => setDealershipSearch(e.target.value)}
                                  className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="max-h-[300px] overflow-auto">
                                {filteredDealerships.length === 0 ? (
                                  <div className="py-6 text-center text-sm text-gray-500">
                                    No dealerships found
                                  </div>
                                ) : (
                                  filteredDealerships.map((dealership: any) => (
                                    <SelectItem key={dealership.id} value={dealership.id}>
                                      {dealership.name}
                                    </SelectItem>
                                  ))
                                )}
                              </div>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="showroomId"
                    render={({ field }) => {
                      const filteredShowrooms = showrooms?.filter((s: any) => 
                        s.name.toLowerCase().includes(showroomSearch.toLowerCase())
                      ) || [];
                      
                      return (
                        <FormItem>
                          <FormLabel className="text-blue-700">Showroom</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowroomSearch("");
                            }}
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
                              <div className="flex items-center px-3 pb-2 sticky top-0 bg-white border-b">
                                <Search className="h-4 w-4 text-gray-400 mr-2" />
                                <Input
                                  placeholder="Search showrooms..."
                                  value={showroomSearch}
                                  onChange={(e) => setShowroomSearch(e.target.value)}
                                  className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="max-h-[300px] overflow-auto">
                                {filteredShowrooms.length === 0 ? (
                                  <div className="py-6 text-center text-sm text-gray-500">
                                    No showrooms found
                                  </div>
                                ) : (
                                  filteredShowrooms.map((showroom: any) => (
                                    <SelectItem key={showroom.id} value={showroom.id}>
                                      {showroom.name}
                                    </SelectItem>
                                  ))
                                )}
                              </div>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
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
        )}
      </DialogContent>
    </Dialog>

    {/* Success Dialog */}
    <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
      <AlertDialogContent data-testid="dialog-work-order-success">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Work Order Created Successfully!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3 pt-2">
            <p className="text-base">
              Your work order has been saved as a <span className="font-semibold text-gray-700">DRAFT</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              You can submit it now to auto-assign to a partner, or view it later to make changes.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleViewDraft}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
            data-testid="button-view-draft"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Draft
          </Button>
          <Button
            onClick={handleSubmitWorkOrder}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            data-testid="button-submit-now"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Now
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
