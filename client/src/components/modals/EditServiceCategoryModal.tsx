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
import { insertServiceCategorySchema, type ServiceCategory } from '@shared/schema';

const categorySchema = insertServiceCategorySchema.extend({
  name: z.string().min(1, 'Category name is required'),
  code: z.string().min(1, 'Category code is required').regex(/^[A-Z_]+$/, 'Code must be uppercase letters and underscores only'),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface EditServiceCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ServiceCategory;
}

export function EditServiceCategoryModal({ open, onOpenChange, category }: EditServiceCategoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category.name || '',
      code: category.code || '',
      description: category.description || '',
      color: category.color || '#3b82f6',
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await apiRequest('PUT', `/api/service-categories/${category.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-categories'] });
      toast({
        title: "Success",
        description: "Service category updated successfully"
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to update service category";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: CategoryFormData) => {
    updateCategoryMutation.mutate(data);
  };

  const generateCodeFromName = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleNameChange = (name: string) => {
    form.setValue('name', name);
    // Don't auto-generate code for existing categories unless it's empty
    if (!form.getValues('code')) {
      form.setValue('code', generateCodeFromName(name));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="modal-edit-category">
        <DialogHeader>
          <DialogTitle data-testid="modal-title">Edit Service Category</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Paint Protection Film"
                      onChange={(e) => {
                        handleNameChange(e.target.value);
                      }}
                      data-testid="input-name"
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
                  <FormLabel>Category Code *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., PPF"
                      style={{ textTransform: 'uppercase' }}
                      data-testid="input-code"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional description for this category"
                      rows={3}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Badge Color</FormLabel>
                  <FormControl>
                    <div className="flex gap-2 items-center">
                      <Input
                        {...field}
                        type="color"
                        className="w-16 h-10 p-1 border rounded cursor-pointer"
                        data-testid="input-color"
                      />
                      <Input
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="#3b82f6"
                        className="flex-1"
                        data-testid="input-color-text"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
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
                disabled={updateCategoryMutation.isPending}
                data-testid="button-save"
              >
                {updateCategoryMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}