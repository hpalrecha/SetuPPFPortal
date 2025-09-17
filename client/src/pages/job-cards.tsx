import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Wrench, CheckCircle2, Trophy, FileText, Zap, Target, Settings, Play, Pause, List, Grid3X3, ToggleLeft, ToggleRight } from "lucide-react";
import ApprovalModal from "@/components/job-cards/approval-modal";
import DetailerJobDetailModal from "@/components/job-cards/detailer-job-detail-modal";
import JobCardListView from "@/components/job-cards/job-card-list-view";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useJobCards, type JobCardView } from "@/hooks/use-job-cards";

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

export default function JobCardsPage() {
  const { user } = useAuth();
  const [selectedJobCard, setSelectedJobCard] = useState<string | null>(null);
  const [selectedDetailerJobCard, setSelectedDetailerJobCard] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list'); // Default to list view

  const { data: jobCards = [], isLoading, error } = useJobCards();

  // Debug logging to understand what's happening
  console.log("Job Cards Debug:", { jobCards, isLoading, error, count: jobCards.length });

  const groupedJobCards = {
    AWAITING_ACK: jobCards.filter(jc => jc.status === 'AWAITING_ACK'),
    IN_PROGRESS: jobCards.filter(jc => jc.status && ['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'].includes(jc.status)),
    PENDING_APPROVAL: jobCards.filter(jc => jc.status && ['COMPLETED', 'PENDING_APPROVAL'].includes(jc.status)),
    COMPLETED: jobCards.filter(jc => jc.status && ['APPROVED', 'CLOSED'].includes(jc.status))
  };

  console.log("Grouped Job Cards Debug:", {
    awaiting: groupedJobCards.AWAITING_ACK.length,
    inProgress: groupedJobCards.IN_PROGRESS.length,
    pendingApproval: groupedJobCards.PENDING_APPROVAL.length,
    completed: groupedJobCards.COMPLETED.length
  });

  const handleSendReminder = (jobCardId: string) => {
    // TODO: Implement reminder notification
    alert("Reminder sent to partner");
  };

  const handleReviewJobCard = (jobCardId: string) => {
    setSelectedJobCard(jobCardId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-96 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Job Cards
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Track installation progress and approvals</p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Badge variant="outline" className="text-sm">
            <Target className="h-3 w-3 mr-1" />
            Live Tracking
          </Badge>
          <Badge variant="outline" className="text-sm">
            <Zap className="h-3 w-3 mr-1" />
            Auto-Refresh
          </Badge>
          
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2"
              data-testid="button-list-view"
            >
              <List className="h-3 w-3 mr-1" />
              List
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="h-8 px-2"
              data-testid="button-kanban-view"
            >
              <Grid3X3 className="h-3 w-3 mr-1" />
              Kanban
            </Button>
          </div>
        </div>
      </div>

      {/* Job Cards Views */}
      {viewMode === 'list' ? (
        <JobCardListView
          jobCards={jobCards}
          onSendReminder={handleSendReminder}
          onManageJob={(id) => setSelectedDetailerJobCard(id)}
          onReview={handleReviewJobCard}
          currentUserRole={user?.role}
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Awaiting Acknowledgment */}
        <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-red-50 to-orange-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-red-700">Awaiting Acknowledgment</CardTitle>
                  <p className="text-xs text-red-500 mt-1">Needs immediate attention</p>
                </div>
              </div>
              <Badge className="bg-red-500 text-white font-semibold" data-testid="count-awaiting-ack">
                {groupedJobCards.AWAITING_ACK.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedJobCards.AWAITING_ACK.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-sm font-medium text-green-700 mb-1">All Clear!</p>
                <p className="text-xs text-green-600">No pending acknowledgments</p>
              </div>
            ) : (
              groupedJobCards.AWAITING_ACK.map((job) => (
                <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
                      <span className="text-xs text-muted-foreground">2h ago</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Vehicle - Service</p>
                    <p className="text-xs text-muted-foreground mb-2">Partner Name</p>
                    <div className="flex gap-2">
                      {['PARTNER_ADMIN', 'PARTNER_STAFF'].includes(user?.role || '') ? (
                        // Partner users see manage button to handle job acknowledgment
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setSelectedDetailerJobCard(job.id)}
                          data-testid={`button-manage-${job.id}`}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Manage Job
                        </Button>
                      ) : (
                        // Admin users see send reminder option
                        <>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="flex-1"
                            onClick={() => handleSendReminder(job.id)}
                            data-testid={`button-reminder-${job.id}`}
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Send Reminder
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setSelectedDetailerJobCard(job.id)}
                            data-testid={`button-manage-${job.id}`}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wrench className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-blue-700">In Progress</CardTitle>
                  <p className="text-xs text-blue-500 mt-1">Active installations</p>
                </div>
              </div>
              <Badge className="bg-blue-500 text-white font-semibold" data-testid="count-in-progress">
                {groupedJobCards.IN_PROGRESS.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedJobCards.IN_PROGRESS.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-blue-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-blue-700 mb-1">Ready to Work</p>
                <p className="text-xs text-blue-600">No active installations</p>
              </div>
            ) : (
              groupedJobCards.IN_PROGRESS.map((job) => (
                <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
                      <span className="text-xs text-muted-foreground">1d ago</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Vehicle - Service</p>
                    <p className="text-xs text-muted-foreground mb-2">Partner Name</p>
                    <div className="mb-2">
                      <Progress value={60} className="h-2" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">60% complete</p>
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => setSelectedDetailerJobCard(job.id)}
                      data-testid={`button-manage-${job.id}`}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Manage Job
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card className="border-l-4 border-l-orange-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-orange-50 to-yellow-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-orange-700">Pending Approval</CardTitle>
                  <p className="text-xs text-orange-500 mt-1">Awaiting review</p>
                </div>
              </div>
              <Badge className="bg-orange-500 text-white font-semibold" data-testid="count-pending-approval">
                {groupedJobCards.PENDING_APPROVAL.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedJobCards.PENDING_APPROVAL.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-gray-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">All Reviewed</p>
                <p className="text-xs text-gray-600">No approvals pending</p>
              </div>
            ) : (
              groupedJobCards.PENDING_APPROVAL.map((job) => (
                <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
                      <span className="text-xs text-muted-foreground">3h ago</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Vehicle - Service</p>
                    <p className="text-xs text-muted-foreground mb-2">Partner Name</p>
                    <Button 
                      size="sm" 
                      className="w-full mb-2"
                      onClick={() => handleReviewJobCard(job.id)}
                      data-testid={`button-review-${job.id}`}
                    >
                      Review
                    </Button>
                    <p className="text-xs text-muted-foreground">4 photos uploaded</p>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-green-700">Completed</CardTitle>
                  <p className="text-xs text-green-500 mt-1">Successfully finished</p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white font-semibold" data-testid="count-completed">
                {groupedJobCards.COMPLETED.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedJobCards.COMPLETED.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-yellow-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Target className="h-8 w-8 text-yellow-500" />
                </div>
                <p className="text-sm font-medium text-yellow-700 mb-1">Ready to Achieve</p>
                <p className="text-xs text-yellow-600">No completed jobs yet</p>
              </div>
            ) : (
              groupedJobCards.COMPLETED.map((job) => (
                <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
                      <span className="text-xs text-muted-foreground">2d ago</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Vehicle - Service</p>
                    <p className="text-xs text-muted-foreground mb-2">Partner Name</p>
                    <Badge className="bg-green-100 text-green-800">
                      Approved
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Approval Modal */}
      <ApprovalModal 
        jobCardId={selectedJobCard}
        isOpen={!!selectedJobCard}
        onClose={() => setSelectedJobCard(null)}
      />
      
      {/* Detailer Job Management Modal */}
      <DetailerJobDetailModal 
        jobCardId={selectedDetailerJobCard}
        isOpen={!!selectedDetailerJobCard}
        onClose={() => setSelectedDetailerJobCard(null)}
      />
    </div>
  );
}
