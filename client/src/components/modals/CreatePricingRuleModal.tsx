import React, { useState, useEffect } from "react";
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

const pricingRuleSchema = z.object({
  pricingType: z.enum(["DEALERSHIP_PRICING", "DETAILER_PRICING"], {
    required_error: "Pricing type is required",
  }),
  dealershipId: z.string().optional(),
  detailerId: z.string().optional(),
  vehicleModelId: z.string().min(1, "Vehicle model is required"),
  serviceId: z.string().min(1, "Service is required"),
  priceAmount: z.string().min(1, "Price amount is required"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});

type PricingRuleFormData = z.infer<typeof pricingRuleSchema>;

interface CreatePricingRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingRule?: any;
  pricingType?: 'DEALERSHIP_PRICING' | 'DETAILER_PRICING';
}

export function CreatePricingRuleModal({
  open,
  onOpenChange,
  onSuccess,
  editingRule,
  pricingType = 'DEALERSHIP_PRICING',
}: CreatePricingRuleModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!editingRule;

  const form = useForm<PricingRuleFormData>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: {
      pricingType: editingRule?.pricingType || pricingType,
      dealershipId: editingRule?.dealershipId || "",
      detailerId: editingRule?.detailerId || "",
      vehicleModelId: editingRule?.vehicleModelId || "",
      serviceId: editingRule?.serviceId || "",
      priceAmount: editingRule?.priceAmount || "",
      effectiveFrom: editingRule?.effectiveFrom ? new Date(editingRule.effectiveFrom).toISOString().split('T')[0] : "",
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
    enabled: open && pricingType === 'DEALERSHIP_PRICING',
  });

  // Fetch detailers (users with PARTNER_STAFF role)
  const { data: detailers = [] } = useQuery({
    queryKey: ["/api/users", "PARTNER_STAFF"],
    queryFn: async () => {
      const response = await fetch('/api/users?role=PARTNER_STAFF', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch detailers');
      return response.json();
    },
    enabled: open && pricingType === 'DETAILER_PRICING',
  });

  // Fetch services from API
  const { data: services = [] } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await fetch('/api/services', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch services');
      return response.json();
    },
    enabled: open,
  });

  // Get selected dealership's OEM ID
  const selectedDealership = dealerships?.find((d: any) => d.id === form.watch('dealershipId'));
  const selectedOemId = selectedDealership?.oemId || selectedDealership?.oem_id;
  
  console.log('Selected dealership:', selectedDealership);
  console.log('Selected OEM ID:', selectedOemId);

  // Reset vehicle model when dealership changes
  const dealershipId = form.watch('dealershipId');
  useEffect(() => {
    if (dealershipId && form.getValues('vehicleModelId')) {
      form.setValue('vehicleModelId', '');
    }
  }, [dealershipId, form]);

  // Fetch vehicle models from API (filtered by OEM)
  const { data: vehicleModels = [] } = useQuery({
    queryKey: ["/api/vehicle-models", selectedOemId],
    queryFn: async () => {
      const url = selectedOemId 
        ? `/api/vehicle-models?oemId=${selectedOemId}`
        : '/api/vehicle-models';
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch vehicle models');
      const data = await response.json();
      console.log('Vehicle models data:', data);
      console.log('Filtered for OEM:', selectedOemId);
      return data;
    },
    enabled: open && (pricingType === 'DEALERSHIP_PRICING' ? !!selectedOemId : true),
  });

  const onSubmit = async (data: PricingRuleFormData) => {
    setIsLoading(true);
    try {
      const endpoint = isEditing ? `/api/pricing-rules/${editingRule.id}` : "/api/pricing-rules";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          priceAmount: data.priceAmount.toString(),
          effectiveFrom: new Date(data.effectiveFrom),
          // Remove detailerId if it's dealership pricing
          ...(pricingType === 'DEALERSHIP_PRICING' ? { detailerId: undefined } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save pricing rule');
      }

      toast({
        title: "Success",
        description: `Pricing rule ${isEditing ? 'updated' : 'created'} successfully`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving pricing rule:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} pricing rule`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Pricing Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Pricing Type (hidden field) */}
            <input type="hidden" {...form.register('pricingType')} value={pricingType} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pricingType === 'DEALERSHIP_PRICING' && (
                <FormField
                  control={form.control}
                  name="dealershipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealership</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select dealership" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {dealerships?.map((dealership: any) => (
                            <SelectItem 
                              key={dealership.id} 
                              value={dealership.id}
                              className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {dealership.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {pricingType === 'DETAILER_PRICING' && (
                <FormField
                  control={form.control}
                  name="detailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detailer/Installer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select detailer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {detailers?.map((detailer: any) => (
                            <SelectItem 
                              key={detailer.id} 
                              value={detailer.id}
                              className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {detailer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800">
                        {services?.map((service: any) => (
                          <SelectItem 
                            key={service.id} 
                            value={service.id}
                            className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {service.name}
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
                name="vehicleModelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Model <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800">
                        {vehicleModels?.map((model: any) => (
                          <SelectItem 
                            key={model.id} 
                            value={model.id}
                            className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {model.modelName}
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
                name="priceAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {pricingType === 'DETAILER_PRICING' ? 'Payout Amount' : 'Price Amount'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-effective-from"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                data-testid="button-save-pricing-rule"
              >
                {isLoading ? "Saving..." : `${isEditing ? 'Update' : 'Create'} Pricing Rule`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}