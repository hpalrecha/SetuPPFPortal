import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCommissionRuleSchema } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const commissionRuleFormSchema = z.object({
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
}).refine(
  (data) => {
    if (data.effectiveToDate && data.effectiveFromDate) {
      return data.effectiveToDate > data.effectiveFromDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["effectiveToDate"]
  }
);

type CommissionRuleFormData = z.infer<typeof commissionRuleFormSchema>;

interface CreateCommissionRuleModalProps {
  children: React.ReactNode;
}

export function CreateCommissionRuleModal({ children }: CreateCommissionRuleModalProps) {
  const [open, setOpen] = useState(false);
  const [dealershipComboboxOpen, setDealershipComboboxOpen] = useState(false);
  const [showroomComboboxOpen, setShowroomComboboxOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: oems = [] } = useQuery<any[]>({ queryKey: ["/api/oems"] });
  const { data: salesPersons = [] } = useQuery<any[]>({ queryKey: ["/api/sales-persons"] });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ["/api/services"] });
  const { data: serviceCategories = [] } = useQuery<any[]>({ queryKey: ["/api/service-categories"] });

  const form = useForm<CommissionRuleFormData>({
    resolver: zodResolver(commissionRuleFormSchema),
    defaultValues: {
      organizationLevel: "SHOWROOM",
      serviceType: "ALL",
      salesPersonId: "ALL",
      type: "PERCENT",
      valueNumeric: "0",
      effectiveFromDate: new Date(),
      status: "ACTIVE"
    }
  });

  const organizationLevel = form.watch("organizationLevel");
  const serviceType = form.watch("serviceType");
  const selectedOemId = form.watch("oemId");
  const selectedDealershipId = form.watch("dealershipId");

  const { data: dealershipData } = useQuery<{ dealerships: any[]; total: number }>({
    queryKey: ["/api/dealerships", selectedOemId],
    queryFn: async () => {
      const url = selectedOemId
        ? `/api/dealerships?oemId=${selectedOemId}&limit=10000`
        : '/api/dealerships?limit=10000';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: open && !!selectedOemId && (organizationLevel === "DEALERSHIP" || organizationLevel === "SHOWROOM"),
    staleTime: 300000,
  });
  const filteredDealerships = dealershipData?.dealerships || [];

  const { data: showroomData } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms", selectedDealershipId, selectedOemId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10000' });
      if (selectedDealershipId) params.set('dealershipId', selectedDealershipId);
      if (selectedOemId) params.set('oemId', selectedOemId);
      const response = await fetch(`/api/showrooms?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: open && !!selectedDealershipId && organizationLevel === "SHOWROOM",
    staleTime: 300000,
  });
  const filteredShowrooms = showroomData?.showrooms || [];

  const createCommissionRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/commission-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      toast({
        title: "Success",
        description: "Commission rule created successfully",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Commission rule creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create commission rule",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: CommissionRuleFormData) => {
    const apiData = {
      oemId: organizationLevel === "OEM" ? data.oemId : undefined,
      dealershipId: organizationLevel === "DEALERSHIP" ? data.dealershipId : undefined,
      showroomId: organizationLevel === "SHOWROOM" ? data.showroomId : undefined,
      
      salesPersonId: data.salesPersonId === "ALL" ? undefined : data.salesPersonId,
      
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

    createCommissionRuleMutation.mutate(apiData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Commission Rule</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="organizationLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Level</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('oemId', undefined);
                        form.setValue('dealershipId', undefined);
                        form.setValue('showroomId', undefined);
                      }}
                      defaultValue={field.value}
                      className="flex space-x-6"
                      data-testid="radio-organization-level"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OEM" id="oem" />
                        <Label htmlFor="oem">OEM Level</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="DEALERSHIP" id="dealership" />
                        <Label htmlFor="dealership">Dealership Level</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SHOWROOM" id="showroom" />
                        <Label htmlFor="showroom">Showroom Level</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {organizationLevel === "OEM" && (
              <FormField
                control={form.control}
                name="oemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select OEM</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-oem">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select OEM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {oems.map((oem: any) => (
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
            )}

            {organizationLevel === "DEALERSHIP" && (
              <>
                <FormField
                  control={form.control}
                  name="oemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select OEM</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('dealershipId', undefined);
                        }}
                        defaultValue={field.value}
                        data-testid="select-oem-for-dealership"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select OEM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {oems.map((oem: any) => (
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
                    <FormItem className="flex flex-col">
                      <FormLabel>Select Dealership</FormLabel>
                      <Popover open={dealershipComboboxOpen} onOpenChange={setDealershipComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={dealershipComboboxOpen}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={!selectedOemId}
                            >
                              {field.value
                                ? filteredDealerships.find((d: any) => d.id === field.value)?.name || "Select Dealership"
                                : selectedOemId ? "Select Dealership" : "Select OEM first"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search dealership..." />
                            <CommandList>
                              <CommandEmpty>No dealership found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {filteredDealerships.map((dealership: any) => (
                                  <CommandItem
                                    key={dealership.id}
                                    value={dealership.name}
                                    onSelect={() => {
                                      field.onChange(dealership.id);
                                      setDealershipComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === dealership.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {dealership.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {organizationLevel === "SHOWROOM" && (
              <>
                <FormField
                  control={form.control}
                  name="oemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select OEM</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('dealershipId', undefined);
                          form.setValue('showroomId', undefined);
                        }}
                        defaultValue={field.value}
                        data-testid="select-oem-for-showroom"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select OEM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {oems.map((oem: any) => (
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
                    <FormItem className="flex flex-col">
                      <FormLabel>Select Dealership</FormLabel>
                      <Popover open={dealershipComboboxOpen} onOpenChange={setDealershipComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={dealershipComboboxOpen}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={!selectedOemId}
                            >
                              {field.value
                                ? filteredDealerships.find((d: any) => d.id === field.value)?.name || "Select Dealership"
                                : selectedOemId ? "Select Dealership" : "Select OEM first"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search dealership..." />
                            <CommandList>
                              <CommandEmpty>No dealership found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {filteredDealerships.map((dealership: any) => (
                                  <CommandItem
                                    key={dealership.id}
                                    value={dealership.name}
                                    onSelect={() => {
                                      field.onChange(dealership.id);
                                      form.setValue('showroomId', undefined);
                                      setDealershipComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === dealership.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {dealership.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="showroomId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Select Showroom</FormLabel>
                      <Popover open={showroomComboboxOpen} onOpenChange={setShowroomComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={showroomComboboxOpen}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={!selectedDealershipId}
                            >
                              {field.value
                                ? filteredShowrooms.find((s: any) => s.id === field.value)?.name || "Select Showroom"
                                : selectedDealershipId ? "Select Showroom" : "Select Dealership first"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search showroom..." />
                            <CommandList>
                              <CommandEmpty>No showroom found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {filteredShowrooms.map((showroom: any) => (
                                  <CommandItem
                                    key={showroom.id}
                                    value={showroom.name}
                                    onSelect={() => {
                                      field.onChange(showroom.id);
                                      setShowroomComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === showroom.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {showroom.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="salesPersonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Person (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-sales-person">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Apply to all sales persons" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">All Sales Persons</SelectItem>
                      {salesPersons.map((person: any) => (
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

            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-6"
                      data-testid="radio-service-type"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ALL" id="all-services" />
                        <Label htmlFor="all-services">All Services</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="CATEGORY" id="service-category" />
                        <Label htmlFor="service-category">Service Category</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SPECIFIC" id="specific-service" />
                        <Label htmlFor="specific-service">Specific Service</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serviceType === "CATEGORY" && (
              <FormField
                control={form.control}
                name="serviceCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Service Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-service-category">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Service Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceCategories.map((category: any) => (
                          <SelectItem key={category.id} value={category.id}>
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

            {serviceType === "SPECIFIC" && (
              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Specific Service</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-service">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services.map((service: any) => (
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
            )}

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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="floorAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Amount (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-floor-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Amount (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-cap-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effectiveFromDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full pl-3 text-left font-normal"
                            data-testid="button-effective-from"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveToDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective To (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full pl-3 text-left font-normal"
                            data-testid="button-effective-to"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>No end date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCommissionRuleMutation.isPending}
                data-testid="button-submit"
              >
                {createCommissionRuleMutation.isPending ? "Creating..." : "Create Commission Rule"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
