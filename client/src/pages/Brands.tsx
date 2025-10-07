import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Brand {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BrandsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: brands = [], isLoading } = useQuery<Brand[]>({
    queryKey: ['/api/p91/brand'],
    enabled: !!user
  });

  const createBrandMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/p91/brand', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p91/brand'] });
      toast({
        title: "Success",
        description: "Brand created successfully"
      });
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create brand",
        variant: "destructive"
      });
    }
  });

  const updateBrandMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string } }) => {
      const response = await apiRequest('PUT', `/api/p91/brand/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p91/brand'] });
      toast({
        title: "Success",
        description: "Brand updated successfully"
      });
      setEditingBrand(null);
      setFormData({ name: '', description: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update brand",
        variant: "destructive"
      });
    }
  });

  const deleteBrandMutation = useMutation({
    mutationFn: async (brandId: string) => {
      const response = await apiRequest('DELETE', `/api/p91/brand/${brandId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p91/brand'] });
      toast({
        title: "Success",
        description: "Brand deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete brand",
        variant: "destructive"
      });
    }
  });

  const handleDeleteBrand = (brandId: string) => {
    if (window.confirm('Are you sure you want to delete this brand? This action cannot be undone.')) {
      deleteBrandMutation.mutate(brandId);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Brand name is required",
        variant: "destructive"
      });
      return;
    }
    createBrandMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !editingBrand) {
      toast({
        title: "Validation Error",
        description: "Brand name is required",
        variant: "destructive"
      });
      return;
    }
    updateBrandMutation.mutate({ id: editingBrand.id, data: formData });
  };

  const openEditModal = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({ name: brand.name, description: brand.description || '' });
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setEditingBrand(null);
    setFormData({ name: '', description: '' });
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (brand.description && brand.description.toLowerCase().includes(searchTerm.toLowerCase()))
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

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to manage brands.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="brands-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="page-title">
            Brand Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="page-description">
            Manage brand catalog and information
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          data-testid="button-create-brand"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Brand
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search brands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="brands-grid">
        {filteredBrands.map((brand) => (
          <Card key={brand.id} className="hover:shadow-lg transition-shadow" data-testid={`card-brand-${brand.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-brand-name-${brand.id}`}>
                      {brand.name}
                    </CardTitle>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                  Active
                </Badge>
              </div>
              {brand.description && (
                <CardDescription className="mt-2 text-sm" data-testid={`text-brand-description-${brand.id}`}>
                  {brand.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(brand)}
                  className="flex-1"
                  data-testid={`button-edit-${brand.id}`}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteBrand(brand.id)}
                  className="flex-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  data-testid={`button-delete-${brand.id}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBrands.length === 0 && (
        <div className="text-center py-12">
          <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No brands found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'Get started by adding your first brand'}
          </p>
        </div>
      )}

      {/* Create Brand Modal */}
      <Dialog open={showCreateModal} onOpenChange={closeModals}>
        <DialogContent data-testid="modal-create-brand">
          <DialogHeader>
            <DialogTitle>Create New Brand</DialogTitle>
            <DialogDescription>
              Add a new brand to the system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Brand Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter brand name"
                  data-testid="input-brand-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter brand description (optional)"
                  rows={3}
                  data-testid="input-brand-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModals} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createBrandMutation.isPending}
                data-testid="button-submit"
              >
                {createBrandMutation.isPending ? 'Creating...' : 'Create Brand'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Brand Modal */}
      <Dialog open={!!editingBrand} onOpenChange={closeModals}>
        <DialogContent data-testid="modal-edit-brand">
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
            <DialogDescription>
              Update brand information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Brand Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter brand name"
                  data-testid="input-edit-brand-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter brand description (optional)"
                  rows={3}
                  data-testid="input-edit-brand-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModals} data-testid="button-edit-cancel">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateBrandMutation.isPending}
                data-testid="button-edit-submit"
              >
                {updateBrandMutation.isPending ? 'Updating...' : 'Update Brand'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
