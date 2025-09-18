import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { format } from "date-fns";

// Job Card type based on the API response
interface JobCard {
  id: string;
  workOrderId?: string;
  partnerId?: string;
  status: string;
  customerName?: string;
  vehicleModelName?: string;
  serviceName?: string;
  createdAt?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  assignedInstallerId?: string;
  remarks?: string;
  partnerRemarks?: string;
  [key: string]: any; // Allow for additional fields
}

interface JobCardsApiResponse {
  items?: JobCard[];
  data?: JobCard[];
  jobCards?: JobCard[];
  count?: number;
  // Handle direct array response
  [index: number]: JobCard;
  length?: number;
}

type ViewMode = 'list' | 'kanban';

const STATUS_COLORS: Record<string, string> = {
  'AWAITING_ACK': 'bg-yellow-500',
  'ASSIGNED': 'bg-blue-500',
  'IN_PROGRESS': 'bg-orange-500',
  'COMPLETED': 'bg-green-500',
  'CANCELLED': 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  'AWAITING_ACK': 'Awaiting Acknowledgment',
  'ASSIGNED': 'Assigned',
  'IN_PROGRESS': 'In Progress',
  'COMPLETED': 'Completed',
  'CANCELLED': 'Cancelled',
};

export default function JobCardsNew() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Fetch job cards with proper authentication
  const { data: jobCards = [], isLoading, error } = useQuery({
    queryKey: ['jobCards'],
    queryFn: async (): Promise<JobCard[]> => {
      const token = localStorage.getItem('auth_token');
      const selectedOemId = localStorage.getItem('selectedOemId');
      
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      if (selectedOemId) {
        headers['x-oem-id'] = selectedOemId;
      }

      const response = await fetch('/api/job-cards', {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job cards: ${response.status}`);
      }

      const data: JobCardsApiResponse = await response.json();
      
      // Normalize different API response formats
      let normalizedJobCards: JobCard[] = [];
      
      if (Array.isArray(data)) {
        // Direct array response: [...] 
        normalizedJobCards = data;
      } else if (data.items && Array.isArray(data.items)) {
        // Wrapped response: { items: [...] }
        normalizedJobCards = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        // Wrapped response: { data: [...] }
        normalizedJobCards = data.data;
      } else if (data.jobCards && Array.isArray(data.jobCards)) {
        // Wrapped response: { jobCards: [...] }
        normalizedJobCards = data.jobCards;
      } else if ('id' in data && typeof data.id === 'string') {
        // Single object response: { id: "...", ... }
        normalizedJobCards = [data as JobCard];
      }
      
      return normalizedJobCards;
    }
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (status: string) => (
    <Badge className={`${STATUS_COLORS[status] || 'bg-gray-500'} text-white`}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );

  // Group job cards by status for Kanban view
  const groupedJobCards = jobCards.reduce((acc, jobCard) => {
    const status = jobCard.status || 'UNKNOWN';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(jobCard);
    return acc;
  }, {} as Record<string, JobCard[]>);

  const kanbanColumns = ['AWAITING_ACK', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>Error loading job cards: {error.message}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with view toggle */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Job Cards</h1>
          <p className="text-muted-foreground">
            {isLoading ? 'Loading...' : `${jobCards.length} job cards`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            data-testid="button-list-view"
          >
            <List className="w-4 h-4 mr-2" />
            List View
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            data-testid="button-kanban-view"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Kanban View
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading job cards...</span>
        </div>
      )}

      {/* No Data State */}
      {!isLoading && jobCards.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-job-cards">
                No job cards found
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {!isLoading && jobCards.length > 0 && viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Scheduled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobCards.map((jobCard) => (
                  <TableRow key={jobCard.id} data-testid={`row-job-card-${jobCard.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-id-${jobCard.id}`}>
                      {jobCard.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell data-testid={`status-${jobCard.id}`}>
                      {getStatusBadge(jobCard.status)}
                    </TableCell>
                    <TableCell data-testid={`text-customer-${jobCard.id}`}>
                      {jobCard.customerName || 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`text-vehicle-${jobCard.id}`}>
                      {jobCard.vehicleModelName || 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`text-service-${jobCard.id}`}>
                      {jobCard.serviceName || 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`text-created-${jobCard.id}`}>
                      {formatDate(jobCard.createdAt)}
                    </TableCell>
                    <TableCell data-testid={`text-scheduled-${jobCard.id}`}>
                      {formatDate(jobCard.scheduledAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Kanban View */}
      {!isLoading && jobCards.length > 0 && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kanbanColumns.map((status) => {
            const statusJobCards = groupedJobCards[status] || [];
            return (
              <div key={status} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold" data-testid={`text-column-${status}`}>
                    {STATUS_LABELS[status] || status}
                  </h3>
                  <Badge variant="secondary" data-testid={`text-count-${status}`}>
                    {statusJobCards.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {statusJobCards.map((jobCard) => (
                    <Card key={jobCard.id} className="p-4" data-testid={`card-job-card-${jobCard.id}`}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="font-mono text-sm" data-testid={`text-kanban-id-${jobCard.id}`}>
                            {jobCard.id.slice(0, 8)}...
                          </p>
                          {getStatusBadge(jobCard.status)}
                        </div>
                        <div className="space-y-1 text-sm">
                          <p data-testid={`text-kanban-customer-${jobCard.id}`}>
                            <span className="font-medium">Customer:</span> {jobCard.customerName || 'N/A'}
                          </p>
                          <p data-testid={`text-kanban-vehicle-${jobCard.id}`}>
                            <span className="font-medium">Vehicle:</span> {jobCard.vehicleModelName || 'N/A'}
                          </p>
                          <p data-testid={`text-kanban-service-${jobCard.id}`}>
                            <span className="font-medium">Service:</span> {jobCard.serviceName || 'N/A'}
                          </p>
                          <p className="text-muted-foreground" data-testid={`text-kanban-created-${jobCard.id}`}>
                            Created: {formatDate(jobCard.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {statusJobCards.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground" data-testid={`text-empty-${status}`}>
                      No {STATUS_LABELS[status].toLowerCase()} job cards
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}