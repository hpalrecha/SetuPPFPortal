import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { processImage, formatFileSize, getCompressionRatio } from '@/lib/imageProcessing';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface UploadedPhoto {
  label: string;
  url: string;
  originalSize: number;
  compressedSize: number;
}

interface PostInstallationPhotoUploadProps {
  jobCardId: string;
  onPhotosChange: (photos: UploadedPhoto[]) => void;
  existingPhotos?: UploadedPhoto[];
}

const PHOTO_LABELS = ['Front View', 'Rear View', 'Left Side', 'Right Side'];

export function PostInstallationPhotoUpload({ 
  jobCardId, 
  onPhotosChange,
  existingPhotos = []
}: PostInstallationPhotoUploadProps) {
  const { toast } = useToast();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [photos, setPhotos] = useState<(UploadedPhoto | null)[]>(
    PHOTO_LABELS.map((label, index) => existingPhotos[index] || null)
  );
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  const handleFileSelect = async (index: number, file: File) => {
    if (!file) return;

    try {
      setProcessingIndex(index);
      setProcessingStatus('Processing image...');

      const isHeic = file.name.toLowerCase().endsWith('.heic') || 
                     file.name.toLowerCase().endsWith('.heif') ||
                     file.type === 'image/heic' ||
                     file.type === 'image/heif';

      if (isHeic) {
        setProcessingStatus('Converting HEIC format...');
      }

      const processed = await processImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        quality: 0.8
      });

      setProcessingStatus('Uploading to server...');
      setProcessingIndex(null);
      setUploadingIndex(index);

      const formData = new FormData();
      formData.append('file', processed.file);
      formData.append('jobCardId', jobCardId);
      formData.append('type', 'IMAGE');
      formData.append('caption', PHOTO_LABELS[index]);

      const response = await apiRequest('POST', '/api/job-cards/upload-media', formData);
      const result = await response.json();

      const newPhoto: UploadedPhoto = {
        label: PHOTO_LABELS[index],
        url: result.url,
        originalSize: processed.originalSize,
        compressedSize: processed.compressedSize
      };

      const newPhotos = [...photos];
      newPhotos[index] = newPhoto;
      setPhotos(newPhotos);
      onPhotosChange(newPhotos.filter((p): p is UploadedPhoto => p !== null));

      toast({
        title: 'Photo Uploaded',
        description: `${PHOTO_LABELS[index]} photo uploaded successfully. ${getCompressionRatio(processed.originalSize, processed.compressedSize)} smaller.`
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload photo. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploadingIndex(null);
      setProcessingIndex(null);
      setProcessingStatus('');
      if (fileInputRefs.current[index]) {
        fileInputRefs.current[index]!.value = '';
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos[index] = null;
    setPhotos(newPhotos);
    onPhotosChange(newPhotos.filter((p): p is UploadedPhoto => p !== null));
  };

  const uploadedCount = photos.filter(p => p !== null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-5 w-5 text-purple-600" />
          Post-Installation Photos
        </CardTitle>
        <p className="text-sm text-gray-600">
          Upload photos showing the vehicle after PPF installation. 
          You can upload one photo at a time - no need to select all 4 at once.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {PHOTO_LABELS.map((label, index) => {
            const photo = photos[index];
            const isProcessing = processingIndex === index;
            const isUploading = uploadingIndex === index;
            const isActive = isProcessing || isUploading;

            return (
              <div key={label} className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  {photo ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  {label}
                </Label>

                {photo ? (
                  <div className="relative group">
                    <img
                      src={photo.url}
                      alt={label}
                      className="w-full h-32 object-cover rounded-lg border-2 border-green-200"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemovePhoto(index)}
                        className="gap-1"
                        data-testid={`button-remove-post-${index}`}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {formatFileSize(photo.compressedSize)}
                      {photo.originalSize !== photo.compressedSize && (
                        <span className="text-green-300 ml-1">
                          ({getCompressionRatio(photo.originalSize, photo.compressedSize)} saved)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`
                      relative border-2 border-dashed rounded-lg h-32 
                      flex flex-col items-center justify-center gap-2 
                      transition-all cursor-pointer
                      ${isActive 
                        ? 'border-purple-400 bg-purple-50' 
                        : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                      }
                    `}
                    onClick={() => !isActive && fileInputRefs.current[index]?.click()}
                  >
                    <input
                      type="file"
                      ref={(el) => (fileInputRefs.current[index] = el)}
                      accept="image/*,.heic,.heif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(index, file);
                      }}
                      className="hidden"
                      data-testid={`input-post-photo-${index}`}
                    />

                    {isActive ? (
                      <>
                        <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                        <span className="text-xs text-purple-600 font-medium text-center px-2">
                          {processingStatus || 'Uploading...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-gray-400" />
                        <span className="text-xs text-gray-500 text-center px-2">
                          Tap to upload
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {uploadedCount > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-700">
              {uploadedCount} of 4 photos uploaded
              {uploadedCount < 4 && ' - you can add more or continue with current photos'}
            </span>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Mobile Upload Tips:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Photos from iPhone (HEIC format) are automatically converted</li>
                <li>Large photos are compressed to under 1MB for faster upload</li>
                <li>You can upload one photo at a time</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
