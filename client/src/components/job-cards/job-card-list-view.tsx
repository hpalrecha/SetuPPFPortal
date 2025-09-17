import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Wrench, CheckCircle2, Trophy, Settings, Play, Eye } from "lucide-react";
import type { JobCard } from "@shared/schema";

const statusColors = {
  AWAITING_ACK: "bg-red-100 text-red-800 border-red-200",
  ACKNOWLEDGED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  SCHEDULED: "bg-blue-100 text-blue-800 border-blue-200", 
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  PENDING_APPROVAL: "bg-orange-100 text-orange-800 border-orange-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  CLOSED: "bg-gray-100 text-gray-800 border-gray-200"
};

const statusIcons = {
  AWAITING_ACK: Clock,
  ACKNOWLEDGED: CheckCircle2,
  SCHEDULED: Clock,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle2,
  PENDING_APPROVAL: AlertCircle,
  APPROVED: Trophy,
  CLOSED: Trophy
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
    CLOSED: 100
  };
  return progressMap[status] || 0;
};

interface JobCardListViewProps {
  jobCards: JobCard[];
  onSendReminder?: (id: string) => void;
  onManageJob?: (id: string) => void;
  onReview?: (id: string) => void;
  currentUserRole?: string;
}

export default function JobCardListView({ 
  jobCards, 
  onSendReminder, 
  onManageJob, 
  onReview,
  currentUserRole 
}: JobCardListViewProps) {
  const getTimeAgo = (dateString: string | Date) => {
    const now = new Date();
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getPriorityLevel = (status: string, createdAt: string | Date) => {
    const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const hoursOld = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60));
    
    if (status === 'AWAITING_ACK' && hoursOld > 2) return 'high';
    if (status === 'PENDING_APPROVAL' && hoursOld > 24) return 'medium';
    return 'normal';
  };

  const sortedJobCards = [...jobCards].sort((a, b) => {
    // Sort by priority first, then by creation date
    const priorityOrder = { 'high': 0, 'medium': 1, 'normal': 2 };
    const aPriority = getPriorityLevel(a.status!, a.createdAt!);
    const bPriority = getPriorityLevel(b.status!, b.createdAt!);
    
    if (aPriority !== bPriority) {
      return priorityOrder[aPriority as keyof typeof priorityOrder] - priorityOrder[bPriority as keyof typeof priorityOrder];
    }
    
    return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
  });

  const renderActionButtons = (job: JobCard) => {
    const isCompleted = ['APPROVED', 'CLOSED'].includes(job.status!);
    
    // Show different buttons based on status and role
    if (job.status === 'AWAITING_ACK') {
      return (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={() => onSendReminder?.(job.id)}
            data-testid={`button-reminder-${job.id}`}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Send Reminder
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onManageJob?.(job.id)}
            data-testid={`button-manage-${job.id}`}
          >
            <Settings className="h-3 w-3 mr-1" />
            Manage
          </Button>
        </div>
      );
    }
    
    if (['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'].includes(job.status!)) {
      return (
        <Button 
          size="sm" 
          onClick={() => onManageJob?.(job.id)}
          data-testid={`button-manage-${job.id}`}
          disabled={isCompleted}
        >
          <Play className="h-3 w-3 mr-1" />
          Manage Job
        </Button>
      );
    }
    
    if (['COMPLETED', 'PENDING_APPROVAL'].includes(job.status!)) {
      return (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => onReview?.(job.id)}
            data-testid={`button-review-${job.id}`}
          >
            <Eye className="h-3 w-3 mr-1" />
            Review
          </Button>
          {!isCompleted && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onManageJob?.(job.id)}
              data-testid={`button-manage-${job.id}`}
            >
              <Settings className="h-3 w-3 mr-1" />
              Manage
            </Button>
          )}
        </div>
      );
    }
    
    // For completed jobs, show view-only button
    return (
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => onReview?.(job.id)}
        data-testid={`button-view-${job.id}`}
      >
        <Eye className="h-3 w-3 mr-1" />
        View
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Job Cards ({jobCards.length})</h3>
          <p className="text-sm text-muted-foreground">Sorted by priority and creation date</p>
        </div>
      </div>

      {/* Job Cards List */}
      {sortedJobCards.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-muted rounded-full">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">No job cards found</h3>
              <p className="text-sm text-muted-foreground">Job cards will appear here when created</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedJobCards.map((job) => {
            const StatusIcon = statusIcons[job.status! as keyof typeof statusIcons] || Clock;
            const priority = getPriorityLevel(job.status!, job.createdAt!);
            const progressValue = getProgressValue(job.status!);
            const isCompleted = ['APPROVED', 'CLOSED'].includes(job.status!);
            
            return (
              <Card 
                key={job.id} 
                className={`transition-shadow hover:shadow-md ${
                  priority === 'high' ? 'border-l-4 border-l-red-500 bg-red-50/20' : 
                  priority === 'medium' ? 'border-l-4 border-l-orange-500 bg-orange-50/20' : 
                  'border-l-4 border-l-gray-300'
                } ${isCompleted ? 'opacity-75' : ''}`}
                data-testid={`card-job-${job.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    {/* Left side - Job Info */}
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Status Icon */}
                      <div className={`p-2 rounded-lg ${statusColors[job.status! as keyof typeof statusColors]?.split(' ')[0]} bg-opacity-50`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      
                      {/* Job Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm font-medium">JC-{job.id.slice(-6)}</span>
                          <Badge 
                            variant="outline" 
                            className={statusColors[job.status! as keyof typeof statusColors]}
                          >
                            {job.status?.replace(/_/g, " ")}
                          </Badge>
                          {priority !== 'normal' && (
                            <Badge variant={priority === 'high' ? 'destructive' : 'default'} className="text-xs">
                              {priority === 'high' ? 'URGENT' : 'PRIORITY'}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Vehicle: </span>
                            <span className="font-medium">Vehicle - Service</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Partner: </span>
                            <span>Partner Name</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created: </span>
                            <span>{getTimeAgo(job.createdAt!)}</span>
                          </div>
                        </div>
                        
                        {/* Progress bar for active jobs */}
                        {['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PENDING_APPROVAL'].includes(job.status!) && (
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={progressValue} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground min-w-[3rem]">{progressValue}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Right side - Actions */}
                    <div className="flex items-center gap-3">
                      {/* Additional info */}
                      {job.scheduledAt && (
                        <div className="text-xs text-muted-foreground text-right">
                          <div>Scheduled</div>
                          <div>{new Date(job.scheduledAt).toLocaleDateString()}</div>
                        </div>
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex flex-col gap-2">
                        {renderActionButtons(job)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}