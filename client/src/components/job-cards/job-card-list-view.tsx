import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Wrench, CheckCircle2, Trophy, Settings, Play, Eye, Phone, Car, User, Calendar, MapPin, Star, ChevronRight } from "lucide-react";
import type { JobCardView } from "@/hooks/use-job-cards";

const statusColors = {
  AWAITING_ACK: "bg-red-50 text-red-700 border border-red-200",
  ACKNOWLEDGED: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border border-blue-200", 
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PENDING_APPROVAL: "bg-orange-50 text-orange-700 border border-orange-200",
  APPROVED: "bg-green-50 text-green-700 border border-green-200",
  CLOSED: "bg-slate-50 text-slate-700 border border-slate-200"
};

const statusIcons = {
  AWAITING_ACK: Clock,
  ACKNOWLEDGED: CheckCircle2,
  SCHEDULED: Calendar,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle2,
  PENDING_APPROVAL: AlertCircle,
  APPROVED: Trophy,
  CLOSED: Trophy
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

  const getPriority = (status: string, createdAt: string | Date) => {
    const hours = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
    if (status === 'AWAITING_ACK' && hours > 24) return 'urgent';
    if (hours > 48) return 'high';
    if (hours > 24) return 'medium';
    return 'normal';
  };

  const getProgress = (status: string) => {
    const progressMap: Record<string, number> = {
      AWAITING_ACK: 5,
      ACKNOWLEDGED: 20,
      SCHEDULED: 40,
      IN_PROGRESS: 65,
      COMPLETED: 85,
      PENDING_APPROVAL: 95,
      APPROVED: 100,
      CLOSED: 100
    };
    return progressMap[status] || 0;
  };

  const renderActionButton = (job: JobCardView) => {
    if (currentUserRole === 'PARTNER_ADMIN' || currentUserRole === 'PARTNER_STAFF') {
      return (
        <Button 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          onClick={() => onManageJob?.(job.id)}
          data-testid={`button-manage-${job.id}`}
        >
          <Settings className="h-3 w-3 mr-1" />
          Manage Job
        </Button>
      );
    }
    
    return (
      <Button 
        size="sm" 
        variant="outline"
        className="border-slate-300 hover:bg-slate-50"
        onClick={() => onReview?.(job.id)}
        data-testid={`button-view-${job.id}`}
      >
        <Eye className="h-3 w-3 mr-1" />
        View Details
      </Button>
    );
  };

  // Sort job cards by priority and date with safer access
  const sortedJobCards = [...jobCards].sort((a, b) => {
    const statusA = a.status || 'AWAITING_ACK';
    const statusB = b.status || 'AWAITING_ACK';
    const dateA = a.createdAt || new Date().toISOString();
    const dateB = b.createdAt || new Date().toISOString();
    
    const priorityA = getPriority(statusA, dateA);
    const priorityB = getPriority(statusB, dateB);
    
    const priorityOrder = { urgent: 4, high: 3, medium: 2, normal: 1 };
    const diff = (priorityOrder[priorityA as keyof typeof priorityOrder] || 0) - (priorityOrder[priorityB as keyof typeof priorityOrder] || 0);
    
    if (diff !== 0) return -diff;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });


  return (
    <div className="space-y-6">
      {/* 🎯 DISTINCTIVE HEADER - This makes it clear we're in card view */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Star className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Job Cards - Card View</h2>
              <p className="text-blue-700 font-medium">Showing {jobCards.length} job cards in modern card layout</p>
            </div>
          </div>
          <Badge className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
            ✨ Enhanced UI
          </Badge>
        </div>
      </div>

      {/* JOB CARDS GRID */}
      {sortedJobCards.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed border-slate-300">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-slate-100 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-slate-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-700">No Job Cards Found</h3>
              <p className="text-slate-500">Job cards will appear here once they're created</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sortedJobCards.map((job) => {
            const StatusIcon = statusIcons[job.status! as keyof typeof statusIcons] || Clock;
            const priority = getPriority(job.status!, job.createdAt!);
            const progress = getProgress(job.status!);
            
            return (
              <Card 
                key={job.id} 
                className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-l-4 ${
                  priority === 'urgent' ? 'border-l-red-500 bg-gradient-to-r from-red-50/50 via-white to-white shadow-red-100' : 
                  priority === 'high' ? 'border-l-orange-500 bg-gradient-to-r from-orange-50/50 via-white to-white shadow-orange-100' : 
                  priority === 'medium' ? 'border-l-yellow-500 bg-gradient-to-r from-yellow-50/50 via-white to-white shadow-yellow-100' : 
                  'border-l-slate-300 bg-gradient-to-r from-slate-50/30 via-white to-white shadow-slate-100'
                }`}
                data-testid={`card-job-${job.id}`}
              >
                {/* Priority Banner */}
                {priority !== 'normal' && (
                  <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white transform rotate-12 translate-x-2 -translate-y-1 ${
                    priority === 'urgent' ? 'bg-red-500' : 
                    priority === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`}>
                    {priority === 'urgent' ? '🚨 URGENT' : priority === 'high' ? '⚡ HIGH' : '⚠️ MEDIUM'}
                  </div>
                )}

                <CardContent className="p-6">
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`p-3 rounded-xl ${statusColors[job.status! as keyof typeof statusColors]} shadow-lg`}>
                        <StatusIcon className="h-6 w-6" />
                      </div>
                      
                      {/* Job Info */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-slate-800 font-mono">
                            JC-{job.id.slice(-6)}
                          </h3>
                          <Badge className={statusColors[job.status! as keyof typeof statusColors]}>
                            {job.status?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="w-40 h-3" />
                          <span className="text-sm font-medium text-slate-600">{progress}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Time & Action */}
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">{getTimeAgo(job.createdAt!)}</span>
                      </div>
                      {renderActionButton(job)}
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Vehicle & Service */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Car className="h-5 w-5 text-blue-600 mt-1" />
                        <div>
                          <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
                            Vehicle & Service
                          </h4>
                          <p className="text-sm font-bold text-blue-900">
                            {job.workOrder?.vehicleModel?.oem?.name} {job.workOrder?.vehicleModel?.modelName}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            {job.workOrder?.service?.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Showroom Details */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-green-600 mt-1" />
                        <div>
                          <h4 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
                            Showroom Details
                          </h4>
                          <p className="text-sm font-bold text-green-900">
                            {job.partner?.displayName || 'Partner Showroom'}
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            Ready for assignment
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-purple-600 mt-1" />
                        <div>
                          <h4 className="text-xs font-semibold text-purple-800 uppercase tracking-wide mb-1">
                            Customer Details
                          </h4>
                          <p className="text-sm font-bold text-purple-900">
                            {(job as any).customerName || `Customer #${job.id.slice(-6)}`}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3 text-purple-600" />
                            <span className="text-xs text-purple-700">
                              {(job as any).customerPhone || 'Contact info loading...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Info */}
                  {job.scheduledAt && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800">
                          Scheduled for: {new Date(job.scheduledAt).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Hover Action Indicator */}
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-6 w-6 text-slate-400" />
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