import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  LayoutGrid, 
  List, 
  Loader2, 
  Eye,
  AlertCircle, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  Trophy, 
  FileText, 
  Zap, 
  Target, 
  Settings, 
  Play,
  Grid3X3 
} from "lucide-react";
import { format } from "date-fns";

// Enhanced Job Card types to match API structure
interface JobCard {
  id: string;
  workOrderId?: string;
  partnerId?: string;
  assignedInstallerId?: string;
  status: string;
  acknowledgedAt?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  checklistJson?: string;
  remarks?: string;
  partnerRemarks?: string;
  materialConsumptionJson?: string;
  batchNumbers?: string[];
  approvalRequestedAt?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  pricingSnapshotJson?: string;
  commissionSnapshotJson?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface WorkOrder {
  id: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleModelId?: string;
  vehicleModelName?: string;
  vehicleVariant?: string;
  serviceId?: string;
  serviceName?: string;
  serviceDescription?: string;
  showroomId?: string;
  showroomName?: string;
  dealershipId?: string;
  dealershipName?: string;
  oemId?: string;
  oemName?: string;
  [key: string]: any;
}

interface Partner {
  id: string;
  displayName?: string;
  companyName?: string;
  businessType?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  [key: string]: any;
}

interface Service {
  id: string;
  name?: string;
  description?: string;
  brandName?: string;
  categoryName?: string;
  [key: string]: any;
}

interface VehicleModel {
  id: string;
  modelName?: string;
  variant?: string;
  oemId?: string;
  oemName?: string;
  [key: string]: any;
}

interface EnrichedJobCard extends JobCard {
  workOrder?: WorkOrder;
  partner?: Partner;
  service?: Service;
  vehicleModel?: VehicleModel;
  customerName?: string;
  vehicleDisplay?: string;
  serviceDisplay?: string;
  partnerDisplay?: string;
}

type ViewMode = 'list' | 'kanban';

const STATUS_COLORS = {
  'AWAITING_ACK': 'bg-red-100 text-red-800 border-red-200',
  'ACKNOWLEDGED': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'ASSIGNED': 'bg-blue-100 text-blue-800 border-blue-200',
  'SCHEDULED': 'bg-blue-100 text-blue-800 border-blue-200', 
  'IN_PROGRESS': 'bg-blue-100 text-blue-800 border-blue-200',
  'COMPLETED': 'bg-green-100 text-green-800 border-green-200',
  'PENDING_APPROVAL': 'bg-orange-100 text-orange-800 border-orange-200',
  'APPROVED': 'bg-green-100 text-green-800 border-green-200',
  'CANCELLED': 'bg-red-100 text-red-800 border-red-200',
  'CLOSED': 'bg-gray-100 text-gray-800 border-gray-200'
};

const STATUS_ICONS = {
  'AWAITING_ACK': Clock,
  'ACKNOWLEDGED': CheckCircle2,
  'ASSIGNED': CheckCircle2,
  'SCHEDULED': Clock,
  'IN_PROGRESS': Wrench,
  'COMPLETED': CheckCircle2,
  'PENDING_APPROVAL': AlertCircle,
  'APPROVED': Trophy,
  'CANCELLED': AlertCircle,
  'CLOSED': Trophy
};

const STATUS_LABELS = {
  'AWAITING_ACK': 'Awaiting Acknowledgment',
  'ACKNOWLEDGED': 'Acknowledged',
  'ASSIGNED': 'Assigned',
  'SCHEDULED': 'Scheduled',
  'IN_PROGRESS': 'In Progress',
  'COMPLETED': 'Completed',
  'PENDING_APPROVAL': 'Pending Approval',
  'APPROVED': 'Approved',
  'CANCELLED': 'Cancelled',
  'CLOSED': 'Closed'
};

export default function JobCardsNew() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedJobCard, setSelectedJobCard] = useState<EnrichedJobCard | null>(null);

  // Fetch and enrich job cards with related data
  const { data: jobCards = [], isLoading, error } = useQuery({
    queryKey: ['jobCards'],
    queryFn: async (): Promise<EnrichedJobCard[]> => {
      const token = localStorage.getItem('auth_token');
      const selectedOemId = localStorage.getItem('selectedOemId');
      
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      if (selectedOemId) {
        headers['x-oem-id'] = selectedOemId;
      }

      // Fetch job cards
      const response = await fetch('/api/job-cards', {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job cards: ${response.status}`);
      }

      const rawJobCards: JobCard[] = await response.json();
      
      // Extract unique IDs for batch fetching
      const workOrderIds = Array.from(new Set(
        rawJobCards.map(jc => jc.workOrderId).filter(Boolean)
      ));
      const partnerIds = Array.from(new Set(
        rawJobCards.map(jc => jc.partnerId).filter(Boolean)
      ));

      // Fetch related data in parallel
      const [workOrdersData, partnersData] = await Promise.all([
        // Fetch work orders
        workOrderIds.length > 0 ? Promise.all(
          workOrderIds.map(async (id) => {
            try {
              const res = await fetch(`/api/work-orders/${id}`, {
                headers,
                credentials: 'include',
                cache: 'no-store',
              });
              return res.ok ? res.json() : null;
            } catch {
              return null;
            }
          })
        ).then(results => results.filter(Boolean)) : [],
        
        // Fetch partners
        partnerIds.length > 0 ? Promise.all(
          partnerIds.map(async (id) => {
            try {
              const res = await fetch(`/api/partners/${id}`, {
                headers,
                credentials: 'include', 
                cache: 'no-store',
              });
              return res.ok ? res.json() : null;
            } catch {
              return null;
            }
          })
        ).then(results => results.filter(Boolean)) : []
      ]);

      // Create lookup maps
      const workOrderMap = new Map(workOrdersData.map((wo: WorkOrder) => [wo.id, wo]));
      const partnerMap = new Map(partnersData.map((p: Partner) => [p.id, p]));

      // Enrich job cards with related data
      const enrichedJobCards: EnrichedJobCard[] = rawJobCards.map(jobCard => {
        const workOrder = workOrderMap.get(jobCard.workOrderId || '');
        const partner = partnerMap.get(jobCard.partnerId || '');

        const enriched: EnrichedJobCard = {
          ...jobCard,
          workOrder,
          partner,
          // Create display strings
          customerName: workOrder?.customerName || 'N/A',
          vehicleDisplay: workOrder?.vehicleModelName 
            ? `${workOrder.oemName || ''} ${workOrder.vehicleModelName}${workOrder.vehicleVariant ? ` (${workOrder.vehicleVariant})` : ''}`.trim()
            : 'N/A',
          serviceDisplay: workOrder?.serviceName || 'N/A',
          partnerDisplay: partner?.displayName || partner?.companyName || 'Unassigned Partner'
        };

        return enriched;
      });
      
      return enrichedJobCards;
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

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (status: string) => {
    const StatusIcon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || Clock;
    return (
      <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-500 text-white'}>
        <StatusIcon className="w-3 h-3 mr-1" />
        {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
      </Badge>
    );
  };

  const getProgressValue = (status: string) => {
    const progressMap: Record<string, number> = {
      AWAITING_ACK: 10,
      ACKNOWLEDGED: 25,
      ASSIGNED: 40,
      SCHEDULED: 40,
      IN_PROGRESS: 60,
      COMPLETED: 80,
      PENDING_APPROVAL: 90,
      APPROVED: 100,
      CLOSED: 100
    };
    return progressMap[status] || 0;
  };

  // Group job cards by status for Kanban view
  const groupedJobCards = {
    AWAITING_ACK: jobCards.filter(jc => jc.status === 'AWAITING_ACK'),
    IN_PROGRESS: jobCards.filter(jc => jc.status && ['ACKNOWLEDGED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(jc.status)),
    PENDING_APPROVAL: jobCards.filter(jc => jc.status && ['COMPLETED', 'PENDING_APPROVAL'].includes(jc.status)),
    COMPLETED: jobCards.filter(jc => jc.status && ['APPROVED', 'CLOSED'].includes(jc.status))
  };

  const handleViewJobCard = (jobCard: EnrichedJobCard) => {
    setSelectedJobCard(jobCard);
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>Error loading job cards: {(error as Error).message}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      {/* Header with gradient styling matching old design */}
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobCards.map((jobCard) => (
                  <TableRow key={jobCard.id} data-testid={`row-job-card-${jobCard.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-id-${jobCard.id}`}>
                      JC-{jobCard.id.slice(-6)}
                    </TableCell>
                    <TableCell data-testid={`status-${jobCard.id}`}>
                      {getStatusBadge(jobCard.status)}
                    </TableCell>
                    <TableCell data-testid={`text-customer-${jobCard.id}`}>
                      {jobCard.customerName}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${jobCard.id}`}>
                      {jobCard.workOrder?.customerPhone || 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`text-vehicle-${jobCard.id}`}>
                      {jobCard.vehicleDisplay}
                    </TableCell>
                    <TableCell data-testid={`text-service-${jobCard.id}`}>
                      {jobCard.serviceDisplay}
                    </TableCell>
                    <TableCell data-testid={`text-partner-${jobCard.id}`}>
                      {jobCard.partnerDisplay}
                    </TableCell>
                    <TableCell data-testid={`text-created-${jobCard.id}`}>
                      {formatDate(jobCard.createdAt)}
                    </TableCell>
                    <TableCell data-testid={`text-scheduled-${jobCard.id}`}>
                      {formatDate(jobCard.scheduledAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewJobCard(jobCard)}
                        data-testid={`button-view-${jobCard.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Kanban View with gradient cards matching old design */}
      {!isLoading && jobCards.length > 0 && viewMode === 'kanban' && (
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
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleViewJobCard(job)}
                        data-testid={`button-view-${job.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
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
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <div className="mb-2">
                        <Progress value={getProgressValue(job.status)} className="h-2" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{getProgressValue(job.status)}% complete</p>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleViewJobCard(job)}
                        data-testid={`button-view-${job.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
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
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleViewJobCard(job)}
                        data-testid={`button-view-${job.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Review
                      </Button>
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
                        <span className="text-sm font-mono text-primary">JC-{job.id.slice(-6)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {job.vehicleDisplay} - {job.serviceDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{job.partnerDisplay}</p>
                      <Badge className="bg-green-100 text-green-800 mb-2">
                        Approved
                      </Badge>
                      <Button 
                        size="sm" 
                        className="w-full"
                        variant="outline"
                        onClick={() => handleViewJobCard(job)}
                        data-testid={`button-view-${job.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Job Card Detail Modal */}
      <Dialog open={!!selectedJobCard} onOpenChange={() => setSelectedJobCard(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Card Details - JC-{selectedJobCard?.id.slice(-6)}</DialogTitle>
          </DialogHeader>
          {selectedJobCard && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Job Card ID:</strong> {selectedJobCard.id}</div>
                    <div><strong>Status:</strong> {getStatusBadge(selectedJobCard.status)}</div>
                    <div><strong>Work Order ID:</strong> {selectedJobCard.workOrderId || 'N/A'}</div>
                    <div><strong>Created:</strong> {formatDateTime(selectedJobCard.createdAt)}</div>
                    <div><strong>Updated:</strong> {formatDateTime(selectedJobCard.updatedAt)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {selectedJobCard.customerName}</div>
                    <div><strong>Phone:</strong> {selectedJobCard.workOrder?.customerPhone || 'N/A'}</div>
                    <div><strong>Email:</strong> {selectedJobCard.workOrder?.customerEmail || 'N/A'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Vehicle & Service</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Vehicle:</strong> {selectedJobCard.vehicleDisplay}</div>
                    <div><strong>Service:</strong> {selectedJobCard.serviceDisplay}</div>
                    <div><strong>Service Description:</strong> {selectedJobCard.workOrder?.serviceDescription || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Partner Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Partner:</strong> {selectedJobCard.partnerDisplay}</div>
                    <div><strong>Business Type:</strong> {selectedJobCard.partner?.businessType || 'N/A'}</div>
                    <div><strong>Contact Person:</strong> {selectedJobCard.partner?.contactPersonName || 'N/A'}</div>
                    <div><strong>Contact Phone:</strong> {selectedJobCard.partner?.contactPersonPhone || 'N/A'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Acknowledged At:</strong> {formatDateTime(selectedJobCard.acknowledgedAt)}</div>
                    <div><strong>Scheduled At:</strong> {formatDateTime(selectedJobCard.scheduledAt)}</div>
                    <div><strong>Started At:</strong> {formatDateTime(selectedJobCard.startedAt)}</div>
                    <div><strong>Completed At:</strong> {formatDateTime(selectedJobCard.completedAt)}</div>
                    <div><strong>Approved At:</strong> {formatDateTime(selectedJobCard.approvedAt)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Additional Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Assigned Installer:</strong> {selectedJobCard.assignedInstallerId || 'N/A'}</div>
                    <div><strong>Remarks:</strong> {selectedJobCard.remarks || 'N/A'}</div>
                    <div><strong>Partner Remarks:</strong> {selectedJobCard.partnerRemarks || 'N/A'}</div>
                    <div><strong>Batch Numbers:</strong> {selectedJobCard.batchNumbers?.join(', ') || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}