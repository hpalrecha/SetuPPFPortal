import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  code: z.string().min(1, 'Service code is required'),
  description: z.string().optional(),
  productBrand: z.string().optional(),
  availabilityScope: z.enum(['GLOBAL', 'OEM', 'DEALERSHIP']),
  oemId: z.string().optional(),
  dealershipId: z.string().optional(),
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
      productBrand: '',
      availabilityScope: 'GLOBAL',
      oemId: '',
      dealershipId: '',
    },
  });

  // Update form when service changes
  useEffect(() => {
    if (service && open) {
      form.reset({
        name: service.name || '',
        code: service.code || '',
        description: service.description || '',
        productBrand: service.productBrand || '',
        availabilityScope: service.availabilityScope || 'GLOBAL',
        oemId: service.oemId || '',
        dealershipId: service.dealershipId || '',
      });
    }
  }, [service, open, form]);

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

  // Watch OEM selection to fetch dealerships
  const selectedOemId = form.watch('oemId');
  const { data: dealerships = [] } = useQuery({
    queryKey: ['/api/dealerships', selectedOemId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships?oemId=${selectedOemId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    enabled: isSuperAdmin && open && !!selectedOemId,
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update service');
      }
      return response.json();
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

    // Clean up data based on scope
    const cleanData = { ...data };
    if (cleanData.availabilityScope === 'GLOBAL') {
      delete cleanData.oemId;
      delete cleanData.dealershipId;
    } else if (cleanData.availabilityScope === 'OEM') {
      delete cleanData.dealershipId;
    }

    updateServiceMutation.mutate(cleanData);
    setIsSubmitting(false);
  };

  const watchedScope = form.watch('availabilityScope');

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
                      if (value !== 'OEM' && value !== 'DEALERSHIP') {
                        form.setValue('oemId', '');
                        form.setValue('dealershipId', '');
                      }
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