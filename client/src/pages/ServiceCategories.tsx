import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreateServiceCategoryModal } from '@/components/modals/CreateServiceCategoryModal';
import { EditServiceCategoryModal } from '@/components/modals/EditServiceCategoryModal';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import type { ServiceCategory } from '@shared/schema';

export default function ServiceCategoriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery<ServiceCategory[]>({
    queryKey: ['/api/service-categories'],
    enabled: !!user
  });

  const deleteServiceCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await apiRequest('DELETE', `/api/service-categories/${categoryId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-categories'] });
      toast({
        title: "Success",
        description: "Service category deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete service category",
        variant: "destructive"
      });
    }
  });

  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this service category? This action cannot be undone.')) {
      deleteServiceCategoryMutation.mutate(categoryId);
    }
  };

  const filteredCategories = categories.filter((category: ServiceCategory) =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Only Super Admins can manage service categories
  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to manage service categories.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="service-categories-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="page-title">
            Service Categories Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="page-description">
            Manage service category types and their properties
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          data-testid="button-create-category"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="categories-grid">
        {filteredCategories.map((category) => (
          <Card key={category.id} className="hover:shadow-md transition-shadow" data-testid={`card-category-${category.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-category-name-${category.id}`}>
                    {category.color && (
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: category.color }}
                        data-testid={`color-indicator-${category.id}`}
                      />
                    )}
                    {category.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <Badge variant="secondary" data-testid={`text-category-code-${category.id}`}>
                      {category.code}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCategory(category)}
                    data-testid={`button-edit-${category.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={deleteServiceCategoryMutation.isPending}
                    data-testid={`button-delete-${category.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {category.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-400" data-testid={`text-category-description-${category.id}`}>
                  {category.description}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12" data-testid="empty-state">
          <Palette className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            {searchTerm ? 'No categories found' : 'No service categories'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first service category.'}
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-create-first-category"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Category
            </Button>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateServiceCategoryModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      )}

      {editingCategory && (
        <EditServiceCategoryModal
          open={!!editingCategory}
          onOpenChange={(open: boolean) => !open && setEditingCategory(null)}
          category={editingCategory}
        />
      )}
    </div>
  );
}