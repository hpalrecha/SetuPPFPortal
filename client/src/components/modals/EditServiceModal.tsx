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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { insertServiceSchema, serviceGroupValues, availabilityScopeValues } from '@shared/schema';

// Transform shared schema to UI-compatible types using shared enums
const serviceSchema = insertServiceSchema.extend({
  description: z.string().optional(),
  serviceGroup: z.enum(serviceGroupValues).optional(),
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

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      serviceGroup: undefined,
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

  // Update form when service changes
  useEffect(() => {
    if (service && open) {
      form.reset({
        name: service.name || '',
        code: service.code || '',
        description: service.description || '',
        serviceGroup: service.serviceGroup || undefined,
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
  const { data: dealerships = [] } = useQuery({
    queryKey: ['/api/dealerships', selectedOemId, watchedScope],
    queryFn: async () => {
      const url = watchedScope === 'MULTIPLE' 
        ? '/api/dealerships' 
        : `/api/dealerships?oemId=${selectedOemId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: isSuperAdmin && open && (watchedScope === 'MULTIPLE' || !!selectedOemId),
  });

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
    if (data.availabilityScope === 'OEM' && !data.oemId) {
      toast({
        title: 'Error',
        description: 'OEM selection is required for OEM-specific services',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    
    if (data.availabilityScope === 'DEALERSHIP' && (!data.oemId || !data.dealershipId)) {
      toast({
        title: 'Error',
        description: 'OEM and Dealership selection is required for dealership-specific services',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }
    
    if (data.availabilityScope === 'MULTIPLE' && (!data.oemIds?.length && !data.dealershipIds?.length)) {
      toast({
        title: 'Error',
        description: 'At least one OEM or Dealership must be selected for multiple scope services',
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
    } else if (cleanData.availabilityScope === 'OEM') {
      delete cleanData.dealershipId;
      delete cleanData.oemIds;
      delete cleanData.dealershipIds;
    } else if (cleanData.availabilityScope === 'DEALERSHIP') {
      delete cleanData.oemIds;
      delete cleanData.dealershipIds;
    } else if (cleanData.availabilityScope === 'MULTIPLE') {
      delete cleanData.oemId;
      delete cleanData.dealershipId;
    }

    updateServiceMutation.mutate(cleanData);
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
              name="serviceGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    data-testid="select-edit-service-group"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select service category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {serviceCategories.map((category: any) => (
                        <SelectItem key={category.id} value={category.code}>
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
                  <FormControl>
                    <Input
                      placeholder="e.g., 3M, XPEL, SunTek"
                      {...field}
                      data-testid="input-edit-product-brand"
                    />
                  </FormControl>
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
                    <FormControl>
                      <div className="grid grid-cols-1 gap-3 max-h-40 overflow-y-auto border rounded-md p-3">
                        {rawMaterials.map((material: any) => (
                          <div key={material.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-material-${material.id}`}
                              checked={field.value?.includes(material.id) || false}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, material.id]);
                                } else {
                                  field.onChange(currentValue.filter((id: string) => id !== material.id));
                                }
                              }}
                              data-testid={`checkbox-edit-material-${material.id}`}
                            />
                            <Label htmlFor={`edit-material-${material.id}`} className="text-sm font-normal">
                              {material.name} {material.brand && `(${material.brand})`}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </FormControl>
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
                      <SelectItem value="OEM">OEM Specific</SelectItem>
                      <SelectItem value="DEALERSHIP">Dealership Specific</SelectItem>
                      <SelectItem value="MULTIPLE">Multiple OEMs/Dealerships</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* OEM Selection (for OEM and DEALERSHIP scopes) */}
            {isSuperAdmin && (watchedScope === 'OEM' || watchedScope === 'DEALERSHIP') && (
              <FormField
                control={form.control}
                name="oemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OEM</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (watchedScope === 'DEALERSHIP') {
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

            {/* Dealership Selection (for DEALERSHIP scope) */}
            {isSuperAdmin && watchedScope === 'DEALERSHIP' && selectedOemId && (
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

            {/* Multiple OEMs Selection (for MULTIPLE scope) */}
            {isSuperAdmin && watchedScope === 'MULTIPLE' && (
              <FormField
                control={form.control}
                name="oemIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select OEMs</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 gap-3 max-h-40 overflow-y-auto border rounded-md p-3">
                        {oems.map((oem: any) => (
                          <div key={oem.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-oem-${oem.id}`}
                              checked={field.value?.includes(oem.id) || false}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, oem.id]);
                                } else {
                                  field.onChange(currentValue.filter((id: string) => id !== oem.id));
                                }
                              }}
                              data-testid={`checkbox-edit-oem-${oem.id}`}
                            />
                            <Label htmlFor={`edit-oem-${oem.id}`} className="text-sm font-normal">
                              {oem.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Multiple Dealerships Selection (for MULTIPLE scope) */}
            {isSuperAdmin && watchedScope === 'MULTIPLE' && oems.length > 0 && (
              <FormField
                control={form.control}
                name="dealershipIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Dealerships</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 gap-3 max-h-40 overflow-y-auto border rounded-md p-3">
                        {oems.map((oem: any) => (
                          <div key={oem.id} className="space-y-2">
                            <div className="font-medium text-sm text-muted-foreground border-b pb-1">
                              {oem.name}
                            </div>
                            {dealerships
                              .filter((dealership: any) => dealership.oemId === oem.id)
                              .map((dealership: any) => (
                                <div key={dealership.id} className="flex items-center space-x-2 ml-4">
                                  <Checkbox
                                    id={`edit-dealership-${dealership.id}`}
                                    checked={field.value?.includes(dealership.id) || false}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, dealership.id]);
                                      } else {
                                        field.onChange(currentValue.filter((id: string) => id !== dealership.id));
                                      }
                                    }}
                                    data-testid={`checkbox-edit-dealership-${dealership.id}`}
                                  />
                                  <Label htmlFor={`edit-dealership-${dealership.id}`} className="text-sm font-normal">
                                    {dealership.name}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
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