import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Package, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreateRawMaterialModal } from '@/components/modals/CreateRawMaterialModal';
import { EditRawMaterialModal } from '@/components/modals/EditRawMaterialModal';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

export default function RawMaterialsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['/api/p91/raw_material'],
    enabled: !!user
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['/api/p91/brand'],
    enabled: !!user
  });

  const getBrandName = (brandId: string | null) => {
    if (!brandId) return null;
    const brand = brands.find((b: any) => b.id === brandId);
    return brand?.name || null;
  };

  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const response = await apiRequest('DELETE', `/api/p91/raw_material/delete/${materialId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p91/raw_material'] });
      toast({
        title: "Success",
        description: "Raw material deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete raw material",
        variant: "destructive"
      });
    }
  });

  const handleDeleteMaterial = (materialId: string) => {
    if (window.confirm('Are you sure you want to delete this raw material? This action cannot be undone.')) {
      deleteMaterialMutation.mutate(materialId);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      const materials: { name: string; brandId: string | null }[] = [];
      
      // Skip header (line 0) and process all data lines
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        // Parse CSV line (handles quoted fields)
        const matches = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
        if (!matches) continue;
        
        const [, , , , itemName] = matches;
        
        if (itemName) {
          materials.push({
            name: itemName,
            brandId: null
          });
        }
      }

      if (materials.length === 0) {
        toast({
          title: "No data found",
          description: "The CSV file appears to be empty or invalid",
          variant: "destructive"
        });
        setIsImporting(false);
        return;
      }

      // Import materials one by one
      let successCount = 0;
      let errorCount = 0;

      for (const material of materials) {
        try {
          await apiRequest('POST', '/api/p91/raw_material/add', material);
          successCount++;
        } catch (error) {
          console.error(`Failed to import ${material.name}:`, error);
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/p91/raw_material'] });

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} materials${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "Failed to process the CSV file",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredMaterials = materials.filter((material: any) => {
    const brandName = getBrandName(material.brandId);
    return material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (brandName && brandName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (material.description && material.description.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Only Super Admins can manage raw materials
  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to manage raw materials.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="raw-materials-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="page-title">
            Raw Materials Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="page-description">
            Manage raw materials, inventory, and pricing
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-csv-file"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={isImporting}
            data-testid="button-import-csv"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? 'Importing...' : 'Import CSV'}
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-create-material"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Material
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="materials-grid">
        {filteredMaterials.map((material: any) => (
          <Card key={material.id} className="hover:shadow-md transition-shadow" data-testid={`card-material-${material.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-material-name-${material.id}`}>
                    <Package className="w-4 h-4 text-blue-600" />
                    {material.name}
                  </CardTitle>
                  <CardDescription className="mt-2 space-y-1">
                    {getBrandName(material.brandId) && (
                      <Badge variant="secondary" data-testid={`text-material-brand-${material.id}`}>
                        {getBrandName(material.brandId)}
                      </Badge>
                    )}
                    {material.estimatedPrice && (
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300" data-testid={`text-material-price-${material.id}`}>
                        ₹{Number(material.estimatedPrice).toFixed(2)}/{material.unit || 'unit'}
                      </div>
                    )}
                    {material.stockQuantity != null && (
                      <div className="text-sm text-gray-600 dark:text-gray-400" data-testid={`text-material-stock-${material.id}`}>
                        Stock: {material.stockQuantity} {material.unit || 'units'}
                      </div>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingMaterial(material)}
                    data-testid={`button-edit-${material.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMaterial(material.id)}
                    disabled={deleteMaterialMutation.isPending}
                    data-testid={`button-delete-${material.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {material.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-400" data-testid={`text-material-description-${material.id}`}>
                  {material.description}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {filteredMaterials.length === 0 && (
        <div className="text-center py-12" data-testid="empty-state">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            {searchTerm ? 'No materials found' : 'No raw materials'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first raw material.'}
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-create-first-material"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Material
            </Button>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateRawMaterialModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      )}

      {editingMaterial && (
        <EditRawMaterialModal
          open={!!editingMaterial}
          onOpenChange={(open: boolean) => !open && setEditingMaterial(null)}
          material={editingMaterial}
        />
      )}
    </div>
  );
}
