import { useState, useEffect, useMemo } from "react";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X, Building2, MapPin, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const allocationSchema = z.object({
  partnerId: z.string().min(1, "Please select a partner"),
  brandIds: z.array(z.string()).min(1, "Please select at least one brand"),
  level: z.enum(['DEALERSHIP', 'SHOWROOM'], { required_error: "Level is required" }),
  levelId: z.string().optional(),
  showroomIds: z.array(z.string()).optional(),
  priority: z.number().min(1).max(10).default(1),
  partnerBillsDirectly: z.boolean().default(false),
  active: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.level === "DEALERSHIP") {
      return data.levelId && data.levelId.length > 0;
    }
    if (data.level === "SHOWROOM") {
      return data.showroomIds && data.showroomIds.length > 0;
    }
    return true;
  },
  {
    message: "Please select at least one showroom or dealership",
    path: ["levelId"],
  }
);

type AllocationFormData = z.infer<typeof allocationSchema>;

interface CreateAllocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  allocation?: any;
}

export function CreateAllocationModal({
  open,
  onOpenChange,
  onSuccess,
  allocation,
}: CreateAllocationModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const isEditing = !!allocation;

  const form = useForm<AllocationFormData>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      partnerId: "",
      brandIds: [],
      level: "DEALERSHIP",
      levelId: "",
      showroomIds: [],
      priority: 1,
      partnerBillsDirectly: false,
      active: true,
    },
  });

  const selectedPartnerId = form.watch("partnerId");
  const selectedLevel = form.watch("level");
  const selectedLevelId = form.watch("levelId");
  const selectedShowroomIds = form.watch("showroomIds") || [];

  // Fetch partners with their service categories
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["/api/partners-with-categories"],
    queryFn: async () => {
      const response = await fetch('/api/partners-with-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partners');
      return response.json();
    },
    enabled: open,
  });

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ["/api/p91/brand"],
    queryFn: async () => {
      const response = await fetch('/api/p91/brand', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch brands');
      return response.json();
    },
    enabled: open,
  });

  // Fetch partner's brands when partner is selected
  const { data: partnerBrandsData } = useQuery({
    queryKey: ["/api/partners", selectedPartnerId, "service-categories"],
    queryFn: async () => {
      const response = await fetch(`/api/partners/${selectedPartnerId}/service-categories`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Cache-Control': 'no-cache',
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partner brands');
      return response.json();
    },
    enabled: open && !!selectedPartnerId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch already-allocated brands for the selected showroom/dealership
  const { data: allocatedBrands = [] } = useQuery<{ brandId: string; partnerId: string; partnerName: string }[]>({
    queryKey: ["/api/allocations/allocated-brands", selectedLevel, selectedLevelId],
    queryFn: async () => {
      const response = await fetch(`/api/allocations/allocated-brands?level=${selectedLevel}&levelId=${selectedLevelId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch allocated brands');
      return response.json();
    },
    enabled: open && !!selectedLevelId,
  });

  // Fetch allocation brands when editing
  const { data: allocationBrandsData } = useQuery({
    queryKey: ["/api/allocations", allocation?.id, "brands"],
    queryFn: async () => {
      const response = await fetch(`/api/allocations/${allocation.id}/brands`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch allocation brands');
      return response.json();
    },
    enabled: open && isEditing && !!allocation?.id,
  });

  const partnerBrandIds = partnerBrandsData?.brandIds || [];
  
  // Filter brands: show only partner's brands AND exclude already-assigned brands
  const allocatedBrandIds = allocatedBrands
    .filter(ab => !isEditing || ab.partnerId !== allocation?.partnerId)
    .map(ab => ab.brandId);
  
  const availableBrands = brands.filter((brand: any) => 
    partnerBrandIds.includes(brand.id) && !allocatedBrandIds.includes(brand.id)
  );

  // Fetch dealerships
  const { data: dealerships = [], isLoading: dealershipsLoading } = useQuery({
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

  // Fetch showrooms
  const { data: showrooms = [], isLoading: showroomsLoading } = useQuery({
    queryKey: ["/api/showrooms"],
    queryFn: async () => {
      const response = await fetch('/api/showrooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
    enabled: open,
  });

  // Reset form when allocation prop changes
  useEffect(() => {
    if (allocation && open) {
      form.reset({
        partnerId: allocation.partnerId || "",
        brandIds: allocationBrandsData?.brandIds || [],
        level: allocation.level || "DEALERSHIP",
        levelId: allocation.levelId || "",
        showroomIds: allocation.level === "SHOWROOM" ? [allocation.levelId] : [],
        priority: allocation.priority || 1,
        partnerBillsDirectly: allocation.partnerBillsDirectly ?? false,
        active: allocation.active ?? true,
      });
    } else if (!allocation && open) {
      form.reset({
        partnerId: "",
        brandIds: [],
        level: "DEALERSHIP",
        levelId: "",
        showroomIds: [],
        priority: 1,
        partnerBillsDirectly: false,
        active: true,
      });
    }
  }, [allocation, open, form, allocationBrandsData]);

  // Filtered partners based on search
  const filteredPartners = useMemo(() => {
    if (!partnerSearch) return partners;
    const search = partnerSearch.toLowerCase();
    return partners.filter((partner: any) =>
      partner.displayName?.toLowerCase().includes(search) ||
      partner.email?.toLowerCase().includes(search) ||
      partner.phone?.includes(search) ||
      partner.city?.toLowerCase().includes(search)
    );
  }, [partners, partnerSearch]);

  // Filtered locations based on search and level
  const filteredLocations = useMemo(() => {
    const locations = selectedLevel === "DEALERSHIP" ? dealerships : showrooms;
    if (!locationSearch) return locations;
    const search = locationSearch.toLowerCase();
    return locations.filter((loc: any) =>
      loc.name?.toLowerCase().includes(search) ||
      loc.city?.toLowerCase().includes(search) ||
      loc.state?.toLowerCase().includes(search) ||
      loc.address?.toLowerCase().includes(search)
    );
  }, [selectedLevel, dealerships, showrooms, locationSearch]);

  const onSubmit = async (data: AllocationFormData) => {
    setIsLoading(true);
    try {
      if (isEditing) {
        const response = await fetch(`/api/allocations/${allocation.id}`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            level: data.level,
            levelId: data.level === "DEALERSHIP" ? data.levelId : allocation.levelId,
            partnerId: data.partnerId,
            brandIds: data.brandIds,
            priority: data.priority,
            partnerBillsDirectly: data.partnerBillsDirectly,
            active: data.active,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update allocation');
        }

        toast({
          title: "Success",
          description: "Allocation updated successfully",
        });
      } else {
        if (data.level === "SHOWROOM" && data.showroomIds && data.showroomIds.length > 0) {
          const promises = data.showroomIds.map(showroomId => 
            fetch("/api/allocations", {
              method: "POST",
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                level: "SHOWROOM",
                levelId: showroomId,
                partnerId: data.partnerId,
                brandIds: data.brandIds,
                priority: data.priority,
                partnerBillsDirectly: data.partnerBillsDirectly,
                active: data.active,
              }),
            })
          );

          const responses = await Promise.all(promises);
          const failedResponses = responses.filter(r => !r.ok);
          
          if (failedResponses.length > 0) {
            throw new Error(`Failed to create ${failedResponses.length} allocation(s)`);
          }

          toast({
            title: "Success",
            description: `Created ${data.showroomIds.length} allocation(s) successfully`,
          });
        } else {
          const response = await fetch("/api/allocations", {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              level: data.level,
              levelId: data.levelId,
              partnerId: data.partnerId,
              brandIds: data.brandIds,
              priority: data.priority,
              partnerBillsDirectly: data.partnerBillsDirectly,
              active: data.active,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create allocation');
          }

          toast({
            title: "Success",
            description: "Allocation created successfully",
          });
        }
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  const selectedPartner = partners.find((p: any) => p.id === selectedPartnerId);
  const selectedLocation = selectedLevel === "DEALERSHIP" 
    ? dealerships.find((d: any) => d.id === selectedLevelId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[850px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Create"} Partner Allocation
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* STEP 1: Partner Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">1</div>
              <h3 className="text-sm font-semibold">Select Partner</h3>
            </div>
            
            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Partner <span className="text-destructive">*</span></FormLabel>
                  <Popover open={partnerSearchOpen} onOpenChange={setPartnerSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-select-partner"
                        >
                          {field.value ? (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4" />
                              <span>{selectedPartner?.displayName}</span>
                            </div>
                          ) : (
                            "Search and select partner..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[600px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search by name, city, email, or phone..." 
                          value={partnerSearch}
                          onValueChange={setPartnerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {partnersLoading ? "Loading partners..." : "No partner found."}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-[300px]">
                              {partnersLoading ? (
                                <div className="p-4 space-y-2">
                                  <Skeleton className="h-12 w-full" />
                                  <Skeleton className="h-12 w-full" />
                                  <Skeleton className="h-12 w-full" />
                                </div>
                              ) : (
                                filteredPartners.map((partner: any) => (
                                  <CommandItem
                                    key={partner.id}
                                    value={`${partner.displayName} ${partner.city} ${partner.email}`}
                                    onSelect={() => {
                                      field.onChange(partner.id);
                                      form.setValue("brandIds", []); // Reset brands when partner changes
                                      setPartnerSearchOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        partner.id === field.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{partner.displayName}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {partner.type || "Partner"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                        {partner.city && (
                                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {partner.city}, {partner.state}
                                          </span>
                                        )}
                                        {partner.email && <span>{partner.email}</span>}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))
                              )}
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
          </div>

          <Separator />

          {/* STEP 2: Brand Selection */}
          {selectedPartnerId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">2</div>
                <h3 className="text-sm font-semibold">Select Product Brands</h3>
              </div>

              <FormField
                control={form.control}
                name="brandIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Brands <span className="text-destructive">*</span></FormLabel>
                    {selectedLevelId && allocatedBrands.length > 0 && (
                      <FormDescription>
                        Only unassigned brands for this {selectedLevel.toLowerCase()} are shown
                      </FormDescription>
                    )}
                    {availableBrands.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-3 px-4 bg-muted rounded-md">
                        {selectedLevelId && allocatedBrandIds.length > 0 
                          ? "All brands assigned to this partner are already allocated to other partners for this location."
                          : "No brands assigned to this partner. Please assign brands to the partner first."}
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
                          <div className="grid grid-cols-2 gap-3">
                            {availableBrands.map((brand: any) => (
                              <div key={brand.id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded-md transition-colors">
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
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {brand.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                        {field.value && field.value.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {field.value.map((brandId: string) => {
                              const brand = brands.find((b: any) => b.id === brandId);
                              return (
                                <Badge key={brandId} variant="secondary" className="gap-1">
                                  {brand?.name}
                                  <X
                                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                                    onClick={() => {
                                      field.onChange(field.value.filter((id: string) => id !== brandId));
                                    }}
                                  />
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedPartnerId && <Separator />}

          {/* STEP 3: Level Selection */}
          {selectedPartnerId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">3</div>
                <h3 className="text-sm font-semibold">Select Allocation Level</h3>
              </div>

              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level <span className="text-destructive">*</span></FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("levelId", "");
                        form.setValue("showroomIds", []);
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DEALERSHIP">Dealership</SelectItem>
                        <SelectItem value="SHOWROOM">Showroom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedPartnerId && <Separator />}

          {/* STEP 4: Location Selection */}
          {selectedPartnerId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">4</div>
                <h3 className="text-sm font-semibold">Select {selectedLevel === "DEALERSHIP" ? "Dealership" : "Showrooms"}</h3>
              </div>

              {selectedLevel === "DEALERSHIP" ? (
                <FormField
                  control={form.control}
                  name="levelId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Dealership <span className="text-destructive">*</span></FormLabel>
                      <Popover open={locationSearchOpen} onOpenChange={setLocationSearchOpen}>
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
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  <span>{selectedLocation?.name}</span>
                                </div>
                              ) : (
                                "Search and select dealership..."
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[600px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search by name, city, or address..." 
                              value={locationSearch}
                              onValueChange={setLocationSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {dealershipsLoading ? "Loading dealerships..." : "No dealership found."}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-[300px]">
                                  {dealershipsLoading ? (
                                    <div className="p-4 space-y-2">
                                      <Skeleton className="h-12 w-full" />
                                      <Skeleton className="h-12 w-full" />
                                    </div>
                                  ) : (
                                    filteredLocations.map((dealership: any) => (
                                      <CommandItem
                                        key={dealership.id}
                                        value={`${dealership.name} ${dealership.city} ${dealership.state}`}
                                        onSelect={() => {
                                          field.onChange(dealership.id);
                                          setLocationSearchOpen(false);
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
                                    ))
                                  )}
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
              ) : (
                <FormField
                  control={form.control}
                  name="showroomIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Showrooms (Select multiple) <span className="text-destructive">*</span></FormLabel>
                      <FormDescription>
                        Search and select one or more showrooms
                      </FormDescription>
                      <Popover open={locationSearchOpen} onOpenChange={setLocationSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between h-auto min-h-10"
                              data-testid="select-showrooms"
                            >
                              <span className="truncate">
                                {field.value && field.value.length > 0
                                  ? `${field.value.length} showroom${field.value.length > 1 ? 's' : ''} selected`
                                  : "Select showrooms"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[500px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name, city, or address..." />
                            <CommandList>
                              <CommandEmpty>No showroom found.</CommandEmpty>
                              <CommandGroup>
                                {showroomsLoading ? (
                                  <div className="space-y-2 p-2">
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                  </div>
                                ) : (
                                  filteredLocations.map((showroom: any) => {
                                    const isSelected = field.value?.includes(showroom.id);
                                    return (
                                      <CommandItem
                                        key={showroom.id}
                                        value={`${showroom.name} ${showroom.city} ${showroom.state}`}
                                        onSelect={() => {
                                          const currentValues = Array.isArray(field.value) ? field.value : [];
                                          if (isSelected) {
                                            field.onChange(currentValues.filter((id: string) => id !== showroom.id));
                                          } else {
                                            field.onChange([...currentValues, showroom.id]);
                                          }
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            isSelected ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">{showroom.name}</div>
                                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {showroom.city}, {showroom.state}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    );
                                  })
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {field.value && field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value.map((showroomId: string) => {
                            const showroom = showrooms.find((s: any) => s.id === showroomId);
                            return (
                              <Badge key={showroomId} variant="secondary" className="gap-1">
                                {showroom?.name}
                                <X
                                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                                  onClick={() => {
                                    field.onChange(field.value.filter((id: string) => id !== showroomId));
                                  }}
                                />
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          {selectedPartnerId && <Separator />}

          {/* Additional Settings */}
          {selectedPartnerId && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Additional Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority (1-10)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-priority"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="partnerBillsDirectly"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Partner Bills Customer Directly</FormLabel>
                      <FormDescription>
                        Enable if partner handles billing independently
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-partner-bills-directly"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? "Saving..." : isEditing ? "Update" : "Create"} Allocation
            </Button>
          </DialogFooter>
        </form>
      </Form>
      </DialogContent>
    </Dialog>
  );
}
