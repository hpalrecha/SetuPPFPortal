import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";
import type { JobCard } from "@shared/schema";
import ApprovalModal from "@/components/job-cards/approval-modal";
import { useState } from "react";

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
  const [selectedJobCard, setSelectedJobCard] = useState<string | null>(null);

  const { data: jobCards = [], isLoading } = useQuery<JobCard[]>({
    queryKey: ["/api/job-cards"],
    queryFn: async () => {
      const response = await fetch('/api/job-cards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch job cards');
      }
      
      return response.json();
    },
    refetchInterval: 30000
  });

  const groupedJobCards = {
    AWAITING_ACK: jobCards.filter(jc => jc.status === 'AWAITING_ACK'),
    IN_PROGRESS: jobCards.filter(jc => jc.status && ['ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS'].includes(jc.status)),
    PENDING_APPROVAL: jobCards.filter(jc => jc.status && ['COMPLETED', 'PENDING_APPROVAL'].includes(jc.status)),
    COMPLETED: jobCards.filter(jc => jc.status && ['APPROVED', 'CLOSED'].includes(jc.status))
  };

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
          <h2 className="text-2xl font-semibold text-foreground">Job Cards</h2>
          <p className="text-muted-foreground mt-1">Track installation progress and approvals</p>
        </div>
      </div>

      {/* Job Cards Kanban View */}
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
              groupedJobCards.AWAITING_ACK.map((job) => (
                <Card key={job.id} className="border" data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-primary">JC-{job.id.slice(-3)}</span>
                      <span className="text-xs text-muted-foreground">2h ago</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Vehicle - Service</p>
                    <p className="text-xs text-muted-foreground mb-2">Partner Name</p>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => handleSendReminder(job.id)}
                      data-testid={`button-reminder-${job.id}`}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Send Reminder
                    </Button>
                  </CardContent>
                </Card>
              ))
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
                    <p className="text-xs text-muted-foreground">60% complete</p>
                  </CardContent>
                </Card>
              ))
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

      {/* Approval Modal */}
      <ApprovalModal 
        jobCardId={selectedJobCard}
        isOpen={!!selectedJobCard}
        onClose={() => setSelectedJobCard(null)}
      />
    </div>
  );
}
