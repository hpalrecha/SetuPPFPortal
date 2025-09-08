import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Check, RotateCcw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ApprovalModalProps {
  jobCardId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApprovalModal({ jobCardId, isOpen, onClose }: ApprovalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState("");

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/job-cards/${jobCardId}/approve`, {
        remarks: comments
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
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

  const mockProofImages = [
    "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400&h=300&fit=crop"
  ];

  return (
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
              <div className="grid grid-cols-2 gap-3 mb-4">
                {mockProofImages.map((imageUrl, index) => (
                  <img 
                    key={index}
                    src={imageUrl} 
                    alt={`PPF installation progress ${index + 1}`} 
                    className="rounded-lg border aspect-square object-cover"
                    data-testid={`proof-image-${index}`}
                  />
                ))}
              </div>

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
  );
}
