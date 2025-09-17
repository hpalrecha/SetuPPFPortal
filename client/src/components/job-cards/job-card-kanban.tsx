import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";
import type { JobCard } from "@shared/schema";

const statusColors = {
  AWAITING_ACK: "bg-red-100 text-red-800",
  ACKNOWLEDGED: "bg-yellow-100 text-yellow-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  PENDING_APPROVAL: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800"
};

interface JobCardKanbanProps {
  jobCards: JobCard[];
  onSendReminder?: (id: string) => void;
  onReview?: (id: string) => void;
}

export default function JobCardKanban({ jobCards, onSendReminder, onReview }: JobCardKanbanProps) {
  const groupedJobCards = {
    AWAITING_ACK: jobCards.filter(jc => jc.status === 'AWAITING_ACK'),
    IN_PROGRESS: jobCards.filter(jc => ['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'].includes(jc.status)),
    PENDING_APPROVAL: jobCards.filter(jc => ['COMPLETED', 'PENDING_APPROVAL'].includes(jc.status)),
    COMPLETED: jobCards.filter(jc => ['APPROVED', 'CLOSED'].includes(jc.status))
  };

  const renderJobCard = (job: JobCard, columnType: string) => (
    <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
          <span className="text-xs text-muted-foreground">
            {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "N/A"}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          {job.workOrder?.vehicleModel?.brand?.name} {job.workOrder?.vehicleModel?.modelName} - {job.workOrder?.service?.name}
        </p>
        <p className="text-xs text-muted-foreground mb-2">{job.partner?.displayName || 'Unassigned Partner'}</p>
        
        {columnType === 'AWAITING_ACK' && (
          <Button 
            size="sm" 
            variant="destructive" 
            className="w-full"
            onClick={() => onSendReminder?.(job.id)}
            data-testid={`button-reminder-${job.id}`}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Send Reminder
          </Button>
        )}
        
        {columnType === 'IN_PROGRESS' && (
          <>
            <div className="mb-2">
              <Progress value={60} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">60% complete</p>
          </>
        )}
        
        {columnType === 'PENDING_APPROVAL' && (
          <>
            <Button 
              size="sm" 
              className="w-full mb-2"
              onClick={() => onReview?.(job.id)}
              data-testid={`button-review-${job.id}`}
            >
              Review
            </Button>
            <p className="text-xs text-muted-foreground">4 photos uploaded</p>
          </>
        )}
        
        {columnType === 'COMPLETED' && (
          <Badge className="bg-green-100 text-green-800">
            Approved
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Awaiting Acknowledgment */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Awaiting Acknowledgment</CardTitle>
            <Badge className="bg-red-100 text-red-800" data-testid="count-awaiting-ack">
              {groupedJobCards.AWAITING_ACK.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedJobCards.AWAITING_ACK.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending acknowledgments</p>
          ) : (
            groupedJobCards.AWAITING_ACK.map((job) => renderJobCard(job, 'AWAITING_ACK'))
          )}
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">In Progress</CardTitle>
            <Badge className="bg-blue-100 text-blue-800" data-testid="count-in-progress">
              {groupedJobCards.IN_PROGRESS.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedJobCards.IN_PROGRESS.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No jobs in progress</p>
          ) : (
            groupedJobCards.IN_PROGRESS.map((job) => renderJobCard(job, 'IN_PROGRESS'))
          )}
        </CardContent>
      </Card>

      {/* Pending Approval */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pending Approval</CardTitle>
            <Badge className="bg-orange-100 text-orange-800" data-testid="count-pending-approval">
              {groupedJobCards.PENDING_APPROVAL.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedJobCards.PENDING_APPROVAL.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No approvals pending</p>
          ) : (
            groupedJobCards.PENDING_APPROVAL.map((job) => renderJobCard(job, 'PENDING_APPROVAL'))
          )}
        </CardContent>
      </Card>

      {/* Completed */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Completed</CardTitle>
            <Badge className="bg-green-100 text-green-800" data-testid="count-completed">
              {groupedJobCards.COMPLETED.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedJobCards.COMPLETED.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No completed jobs</p>
          ) : (
            groupedJobCards.COMPLETED.map((job) => renderJobCard(job, 'COMPLETED'))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
