import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Check, X, RotateCcw } from "lucide-react";

interface ApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCard: any;
  onSuccess: () => void;
}

export function ApprovalModal({
  open,
  onOpenChange,
  jobCard,
  onSuccess,
}: ApprovalModalProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: "approve" | "reject" | "rework") => {
    if (!jobCard) return;

    setIsLoading(true);
    try {
      let endpoint = "";
      let successMessage = "";

      switch (action) {
        case "approve":
          endpoint = `/api/job-cards/${jobCard.id}/approve`;
          successMessage = "Job card approved successfully";
          break;
        case "reject":
          endpoint = `/api/job-cards/${jobCard.id}/reject`;
          successMessage = "Job card rejected";
          break;
        case "rework":
          endpoint = `/api/job-cards/${jobCard.id}/request-rework`;
          successMessage = "Rework requested";
          break;
      }

      await api.post(endpoint, { remarks: comments });

      toast({
        title: "Success",
        description: successMessage,
      });

      onSuccess();
    } catch (error) {
      console.error(`Error ${action} job card:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} job card`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!jobCard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Job Card Approval - {jobCard.id}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Review the completed work and make approval decision
          </p>
        </DialogHeader>

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
                  <span className="text-foreground">
                    {jobCard.startedAt
                      ? new Date(jobCard.startedAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="text-foreground">
                    {jobCard.completedAt
                      ? new Date(jobCard.completedAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="secondary">{jobCard.status}</Badge>
                </div>
              </div>
            </div>

            {jobCard.partnerRemarks && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">
                  Partner Remarks
                </h4>
                <p className="text-sm text-foreground">{jobCard.partnerRemarks}</p>
              </div>
            )}

            {jobCard.checklistJson && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">
                  Quality Checklist
                </h4>
                <div className="space-y-2 text-sm">
                  {Object.entries(jobCard.checklistJson).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      {value ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Proof Images */}
          <div>
            <h4 className="font-semibold text-foreground mb-3">Proof Images</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Mock images - in real implementation, these would come from jobCard.media */}
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-square bg-muted rounded-lg border flex items-center justify-center"
                >
                  <span className="text-sm text-muted-foreground">Image {i}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="comments">Approval Comments</Label>
                <Textarea
                  id="comments"
                  placeholder="Add comments (optional)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  data-testid="textarea-approval-comments"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            onClick={() => handleAction("approve")}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
            data-testid="button-approve"
          >
            <Check className="w-4 h-4 mr-2" />
            Approve
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAction("reject")}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
            data-testid="button-reject"
          >
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("rework")}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
            data-testid="button-rework"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Request Rework
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
