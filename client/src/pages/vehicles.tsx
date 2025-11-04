import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Factory, Upload, Download, AlertTriangle, CheckCircle, FileSpreadsheet, Plus, Edit, Trash2, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import * as XLSX from 'xlsx';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

type Oem = {
  id: string;
  name: string;
  active: boolean;
};

type VehicleData = {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
    variants: {
      id: string;
      name: string;
      fuelType?: string;
      transmission?: string;
      engineCapacity?: string;
      ppfQtyConsumption?: string;
    }[];
  }[];
};

// Form schemas
const brandFormSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  oemId: z.string().min(1, 'OEM is required')
});

const modelFormSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  oemId: z.string().min(1, 'OEM is required'),
  vehicleType: z.string().optional() // Vehicle type selection
});

const variantFormSchema = z.object({
  variantName: z.string().min(1, 'Variant name is required'),
  modelId: z.string().min(1, 'Model is required'),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  engineCapacity: z.string().optional(),
  ppfQtyConsumption: z.string().optional()
});


export default function VehiclesPage() {
  const [selectedOemId, setSelectedOemId] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const { toast } = useToast();

  // Fetch OEMs
  const { data: oems = [], isLoading: oemsLoading } = useQuery<Oem[]>({
    queryKey: ['/api/oems'],
    enabled: true,
  });

  // Fetch vehicle data for selected OEM
  const { data: vehicleData = [], isLoading: vehicleLoading, refetch: refetchVehicleData } = useQuery<VehicleData[]>({
    queryKey: ['/api/vehicle-data', selectedOemId],
    enabled: !!selectedOemId,
  });

  // Form instances
  const brandForm = useForm<z.infer<typeof brandFormSchema>>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: { name: '', oemId: selectedOemId }
  });

  const modelForm = useForm<z.infer<typeof modelFormSchema>>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: { modelName: '', oemId: selectedOemId, vehicleType: '' }
  });

  const variantForm = useForm<z.infer<typeof variantFormSchema>>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: { variantName: '', modelId: '', fuelType: '', transmission: '', engineCapacity: '', ppfQtyConsumption: '0.00' }
  });


  // Excel Upload Mutation
  const uploadExcelMutation = useMutation({
    mutationFn: async ({ file, oemId }: { file: File; oemId: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('oemId', oemId);

      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/vehicle-data/upload-excel', {
        method: 'POST',
        headers,
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
      refetchVehicleData(); // Refresh the vehicle data display
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

  // CRUD Mutations
  const createBrandMutation = useMutation({
    mutationFn: (data: z.infer<typeof brandFormSchema>) => 
      apiRequest('POST', '/api/vehicle-brands', data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Brand created successfully' });
      setShowBrandDialog(false);
      brandForm.reset();
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create brand', variant: 'destructive' });
    }
  });

  const createModelMutation = useMutation({
    mutationFn: (data: z.infer<typeof modelFormSchema>) => 
      apiRequest('POST', '/api/vehicle-models', data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Model created successfully' });
      setShowModelDialog(false);
      modelForm.reset();
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create model', variant: 'destructive' });
    }
  });

  const createVariantMutation = useMutation({
    mutationFn: (data: z.infer<typeof variantFormSchema>) => 
      apiRequest('POST', '/api/vehicle-variants', data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Variant created successfully' });
      setShowVariantDialog(false);
      setEditingVariant(null);
      variantForm.reset();
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create variant', variant: 'destructive' });
    }
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof variantFormSchema> }) => 
      apiRequest('PUT', `/api/vehicle-variants/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Variant updated successfully' });
      setShowVariantDialog(false);
      setEditingVariant(null);
      variantForm.reset();
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update variant', variant: 'destructive' });
    }
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/vehicle-brands/${id}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Brand deleted successfully' });
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete brand', variant: 'destructive' });
    }
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/vehicle-models/${id}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Model deleted successfully' });
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete model', variant: 'destructive' });
    }
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/vehicle-variants/${id}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Variant deleted successfully' });
      refetchVehicleData();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete variant', variant: 'destructive' });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
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
    // Create sample Excel template with new OEM-Model-Variant format including vehicle type
    const templateData = [
      {
        model_name: 'Swift',
        vehicle_type: 'HATCHBACK',
        variant_name: 'VXI'
      },
      {
        model_name: 'Swift',
        vehicle_type: 'HATCHBACK',
        variant_name: 'ZXI'
      },
      {
        model_name: 'Nexon',
        vehicle_type: 'SUV',
        variant_name: 'XM'
      },
      {
        model_name: 'Dzire',
        vehicle_type: 'SEDAN',
        variant_name: 'VXI'
      },
      {
        model_name: 'Brezza',
        vehicle_type: 'SUV',
        variant_name: 'ZXI+'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
    XLSX.writeFile(wb, 'vehicle_upload_template.xlsx');
  };

  const resetUpload = () => {
    setShowUploadDialog(false);
    setUploadFile(null);
    setUploadResults(null);
    setIsUploading(false);
  };

  if (oemsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Progress value={undefined} className="h-2 w-32 mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading OEMs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6" data-testid="vehicles-page">
      {/* Header */}
      <div className="text-center space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Vehicle Data Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
            Upload vehicle brands, models, and variants via Excel
          </p>
        </div>
      </div>

      {/* OEM Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Select OEM
          </CardTitle>
          <CardDescription>
            Choose an OEM to manage vehicle data for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedOemId} onValueChange={setSelectedOemId} data-testid="oem-select">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an OEM to manage vehicle data" />
            </SelectTrigger>
            <SelectContent>
              {oems.map((oem) => (
                <SelectItem key={oem.id} value={oem.id}>
                  <div className="flex items-center gap-2">
                    <Factory className="h-4 w-4" />
                    {oem.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Upload Actions */}
      {selectedOemId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Excel Data Upload
            </CardTitle>
            <CardDescription>
              Upload vehicle data in bulk using Excel files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={downloadTemplate} 
                variant="outline" 
                size="lg"
                data-testid="download-template-btn"
              >
                <Download className="h-5 w-5 mr-2" />
                Download Template
              </Button>
              <Button 
                onClick={() => setShowUploadDialog(true)} 
                size="lg"
                data-testid="upload-excel-btn"
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload Excel Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Data Display */}
      {selectedOemId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Vehicle Data for {oems.find(o => o.id === selectedOemId)?.name}
              </div>
              <Button 
                onClick={() => {
                  modelForm.setValue('oemId', selectedOemId);
                  setShowModelDialog(true);
                }}
                className="flex items-center gap-2"
                data-testid="button-add-model-header"
              >
                <Plus className="h-4 w-4" />
                Add Model
              </Button>
            </CardTitle>
            <CardDescription>
              {vehicleLoading ? 'Loading...' : `${vehicleData.reduce((total, brand) => total + brand.models.reduce((modelTotal, model) => modelTotal + model.variants.length, 0), 0)} vehicle records found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vehicleLoading ? (
              <div className="text-center py-8">
                <Progress value={undefined} className="h-2 w-32 mx-auto mb-4" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading vehicle data...</p>
              </div>
            ) : vehicleData.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No vehicle data found</p>
                <p className="text-sm">Upload an Excel file to add vehicle data</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vehicleData.map((brand) => (
                  <div key={brand.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {brand.name}
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          modelForm.setValue('oemId', brand.id);
                          setSelectedBrandId(brand.id);
                          setShowModelDialog(true);
                        }}
                        className="flex items-center gap-1"
                        data-testid={`button-add-model-${brand.name}`}
                      >
                        <Plus className="h-3 w-3" />
                        Add Model
                      </Button>
                    </div>
                    {brand.models.length === 0 ? (
                      <p className="text-sm text-gray-500">No models found</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {brand.models.map((model) => (
                          <div key={model.id} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                {model.name}
                              </h4>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    variantForm.setValue('modelId', model.id);
                                    setSelectedModelId(model.id);
                                    setShowVariantDialog(true);
                                  }}
                                  className="h-6 px-2 text-xs"
                                  data-testid={`button-add-variant-${model.name}`}
                                >
                                  <Plus className="h-2 w-2 mr-1" />
                                  Add Variant
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteModelMutation.mutate(model.id)}
                                  disabled={deleteModelMutation.isPending}
                                  className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                  data-testid={`button-delete-model-${model.name}`}
                                >
                                  <Trash2 className="h-2 w-2" />
                                </Button>
                              </div>
                            </div>
                            {model.variants.length === 0 ? (
                              <p className="text-xs text-gray-500">No variants</p>
                            ) : (
                              <div className="space-y-1">
                                {model.variants.map((variant) => (
                                  <div key={variant.id} className="text-xs bg-white dark:bg-gray-700 rounded px-2 py-1 flex items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <span className="font-medium">{variant.name}</span>
                                      {variant.fuelType && (
                                        <span className="text-gray-500 ml-2">• {variant.fuelType}</span>
                                      )}
                                      {variant.transmission && (
                                        <span className="text-gray-500 ml-1">• {variant.transmission}</span>
                                      )}
                                      {variant.ppfQtyConsumption && parseFloat(variant.ppfQtyConsumption) > 0 && (
                                        <span className="text-blue-600 dark:text-blue-400 ml-2 font-semibold">• {variant.ppfQtyConsumption} SFT</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingVariant(variant);
                                          variantForm.reset({
                                            variantName: variant.name,
                                            modelId: model.id,
                                            fuelType: variant.fuelType || '',
                                            transmission: variant.transmission || '',
                                            engineCapacity: variant.engineCapacity || '',
                                            ppfQtyConsumption: variant.ppfQtyConsumption || '0.00'
                                          });
                                          setShowVariantDialog(true);
                                        }}
                                        className="h-4 w-4 p-0 text-blue-600 hover:text-blue-700"
                                        data-testid={`button-edit-variant-${variant.name}`}
                                      >
                                        <Edit className="h-2 w-2" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => deleteVariantMutation.mutate(variant.id)}
                                        disabled={deleteVariantMutation.isPending}
                                        className="h-4 w-4 p-0 text-red-600 hover:text-red-700"
                                        data-testid={`button-delete-variant-${variant.name}`}
                                      >
                                        <Trash2 className="h-2 w-2" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => !open && resetUpload()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Vehicle Data</DialogTitle>
            <DialogDescription>
              Upload an Excel file to bulk import vehicle models and variants for {oems.find(o => o.id === selectedOemId)?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* File Selection */}
            {!uploadResults && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Excel File</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-gray-400" />
                    <div>
                      <p className="text-lg">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-500">Excel files only (.XLSX, .XLS)</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input"
                      data-testid="file-input"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('file-input')?.click()}
                      data-testid="select-file-btn"
                    >
                      Choose File
                    </Button>
                  </div>
                </div>
                {uploadFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Selected: <span className="font-medium">{uploadFile.name}</span> ({Math.round(uploadFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            {/* Expected Format */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Expected Excel Format:</h4>
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-100 dark:bg-blue-900/50">
                      <th className="border border-blue-200 dark:border-blue-700 px-4 py-2 text-left">model_name</th>
                      <th className="border border-blue-200 dark:border-blue-700 px-4 py-2 text-left">vehicle_type</th>
                      <th className="border border-blue-200 dark:border-blue-700 px-4 py-2 text-left">variant_name</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-blue-200 dark:border-blue-700 px-4 py-2">Swift</td>
                      <td className="border border-blue-200 dark:border-blue-700 px-4 py-2">HATCHBACK</td>
                      <td className="border border-blue-200 dark:border-blue-700 px-4 py-2">VXI</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                * model_name is required. vehicle_type and variant_name are optional.
              </p>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 animate-pulse" />
                  <span className="text-sm">Uploading and processing...</span>
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
                          <div className="font-medium">OEM: {item.oem}</div>
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
                onClick={resetUpload}
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

      {/* Add Model Dialog */}
      <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Model</DialogTitle>
            <DialogDescription>
              Create a new vehicle model
            </DialogDescription>
          </DialogHeader>
          <Form {...modelForm}>
            <form onSubmit={modelForm.handleSubmit(data => createModelMutation.mutate(data))} className="space-y-4">
              <FormField
                control={modelForm.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter model name" {...field} data-testid="input-model-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={modelForm.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle-type">
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HATCHBACK">Hatchback</SelectItem>
                        <SelectItem value="SEDAN">Sedan</SelectItem>
                        <SelectItem value="SUV">SUV</SelectItem>
                        <SelectItem value="ELECTRIC">Electric</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                        <SelectItem value="CROSSOVER">Crossover</SelectItem>
                        <SelectItem value="LUXURY_SEDAN">Luxury Sedan</SelectItem>
                        <SelectItem value="LUXURY_SUV">Luxury SUV</SelectItem>
                        <SelectItem value="COUPE">Coupe</SelectItem>
                        <SelectItem value="CONVERTIBLE">Convertible</SelectItem>
                        <SelectItem value="MPV">MPV</SelectItem>
                        <SelectItem value="PICKUP_TRUCK">Pickup Truck</SelectItem>
                        <SelectItem value="VAN">Van</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowModelDialog(false)} data-testid="button-cancel-model">
                  Cancel
                </Button>
                <Button type="submit" disabled={createModelMutation.isPending} data-testid="button-save-model">
                  {createModelMutation.isPending ? 'Creating...' : 'Create Model'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Variant Dialog */}
      <Dialog open={showVariantDialog} onOpenChange={(open) => {
        setShowVariantDialog(open);
        if (!open) {
          setEditingVariant(null);
          variantForm.reset();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'Edit Variant' : 'Add New Variant'}</DialogTitle>
            <DialogDescription>
              {editingVariant ? 'Update vehicle variant details' : 'Create a new vehicle variant'}
            </DialogDescription>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit(data => {
              if (editingVariant) {
                updateVariantMutation.mutate({ id: editingVariant.id, data });
              } else {
                createVariantMutation.mutate(data);
              }
            })} className="space-y-4">
              <FormField
                control={variantForm.control}
                name="variantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter variant name" {...field} data-testid="input-variant-name" />
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
                    <FormLabel>Fuel Type (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Petrol, Diesel, Electric" {...field} data-testid="input-fuel-type" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="transmission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transmission (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Manual, Automatic, CVT" {...field} data-testid="input-transmission" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="engineCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engine Capacity (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 1.2L, 1500cc" {...field} data-testid="input-engine-capacity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="ppfQtyConsumption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PPF Quantity Consumption (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Enter total PPF used (in sq.ft)" 
                          {...field} 
                          data-testid="input-ppf-qty-consumption" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          sq.ft
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => {
                  setShowVariantDialog(false);
                  setEditingVariant(null);
                  variantForm.reset();
                }} data-testid="button-cancel-variant">
                  Cancel
                </Button>
                <Button type="submit" disabled={createVariantMutation.isPending || updateVariantMutation.isPending} data-testid="button-save-variant">
                  {editingVariant 
                    ? (updateVariantMutation.isPending ? 'Updating...' : 'Update Variant')
                    : (createVariantMutation.isPending ? 'Creating...' : 'Create Variant')
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}