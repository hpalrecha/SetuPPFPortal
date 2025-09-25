import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Check, RotateCcw, CheckCircle, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ImageModal } from "@/components/ui/image-modal";

interface ApprovalModalProps {
  jobCardId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApprovalModal({ jobCardId, isOpen, onClose }: ApprovalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Fetch job card data to access media
  const { data: jobCard } = useQuery({
    queryKey: ['/api/job-cards', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return null;
      const response = await apiRequest('GET', `/api/job-cards/${jobCardId}`);
      return response.json();
    },
    enabled: !!jobCardId && isOpen
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/job-cards/${jobCardId}/approve`, {
        remarks: comments
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards", jobCardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      toast({
        title: "Job Card Approved",
        description: "The job card has been approved successfully."
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve job card. Please try again.",
        variant: "destructive"
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/job-cards/${jobCardId}/reject`, {
        reason: comments
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      toast({
        title: "Job Card Rejected",
        description: "The job card has been rejected."
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Rejection Failed",
        description: "Failed to reject job card. Please try again.",
        variant: "destructive"
      });
    }
  });

  const reworkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/job-cards/${jobCardId}/request-rework`, {
        reason: comments
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      toast({
        title: "Rework Requested",
        description: "Rework has been requested for this job card."
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Rework Request Failed",
        description: "Failed to request rework. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleApprove = () => {
    approveMutation.mutate();
  };

  const handleReject = () => {
    if (!comments.trim()) {
      toast({
        title: "Comments Required",
        description: "Please provide comments for rejection.",
        variant: "destructive"
      });
      return;
    }
    rejectMutation.mutate();
  };

  const handleRework = () => {
    if (!comments.trim()) {
      toast({
        title: "Comments Required",
        description: "Please provide specific issues for rework.",
        variant: "destructive"
      });
      return;
    }
    reworkMutation.mutate();
  };

  const handleClose = () => {
    setComments("");
    onClose();
  };

  if (!isOpen || !jobCardId) return null;

  // Use real images from job card data, fallback to empty array
  const proofImages = jobCard?.media || [];

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-testid="approval-modal">
      <div className="bg-card rounded-lg border shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Job Card Approval</h3>
            <p className="text-sm text-muted-foreground">JC-{jobCardId.slice(-3)} - Vehicle PPF Installation</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} data-testid="button-close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Work Details */}
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Work Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Partner:</span>
                    <span className="text-foreground">DetailCare Studio</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="text-foreground">PPF Full Body</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started:</span>
                    <span className="text-foreground">2 days ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="text-foreground">6 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="text-foreground font-semibold">₹45,000</span>
                  </div>
                </div>
              </div>

              {/* Partner Remarks */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Partner Remarks</h4>
                <p className="text-sm text-foreground">
                  PPF installation completed as per specifications. All edges properly sealed. 
                  Customer vehicle cleaned and detailed post installation. 
                  Quality check passed - no bubbles or imperfections noted.
                </p>
              </div>

              {/* Quality Checklist */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Quality Checklist</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-foreground">Surface preparation completed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-foreground">PPF applied without bubbles</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-foreground">Edges properly sealed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-foreground">Final quality inspection passed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Proof Images */}
            <div>
              <h4 className="font-semibold text-foreground mb-3">Proof Images</h4>
              {proofImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {proofImages.map((mediaItem: any, index: number) => (
                    <div key={mediaItem.id || index} className="space-y-1">
                      <img 
                        src={mediaItem.url} 
                        alt={mediaItem.caption || `Proof image ${index + 1}`} 
                        className="rounded-lg border aspect-square object-cover w-full cursor-pointer hover:opacity-80 transition-opacity"
                        data-testid={`proof-image-${index}`}
                        onClick={() => {
                          setSelectedImageIndex(index);
                          setImageModalOpen(true);
                        }}
                      />
                      {mediaItem.caption && (
                        <p className="text-xs text-muted-foreground text-center" data-testid={`proof-caption-${index}`}>
                          {mediaItem.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center text-muted-foreground" data-testid="no-images-message">
                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No proof images uploaded yet</p>
                </div>
              )}

              {/* Approval Actions */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="comments">Approval Comments</Label>
                  <Textarea
                    id="comments"
                    rows={3}
                    placeholder="Add comments (optional for approval, required for rejection/rework)"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    data-testid="textarea-comments"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Button 
                    className="flex-1" 
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                    data-testid="button-approve"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1" 
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                    data-testid="button-reject"
                  >
                    <X className="mr-2 h-4 w-4" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1" 
                    onClick={handleRework}
                    disabled={reworkMutation.isPending}
                    data-testid="button-rework"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {reworkMutation.isPending ? "Requesting..." : "Rework"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Image Modal */}
    <ImageModal
      images={proofImages.map((item: any, idx: number) => ({
        id: item.id || idx.toString(),
        url: item.url,
        caption: item.caption,
        alt: item.caption || `Proof image ${idx + 1}`
      }))}
      initialIndex={selectedImageIndex}
      isOpen={imageModalOpen}
      onClose={() => setImageModalOpen(false)}
    />
    </>
  );
}
