import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, X } from "lucide-react";
import { useState } from "react";

interface ViewPreInstallationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoFrontUrl: string;
  photoBackUrl: string;
  photoLeftUrl: string;
  photoRightUrl: string;
  remarks?: string | null;
  completedAt?: Date | null;
  completedBy?: string | null;
}

export function ViewPreInstallationModal({
  open,
  onOpenChange,
  photoFrontUrl,
  photoBackUrl,
  photoLeftUrl,
  photoRightUrl,
  remarks,
  completedAt,
}: ViewPreInstallationModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const PhotoView = ({ label, url, testId }: { label: string; url: string; testId: string }) => (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div
        className="relative border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-colors"
        onClick={() => setSelectedPhoto(url)}
        data-testid={`view-${testId}`}
      >
        <img
          src={url}
          alt={label}
          className="w-full h-40 object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
          <Camera className="h-8 w-8 text-white opacity-0 hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Pre-Installation Inspection Photos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {completedAt && (
              <p className="text-sm text-muted-foreground">
                Completed on {new Date(completedAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhotoView label="Front View" url={photoFrontUrl} testId="photo-front" />
              <PhotoView label="Back View" url={photoBackUrl} testId="photo-back" />
              <PhotoView label="Left Side View" url={photoLeftUrl} testId="photo-left" />
              <PhotoView label="Right Side View" url={photoRightUrl} testId="photo-right" />
            </div>

            {remarks && (
              <div className="space-y-2">
                <Label>Remarks</Label>
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="text-sm whitespace-pre-wrap">{remarks}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-size photo viewer */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-6xl max-h-[95vh] p-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={selectedPhoto}
                alt="Full size view"
                className="w-full h-auto max-h-[90vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
