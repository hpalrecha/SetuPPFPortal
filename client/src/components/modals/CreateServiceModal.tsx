import { useState } from 'react';
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

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  code: z.string().min(1, 'Service code is required'),
  description: z.string().optional(),
  serviceGroup: z.enum(['PPF', 'CERAMIC_COATING', 'WINDOW_TINTING', 'PAINT_CORRECTION', 'INTERIOR_PROTECTION', 'ACCESSORIES', 'MAINTENANCE', 'DETAILING', 'CUSTOMIZATION']).optional(),
  productBrand: z.string().optional(),
  availabilityScope: z.enum(['GLOBAL', 'OEM', 'DEALERSHIP', 'MULTIPLE']),
  oemId: z.string().optional(),
  dealershipId: z.string().optional(),
  oemIds: z.array(z.string()).optional(),
  dealershipIds: z.array(z.string()).optional(),
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
    },
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

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create service');
      }
      return response.json();
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

    createServiceMutation.mutate(cleanData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
                      <SelectItem value="PPF">Paint Protection Film (PPF)</SelectItem>
                      <SelectItem value="CERAMIC_COATING">Ceramic Coating</SelectItem>
                      <SelectItem value="WINDOW_TINTING">Window Tinting</SelectItem>
                      <SelectItem value="PAINT_CORRECTION">Paint Correction</SelectItem>
                      <SelectItem value="INTERIOR_PROTECTION">Interior Protection</SelectItem>
                      <SelectItem value="ACCESSORIES">Accessories</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="DETAILING">Detailing</SelectItem>
                      <SelectItem value="CUSTOMIZATION">Customization</SelectItem>
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
                      data-testid="input-product-brand"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                              id={`oem-${oem.id}`}
                              checked={field.value?.includes(oem.id) || false}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, oem.id]);
                                } else {
                                  field.onChange(currentValue.filter((id: string) => id !== oem.id));
                                }
                              }}
                              data-testid={`checkbox-oem-${oem.id}`}
                            />
                            <Label htmlFor={`oem-${oem.id}`} className="text-sm font-normal">
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
                                    id={`dealership-${dealership.id}`}
                                    checked={field.value?.includes(dealership.id) || false}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, dealership.id]);
                                      } else {
                                        field.onChange(currentValue.filter((id: string) => id !== dealership.id));
                                      }
                                    }}
                                    data-testid={`checkbox-dealership-${dealership.id}`}
                                  />
                                  <Label htmlFor={`dealership-${dealership.id}`} className="text-sm font-normal">
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