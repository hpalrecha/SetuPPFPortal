import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreInstallationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCardId: string;
  onSuccess: () => void;
}

export function PreInstallationModal({
  open,
  onOpenChange,
  jobCardId,
  onSuccess,
}: PreInstallationModalProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [backPhoto, setBackPhoto] = useState<File | null>(null);
  const [leftPhoto, setLeftPhoto] = useState<File | null>(null);
  const [rightPhoto, setRightPhoto] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");

  const [frontPhotoPreview, setFrontPhotoPreview] = useState<string | null>(null);
  const [backPhotoPreview, setBackPhotoPreview] = useState<string | null>(null);
  const [leftPhotoPreview, setLeftPhotoPreview] = useState<string | null>(null);
  const [rightPhotoPreview, setRightPhotoPreview] = useState<string | null>(null);

  const handleFileChange = (
    file: File | null,
    setPhoto: (file: File | null) => void,
    setPreview: (preview: string | null) => void
  ) => {
    setPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    // Get upload URL from backend
    const uploadUrlResponse = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      credentials: 'include',
    });

    if (!uploadUrlResponse.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { uploadURL } = await uploadUrlResponse.json();

    // Upload file to object storage
    const uploadResponse = await fetch(uploadURL, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload photo');
    }

    return uploadURL;
  };

  const handleSubmit = async () => {
    try {
      // Validate all photos are selected
      if (!frontPhoto || !backPhoto || !leftPhoto || !rightPhoto) {
        toast({
          title: "Missing Photos",
          description: "Please upload all 4 photos (Front, Back, Left, Right)",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);

      // Upload all photos
      const [photoFrontUrl, photoBackUrl, photoLeftUrl, photoRightUrl] = await Promise.all([
        uploadPhoto(frontPhoto),
        uploadPhoto(backPhoto),
        uploadPhoto(leftPhoto),
        uploadPhoto(rightPhoto),
      ]);

      // Submit to backend
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

      toast({
        title: "Success",
        description: "Pre-installation inspection completed successfully",
      });

      // Reset form
      setFrontPhoto(null);
      setBackPhoto(null);
      setLeftPhoto(null);
      setRightPhoto(null);
      setRemarks("");
      setFrontPhotoPreview(null);
      setBackPhotoPreview(null);
      setLeftPhotoPreview(null);
      setRightPhotoPreview(null);

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Pre-installation upload error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete pre-installation inspection",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const PhotoUploadBox = ({
    label,
    photo,
    preview,
    onFileChange,
    testId,
  }: {
    label: string;
    photo: File | null;
    preview: string | null;
    onFileChange: (file: File | null) => void;
    testId: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt={label}
              className="w-full h-40 object-cover rounded"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => onFileChange(null)}
              data-testid={`button-remove-${testId}`}
            >
              Remove
            </Button>
          </div>
        ) : (
          <label
            htmlFor={`upload-${testId}`}
            className="flex flex-col items-center justify-center h-40 cursor-pointer"
          >
            <Camera className="h-10 w-10 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Click to upload {label}</span>
            <input
              id={`upload-${testId}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onFileChange(file);
                }
              }}
              data-testid={`input-${testId}`}
            />
          </label>
        )}
      </div>
    </div>
  );

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
            This helps document the vehicle's condition before any work begins.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PhotoUploadBox
              label="Front View"
              photo={frontPhoto}
              preview={frontPhotoPreview}
              onFileChange={(file) => handleFileChange(file, setFrontPhoto, setFrontPhotoPreview)}
              testId="photo-front"
            />
            <PhotoUploadBox
              label="Back View"
              photo={backPhoto}
              preview={backPhotoPreview}
              onFileChange={(file) => handleFileChange(file, setBackPhoto, setBackPhotoPreview)}
              testId="photo-back"
            />
            <PhotoUploadBox
              label="Left Side View"
              photo={leftPhoto}
              preview={leftPhotoPreview}
              onFileChange={(file) => handleFileChange(file, setLeftPhoto, setLeftPhotoPreview)}
              testId="photo-left"
            />
            <PhotoUploadBox
              label="Right Side View"
              photo={rightPhoto}
              preview={rightPhotoPreview}
              onFileChange={(file) => handleFileChange(file, setRightPhoto, setRightPhotoPreview)}
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
              disabled={isUploading || !frontPhoto || !backPhoto || !leftPhoto || !rightPhoto}
              data-testid="button-submit"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
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
