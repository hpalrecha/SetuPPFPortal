import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { insertServiceSchema, serviceGroupValues, availabilityScopeValues } from '@shared/schema';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';

// Transform shared schema to UI-compatible types using shared enums
const serviceSchema = insertServiceSchema.extend({
  description: z.string().optional(),
  serviceCategoryId: z.string().optional(), // NEW: Use serviceCategoryId instead of legacy serviceGroup
  productBrand: z.string().optional(),
  availabilityScope: z.enum(availabilityScopeValues),
  oemId: z.string().optional(),
  dealershipId: z.string().optional(),
  oemIds: z.array(z.string()).optional(),
  dealershipIds: z.array(z.string()).optional(),
  rawMaterialIds: z.array(z.string()).optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: any;
  onSuccess: () => void;
}

export function EditServiceModal({ open, onOpenChange, service, onSuccess }: EditServiceModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawMaterialsOpen, setRawMaterialsOpen] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      serviceCategoryId: undefined, // Use serviceCategoryId
      productBrand: '',
      availabilityScope: 'GLOBAL',
      oemId: '',
      dealershipId: '',
      oemIds: [],
      dealershipIds: [],
      rawMaterialIds: [],
    },
  });

  // Fetch service categories
  const { data: serviceCategories = [] } = useQuery({
    queryKey: ['/api/service-categories'],
    enabled: open,
  });

  // Fetch raw materials
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['/api/p91/raw_material'],
    enabled: open,
  });

  // Fetch existing raw materials for this service
  const { data: existingMaterials = [] } = useQuery({
    queryKey: ['/api/p91/service', service?.id, 'raw_materials'],
    enabled: open && !!service?.id,
  });

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ['/api/p91/brand'],
    enabled: open,
  });

  // Update form when service changes
  useEffect(() => {
    if (service && open) {
      form.reset({
        name: service.name || '',
        code: service.code || '',
        description: service.description || '',
        serviceCategoryId: service.serviceCategoryId || undefined, // Use serviceCategoryId
        productBrand: service.productBrand || '',
        availabilityScope: service.availabilityScope || 'GLOBAL',
        oemId: service.oemId || '',
        dealershipId: service.dealershipId || '',
        oemIds: service.oemIds || [],
        dealershipIds: service.dealershipIds || [],
        rawMaterialIds: existingMaterials.map((m: any) => m.id) || [],
      });
    }
  }, [service, open, form, existingMaterials]);

  // Fetch OEMs for Super Admin
  const { data: oems = [] } = useQuery({
    queryKey: ['/api/oems'],
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
    enabled: isSuperAdmin && open,
  });

  // Watch scope and OEM selection to fetch dealerships
  const selectedOemId = form.watch('oemId');
  const watchedScope = form.watch('availabilityScope');
  const { data: dealershipData } = useQuery<{ dealerships: any[]; total: number }>({
    queryKey: ['/api/dealerships', selectedOemId, watchedScope],
    queryFn: async () => {
      const url = watchedScope === 'MULTIPLE_DEALERSHIPS' 
        ? '/api/dealerships?limit=1000' 
        : `/api/dealerships?oemId=${selectedOemId}&limit=1000`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: isSuperAdmin && open && (watchedScope === 'MULTIPLE_DEALERSHIPS' || !!selectedOemId),
  });
  const dealerships = dealershipData?.dealerships || [];

  const updateServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const { rawMaterialIds, ...serviceData } = data;
      
      // Update service first
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(serviceData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update service');
      }
      const updatedService = await response.json();
      
      // Update raw materials
      const currentMaterialIds = existingMaterials.map((m: any) => m.id);
      const newMaterialIds = rawMaterialIds || [];
      
      // Remove materials that are no longer selected
      const materialsToRemove = currentMaterialIds.filter((id: string) => !newMaterialIds.includes(id));
      for (const materialId of materialsToRemove) {
        await fetch(`/api/p91/service/${service.id}/raw_materials/${materialId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
        });
      }
      
      // Add new materials
      const materialsToAdd = newMaterialIds.filter((id: string) => !currentMaterialIds.includes(id));
      for (const materialId of materialsToAdd) {
        await fetch(`/api/p91/service/${service.id}/raw_materials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
          body: JSON.stringify({ rawMaterialId: materialId }),
        });
      }
      
      return updatedService;
    },
    onSuccess: () => {
      // Refetch the service materials to ensure fresh data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/p91/service', service.id, 'raw_materials'] 
      });
      toast({
        title: 'Success',
        description: 'Service updated successfully',
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update service',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: ServiceFormData) => {
    setIsSubmitting(true);
    
    // Validate scope requirements
    if (data.availabilityScope === 'OEM_SPECIFIC' && !data.oemId) {
      toast({
        title: 'Error',
        description: 'OEM selection is required for OEM-specific services',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    
    if (data.availabilityScope === 'DEALERSHIP_SPECIFIC' && (!data.oemId || !data.dealershipId)) {
      toast({
        title: 'Error',
        description: 'OEM and Dealership selection is required for dealership-specific services',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    
    if (data.availabilityScope === 'MULTIPLE_OEMS' && !data.oemIds?.length) {
      toast({
        title: 'Error',
        description: 'At least one OEM must be selected',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    
    if (data.availabilityScope === 'MULTIPLE_DEALERSHIPS' && !data.dealershipIds?.length) {
      toast({
        title: 'Error',
        description: 'At least one Dealership must be selected',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    // Clean up data based on scope
    const cleanData = { ...data };
    if (cleanData.availabilityScope === 'GLOBAL') {
      delete cleanData.oemId;
      delete cleanData.dealershipId;
      delete cleanData.oemIds;
      delete cleanData.dealershipIds;
    } else if (cleanData.availabilityScope === 'OEM_SPECIFIC') {
      delete cleanData.dealershipId;
      delete cleanData.oemIds;
      delete cleanData.dealershipIds;
    } else if (cleanData.availabilityScope === 'DEALERSHIP_SPECIFIC') {
      delete cleanData.oemIds;
      delete cleanData.dealershipIds;
    } else if (cleanData.availabilityScope === 'MULTIPLE_OEMS') {
      delete cleanData.oemId;
      delete cleanData.dealershipId;
      delete cleanData.dealershipIds;
    } else if (cleanData.availabilityScope === 'MULTIPLE_DEALERSHIPS') {
      delete cleanData.oemId;
      delete cleanData.dealershipId;
      delete cleanData.oemIds;
    }

    // Ensure rawMaterialIds is included
    updateServiceMutation.mutate({
      ...cleanData,
      rawMaterialIds: data.rawMaterialIds
    });
    setIsSubmitting(false);
  };

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Paint Protection Film"
                        {...field}
                        data-testid="input-edit-service-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., PPF_FULL"
                        {...field}
                        data-testid="input-edit-service-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Service description..."
                      {...field}
                      data-testid="textarea-edit-service-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    data-testid="select-edit-service-category"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select service category" />
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

            <FormField
              control={form.control}
              name="productBrand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Brand (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-product-brand">
                        <SelectValue placeholder="Select a brand (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {brands.map((brand: any) => (
                        <SelectItem key={brand.id} value={brand.name}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Raw Materials Selection */}
            {rawMaterials.length > 0 && (
              <FormField
                control={form.control}
                name="rawMaterialIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Raw Materials Used (Optional)</FormLabel>
                    <div className="space-y-2">
                      <Popover open={rawMaterialsOpen} onOpenChange={setRawMaterialsOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={rawMaterialsOpen}
                              className="w-full justify-between"
                              data-testid="button-edit-select-materials"
                            >
                              {field.value?.length 
                                ? `${field.value.length} material${field.value.length > 1 ? 's' : ''} selected`
                                : "Select materials..."}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command className="overflow-visible">
                            <CommandInput placeholder="Search materials..." />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                              <CommandEmpty>No materials found.</CommandEmpty>
                              <CommandGroup>
                                {rawMaterials.map((material: any) => {
                                  const isSelected = field.value?.includes(material.id);
                                  return (
                                    <CommandItem
                                      key={material.id}
                                      value={`${material.name} ${material.brand || ''}`}
                                      onSelect={() => {
                                        const currentValue = field.value || [];
                                        if (isSelected) {
                                          field.onChange(currentValue.filter((id: string) => id !== material.id));
                                        } else {
                                          field.onChange([...currentValue, material.id]);
                                        }
                                      }}
                                      data-testid={`command-item-edit-material-${material.id}`}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          isSelected ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{material.name}</span>
                                        {material.brand && (
                                          <span className="text-xs text-muted-foreground">{material.brand}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                      {/* Display selected materials as badges */}
                      {field.value && field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((materialId: string) => {
                            const material = rawMaterials.find((m: any) => m.id === materialId);
                            if (!material) return null;
                            return (
                              <Badge 
                                key={materialId} 
                                variant="secondary" 
                                className="gap-1 flex items-center"
                                data-testid={`badge-edit-material-${materialId}`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{material.name}</span>
                                  {material.brand && (
                                    <span className="text-xs opacity-80">{material.brand}</span>
                                  )}
                                </div>
                                <X
                                  className="h-3 w-3 cursor-pointer ml-1"
                                  onClick={() => {
                                    field.onChange(field.value?.filter((id: string) => id !== materialId));
                                  }}
                                />
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Availability Scope */}
            <FormField
              control={form.control}
              name="availabilityScope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Availability Scope</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('oemId', '');
                      form.setValue('dealershipId', '');
                      form.setValue('oemIds', []);
                      form.setValue('dealershipIds', []);
                    }}
                    value={field.value}
                    data-testid="select-edit-availability-scope"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select availability scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GLOBAL">Global - Available to All</SelectItem>
                      <SelectItem value="OEM_SPECIFIC">OEM Specific</SelectItem>
                      <SelectItem value="DEALERSHIP_SPECIFIC">Dealership Specific</SelectItem>
                      <SelectItem value="MULTIPLE_OEMS">Multiple OEMs</SelectItem>
                      <SelectItem value="MULTIPLE_DEALERSHIPS">Multiple Dealerships</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* OEM Selection (for OEM_SPECIFIC and DEALERSHIP_SPECIFIC scopes) */}
            {isSuperAdmin && (watchedScope === 'OEM_SPECIFIC' || watchedScope === 'DEALERSHIP_SPECIFIC') && (
              <FormField
                control={form.control}
                name="oemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OEM</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (watchedScope === 'DEALERSHIP_SPECIFIC') {
                          form.setValue('dealershipId', '');
                        }
                      }}
                      value={field.value}
                      data-testid="select-edit-oem"
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
            )}

            {/* Dealership Selection (for DEALERSHIP_SPECIFIC scope) */}
            {isSuperAdmin && watchedScope === 'DEALERSHIP_SPECIFIC' && selectedOemId && (
              <FormField
                control={form.control}
                name="dealershipId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dealership</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-edit-dealership"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Dealership" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dealerships.map((dealership: any) => (
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
            )}

            {/* Multiple OEMs Selection (for MULTIPLE_OEMS scope) */}
            {isSuperAdmin && watchedScope === 'MULTIPLE_OEMS' && (
              <FormField
                control={form.control}
                name="oemIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select OEMs</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={oems.map((oem: any) => ({ value: oem.id, label: oem.name }))}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Search and select OEMs..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Multiple Dealerships Selection (for MULTIPLE_DEALERSHIPS scope) */}
            {isSuperAdmin && watchedScope === 'MULTIPLE_DEALERSHIPS' && (
              <FormField
                control={form.control}
                name="dealershipIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Dealerships</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={dealerships.map((dealership: any) => ({ 
                          value: dealership.id, 
                          label: dealership.name 
                        }))}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Search and select dealerships..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-update-service"
              >
                {isSubmitting ? 'Updating...' : 'Update Service'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}