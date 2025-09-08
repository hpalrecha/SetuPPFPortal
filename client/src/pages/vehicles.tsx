import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Edit, Trash2, Car, Building2, Factory, Upload, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertVehicleBrandSchema, insertVehicleModelSchema, insertVehicleVariantSchema } from '@shared/schema';
import * as XLSX from 'xlsx';

type VehicleBrand = {
  id: string;
  oemId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type VehicleModel = {
  id: string;
  brandId: string;
  modelName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type VehicleVariant = {
  id: string;
  modelId: string;
  variantName: string;
  fuelType?: string;
  transmission?: string;
  engineCapacity?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Oem = {
  id: string;
  name: string;
  active: boolean;
};

const vehicleBrandFormSchema = insertVehicleBrandSchema;
const vehicleModelFormSchema = insertVehicleModelSchema;
const vehicleVariantFormSchema = insertVehicleVariantSchema;

export default function VehiclesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOemId, setSelectedOemId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingBrand, setEditingBrand] = useState<VehicleBrand | null>(null);
  const [editingModel, setEditingModel] = useState<VehicleModel | null>(null);
  const [editingVariant, setEditingVariant] = useState<VehicleVariant | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Fetch OEMs
  const { data: oems = [] } = useQuery<Oem[]>({
    queryKey: ['/api/oems']
  });

  // Fetch Vehicle Brands
  const { data: brands = [], isLoading: brandsLoading } = useQuery<VehicleBrand[]>({
    queryKey: ['/api/vehicle-brands', { oemId: selectedOemId }],
    enabled: !!selectedOemId
  });

  // Fetch Vehicle Models
  const { data: models = [], isLoading: modelsLoading } = useQuery<VehicleModel[]>({
    queryKey: ['/api/vehicle-models', { brandId: selectedBrandId }],
    enabled: !!selectedBrandId
  });

  // Fetch Vehicle Variants
  const { data: variants = [], isLoading: variantsLoading } = useQuery<VehicleVariant[]>({
    queryKey: ['/api/vehicle-variants', { modelId: selectedModelId }],
    enabled: !!selectedModelId
  });

  // Forms
  const brandForm = useForm<z.infer<typeof vehicleBrandFormSchema>>({
    resolver: zodResolver(vehicleBrandFormSchema),
    defaultValues: {
      oemId: selectedOemId,
      name: '',
      active: true
    }
  });

  const modelForm = useForm<z.infer<typeof vehicleModelFormSchema>>({
    resolver: zodResolver(vehicleModelFormSchema),
    defaultValues: {
      brandId: selectedBrandId,
      modelName: '',
      active: true
    }
  });

  const variantForm = useForm<z.infer<typeof vehicleVariantFormSchema>>({
    resolver: zodResolver(vehicleVariantFormSchema),
    defaultValues: {
      modelId: selectedModelId,
      variantName: '',
      fuelType: '',
      transmission: '',
      engineCapacity: '',
      active: true
    }
  });

  // Mutations
  const createBrandMutation = useMutation({
    mutationFn: (data: z.infer<typeof vehicleBrandFormSchema>) =>
      apiRequest('/api/vehicle-brands', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-brands'] });
      setShowBrandDialog(false);
      brandForm.reset();
      toast({ title: 'Brand created successfully' });
    }
  });

  const updateBrandMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<z.infer<typeof vehicleBrandFormSchema>>) =>
      apiRequest(`/api/vehicle-brands/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-brands'] });
      setShowBrandDialog(false);
      setEditingBrand(null);
      brandForm.reset();
      toast({ title: 'Brand updated successfully' });
    }
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/vehicle-brands/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-brands'] });
      toast({ title: 'Brand deleted successfully' });
    }
  });

  const createModelMutation = useMutation({
    mutationFn: (data: z.infer<typeof vehicleModelFormSchema>) =>
      apiRequest('/api/vehicle-models', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-models'] });
      setShowModelDialog(false);
      modelForm.reset();
      toast({ title: 'Model created successfully' });
    }
  });

  const updateModelMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<z.infer<typeof vehicleModelFormSchema>>) =>
      apiRequest(`/api/vehicle-models/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-models'] });
      setShowModelDialog(false);
      setEditingModel(null);
      modelForm.reset();
      toast({ title: 'Model updated successfully' });
    }
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/vehicle-models/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-models'] });
      toast({ title: 'Model deleted successfully' });
    }
  });

  const createVariantMutation = useMutation({
    mutationFn: (data: z.infer<typeof vehicleVariantFormSchema>) =>
      apiRequest('/api/vehicle-variants', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-variants'] });
      setShowVariantDialog(false);
      variantForm.reset();
      toast({ title: 'Variant created successfully' });
    }
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<z.infer<typeof vehicleVariantFormSchema>>) =>
      apiRequest(`/api/vehicle-variants/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-variants'] });
      setShowVariantDialog(false);
      setEditingVariant(null);
      variantForm.reset();
      toast({ title: 'Variant updated successfully' });
    }
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/vehicle-variants/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-variants'] });
      toast({ title: 'Variant deleted successfully' });
    }
  });

  // Excel Upload Mutation
  const uploadExcelMutation = useMutation({
    mutationFn: async ({ file, oemId }: { file: File; oemId: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('oemId', oemId);

      const response = await fetch('/api/vehicle-brands/upload-excel', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadResults(data);
      setIsUploading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-brands'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-models'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-variants'] });
      toast({ title: 'Upload completed', description: data.message });
    },
    onError: (error) => {
      setIsUploading(false);
      toast({ 
        title: 'Upload failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Filter functions
  const filteredBrands = useMemo(() => {
    return brands.filter(brand =>
      brand.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [brands, searchTerm]);

  const filteredModels = useMemo(() => {
    return models.filter(model =>
      model.modelName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [models, searchTerm]);

  const filteredVariants = useMemo(() => {
    return variants.filter(variant =>
      variant.variantName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [variants, searchTerm]);

  // Helper functions
  const openBrandDialog = (brand?: VehicleBrand) => {
    if (brand) {
      setEditingBrand(brand);
      brandForm.reset({
        oemId: brand.oemId,
        name: brand.name,
        active: brand.active
      });
    } else {
      setEditingBrand(null);
      brandForm.reset({
        oemId: selectedOemId,
        name: '',
        active: true
      });
    }
    setShowBrandDialog(true);
  };

  const openModelDialog = (model?: VehicleModel) => {
    if (model) {
      setEditingModel(model);
      modelForm.reset({
        brandId: model.brandId,
        modelName: model.modelName,
        active: model.active
      });
    } else {
      setEditingModel(null);
      modelForm.reset({
        brandId: selectedBrandId,
        modelName: '',
        active: true
      });
    }
    setShowModelDialog(true);
  };

  const openVariantDialog = (variant?: VehicleVariant) => {
    if (variant) {
      setEditingVariant(variant);
      variantForm.reset({
        modelId: variant.modelId,
        variantName: variant.variantName,
        fuelType: variant.fuelType || '',
        transmission: variant.transmission || '',
        engineCapacity: variant.engineCapacity || '',
        active: variant.active
      });
    } else {
      setEditingVariant(null);
      variantForm.reset({
        modelId: selectedModelId,
        variantName: '',
        fuelType: '',
        transmission: '',
        engineCapacity: '',
        active: true
      });
    }
    setShowVariantDialog(true);
  };

  const onBrandSubmit = (data: z.infer<typeof vehicleBrandFormSchema>) => {
    if (editingBrand) {
      updateBrandMutation.mutate({ id: editingBrand.id, ...data });
    } else {
      createBrandMutation.mutate(data);
    }
  };

  const onModelSubmit = (data: z.infer<typeof vehicleModelFormSchema>) => {
    if (editingModel) {
      updateModelMutation.mutate({ id: editingModel.id, ...data });
    } else {
      createModelMutation.mutate(data);
    }
  };

  const onVariantSubmit = (data: z.infer<typeof vehicleVariantFormSchema>) => {
    if (editingVariant) {
      updateVariantMutation.mutate({ id: editingVariant.id, ...data });
    } else {
      createVariantMutation.mutate(data);
    }
  };

  const handleUpload = () => {
    if (!uploadFile || !selectedOemId) {
      toast({ 
        title: 'Missing requirements', 
        description: 'Please select an OEM and choose a file',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setUploadResults(null);
    uploadExcelMutation.mutate({ file: uploadFile, oemId: selectedOemId });
  };

  const downloadTemplate = () => {
    // Create sample Excel template
    const templateData = [
      {
        brand_name: 'Maruti Suzuki',
        model_name: 'Swift',
        variant_name: 'VXI',
        fuel_type: 'PETROL',
        transmission: 'MANUAL',
        engine_capacity: '1.2L'
      },
      {
        brand_name: 'Maruti Suzuki',
        model_name: 'Swift',
        variant_name: 'ZXI',
        fuel_type: 'PETROL',
        transmission: 'AUTOMATIC',
        engine_capacity: '1.2L'
      },
      {
        brand_name: 'Tata Motors',
        model_name: 'Nexon',
        variant_name: 'XM',
        fuel_type: 'PETROL',
        transmission: 'MANUAL',
        engine_capacity: '1.2L'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
    XLSX.writeFile(wb, 'vehicle_upload_template.xlsx');
  };

  return (
    <div className="space-y-6" data-testid="vehicles-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Vehicle Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage vehicle brands, models, and variants linked to OEMs
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            data-testid="download-template-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button
            onClick={() => setShowUploadDialog(true)}
            disabled={!selectedOemId}
            data-testid="upload-excel-btn"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Excel
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search vehicles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            data-testid="search-vehicles"
          />
        </div>
        
        <Select value={selectedOemId} onValueChange={setSelectedOemId}>
          <SelectTrigger className="w-48" data-testid="select-oem">
            <SelectValue placeholder="Select OEM" />
          </SelectTrigger>
          <SelectContent>
            {oems.map((oem) => (
              <SelectItem key={oem.id} value={oem.id}>
                {oem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hierarchy Navigation */}
      {selectedOemId && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Factory className="h-4 w-4" />
          <span>{oems.find(o => o.id === selectedOemId)?.name}</span>
          {selectedBrandId && (
            <>
              <span>→</span>
              <Building2 className="h-4 w-4" />
              <span>{brands.find(b => b.id === selectedBrandId)?.name}</span>
            </>
          )}
          {selectedModelId && (
            <>
              <span>→</span>
              <Car className="h-4 w-4" />
              <span>{models.find(m => m.id === selectedModelId)?.modelName}</span>
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vehicle Brands */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">Vehicle Brands</CardTitle>
                <CardDescription>
                  Brands linked to {selectedOemId ? oems.find(o => o.id === selectedOemId)?.name : 'selected OEM'}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => openBrandDialog()}
                disabled={!selectedOemId}
                data-testid="add-brand-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Brand
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {brandsLoading ? (
                <div className="text-sm text-gray-500">Loading brands...</div>
              ) : filteredBrands.length === 0 ? (
                <div className="text-sm text-gray-500">
                  {selectedOemId ? 'No brands found' : 'Select an OEM to view brands'}
                </div>
              ) : (
                filteredBrands.map((brand) => (
                  <div
                    key={brand.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedBrandId === brand.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedBrandId(brand.id);
                      setSelectedModelId('');
                    }}
                    data-testid={`brand-card-${brand.id}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{brand.name}</div>
                        <div className="text-xs text-gray-500">
                          {brand.active ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openBrandDialog(brand);
                          }}
                          data-testid={`edit-brand-${brand.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBrandMutation.mutate(brand.id);
                          }}
                          data-testid={`delete-brand-${brand.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Models */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">Vehicle Models</CardTitle>
                <CardDescription>
                  Models under {selectedBrandId ? brands.find(b => b.id === selectedBrandId)?.name : 'selected brand'}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => openModelDialog()}
                disabled={!selectedBrandId}
                data-testid="add-model-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Model
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {modelsLoading ? (
                <div className="text-sm text-gray-500">Loading models...</div>
              ) : filteredModels.length === 0 ? (
                <div className="text-sm text-gray-500">
                  {selectedBrandId ? 'No models found' : 'Select a brand to view models'}
                </div>
              ) : (
                filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedModelId === model.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedModelId(model.id)}
                    data-testid={`model-card-${model.id}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{model.modelName}</div>
                        <div className="text-xs text-gray-500">
                          {model.active ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModelDialog(model);
                          }}
                          data-testid={`edit-model-${model.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteModelMutation.mutate(model.id);
                          }}
                          data-testid={`delete-model-${model.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Variants */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">Vehicle Variants</CardTitle>
                <CardDescription>
                  Variants of {selectedModelId ? models.find(m => m.id === selectedModelId)?.modelName : 'selected model'}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => openVariantDialog()}
                disabled={!selectedModelId}
                data-testid="add-variant-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Variant
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {variantsLoading ? (
                <div className="text-sm text-gray-500">Loading variants...</div>
              ) : filteredVariants.length === 0 ? (
                <div className="text-sm text-gray-500">
                  {selectedModelId ? 'No variants found' : 'Select a model to view variants'}
                </div>
              ) : (
                filteredVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    data-testid={`variant-card-${variant.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{variant.variantName}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {variant.fuelType && (
                            <Badge variant="outline" className="text-xs mr-1">
                              {variant.fuelType}
                            </Badge>
                          )}
                          {variant.transmission && (
                            <Badge variant="outline" className="text-xs mr-1">
                              {variant.transmission}
                            </Badge>
                          )}
                          {variant.engineCapacity && (
                            <Badge variant="outline" className="text-xs mr-1">
                              {variant.engineCapacity}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {variant.active ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openVariantDialog(variant)}
                          data-testid={`edit-variant-${variant.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteVariantMutation.mutate(variant.id)}
                          data-testid={`delete-variant-${variant.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Dialog */}
      <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
        <DialogContent data-testid="brand-dialog">
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
          </DialogHeader>
          <Form {...brandForm}>
            <form onSubmit={brandForm.handleSubmit(onBrandSubmit)} className="space-y-4">
              <FormField
                control={brandForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter brand name" {...field} data-testid="brand-name-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowBrandDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBrandMutation.isPending || updateBrandMutation.isPending}
                  data-testid="save-brand-btn"
                >
                  {editingBrand ? 'Update' : 'Create'} Brand
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
        <DialogContent data-testid="model-dialog">
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
          </DialogHeader>
          <Form {...modelForm}>
            <form onSubmit={modelForm.handleSubmit(onModelSubmit)} className="space-y-4">
              <FormField
                control={modelForm.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter model name" {...field} data-testid="model-name-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModelDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createModelMutation.isPending || updateModelMutation.isPending}
                  data-testid="save-model-btn"
                >
                  {editingModel ? 'Update' : 'Create'} Model
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={showVariantDialog} onOpenChange={setShowVariantDialog}>
        <DialogContent data-testid="variant-dialog">
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'Edit Variant' : 'Add Variant'}</DialogTitle>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit(onVariantSubmit)} className="space-y-4">
              <FormField
                control={variantForm.control}
                name="variantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter variant name" {...field} data-testid="variant-name-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="fuel-type-select">
                          <SelectValue placeholder="Select fuel type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PETROL">Petrol</SelectItem>
                        <SelectItem value="DIESEL">Diesel</SelectItem>
                        <SelectItem value="ELECTRIC">Electric</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                        <SelectItem value="CNG">CNG</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="transmission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transmission</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="transmission-select">
                          <SelectValue placeholder="Select transmission" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MANUAL">Manual</SelectItem>
                        <SelectItem value="AUTOMATIC">Automatic</SelectItem>
                        <SelectItem value="CVT">CVT</SelectItem>
                        <SelectItem value="AMT">AMT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="engineCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engine Capacity</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 1.2L, 1500cc" {...field} value={field.value || ''} data-testid="engine-capacity-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowVariantDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createVariantMutation.isPending || updateVariantMutation.isPending}
                  data-testid="save-variant-btn"
                >
                  {editingVariant ? 'Update' : 'Create'} Variant
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl" data-testid="upload-dialog">
          <DialogHeader>
            <DialogTitle>Upload Vehicle Data</DialogTitle>
            <DialogDescription>
              Upload an Excel file to bulk import vehicle brands, models, and variants for {oems.find(o => o.id === selectedOemId)?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* File Upload */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Excel File
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label className="cursor-pointer">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Click to upload or drag and drop
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".xlsx,.xls"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          data-testid="file-input"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Excel files only (XLSX, XLS)
                    </p>
                  </div>
                </div>
                
                {uploadFile && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Expected Format */}
              <div>
                <h4 className="text-sm font-medium mb-2">Expected Excel Format:</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs font-mono">
                  <div className="grid grid-cols-6 gap-2 font-semibold border-b border-gray-300 dark:border-gray-600 pb-1">
                    <span>brand_name</span>
                    <span>model_name</span>
                    <span>variant_name</span>
                    <span>fuel_type</span>
                    <span>transmission</span>
                    <span>engine_capacity</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2 pt-1">
                    <span>Maruti Suzuki</span>
                    <span>Swift</span>
                    <span>VXI</span>
                    <span>PETROL</span>
                    <span>MANUAL</span>
                    <span>1.2L</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  * brand_name and model_name are required. Other fields are optional.
                </p>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading and processing...</span>
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {/* Upload Results */}
            {uploadResults && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {uploadResults.message}
                  </AlertDescription>
                </Alert>

                {uploadResults.results.created.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                      Successfully Created:
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {uploadResults.results.created.map((item: any, index: number) => (
                        <div key={index} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2 text-xs">
                          <div className="font-medium">Brand: {item.brand}</div>
                          {item.models.length > 0 && (
                            <div>Models: {item.models.join(', ')}</div>
                          )}
                          {item.variants.length > 0 && (
                            <div>Variants: {item.variants.map((v: any) => `${v.model} - ${v.variant}`).join(', ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadResults.results.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                      Errors ({uploadResults.results.errors.length}):
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {uploadResults.results.errors.map((error: any, index: number) => (
                        <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-xs">
                          <div className="font-medium">Row {error.row}: {error.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowUploadDialog(false);
                  setUploadFile(null);
                  setUploadResults(null);
                }}
              >
                {uploadResults ? 'Close' : 'Cancel'}
              </Button>
              {!uploadResults && (
                <Button 
                  onClick={handleUpload}
                  disabled={!uploadFile || isUploading}
                  data-testid="upload-btn"
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}