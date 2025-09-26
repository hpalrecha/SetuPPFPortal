import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Wrench, CheckCircle2, Trophy, Settings, Play, Eye, Phone, Car, User, Calendar, MapPin } from "lucide-react";
import type { JobCardView } from "@/hooks/use-job-cards";

const statusColors = {
  AWAITING_ACK: "bg-red-50 text-red-700 border-red-200 shadow-red-100",
  ACKNOWLEDGED: "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-yellow-100",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100", 
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-indigo-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100",
  PENDING_APPROVAL: "bg-orange-50 text-orange-700 border-orange-200 shadow-orange-100",
  APPROVED: "bg-green-50 text-green-700 border-green-200 shadow-green-100",
  CLOSED: "bg-slate-50 text-slate-700 border-slate-200 shadow-slate-100"
};

const statusColorClasses = {
  AWAITING_ACK: "bg-red-100 text-red-600",
  ACKNOWLEDGED: "bg-yellow-100 text-yellow-600",
  SCHEDULED: "bg-blue-100 text-blue-600", 
  IN_PROGRESS: "bg-indigo-100 text-indigo-600",
  COMPLETED: "bg-emerald-100 text-emerald-600",
  PENDING_APPROVAL: "bg-orange-100 text-orange-600",
  APPROVED: "bg-green-100 text-green-600",
  CLOSED: "bg-slate-100 text-slate-600"
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
  jobCards: JobCardView[];
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

  const renderActionButtons = (job: JobCardView) => {
    const isCompleted = ['APPROVED', 'CLOSED'].includes(job.status!);
    const isPartnerUser = ['PARTNER_ADMIN', 'PARTNER_STAFF'].includes(currentUserRole || '');
    
    // Show different buttons based on status and role
    if (job.status === 'AWAITING_ACK') {
      if (isPartnerUser) {
        // For partner users, show manage button to handle job acknowledgment
        return (
          <Button 
            size="sm" 
            onClick={() => onManageJob?.(job.id)}
            data-testid={`button-manage-${job.id}`}
          >
            <Settings className="h-3 w-3 mr-1" />
            Manage Job
          </Button>
        );
      } else {
        // For admin users, show send reminder option
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Job Cards ({jobCards.length})</h3>
          <p className="text-sm text-muted-foreground mt-1">Sorted by priority and creation date</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Real-time updates
          </Badge>
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
                className={`group transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-0 shadow-sm ${
                  priority === 'high' ? 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50/30 to-white' : 
                  priority === 'medium' ? 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/30 to-white' : 
                  'border-l-4 border-l-slate-200 bg-gradient-to-r from-slate-50/30 to-white'
                } ${isCompleted ? 'opacity-80 hover:opacity-100' : ''}`}
                data-testid={`card-job-${job.id}`}
              >
                <CardContent className="p-6">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {/* Status Icon with enhanced styling */}
                      <div className={`p-3 rounded-xl ${statusColorClasses[job.status! as keyof typeof statusColorClasses]} shadow-sm`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      
                      {/* Job ID and Status */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-lg font-bold text-foreground">JC-{job.id.slice(-6)}</span>
                          <Badge 
                            className={`px-3 py-1 font-medium ${statusColors[job.status! as keyof typeof statusColors]}`}
                          >
                            {job.status?.replace(/_/g, " ")}
                          </Badge>
                          {priority !== 'normal' && (
                            <Badge 
                              variant={priority === 'high' ? 'destructive' : 'default'} 
                              className="text-xs font-bold px-2 py-1 animate-pulse"
                            >
                              {priority === 'high' ? '🚨 URGENT' : '⚡ PRIORITY'}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Progress bar for active jobs - moved to header */}
                        {['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PENDING_APPROVAL'].includes(job.status!) && (
                          <div className="flex items-center gap-3 mb-2">
                            <Progress value={progressValue} className="h-3 w-32" />
                            <span className="text-sm font-medium text-muted-foreground">{progressValue}% complete</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Time info */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-sm">{getTimeAgo(job.createdAt!)}</span>
                      </div>
                      {job.scheduledAt && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className="text-xs">Scheduled {new Date(job.scheduledAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {/* Vehicle Info */}
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <Car className="h-4 w-4 text-slate-600 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Vehicle & Service</div>
                        <div className="font-semibold text-sm text-foreground">
                          {job.workOrder?.vehicleModel?.oem?.name} {job.workOrder?.vehicleModel?.modelName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {job.workOrder?.service?.name}
                        </div>
                      </div>
                    </div>

                    {/* Partner Info */}
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Installation Partner</div>
                        <div className="font-semibold text-sm text-foreground">
                          {job.partner?.displayName || 'Unassigned Partner'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Pending assignment
                        </div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <User className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Customer</div>
                        <div className="font-semibold text-sm text-foreground">
                          Customer Info
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          Contact available
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-end">
                    {renderActionButtons(job)}
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