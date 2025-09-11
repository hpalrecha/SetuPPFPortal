import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { CommissionRuleWithContext } from "@shared/types";

// Form schema for editing commission rules
const editCommissionRuleFormSchema = z.object({
  organizationLevel: z.enum(["OEM", "DEALERSHIP", "SHOWROOM"]),
  oemId: z.string().optional(),
  dealershipId: z.string().optional(),
  showroomId: z.string().optional(),
  salesPersonId: z.string().optional(),
  serviceType: z.enum(["ALL", "CATEGORY", "SPECIFIC"]),
  serviceId: z.string().optional(),
  serviceCategoryId: z.string().optional(),
  type: z.enum(["PERCENT", "AMOUNT"]),
  valueNumeric: z.string(),
  capAmount: z.string().optional(),
  floorAmount: z.string().optional(),
  effectiveFromDate: z.date(),
  effectiveToDate: z.date().optional(),
  status: z.string().default("ACTIVE")
});

type EditCommissionRuleFormData = z.infer<typeof editCommissionRuleFormSchema>;

interface EditCommissionRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionRule: CommissionRuleWithContext;
}

export function EditCommissionRuleModal({ open, onOpenChange, commissionRule }: EditCommissionRuleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Data queries
  const { data: oems = [] } = useQuery<any[]>({ queryKey: ["/api/oems"] });
  const { data: dealerships = [] } = useQuery<any[]>({ queryKey: ["/api/dealerships"] });
  const { data: showrooms = [] } = useQuery<any[]>({ queryKey: ["/api/showrooms"] });
  const { data: salesPersons = [] } = useQuery<any[]>({ queryKey: ["/api/sales-persons"] });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ["/api/services"] });
  const { data: serviceCategories = [] } = useQuery<any[]>({ queryKey: ["/api/service-categories"] });

  const form = useForm<EditCommissionRuleFormData>({
    resolver: zodResolver(editCommissionRuleFormSchema),
    defaultValues: {
      organizationLevel: "OEM",
      serviceType: "ALL",
      salesPersonId: "ALL",
      type: "PERCENT",
      valueNumeric: "0",
      effectiveFromDate: new Date(),
      status: "ACTIVE"
    }
  });

  // Reset form when rule changes
  useEffect(() => {
    if (commissionRule) {
      // Determine organization level
      let organizationLevel: "OEM" | "DEALERSHIP" | "SHOWROOM" = "OEM";
      if (commissionRule.showroomId) organizationLevel = "SHOWROOM";
      else if (commissionRule.dealershipId) organizationLevel = "DEALERSHIP";
      else if (commissionRule.oemId) organizationLevel = "OEM";

      // Determine service type
      let serviceType: "ALL" | "CATEGORY" | "SPECIFIC" = "ALL";
      if (commissionRule.serviceId) serviceType = "SPECIFIC";
      else if (commissionRule.serviceCategoryId) serviceType = "CATEGORY";

      form.reset({
        organizationLevel,
        oemId: commissionRule.oemId || undefined,
        dealershipId: commissionRule.dealershipId || undefined,
        showroomId: commissionRule.showroomId || undefined,
        salesPersonId: commissionRule.salesPersonId || "ALL",
        serviceType,
        serviceId: commissionRule.serviceId || undefined,
        serviceCategoryId: commissionRule.serviceCategoryId || undefined,
        type: commissionRule.type,
        valueNumeric: commissionRule.valueNumeric,
        capAmount: commissionRule.capAmount || undefined,
        floorAmount: commissionRule.floorAmount || undefined,
        effectiveFromDate: new Date(commissionRule.effectiveFrom),
        effectiveToDate: commissionRule.effectiveTo ? new Date(commissionRule.effectiveTo) : undefined,
        status: commissionRule.status
      });
    }
  }, [commissionRule, form]);

  const organizationLevel = form.watch("organizationLevel");
  const serviceType = form.watch("serviceType");
  const selectedOemId = form.watch("oemId");
  const selectedDealershipId = form.watch("dealershipId");

  // Filter dealerships based on selected OEM
  const filteredDealerships = selectedOemId 
    ? dealerships.filter((d: any) => d.oemId === selectedOemId)
    : dealerships;

  // Filter showrooms based on selected dealership
  const filteredShowrooms = selectedDealershipId
    ? showrooms.filter((s: any) => s.dealershipId === selectedDealershipId)
    : showrooms;

  const updateCommissionRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/commission-rules/${commissionRule.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      toast({
        title: "Success",
        description: "Commission rule updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Commission rule update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update commission rule",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: EditCommissionRuleFormData) => {
    // Transform form data to API format
    const apiData = {
      // Set organizational IDs based on level
      oemId: organizationLevel === "OEM" ? data.oemId : undefined,
      dealershipId: organizationLevel === "DEALERSHIP" ? data.dealershipId : undefined,
      showroomId: organizationLevel === "SHOWROOM" ? data.showroomId : undefined,
      
      salesPersonId: data.salesPersonId === "ALL" ? undefined : data.salesPersonId,
      
      // Set service IDs based on type
      serviceId: serviceType === "SPECIFIC" ? data.serviceId : undefined,
      serviceCategoryId: serviceType === "CATEGORY" ? data.serviceCategoryId : undefined,
      
      type: data.type,
      valueNumeric: data.valueNumeric,
      capAmount: data.capAmount || undefined,
      floorAmount: data.floorAmount || undefined,
      effectiveFrom: data.effectiveFromDate.toISOString(),
      effectiveTo: data.effectiveToDate?.toISOString() || undefined,
      status: data.status
    };

    updateCommissionRuleMutation.mutate(apiData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Commission Rule</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Organization Level Selection */}
            <FormField
              control={form.control}
              name="organizationLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Level</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-6"
                      data-testid="radio-organization-level"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OEM" id="edit-oem" />
                        <Label htmlFor="edit-oem">OEM Level</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="DEALERSHIP" id="edit-dealership" />
                        <Label htmlFor="edit-dealership">Dealership Level</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SHOWROOM" id="edit-showroom" />
                        <Label htmlFor="edit-showroom">Showroom Level</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Commission Type and Value */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-commission-type">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                        <SelectItem value="AMOUNT">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valueNumeric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Value</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-commission-value"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateCommissionRuleMutation.isPending}
                data-testid="button-save-commission-rule"
              >
                {updateCommissionRuleMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}