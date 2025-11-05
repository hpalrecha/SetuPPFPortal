import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkUploadDealershipsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkUploadDealershipsModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkUploadDealershipsModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isValidFile = 
        selectedFile.type === 'text/csv' || 
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        selectedFile.type === 'application/vnd.ms-excel' ||
        selectedFile.name.endsWith('.csv') || 
        selectedFile.name.endsWith('.xlsx') || 
        selectedFile.name.endsWith('.xls');
      
      if (!isValidFile) {
        toast({
          title: "Invalid File",
          description: "Please upload a CSV or Excel file (.csv, .xls, .xlsx)",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "username,dealership_name,oem_name\naakarhyundai,Aakar Hyundai Bangalore,Hyundai\nmumbaidlr,Mumbai Hyundai Showroom,Hyundai\ndelhidlr,Delhi Hyundai Motors,";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dealerships-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV or Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await apiRequest('POST', '/api/dealerships/bulk-upload', formData, {
        headers: {
          // Don't set Content-Type, let browser set it with boundary
        },
      });

      setUploadResult(result);

      if (result.success > 0) {
        toast({
          title: "Upload Successful",
          description: `Successfully created ${result.success} dealership(s)`,
        });
        onSuccess();
      }

      if (result.failed > 0) {
        toast({
          title: "Partial Upload",
          description: `${result.failed} dealership(s) failed to create. Check errors below.`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Dealerships</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Instructions:</h3>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Download the CSV template using the button below (or create an Excel file with same columns)</li>
              <li>Fill in: <strong>username</strong> (for login), <strong>dealership_name</strong> (display name), and <strong>oem_name</strong> (optional)</li>
              <li>If OEM name is empty, it will default to "Hyundai"</li>
              <li>Upload the completed CSV or Excel file (.csv, .xls, .xlsx)</li>
              <li>Passwords will be auto-generated as: <code className="bg-muted px-1 rounded">username@123</code></li>
              <li>Users must complete their profile (email/phone verification) on first login</li>
            </ol>

            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              data-testid="button-download-template"
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
                data-testid="input-csv-file"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                {file ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      <FileText className="inline mr-2 h-4 w-4" />
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Click to upload CSV or Excel file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or drag and drop (.csv, .xls, .xlsx)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-4">
              {uploadResult.success > 0 && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    Successfully created {uploadResult.success} dealership(s)
                  </AlertDescription>
                </Alert>
              )}

              {uploadResult.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">
                        {uploadResult.failed} dealership(s) failed to create:
                      </p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              data-testid="button-upload-csv"
            >
              {isUploading ? "Uploading..." : "Upload & Create Dealerships"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
