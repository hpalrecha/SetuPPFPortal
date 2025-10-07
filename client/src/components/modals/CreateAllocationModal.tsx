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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const allocationSchema = z.object({
  level: z.enum(['DEALERSHIP', 'SHOWROOM'], { required_error: "Level is required" }),
  levelId: z.string().optional(), // Single ID for dealership
  showroomIds: z.array(z.string()).optional(), // Multiple IDs for showrooms
  partnerId: z.string().min(1, "Please select a partner"),
  brandIds: z.array(z.string()).min(1, "Please select at least one brand"),
  priority: z.number().min(1).max(10).default(1),
  partnerBillsDirectly: z.boolean().default(false),
  active: z.boolean().default(true),
}).refine(
  (data) => {
    // For DEALERSHIP, require levelId
    if (data.level === "DEALERSHIP") {
      return data.levelId && data.levelId.length > 0;
    }
    // For SHOWROOM, require at least one showroom
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
  const isEditing = !!allocation;

  const form = useForm<AllocationFormData>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      level: "DEALERSHIP",
      levelId: "",
      showroomIds: [],
      partnerId: "",
      brandIds: [],
      priority: 1,
      partnerBillsDirectly: false,
      active: true,
    },
  });

  const selectedLevel = form.watch("level");
  const selectedPartnerId = form.watch("partnerId");

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ["/api/p91/brands"],
    queryFn: async () => {
      const response = await fetch('/api/p91/brands', {
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
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partner brands');
      return response.json();
    },
    enabled: open && !!selectedPartnerId,
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
  const availableBrands = brands.filter((brand: any) => partnerBrandIds.includes(brand.id));

  // Reset form when allocation prop changes (for editing)
  useEffect(() => {
    if (allocation && open) {
      form.reset({
        level: allocation.level || "DEALERSHIP",
        levelId: allocation.levelId || "",
        showroomIds: allocation.level === "SHOWROOM" ? [allocation.levelId] : [],
        partnerId: allocation.partnerId || "",
        brandIds: allocationBrandsData?.brandIds || [],
        priority: allocation.priority || 1,
        partnerBillsDirectly: allocation.partnerBillsDirectly ?? false,
        active: allocation.active ?? true,
      });
    } else if (!allocation && open) {
      form.reset({
        level: "DEALERSHIP",
        levelId: "",
        showroomIds: [],
        partnerId: "",
        brandIds: [],
        priority: 1,
        partnerBillsDirectly: false,
        active: true,
      });
    }
  }, [allocation, open, form, allocationBrandsData]);

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

  // Fetch showrooms
  const { data: showrooms = [] } = useQuery({
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

  // Fetch partners with their service categories
  const { data: partners = [] } = useQuery({
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

  const onSubmit = async (data: AllocationFormData) => {
    setIsLoading(true);
    try {
      // For editing, use single allocation endpoint
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
        // For creating, handle multiple showrooms
        if (data.level === "SHOWROOM" && data.showroomIds && data.showroomIds.length > 0) {
          // Create multiple allocations - one for each showroom
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
          // Single dealership allocation
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

  const getLevelOptions = () => {
    if (selectedLevel === "DEALERSHIP") {
      return dealerships.map((dealership) => ({
        value: dealership.id,
        label: dealership.name,
      }));
    } else {
      return showrooms.map((showroom) => ({
        value: showroom.id,
        label: showroom.name,
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-create-allocation">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Partner Allocation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("levelId", ""); // Reset levelId when level changes
                      }} 
                      defaultValue={field.value}
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

              {selectedLevel === "DEALERSHIP" ? (
                <FormField
                  control={form.control}
                  name="levelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealership</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-level-id">
                            <SelectValue placeholder="Select dealership" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getLevelOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="showroomIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Showrooms (Select Multiple)</FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {showrooms.map((showroom: any) => (
                            <div key={showroom.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`showroom-${showroom.id}`}
                                checked={field.value?.includes(showroom.id) || false}
                                onCheckedChange={(checked) => {
                                  const currentValues = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValues, showroom.id]);
                                  } else {
                                    field.onChange(currentValues.filter((id: string) => id !== showroom.id));
                                  }
                                }}
                                data-testid={`checkbox-showroom-${showroom.id}`}
                              />
                              <label
                                htmlFor={`showroom-${showroom.id}`}
                                className="text-sm cursor-pointer"
                              >
                                {showroom.name}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("brandIds", []); // Reset brands when partner changes
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-partner">
                        <SelectValue placeholder="Select partner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partners.map((partner) => {
                        const serviceCategories = partner.serviceCategories || [];
                        const categoryNames = serviceCategories.map(cat => cat.name).join(', ');
                        const categoryDisplay = categoryNames || 'No specializations';
                        
                        return (
                          <SelectItem key={partner.id} value={partner.id}>
                            <div className="flex flex-col items-start">
                              <div className="font-medium">
                                {partner.displayName} ({partner.type})
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Specializes in: {categoryDisplay}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Brand Selection - only show if partner is selected */}
            {selectedPartnerId && (
              <FormField
                control={form.control}
                name="brandIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Brands (Select at least one)</FormLabel>
                    {availableBrands.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">
                        No brands assigned to this partner. Please assign brands to the partner first.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {availableBrands.map((brand: any) => (
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
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
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
                  <FormItem className="flex flex-col space-y-2">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Partner Bills Directly Toggle */}
            <FormField
              control={form.control}
              name="partnerBillsDirectly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Partner Bills Customer Directly
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      When enabled, this partner bills the customer directly and the system will not handle billing for their job cards.
                    </div>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? "Saving..." : isEditing ? "Update Allocation" : "Create Allocation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}