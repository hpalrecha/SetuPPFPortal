import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { MultiSelect } from '@/components/ui/multi-select';
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

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateServiceModal({ open, onOpenChange, onSuccess }: CreateServiceModalProps) {
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

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ['/api/p91/brand'],
    enabled: open,
  });

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
      const url = watchedScope === 'MULTIPLE_DEALERSHIPS' 
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
    enabled: isSuperAdmin && open && (watchedScope === 'MULTIPLE_DEALERSHIPS' || !!selectedOemId),
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const { rawMaterialIds, ...serviceData } = data;
      
      console.log('Creating service with data:', serviceData);
      
      // Create service first
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(serviceData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create service');
      }
      const service = await response.json();
      
      // Add raw materials if selected
      if (rawMaterialIds && rawMaterialIds.length > 0) {
        for (const materialId of rawMaterialIds) {
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
      }
      
      return service;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Service created successfully',
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create service',
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

    // Clean up data based on scope - remove unused fields
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

    createServiceMutation.mutate(cleanData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Service</DialogTitle>
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
                        data-testid="input-service-name"
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
                        data-testid="input-service-code"
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
                      data-testid="textarea-service-description"
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
                    data-testid="select-service-group"
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-product-brand">
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
                    <FormControl>
                      <MultiSelect
                        options={rawMaterials.map((material: any) => ({
                          label: material.brand ? `${material.name} (${material.brand})` : material.name,
                          value: material.id,
                        }))}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select materials..."
                      />
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
                    data-testid="select-availability-scope"
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
                      data-testid="select-oem"
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
                      data-testid="select-dealership"
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
                        options={oems.map((oem: any) => ({
                          label: oem.name,
                          value: oem.id,
                        }))}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select OEMs..."
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
                          label: `${dealership.name}${dealership.oemIds?.length > 0 ? ` (${oems.find((o: any) => dealership.oemIds.includes(o.id))?.name || 'Multi-OEM'})` : ''}`,
                          value: dealership.id,
                        }))}
                        selected={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select Dealerships..."
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
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-create-service"
              >
                {isSubmitting ? 'Creating...' : 'Create Service'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}