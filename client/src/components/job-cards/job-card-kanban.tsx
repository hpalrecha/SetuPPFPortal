import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";
import type { JobCardView } from "@/hooks/use-job-cards";

const statusColors = {
  AWAITING_ACK: "bg-red-100 text-red-800",
  ACKNOWLEDGED: "bg-yellow-100 text-yellow-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  PENDING_APPROVAL: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  REWORK_REQUESTED: "bg-red-100 text-red-800",
  CLOSED: "bg-gray-100 text-gray-800"
};

interface JobCardKanbanProps {
  jobCards: JobCardView[];
  onSendReminder?: (id: string) => void;
  onReview?: (id: string) => void;
  onManageJob?: (id: string) => void;
  currentUserRole?: string;
}

export default function JobCardKanban({ jobCards, onSendReminder, onReview, onManageJob, currentUserRole }: JobCardKanbanProps) {
  // Enhanced grouping for 7-status workflow
  const groupedJobCards = {
    AWAITING_ACK: jobCards.filter(jc => jc.status === 'AWAITING_ACK'),
    ACKNOWLEDGED: jobCards.filter(jc => jc.status === 'ACKNOWLEDGED'), 
    SCHEDULED: jobCards.filter(jc => jc.status === 'SCHEDULED'),
    IN_PROGRESS: jobCards.filter(jc => jc.status === 'IN_PROGRESS'),
    COMPLETED: jobCards.filter(jc => jc.status === 'COMPLETED'),
    PENDING_APPROVAL: jobCards.filter(jc => jc.status === 'PENDING_APPROVAL'),
    APPROVED: jobCards.filter(jc => ['APPROVED', 'CLOSED'].includes(jc.status || '')),
    REWORK_REQUESTED: jobCards.filter(jc => jc.status === 'REWORK_REQUESTED')
  };

  const renderJobCard = (job: JobCardView, columnType: string) => (
    <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
          <span className="text-xs text-muted-foreground">
            {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "N/A"}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          {job.workOrder?.vehicleModel?.oem?.name} {job.workOrder?.vehicleModel?.modelName} - {job.workOrder?.service?.name}
        </p>
        <p className="text-xs text-muted-foreground mb-2">{job.partner?.displayName || 'Unassigned Partner'}</p>
        
        {/* Action buttons based on status and role */}
        {(columnType === 'AWAITING_ACK' || columnType === 'REWORK_REQUESTED') && 
         ['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN'].includes(currentUserRole || '') && onSendReminder && (
          <Button 
            size="sm" 
            variant="destructive" 
            className="w-full"
            onClick={() => onSendReminder(job.id)}
            data-testid={`button-reminder-${job.id}`}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Send Reminder
          </Button>
        )}
        
        {(columnType === 'ACKNOWLEDGED' || columnType === 'SCHEDULED' || columnType === 'IN_PROGRESS') && (
          <>
            {['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER'].includes(currentUserRole || '') && onManageJob && (
              <Button 
                size="sm" 
                className="w-full mb-2"
                onClick={() => onManageJob(job.id)}
                data-testid={`button-manage-${job.id}`}
              >
                Manage Job
              </Button>
            )}
            <div className="mb-2">
              <Progress value={columnType === 'ACKNOWLEDGED' ? 25 : columnType === 'SCHEDULED' ? 50 : 75} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              {columnType === 'ACKNOWLEDGED' ? '25%' : columnType === 'SCHEDULED' ? '50%' : '75%'} complete
            </p>
          </>
        )}
        
        {(columnType === 'COMPLETED' || columnType === 'PENDING_APPROVAL') && (
          <>
            {['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN'].includes(currentUserRole || '') && onReview && (
              <Button 
                size="sm" 
                className="w-full mb-2"
                onClick={() => onReview(job.id)}
                data-testid={`button-review-${job.id}`}
              >
                Review
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Ready for approval</p>
          </>
        )}
        
        {columnType === 'APPROVED' && (
          <Badge className={job.status === 'CLOSED' ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800"}>
            {job.status === 'CLOSED' ? 'Closed' : 'Approved'}
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Awaiting Start (Acknowledgment + Rework) */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Awaiting Start</CardTitle>
            <Badge className="bg-red-100 text-red-800" data-testid="count-awaiting-start">
              {groupedJobCards.AWAITING_ACK.length + groupedJobCards.REWORK_REQUESTED.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(groupedJobCards.AWAITING_ACK.length + groupedJobCards.REWORK_REQUESTED.length) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No jobs awaiting start</p>
          ) : (
            <>
              {groupedJobCards.AWAITING_ACK.map((job) => renderJobCard(job, 'AWAITING_ACK'))}
              {groupedJobCards.REWORK_REQUESTED.map((job) => renderJobCard(job, 'REWORK_REQUESTED'))}
            </>
          )}
        </CardContent>
      </Card>

      {/* In Progress (Acknowledged + Scheduled + In Progress) */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">In Progress</CardTitle>
            <Badge className="bg-blue-100 text-blue-800" data-testid="count-in-progress">
              {groupedJobCards.ACKNOWLEDGED.length + groupedJobCards.SCHEDULED.length + groupedJobCards.IN_PROGRESS.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(groupedJobCards.ACKNOWLEDGED.length + groupedJobCards.SCHEDULED.length + groupedJobCards.IN_PROGRESS.length) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No jobs in progress</p>
          ) : (
            <>
              {groupedJobCards.ACKNOWLEDGED.map((job) => renderJobCard(job, 'ACKNOWLEDGED'))}
              {groupedJobCards.SCHEDULED.map((job) => renderJobCard(job, 'SCHEDULED'))}
              {groupedJobCards.IN_PROGRESS.map((job) => renderJobCard(job, 'IN_PROGRESS'))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Awaiting Approval (Completed + Pending Approval + Approved) */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Completion & Approval</CardTitle>
            <Badge className="bg-orange-100 text-orange-800" data-testid="count-completion-approval">
              {groupedJobCards.COMPLETED.length + groupedJobCards.PENDING_APPROVAL.length + groupedJobCards.APPROVED.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(groupedJobCards.COMPLETED.length + groupedJobCards.PENDING_APPROVAL.length + groupedJobCards.APPROVED.length) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No jobs ready for approval</p>
          ) : (
            <>
              {groupedJobCards.COMPLETED.map((job) => renderJobCard(job, 'COMPLETED'))}
              {groupedJobCards.PENDING_APPROVAL.map((job) => renderJobCard(job, 'PENDING_APPROVAL'))}
              {groupedJobCards.APPROVED.map((job) => renderJobCard(job, 'APPROVED'))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
