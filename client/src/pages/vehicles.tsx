import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Factory, Upload, Download, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import * as XLSX from 'xlsx';

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
    }[];
  }[];
};


export default function VehiclesPage() {
  const [selectedOemId, setSelectedOemId] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
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

      const response = await fetch('/api/vehicle-brands/upload-excel', {
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
    // Create sample Excel template
    const templateData = [
      {
        brand_name: 'Maruti Suzuki',
        model_name: 'Swift',
        variant_name: 'VXI'
      },
      {
        brand_name: 'Maruti Suzuki', 
        model_name: 'Swift',
        variant_name: 'ZXI'
      },
      {
        brand_name: 'Tata Motors',
        model_name: 'Nexon',
        variant_name: 'XM'
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
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Vehicle Data for {oems.find(o => o.id === selectedOemId)?.name}
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
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      {brand.name}
                    </h3>
                    {brand.models.length === 0 ? (
                      <p className="text-sm text-gray-500">No models found</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {brand.models.map((model) => (
                          <div key={model.id} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                              {model.name}
                            </h4>
                            {model.variants.length === 0 ? (
                              <p className="text-xs text-gray-500">No variants</p>
                            ) : (
                              <div className="space-y-1">
                                {model.variants.map((variant) => (
                                  <div key={variant.id} className="text-xs bg-white dark:bg-gray-700 rounded px-2 py-1">
                                    <span className="font-medium">{variant.name}</span>
                                    {variant.fuelType && (
                                      <span className="text-gray-500 ml-2">• {variant.fuelType}</span>
                                    )}
                                    {variant.transmission && (
                                      <span className="text-gray-500 ml-1">• {variant.transmission}</span>
                                    )}
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
              Upload an Excel file to bulk import vehicle brands, models, and variants for {oems.find(o => o.id === selectedOemId)?.name}
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
                      <th className="border border-blue-200 dark:border-blue-700 px-4 py-2 text-left">brand_name</th>
                      <th className="border border-blue-200 dark:border-blue-700 px-4 py-2 text-left">model_name</th>
                      <th className="border border-blue-200 dark:border-blue-700 px-4 py-2 text-left">variant_name</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-blue-200 dark:border-blue-700 px-4 py-2">Maruti Suzuki</td>
                      <td className="border border-blue-200 dark:border-blue-700 px-4 py-2">Swift</td>
                      <td className="border border-blue-200 dark:border-blue-700 px-4 py-2">VXI</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                * brand_name and model_name are required. variant_name is optional.
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
    </div>
  );
}