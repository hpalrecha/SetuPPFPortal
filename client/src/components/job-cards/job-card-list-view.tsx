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
    const isPartnerUser = ['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER'].includes(currentUserRole || '');
    
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

      {/* Job Cards Table */}
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
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Table Header */}
          <div className="bg-muted/50 border-b border-border px-4 py-3">
            <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr_1.5fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div>ID</div>
              <div>Status</div>
              <div>Customer</div>
              <div>Phone</div>
              <div>Vehicle</div>
              <div>Service</div>
              <div>Billing Value</div>
              <div>Partner</div>
              <div>Sales Person</div>
              <div>Appointment</div>
              <div>Created</div>
              <div>Scheduled</div>
              <div>Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {sortedJobCards.map((job) => {
              const StatusIcon = statusIcons[job.status! as keyof typeof statusIcons] || Clock;
              const priority = getPriorityLevel(job.status!, job.createdAt!);
              const progressValue = getProgressValue(job.status!);
              const isCompleted = ['APPROVED', 'CLOSED'].includes(job.status!);
              
              return (
                <div 
                  key={job.id}
                  className={`px-4 py-4 hover:bg-muted/30 transition-colors ${
                    priority === 'high' ? 'border-l-4 border-l-red-500 bg-red-50/20' : 
                    priority === 'medium' ? 'border-l-4 border-l-orange-500 bg-orange-50/20' : 
                    ''
                  } ${isCompleted ? 'opacity-75' : ''}`}
                  data-testid={`card-job-${job.id}`}
                >
                  <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr_1.5fr_1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 items-center">
                    {/* ID Column */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${statusColorClasses[job.status! as keyof typeof statusColorClasses]}`}>
                          <StatusIcon className="h-3 w-3" />
                        </div>
                        <div>
                          <span className="font-mono text-sm font-semibold">JC-{job.id.slice(-6)}</span>
                          {priority !== 'normal' && (
                            <div className="text-xs">
                              <Badge 
                                variant={priority === 'high' ? 'destructive' : 'default'} 
                                className="text-xs px-1 py-0"
                              >
                                {priority === 'high' ? 'URGENT' : 'PRIORITY'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Column */}
                    <div>
                      <Badge 
                        className={`text-xs px-2 py-1 ${statusColors[job.status! as keyof typeof statusColors]}`}
                      >
                        {job.status?.replace(/_/g, " ")}
                      </Badge>
                      {/* Progress bar for active jobs */}
                      {['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PENDING_APPROVAL'].includes(job.status!) && (
                        <div className="mt-1">
                          <Progress value={progressValue} className="h-1 w-full" />
                          <span className="text-xs text-muted-foreground">{progressValue}%</span>
                        </div>
                      )}
                    </div>

                    {/* Customer Column */}
                    <div>
                      <div className="text-sm font-medium">Customer</div>
                    </div>

                    {/* Phone Column */}
                    <div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-xs">Available</span>
                      </div>
                    </div>

                    {/* Vehicle Column */}
                    <div>
                      <div className="text-sm font-medium">
                        {job.workOrder?.vehicleModel?.oem?.name} {job.workOrder?.vehicleModel?.modelName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.workOrder?.vehicleModel?.oem?.name || 'Vehicle Brand'}
                      </div>
                    </div>

                    {/* Service Column */}
                    <div>
                      <div className="text-sm font-medium">
                        {job.workOrder?.service?.name || 'PPF Service'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Installation service
                      </div>
                    </div>

                    {/* Billing Value Column */}
                    <div>
                      <div className="text-sm font-semibold text-green-600">
                        {job.billingValue ? `₹${Number(job.billingValue).toLocaleString('en-IN')}` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.billingValue ? 'Billing' : 'Not set'}
                      </div>
                    </div>

                    {/* Partner Column */}
                    <div>
                      <div className="text-sm font-medium">
                        {job.partner?.displayName || 'Unassigned'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Partner
                      </div>
                    </div>

                    {/* Sales Person Column */}
                    <div>
                      <div className="text-sm font-medium">
                        {job.workOrder?.salesPersonName || '—'}
                      </div>
                    </div>

                    {/* Appointment Column */}
                    <div>
                      {job.workOrder?.appointmentAt ? (
                        <div>
                          <div className="text-sm">{new Date(job.workOrder.appointmentAt).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">{new Date(job.workOrder.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">—</div>
                      )}
                    </div>

                    {/* Created Column */}
                    <div>
                      <div className="text-sm">{getTimeAgo(job.createdAt!)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(job.createdAt!).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Scheduled Column */}
                    <div>
                      {job.scheduledAt ? (
                        <div>
                          <div className="text-sm">{new Date(job.scheduledAt).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">Scheduled</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Not scheduled</div>
                      )}
                    </div>

                    {/* Actions Column */}
                    <div>
                      <div className="flex flex-col gap-1">
                        {renderActionButtons(job)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}