import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bell, User, Calendar } from "lucide-react";

interface JobCard {
  id: string;
  status: string;
  workOrderId: string;
  partner?: { displayName: string };
  workOrder?: {
    vehicleBrand?: { name: string };
    vehicleModel?: { modelName: string };
    service?: { name: string };
    salesPersonName?: string;
    appointmentAt?: string;
  };
  scheduledAt?: string;
  createdAt: string;
}

interface JobCardKanbanProps {
  jobCard: JobCard;
  onApprovalClick?: () => void;
  showApprovalButton?: boolean;
}

export function JobCardKanban({
  jobCard,
  onApprovalClick,
  showApprovalButton = false,
}: JobCardKanbanProps) {
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getProgressValue = (status: string) => {
    const progressMap: Record<string, number> = {
      AWAITING_ACK: 10,
      ACKNOWLEDGED: 25,
      SCHEDULED: 40,
      IN_PROGRESS: 60,
      COMPLETED: 80,
      PENDING_APPROVAL: 90,
      APPROVED: 100,
    };
    return progressMap[status] || 0;
  };

  const shouldShowReminder = jobCard.status === "AWAITING_ACK";

  return (
    <Card className="bg-background border" data-testid={`job-card-${jobCard.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono text-primary">
            {jobCard.id.slice(0, 8)}
          </span>
          <span className="text-xs text-muted-foreground">
            {getTimeAgo(jobCard.createdAt)}
          </span>
        </div>

        <div className="mb-2">
          <p className="text-sm font-medium text-foreground mb-1">
            {jobCard.workOrder?.vehicleBrand?.name} {jobCard.workOrder?.vehicleModel?.modelName}
          </p>
          <p className="text-xs text-muted-foreground mb-1">
            {jobCard.workOrder?.service?.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {jobCard.partner?.displayName}
          </p>
          {jobCard.workOrder?.salesPersonName && (
            <div className="flex items-center gap-1 mt-1">
              <User className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{jobCard.workOrder.salesPersonName}</p>
            </div>
          )}
          {jobCard.workOrder?.appointmentAt && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {new Date(jobCard.workOrder.appointmentAt).toLocaleDateString()} {new Date(jobCard.workOrder.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>

        {jobCard.status === "IN_PROGRESS" && (
          <div className="mb-2">
            <Progress value={getProgressValue(jobCard.status)} className="h-2 mb-1" />
            <p className="text-xs text-muted-foreground">
              {getProgressValue(jobCard.status)}% complete
            </p>
          </div>
        )}

        {jobCard.status === "PENDING_APPROVAL" && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">4 photos uploaded</p>
          </div>
        )}

        {jobCard.status === "APPROVED" && (
          <Badge className="mb-2 bg-green-100 text-green-800">
            Approved
          </Badge>
        )}

        {shouldShowReminder && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full text-xs"
            data-testid={`button-reminder-${jobCard.id}`}
          >
            <Bell className="w-3 h-3 mr-1" />
            Send Reminder
          </Button>
        )}

        {showApprovalButton && onApprovalClick && (
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={onApprovalClick}
            data-testid={`button-review-${jobCard.id}`}
          >
            Review
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
