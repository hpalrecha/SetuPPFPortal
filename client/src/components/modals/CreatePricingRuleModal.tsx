import React, { useState, useEffect, useMemo } from "react";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const pricingRuleSchema = z.object({
  pricingType: z.enum(["DEALERSHIP_PRICING", "DETAILER_PRICING", "OEM_PRICING", "STAFF_PRICING"], {
    required_error: "Pricing type is required",
  }),
  dealershipId: z.string().optional(),
  detailerId: z.string().optional(),
  oemId: z.string().optional(),
  vehicleModelId: z.string().optional(),
  serviceId: z.string().optional(), // For DEALERSHIP_PRICING and OEM_PRICING
  serviceCategoryId: z.string().optional(), // For DETAILER_PRICING and STAFF_PRICING
  // STAFF_PRICING fields
  staffUserId: z.string().optional(),
  billingEntityType: z.enum(["COMPANY", "PARTNER"]).optional(),
  billingEntityId: z.string().optional(),
  showroomId: z.string().optional(),
  priceAmount: z.string().min(1, "Price amount is required"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
}).refine(
  (data) => {
    // For DEALERSHIP_PRICING, require serviceId and vehicleModelId
    if (data.pricingType === "DEALERSHIP_PRICING") {
      return data.serviceId && data.serviceId.length > 0 && data.vehicleModelId && data.vehicleModelId.length > 0;
    }
    // For DETAILER_PRICING, require serviceCategoryId (vehicleModelId is optional)
    if (data.pricingType === "DETAILER_PRICING") {
      return data.serviceCategoryId && data.serviceCategoryId.length > 0;
    }
    // For OEM_PRICING, require oemId, serviceId and vehicleModelId
    if (data.pricingType === "OEM_PRICING") {
      return data.oemId && data.oemId.length > 0 && data.serviceId && data.serviceId.length > 0 && data.vehicleModelId && data.vehicleModelId.length > 0;
    }
    // For STAFF_PRICING, require staff, billing entity type, and the individual service.
    // Showroom(s) are validated separately: edit mode uses form.showroomId, add mode
    // uses the multi-select bulk builder state. billingEntityId required only for PARTNER.
    if (data.pricingType === "STAFF_PRICING") {
      if (!data.staffUserId || !data.billingEntityType || !data.serviceId) return false;
      if (data.billingEntityType === "PARTNER" && !data.billingEntityId) return false;
      return true;
    }
    return true;
  },
  {
    message: "Required fields are missing",
    path: ["serviceId"], // Show error on serviceId field for UI purposes
  }
);

type PricingRuleFormData = z.infer<typeof pricingRuleSchema>;

interface CreatePricingRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingRule?: any;
  pricingType?: 'DEALERSHIP_PRICING' | 'DETAILER_PRICING' | 'OEM_PRICING' | 'STAFF_PRICING';
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
  const [dealershipSearch, setDealershipSearch] = useState("");
  const [dealershipSearchOpen, setDealershipSearchOpen] = useState(false);
  // STAFF_PRICING (edit mode): dealership is a UI-only cascade filter that narrows the
  // showroom dropdown — it is NOT part of the submitted rule (showroom implies dealership).
  const [staffDealershipFilter, setStaffDealershipFilter] = useState<string>("");
  // STAFF_PRICING (add mode): OEM → multi-dealership → multi-showroom bulk scope builder.
  // On save this fans out to one rule per selected showroom, all sharing the same
  // staff / billing entity / service category / price.
  const [addOemId, setAddOemId] = useState<string>("");
  const [addDealershipIds, setAddDealershipIds] = useState<string[]>([]);
  const [addShowroomIds, setAddShowroomIds] = useState<string[]>([]);
  const isEditing = !!editingRule;

  const form = useForm<PricingRuleFormData>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: {
      pricingType: editingRule?.pricingType || pricingType,
      dealershipId: editingRule?.dealershipId || undefined,
      detailerId: editingRule?.detailerId || undefined,
      oemId: editingRule?.oemId || undefined,
      vehicleModelId: editingRule?.vehicleModelId || "",
      serviceId: editingRule?.serviceId || "",
      serviceCategoryId: editingRule?.serviceCategoryId || "",
      staffUserId: editingRule?.staffUserId || undefined,
      billingEntityType: editingRule?.billingEntityType || undefined,
      billingEntityId: editingRule?.billingEntityId || undefined,
      showroomId: editingRule?.showroomId || undefined,
      priceAmount: editingRule?.priceAmount || "",
      effectiveFrom: editingRule?.effectiveFrom ? new Date(editingRule.effectiveFrom).toISOString().split('T')[0] : "",
    },
  });

  // Fetch dealerships
  const { data: dealershipsData } = useQuery({
    queryKey: ["/api/dealerships"],
    queryFn: async () => {
      const response = await fetch('/api/dealerships?limit=1000', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: open && (pricingType === 'DEALERSHIP_PRICING' || pricingType === 'STAFF_PRICING'),
    staleTime: 300000, // Cache for 5 minutes - dealerships rarely change
  });

  // Extract array from paginated response
  const dealerships = dealershipsData?.dealerships || [];
  
  // Filter dealerships based on search
  const filteredDealerships = useMemo(() => {
    if (!dealershipSearch) return dealerships;
    const search = dealershipSearch.toLowerCase();
    return dealerships.filter((dealership: any) =>
      dealership.name?.toLowerCase().includes(search) ||
      dealership.city?.toLowerCase().includes(search) ||
      dealership.state?.toLowerCase().includes(search)
    );
  }, [dealerships, dealershipSearch]);

  // Fetch all partners (both INSTALLER and STUDIO types)
  const { data: detailers = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: async () => {
      const response = await fetch('/api/partners', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partners');
      return response.json();
    },
    enabled: open && (pricingType === 'DETAILER_PRICING' || pricingType === 'STAFF_PRICING'),
    staleTime: 300000, // Cache for 5 minutes - partners rarely change
  });

  // Fetch OEMs for OEM_PRICING
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
    enabled: open && (pricingType === 'OEM_PRICING' || pricingType === 'STAFF_PRICING'),
    staleTime: 300000, // Cache for 5 minutes - OEMs don't change often
  });

  // Fetch services from API (for DEALERSHIP_PRICING)
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
    enabled: open && (pricingType === 'DEALERSHIP_PRICING' || pricingType === 'OEM_PRICING' || pricingType === 'STAFF_PRICING'),
    staleTime: 300000, // Cache for 5 minutes - services rarely change
  });

  // Fetch service categories from API (for DETAILER_PRICING)
  const { data: serviceCategories = [] } = useQuery({
    queryKey: ["/api/service-categories"],
    queryFn: async () => {
      const response = await fetch('/api/service-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch service categories');
      return response.json();
    },
    enabled: open && pricingType === 'DETAILER_PRICING',
    staleTime: 300000, // Cache for 5 minutes - service categories rarely change
  });

  // STAFF_PRICING: all staff (any partner or freelancer) — the picker is intentionally
  // unfiltered, since any team can work a job for the company or any partner admin.
  const { data: allStaff = [] } = useQuery({
    queryKey: ["/api/admin/staff-users"],
    queryFn: async () => {
      const response = await fetch('/api/admin/staff-users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch staff');
      return response.json();
    },
    enabled: open && pricingType === 'STAFF_PRICING',
    staleTime: 300000,
  });

  // STAFF_PRICING (edit mode): showrooms narrowed by the single dealership cascade filter.
  const { data: staffShowroomsData } = useQuery({
    queryKey: ["/api/showrooms", "staff-pricing", staffDealershipFilter],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms?dealershipId=${staffDealershipFilter}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: open && pricingType === 'STAFF_PRICING' && !!staffDealershipFilter,
    staleTime: 300000,
  });
  const staffShowrooms = staffShowroomsData?.showrooms || [];

  // STAFF_PRICING (add mode): dealerships under the selected OEM.
  const { data: addOemDealershipsData } = useQuery({
    queryKey: ["/api/dealerships", "staff-add", addOemId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships?oemId=${addOemId}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: open && pricingType === 'STAFF_PRICING' && !isEditing && !!addOemId,
    staleTime: 300000,
  });
  const addOemDealerships = addOemDealershipsData?.dealerships || [];

  // STAFF_PRICING (add mode): all showrooms under the selected OEM (filtered client-side
  // to the chosen dealerships). One query per OEM keeps the cascade simple.
  const { data: addOemShowroomsData } = useQuery({
    queryKey: ["/api/showrooms", "staff-add", addOemId],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms?oemId=${addOemId}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: open && pricingType === 'STAFF_PRICING' && !isEditing && !!addOemId,
    staleTime: 300000,
  });
  const addOemShowrooms = addOemShowroomsData?.showrooms || [];
  // Showroom options shown = those under the selected dealerships.
  const addShowroomOptions = addOemShowrooms.filter((sh: any) => addDealershipIds.includes(sh.dealershipId));

  // Get selected dealership's OEM ID for DEALERSHIP_PRICING or use selected OEM for OEM_PRICING
  const selectedDealership = dealerships?.find((d: any) => d.id === form.watch('dealershipId'));
  const selectedOemId = pricingType === 'OEM_PRICING' 
    ? form.watch('oemId')
    : (selectedDealership?.oemIds?.[0] || selectedDealership?.oemId || selectedDealership?.oem_id);
  
  console.log('Selected dealership:', selectedDealership);
  console.log('Selected OEM ID:', selectedOemId);
  console.log('Pricing type:', pricingType);

  // Reset vehicle model when dealership changes
  const dealershipId = form.watch('dealershipId');
  useEffect(() => {
    if (dealershipId && form.getValues('vehicleModelId')) {
      form.setValue('vehicleModelId', '');
    }
  }, [dealershipId, form]);

  // Update form when editingRule prop changes
  useEffect(() => {
    if (editingRule && open) {
      form.reset({
        pricingType: editingRule.pricingType || pricingType,
        dealershipId: editingRule.dealershipId || undefined,
        detailerId: editingRule.detailerId || undefined,
        oemId: editingRule.oemId || undefined,
        vehicleModelId: editingRule.vehicleModelId || "",
        serviceId: editingRule.serviceId || "",
        serviceCategoryId: editingRule.serviceCategoryId || "",
        staffUserId: editingRule.staffUserId || undefined,
        billingEntityType: editingRule.billingEntityType || undefined,
        billingEntityId: editingRule.billingEntityId || undefined,
        showroomId: editingRule.showroomId || undefined,
        priceAmount: editingRule.priceAmount?.toString() || "",
        effectiveFrom: editingRule.effectiveFrom ? new Date(editingRule.effectiveFrom).toISOString().split('T')[0] : "",
      });
      // Seed the dealership cascade filter from the rule's showroom, so the showroom
      // dropdown is populated when editing an existing STAFF_PRICING rule.
      setStaffDealershipFilter(editingRule.showroomDealershipId || "");
      // Bulk builder is add-mode only.
      setAddOemId("");
      setAddDealershipIds([]);
      setAddShowroomIds([]);
    } else if (!editingRule && open) {
      form.reset({
        pricingType: pricingType,
        dealershipId: undefined,
        detailerId: undefined,
        oemId: undefined,
        vehicleModelId: "",
        serviceId: "",
        serviceCategoryId: "",
        staffUserId: undefined,
        billingEntityType: undefined,
        billingEntityId: undefined,
        showroomId: undefined,
        priceAmount: "",
        effectiveFrom: "",
      });
      setStaffDealershipFilter("");
      setAddOemId("");
      setAddDealershipIds([]);
      setAddShowroomIds([]);
    }
  }, [editingRule, open, pricingType, form]);

  // Fetch vehicle models from API (filtered by OEM for dealership and OEM pricing, all for detailer pricing)
  const { data: vehicleModels = [] } = useQuery({
    queryKey: ["/api/vehicle-models", (pricingType === 'DEALERSHIP_PRICING' || pricingType === 'OEM_PRICING') ? selectedOemId : 'ALL'],
    queryFn: async () => {
      const url = ((pricingType === 'DEALERSHIP_PRICING' || pricingType === 'OEM_PRICING') && selectedOemId) 
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
      console.log('Pricing type:', pricingType);
      console.log('Filtered for OEM:', selectedOemId);
      return data;
    },
    enabled: open && ((pricingType === 'DEALERSHIP_PRICING' || pricingType === 'OEM_PRICING') ? !!selectedOemId : true),
    staleTime: 300000, // Cache for 5 minutes - vehicle models rarely change
  });

  const onSubmit = async (data: PricingRuleFormData) => {
    // STAFF_PRICING add mode: fan out to one rule per selected showroom.
    if (pricingType === 'STAFF_PRICING' && !isEditing) {
      if (addShowroomIds.length === 0) {
        toast({ title: "Pick at least one showroom", description: "Select the showroom(s) this rate applies to.", variant: "destructive" });
        return;
      }
      setIsLoading(true);
      let created = 0, skipped = 0, failed = 0;
      let lastError = "";
      try {
        for (const showroomId of addShowroomIds) {
          const res = await fetch("/api/pricing-rules", {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              pricingType: 'STAFF_PRICING',
              staffUserId: data.staffUserId,
              billingEntityType: data.billingEntityType,
              billingEntityId: data.billingEntityType === 'PARTNER' ? data.billingEntityId : undefined,
              showroomId,
              serviceId: data.serviceId,
              priceAmount: String(data.priceAmount),
              effectiveFrom: data.effectiveFrom,
            }),
          });
          if (res.ok) created++;
          else if (res.status === 409) skipped++;   // already priced for this combo
          else {
            failed++;
            try { const b = await res.json(); lastError = b?.error || JSON.stringify(b); } catch { /* ignore */ }
          }
        }
        toast({
          title: failed ? "Some rules could not be saved" : "Staff pricing saved",
          description: `${created} created${skipped ? `, ${skipped} already existed` : ''}${failed ? `, ${failed} failed${lastError ? ` — ${lastError}` : ''}` : ''}.`,
          variant: failed ? "destructive" : "default",
        });
        if (created > 0) {
          form.reset();
          onSuccess();
        }
      } catch (error) {
        console.error("Error creating staff pricing rules:", error);
        toast({ title: "Error", description: "Failed to create staff pricing rules", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

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
          effectiveFrom: data.effectiveFrom,
          // For DETAILER_PRICING, vehicleModelId is optional (can be undefined)
          vehicleModelId: data.vehicleModelId || undefined,
          // Remove fields based on pricing type
          ...(pricingType === 'DEALERSHIP_PRICING' ? {
            detailerId: undefined,
            oemId: undefined
          } : pricingType === 'DETAILER_PRICING' ? {
            dealershipId: undefined,
            oemId: undefined
          } : pricingType === 'STAFF_PRICING' ? {
            // STAFF_PRICING carries staff/billing-entity/showroom + service (individual) only
            dealershipId: undefined,
            detailerId: undefined,
            oemId: undefined,
            serviceCategoryId: undefined,
            vehicleModelId: undefined,
            // billing entity id only applies when billing to a partner
            billingEntityId: data.billingEntityType === 'PARTNER' ? data.billingEntityId : undefined,
          } : {
            // OEM_PRICING
            dealershipId: undefined,
            detailerId: undefined
          }),
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Pricing Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Pricing Type (hidden field) */}
            <input type="hidden" {...form.register('pricingType')} value={pricingType} />

            {pricingType === 'STAFF_PRICING' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Staff — unfiltered across all partners/freelancers */}
                  <FormField
                    control={form.control}
                    name="staffUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff Name</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-staff">
                              <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-gray-800">
                            {allStaff?.map((s: any) => (
                              <SelectItem
                                key={s.id}
                                value={s.id}
                                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                {s.name}
                                {s.partners?.length ? ` (${s.partners.map((p: any) => p.displayName).join(', ')})` : ' (unassigned)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Billing entity type — Company or a specific Partner */}
                  <FormField
                    control={form.control}
                    name="billingEntityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Entity</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value === 'COMPANY') form.setValue('billingEntityId', undefined);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-billing-entity-type">
                              <SelectValue placeholder="Company or Partner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-gray-800">
                            <SelectItem value="COMPANY" className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Company (P91)</SelectItem>
                            <SelectItem value="PARTNER" className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Partner Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Partner picker — only when billing to a Partner */}
                {form.watch('billingEntityType') === 'PARTNER' && (
                  <FormField
                    control={form.control}
                    name="billingEntityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partner Admin</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-billing-entity">
                              <SelectValue placeholder="Select partner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-gray-800">
                            {detailers?.map((p: any) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                {p.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* EDIT mode: a single rule is one showroom — keep the single cascade. */}
                {isEditing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Dealership — UI-only cascade filter, narrows the showroom list */}
                    <FormItem>
                      <Label>Dealership <span className="text-muted-foreground text-sm">(filter)</span></Label>
                      <Select
                        value={staffDealershipFilter}
                        onValueChange={(value) => {
                          setStaffDealershipFilter(value);
                          form.setValue('showroomId', undefined); // reset showroom when dealership changes
                        }}
                      >
                        <SelectTrigger data-testid="select-staff-dealership">
                          <SelectValue placeholder="Select dealership to filter showrooms" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {dealerships?.map((d: any) => (
                            <SelectItem
                              key={d.id}
                              value={d.id}
                              className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>

                    {/* Showroom — narrowed by dealership */}
                    <FormField
                      control={form.control}
                      name="showroomId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Showroom</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!staffDealershipFilter}>
                            <FormControl>
                              <SelectTrigger data-testid="select-staff-showroom">
                                <SelectValue placeholder={staffDealershipFilter ? "Select showroom" : "Pick a dealership first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-gray-800">
                              {staffShowrooms?.map((sh: any) => (
                                <SelectItem
                                  key={sh.id}
                                  value={sh.id}
                                  className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {sh.name}
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

                {/* ADD mode: OEM → dealerships → showrooms bulk builder. Saving fans out
                    to one rule per selected showroom, all sharing the same price. */}
                {!isEditing && (
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <FormItem>
                      <Label>OEM</Label>
                      <Select
                        value={addOemId}
                        onValueChange={(value) => {
                          setAddOemId(value);
                          setAddDealershipIds([]);
                          setAddShowroomIds([]);
                        }}
                      >
                        <SelectTrigger data-testid="select-staff-oem">
                          <SelectValue placeholder="Select OEM" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {oems?.map((oem: any) => (
                            <SelectItem
                              key={oem.id}
                              value={oem.id}
                              className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {oem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>

                    {/* Dealerships + Showrooms side by side to save vertical space */}
                    {!!addOemId && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label>Dealerships</Label>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            data-testid="button-select-all-dealerships"
                            onClick={() => {
                              const allIds = addOemDealerships.map((d: any) => d.id);
                              const allSelected = allIds.length > 0 && allIds.every((id: string) => addDealershipIds.includes(id));
                              if (allSelected) {
                                setAddDealershipIds([]);
                                setAddShowroomIds([]);
                              } else {
                                setAddDealershipIds(allIds);
                              }
                            }}
                          >
                            {addOemDealerships.length > 0 && addOemDealerships.every((d: any) => addDealershipIds.includes(d.id)) ? 'Clear all' : 'Select all'}
                          </button>
                        </div>
                        <ScrollArea className="h-[120px] rounded border border-border p-2">
                          {addOemDealerships.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No dealerships for this OEM.</p>
                          ) : addOemDealerships.map((d: any) => (
                            <label key={d.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={addDealershipIds.includes(d.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAddDealershipIds([...addDealershipIds, d.id]);
                                  } else {
                                    setAddDealershipIds(addDealershipIds.filter((id) => id !== d.id));
                                    // drop showrooms belonging to the removed dealership
                                    setAddShowroomIds(addShowroomIds.filter((sid) => {
                                      const sh = addOemShowrooms.find((s: any) => s.id === sid);
                                      return sh && sh.dealershipId !== d.id;
                                    }));
                                  }
                                }}
                              />
                              {d.name}
                            </label>
                          ))}
                        </ScrollArea>
                      </div>

                    {/* Showrooms multi-select (only under chosen dealerships) */}
                    {addDealershipIds.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label>Showrooms</Label>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            data-testid="button-select-all-showrooms"
                            onClick={() => {
                              const allIds = addShowroomOptions.map((s: any) => s.id);
                              const allSelected = allIds.length > 0 && allIds.every((id: string) => addShowroomIds.includes(id));
                              setAddShowroomIds(allSelected ? [] : allIds);
                            }}
                          >
                            {addShowroomOptions.length > 0 && addShowroomOptions.every((s: any) => addShowroomIds.includes(s.id)) ? 'Clear all' : 'Select all'}
                          </button>
                        </div>
                        <ScrollArea className="h-[120px] rounded border border-border p-2">
                          {addShowroomOptions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No showrooms under the selected dealerships.</p>
                          ) : addShowroomOptions.map((s: any) => (
                            <label key={s.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={addShowroomIds.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAddShowroomIds([...addShowroomIds, s.id]);
                                  } else {
                                    setAddShowroomIds(addShowroomIds.filter((id) => id !== s.id));
                                  }
                                }}
                              />
                              {s.name}
                            </label>
                          ))}
                        </ScrollArea>
                        <p className="text-xs text-muted-foreground mt-1">
                          {addShowroomIds.length} showroom{addShowroomIds.length === 1 ? '' : 's'} selected — one rule will be created for each.
                        </p>
                      </div>
                    )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Service — individual service (all services listed) */}
                  <FormField
                    control={form.control}
                    name="serviceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-staff-service">
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

                  {/* Payout amount */}
                  <FormField
                    control={form.control}
                    name="priceAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="Enter amount" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {pricingType !== 'STAFF_PRICING' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pricingType === 'DEALERSHIP_PRICING' && (
                <FormField
                  control={form.control}
                  name="dealershipId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Dealership</FormLabel>
                      <Popover open={dealershipSearchOpen} onOpenChange={setDealershipSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-select-dealership"
                            >
                              {field.value ? (
                                <div className="flex items-center gap-2 truncate">
                                  <span className="truncate">{dealerships.find((d: any) => d.id === field.value)?.name}</span>
                                </div>
                              ) : (
                                "Search and select dealership..."
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search by name, city, or state..." 
                              value={dealershipSearch}
                              onValueChange={setDealershipSearch}
                            />
                            <CommandList>
                              <CommandEmpty>No dealership found.</CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-[300px]">
                                  {filteredDealerships.map((dealership: any) => (
                                    <CommandItem
                                      key={dealership.id}
                                      value={`${dealership.name} ${dealership.city} ${dealership.state}`}
                                      onSelect={() => {
                                        field.onChange(dealership.id);
                                        setDealershipSearchOpen(false);
                                        setDealershipSearch("");
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          dealership.id === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col flex-1">
                                        <span className="font-medium">{dealership.name}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                          <MapPin className="h-3 w-3" />
                                          {dealership.city}, {dealership.state}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                              {detailer.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {pricingType === 'OEM_PRICING' && (
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
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {oems?.map((oem: any) => (
                            <SelectItem 
                              key={oem.id} 
                              value={oem.id}
                              className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {oem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Service selection - different for each pricing type */}
              {(pricingType === 'DEALERSHIP_PRICING' || pricingType === 'OEM_PRICING') ? (
                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service">
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
              ) : (
                <FormField
                  control={form.control}
                  name="serviceCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service-category">
                            <SelectValue placeholder="Select service category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white dark:bg-gray-800">
                          {serviceCategories?.map((category: any) => (
                            <SelectItem 
                              key={category.id} 
                              value={category.id}
                              className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            )}

            {pricingType !== 'STAFF_PRICING' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleModelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Vehicle Model 
                      {(pricingType === 'DEALERSHIP_PRICING' || pricingType === 'OEM_PRICING') && <span className="text-red-500">*</span>}
                      {pricingType === 'DETAILER_PRICING' && <span className="text-muted-foreground text-sm"> (Optional)</span>}
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "__ALL_VEHICLES__" ? "" : value)} 
                      value={field.value || (pricingType === 'DETAILER_PRICING' ? "__ALL_VEHICLES__" : "")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800">
                        {pricingType === 'DETAILER_PRICING' && (
                          <SelectItem 
                            value="__ALL_VEHICLES__"
                            className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 font-medium border-b"
                          >
                            🚗 All Vehicles (Applies to any vehicle)
                          </SelectItem>
                        )}
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
            )}

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