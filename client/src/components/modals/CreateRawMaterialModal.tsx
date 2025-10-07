import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const materialSchema = z.object({
  name: z.string().min(1, 'Material name is required'),
  brand: z.string().optional(),
  description: z.string().optional(),
  estimatedPrice: z.string().optional(),
  unit: z.string().optional(),
  stockQuantity: z.string().optional(),
  gstPercentage: z.string().optional(),
});

type MaterialFormData = z.infer<typeof materialSchema>;

interface CreateRawMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRawMaterialModal({ open, onOpenChange }: CreateRawMaterialModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: '',
      brand: '',
      description: '',
      estimatedPrice: '',
      unit: '',
      stockQuantity: '',
      gstPercentage: '',
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (data: MaterialFormData) => {
      const payload = {
        name: data.name,
        brand: data.brand || null,
        description: data.description || null,
        estimatedPrice: data.estimatedPrice ? parseFloat(data.estimatedPrice) : null,
        unit: data.unit || null,
        stockQuantity: data.stockQuantity ? parseInt(data.stockQuantity) : null,
        gstPercentage: data.gstPercentage ? parseFloat(data.gstPercentage) : null,
      };
      const response = await apiRequest('POST', '/api/p91/raw_material/add', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p91/raw_material'] });
      toast({
        title: 'Success',
        description: 'Raw material created successfully',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create raw material',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: MaterialFormData) => {
    setIsSubmitting(true);
    await createMaterialMutation.mutateAsync(data);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="create-material-modal">
        <DialogHeader>
          <DialogTitle>Add Raw Material</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., PPF Film 3M"
                      {...field}
                      data-testid="input-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 3M, XPEL"
                      {...field}
                      data-testid="input-brand"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Material description..."
                      {...field}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Price (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., sq ft, meter"
                        {...field}
                        data-testid="input-unit"
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
                name="stockQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        data-testid="input-stock"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST % (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="18"
                        {...field}
                        data-testid="input-gst"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-submit"
              >
                {isSubmitting ? 'Creating...' : 'Create Material'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
