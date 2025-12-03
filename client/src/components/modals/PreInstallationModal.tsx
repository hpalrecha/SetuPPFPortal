import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Upload, Camera, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { processImage, formatFileSize, getCompressionRatio, type ProcessedImage } from "@/lib/imageProcessing";

interface PreInstallationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId: string;
  onSuccess: () => void;
}

interface PhotoState {
  file: File | null;
  preview: string | null;
  isProcessing: boolean;
  error: string | null;
  compressionInfo: {
    original: number;
    compressed: number;
  } | null;
}

const initialPhotoState: PhotoState = {
  file: null,
  preview: null,
  isProcessing: false,
  error: null,
  compressionInfo: null,
};

export function PreInstallationModal({
  open,
  onOpenChange,
  jobCardId,
  onSuccess,
}: PreInstallationModalProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  
  const [frontPhoto, setFrontPhoto] = useState<PhotoState>(initialPhotoState);
  const [backPhoto, setBackPhoto] = useState<PhotoState>(initialPhotoState);
  const [leftPhoto, setLeftPhoto] = useState<PhotoState>(initialPhotoState);
  const [rightPhoto, setRightPhoto] = useState<PhotoState>(initialPhotoState);
  const [remarks, setRemarks] = useState("");

  const handleFileSelect = async (
    inputFile: File | null,
    setPhoto: (state: PhotoState) => void
  ) => {
    if (!inputFile) {
      setPhoto(initialPhotoState);
      return;
    }

    setPhoto({
      ...initialPhotoState,
      isProcessing: true,
    });

    try {
      const processed: ProcessedImage = await processImage(inputFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        quality: 0.8,
      });

      setPhoto({
        file: processed.file,
        preview: processed.preview,
        isProcessing: false,
        error: null,
        compressionInfo: {
          original: processed.originalSize,
          compressed: processed.compressedSize,
        },
      });

      if (processed.originalSize > processed.compressedSize) {
        toast({
          title: "Image Optimized",
          description: `Compressed from ${formatFileSize(processed.originalSize)} to ${formatFileSize(processed.compressedSize)} (${getCompressionRatio(processed.originalSize, processed.compressedSize)} smaller)`,
        });
      }
    } catch (error) {
      console.error('Image processing error:', error);
      setPhoto({
        ...initialPhotoState,
        error: error instanceof Error ? error.message : 'Failed to process image',
      });
      toast({
        title: "Image Processing Failed",
        description: error instanceof Error ? error.message : 'Please try a different image',
        variant: "destructive",
      });
    }
  };

  const uploadPhoto = async (file: File, label: string): Promise<string> => {
    setUploadStage(`Uploading ${label}...`);
    
    const uploadUrlResponse = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      credentials: 'include',
    });

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      throw new Error(`Failed to get upload URL for ${label}: ${errorText}`);
    }

    const { uploadURL } = await uploadUrlResponse.json();

    const uploadResponse = await fetch(uploadURL, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload ${label}`);
    }

    return uploadURL;
  };

  const handleSubmit = async () => {
    try {
      if (!frontPhoto.file || !backPhoto.file || !leftPhoto.file || !rightPhoto.file) {
        toast({
          title: "Missing Photos",
          description: "Please upload all 4 photos (Front, Back, Left, Right)",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      setUploadStage("Uploading Front View...");
      const photoFrontUrl = await uploadPhoto(frontPhoto.file, "Front View");
      setUploadProgress(25);

      setUploadStage("Uploading Back View...");
      const photoBackUrl = await uploadPhoto(backPhoto.file, "Back View");
      setUploadProgress(50);

      setUploadStage("Uploading Left Side View...");
      const photoLeftUrl = await uploadPhoto(leftPhoto.file, "Left Side View");
      setUploadProgress(75);

      setUploadStage("Uploading Right Side View...");
      const photoRightUrl = await uploadPhoto(rightPhoto.file, "Right Side View");
      setUploadProgress(90);

      setUploadStage("Saving inspection data...");
      const response = await fetch(`/api/job-cards/${jobCardId}/pre-installation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          photoFrontUrl,
          photoBackUrl,
          photoLeftUrl,
          photoRightUrl,
          remarks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit pre-installation inspection');
      }

      setUploadProgress(100);

      toast({
        title: "Success",
        description: "Pre-installation inspection completed successfully",
      });

      setFrontPhoto(initialPhotoState);
      setBackPhoto(initialPhotoState);
      setLeftPhoto(initialPhotoState);
      setRightPhoto(initialPhotoState);
      setRemarks("");
      setUploadProgress(0);
      setUploadStage("");

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Pre-installation upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to complete pre-installation inspection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const PhotoUploadBox = ({
    label,
    photoState,
    onFileSelect,
    testId,
  }: {
    label: string;
    photoState: PhotoState;
    onFileSelect: (file: File | null) => void;
    testId: string;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {photoState.file && <CheckCircle className="h-4 w-4 text-green-500" />}
      </Label>
      <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
        {photoState.isProcessing ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-2" />
            <span className="text-sm text-gray-500">Processing image...</span>
            <span className="text-xs text-gray-400 mt-1">Converting & compressing</span>
          </div>
        ) : photoState.error ? (
          <div className="flex flex-col items-center justify-center h-40">
            <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
            <span className="text-sm text-red-500 text-center">{photoState.error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => onFileSelect(null)}
            >
              Try Again
            </Button>
          </div>
        ) : photoState.preview ? (
          <div className="relative">
            <img
              src={photoState.preview}
              alt={label}
              className="w-full h-40 object-cover rounded"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => onFileSelect(null)}
              data-testid={`button-remove-${testId}`}
            >
              Remove
            </Button>
            {photoState.compressionInfo && photoState.compressionInfo.original > photoState.compressionInfo.compressed && (
              <div className="absolute bottom-2 left-2 bg-green-600/90 text-white text-xs px-2 py-1 rounded">
                {formatFileSize(photoState.compressionInfo.compressed)}
                <span className="ml-1 opacity-75">
                  ({getCompressionRatio(photoState.compressionInfo.original, photoState.compressionInfo.compressed)} saved)
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(`camera-${testId}`)?.click()}
                className="gap-1 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
                data-testid={`button-camera-${testId}`}
              >
                <Camera className="h-4 w-4" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(`gallery-${testId}`)?.click()}
                className="gap-1"
                data-testid={`button-gallery-${testId}`}
              >
                <Upload className="h-4 w-4" />
                Gallery
              </Button>
            </div>
            <span className="text-xs text-gray-400">Capture {label} or choose from gallery</span>
            <input
              id={`camera-${testId}`}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onFileSelect(file);
                }
                e.target.value = '';
              }}
            />
            <input
              id={`gallery-${testId}`}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onFileSelect(file);
                }
                e.target.value = '';
              }}
              data-testid={`input-${testId}`}
            />
          </div>
        )}
      </div>
    </div>
  );

  const allPhotosReady = frontPhoto.file && backPhoto.file && leftPhoto.file && rightPhoto.file;
  const anyProcessing = frontPhoto.isProcessing || backPhoto.isProcessing || leftPhoto.isProcessing || rightPhoto.isProcessing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Pre-Installation Inspection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Please upload photos of the vehicle from all 4 angles before starting the installation work.
            Images are automatically optimized for faster uploads.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PhotoUploadBox
              label="Front View"
              photoState={frontPhoto}
              onFileSelect={(file) => handleFileSelect(file, setFrontPhoto)}
              testId="photo-front"
            />
            <PhotoUploadBox
              label="Back View"
              photoState={backPhoto}
              onFileSelect={(file) => handleFileSelect(file, setBackPhoto)}
              testId="photo-back"
            />
            <PhotoUploadBox
              label="Left Side View"
              photoState={leftPhoto}
              onFileSelect={(file) => handleFileSelect(file, setLeftPhoto)}
              testId="photo-left"
            />
            <PhotoUploadBox
              label="Right Side View"
              photoState={rightPhoto}
              onFileSelect={(file) => handleFileSelect(file, setRightPhoto)}
              testId="photo-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks (Optional)</Label>
            <Textarea
              id="remarks"
              placeholder="Any scratches, dents, or other observations..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              data-testid="textarea-remarks"
            />
          </div>

          {isUploading && (
            <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{uploadStage}</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <span className="text-xs text-blue-600 dark:text-blue-400">{uploadProgress}% complete</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isUploading || !allPhotosReady || anyProcessing}
              data-testid="button-submit"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : anyProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Inspection"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
