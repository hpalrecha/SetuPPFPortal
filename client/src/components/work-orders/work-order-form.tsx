import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const workOrderSchema = z.object({
  vehicleBrandId: z.string().min(1, "Vehicle brand is required"),
  vehicleModelId: z.string().min(1, "Vehicle model is required"),
  variant: z.string().optional(),
  regNo: z.string().optional(),
  serviceId: z.string().min(1, "Service is required"),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  salesPersonId: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerAddress: z.string().optional(),
  notes: z.string().optional()
});

type WorkOrderForm = z.infer<typeof workOrderSchema>;

interface WorkOrderFormProps {
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
}

export default function WorkOrderForm({ onSubmit, onCancel }: WorkOrderFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      quantity: 1
    }
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: WorkOrderForm) => {
      const response = await apiRequest("POST", "/api/work-orders", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Work Order Created",
        description: "Work order has been created successfully."
      });
      onSubmit?.(data);
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create work order. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: WorkOrderForm) => {
    setIsLoading(true);
    createWorkOrderMutation.mutate(data);
    setIsLoading(false);
  };

  // Mock data for dropdowns
  const vehicleBrands = [
    { id: "brand1", name: "Tata Motors" },
    { id: "brand2", name: "Kia Motors" },
    { id: "brand3", name: "Mahindra" }
  ];

  const vehicleModels = [
    { id: "model1", name: "Harrier", brandId: "brand1" },
    { id: "model2", name: "Seltos", brandId: "brand2" },
    { id: "model3", name: "XUV700", brandId: "brand3" }
  ];

  const services = [
    { id: "service1", name: "PPF Full Body", code: "PPF_FULL" },
    { id: "service2", name: "PPF Partial", code: "PPF_PARTIAL" },
    { id: "service3", name: "Window Film", code: "WINDOW_FILM" }
  ];

  const salesPersons = [
    { id: "sp1", name: "Rahul Verma" },
    { id: "sp2", name: "Priya Sharma" },
    { id: "sp3", name: "Amit Kumar" }
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Create Work Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Vehicle Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Vehicle Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleBrandId">Vehicle Brand *</Label>
                <Select 
                  value={form.watch("vehicleBrandId")} 
                  onValueChange={(value) => form.setValue("vehicleBrandId", value)}
                  data-testid="select-vehicle-brand"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleBrands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.vehicleBrandId && (
                  <p className="text-sm text-destructive">{form.formState.errors.vehicleBrandId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleModelId">Vehicle Model *</Label>
                <Select 
                  value={form.watch("vehicleModelId")} 
                  onValueChange={(value) => form.setValue("vehicleModelId", value)}
                  data-testid="select-vehicle-model"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle model" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.vehicleModelId && (
                  <p className="text-sm text-destructive">{form.formState.errors.vehicleModelId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="variant">Variant</Label>
                <Input
                  id="variant"
                  placeholder="e.g., XZ+"
                  {...form.register("variant")}
                  data-testid="input-variant"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="regNo">Registration Number</Label>
                <Input
                  id="regNo"
                  placeholder="e.g., MH12AB1234"
                  {...form.register("regNo")}
                  data-testid="input-reg-no"
                />
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Service Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Service *</Label>
                <Select 
                  value={form.watch("serviceId")} 
                  onValueChange={(value) => form.setValue("serviceId", value)}
                  data-testid="select-service"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.serviceId && (
                  <p className="text-sm text-destructive">{form.formState.errors.serviceId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  {...form.register("quantity", { valueAsNumber: true })}
                  data-testid="input-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salesPersonId">Sales Person</Label>
                <Select 
                  value={form.watch("salesPersonId")} 
                  onValueChange={(value) => form.setValue("salesPersonId", value)}
                  data-testid="select-sales-person"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sales person" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  placeholder="Enter customer name"
                  {...form.register("customerName")}
                  data-testid="input-customer-name"
                />
                {form.formState.errors.customerName && (
                  <p className="text-sm text-destructive">{form.formState.errors.customerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Customer Phone *</Label>
                <Input
                  id="customerPhone"
                  placeholder="Enter customer phone"
                  {...form.register("customerPhone")}
                  data-testid="input-customer-phone"
                />
                {form.formState.errors.customerPhone && (
                  <p className="text-sm text-destructive">{form.formState.errors.customerPhone.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerAddress">Customer Address</Label>
                <Textarea
                  id="customerAddress"
                  placeholder="Enter customer address"
                  {...form.register("customerAddress")}
                  data-testid="input-customer-address"
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes or requirements"
                {...form.register("notes")}
                data-testid="input-notes"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || createWorkOrderMutation.isPending}
              data-testid="button-create"
            >
              {isLoading || createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
