import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreateServiceModal } from '@/components/modals/CreateServiceModal';
import { EditServiceModal } from '@/components/modals/EditServiceModal';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

export default function ServicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOEMAdmin = user?.role === 'OEM_ADMIN';
  const canManageServices = isSuperAdmin || isOEMAdmin;

  // Fetch service categories
  const { data: serviceCategories = [] } = useQuery({
    queryKey: ['/api/service-categories'],
  });

  // Fetch services
  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/services'],
    queryFn: async () => {
      const response = await fetch('/api/services', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch services');
      return response.json();
    },
  });

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete service');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service",
        variant: "destructive",
      });
    },
  });

  const filteredServices = services.filter((service: any) => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.productBrand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.serviceGroup?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || service.serviceGroup === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (service: any) => {
    setSelectedService(service);
    setEditModalOpen(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      deleteServiceMutation.mutate(serviceId);
    }
  };

  const getAvailabilityBadge = (scope: string, oemId?: string, dealershipId?: string, oemIds?: string[], dealershipIds?: string[]) => {
    switch (scope) {
      case 'GLOBAL':
        return <Badge variant="secondary">Global</Badge>;
      case 'OEM':
        return <Badge variant="outline">OEM Specific</Badge>;
      case 'DEALERSHIP':
        return <Badge variant="destructive">Dealership Only</Badge>;
      case 'MULTIPLE':
        const oemCount = oemIds?.length || 0;
        const dealershipCount = dealershipIds?.length || 0;
        const total = oemCount + dealershipCount;
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Multiple ({total} orgs)</Badge>;
      default:
        return <Badge variant="secondary">Global</Badge>;
    }
  };

  const getServiceGroupLabel = (serviceGroup: string) => {
    // First try to find in dynamic categories
    const category = serviceCategories.find((cat: any) => cat.code === serviceGroup);
    if (category) return category.name;
    
    // Fallback to hardcoded labels for backward compatibility
    const groupLabels: Record<string, string> = {
      'PPF': 'Paint Protection Film',
      'CERAMIC_COATING': 'Ceramic Coating', 
      'WINDOW_TINTING': 'Window Tinting',
      'PAINT_CORRECTION': 'Paint Correction',
      'INTERIOR_PROTECTION': 'Interior Protection',
      'ACCESSORIES': 'Accessories',
      'MAINTENANCE': 'Maintenance',
      'DETAILING': 'Detailing',
      'CUSTOMIZATION': 'Customization'
    };
    return groupLabels[serviceGroup] || serviceGroup;
  };

  const getServiceGroupBadge = (serviceGroup: string) => {
    if (!serviceGroup) return null;
    return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200">{getServiceGroupLabel(serviceGroup)}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Services Management</h1>
          <p className="text-muted-foreground">
            Manage automotive services and their availability
          </p>
        </div>
        {canManageServices && (
          <Button 
            onClick={() => setCreateModalOpen(true)}
            data-testid="button-create-service"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Service
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-services"
          />
        </div>
        
        <div className="w-full sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-category-filter"
          >
            <option value="">All Categories</option>
            {serviceCategories.map((category: any) => (
              <option key={category.id} value={category.code}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service: any) => (
          <Card key={service.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <CardDescription>Code: {service.code}</CardDescription>
                </div>
                {canManageServices && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(service)}
                      data-testid={`button-edit-service-${service.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(service.id)}
                      data-testid={`button-delete-service-${service.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {service.description && (
                <p className="text-sm text-muted-foreground">
                  {service.description}
                </p>
              )}
              
              {service.serviceGroup && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Category:</span>
                  {getServiceGroupBadge(service.serviceGroup)}
                </div>
              )}
              
              {service.productBrand && (
                <div>
                  <span className="text-sm font-medium">Product Brand: </span>
                  <span className="text-sm">{service.productBrand}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Availability:</span>
                {getAvailabilityBadge(service.availabilityScope, service.oemId, service.dealershipId, service.oemIds, service.dealershipIds)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm ? 'No services found matching your search.' : 'No services available.'}
          </p>
          {canManageServices && !searchTerm && (
            <Button 
              onClick={() => setCreateModalOpen(true)}
              className="mt-4"
              data-testid="button-create-first-service"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Service
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateServiceModal 
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          setCreateModalOpen(false);
          refetch();
        }}
      />
      
      <EditServiceModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        service={selectedService}
        onSuccess={() => {
          setEditModalOpen(false);
          setSelectedService(null);
          refetch();
        }}
      />
    </div>
  );
}