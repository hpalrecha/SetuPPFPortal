import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Edit, ArrowLeft, Save, XCircle, UserPlus, Send, User, Wrench, Car } from "lucide-react";
import type { WorkOrder } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";
import { CreateWorkOrderModal } from "@/components/modals/CreateWorkOrderModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const statusColors = {
  DRAFT: "bg-gray-100 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED_PENDING_APPROVAL: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800"
};

export default function WorkOrdersPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Route detection
  const [, listRouteParams] = useRoute("/work-orders");
  const [, viewRouteParams] = useRoute("/work-orders/:id");
  const [, editRouteParams] = useRoute("/work-orders/:id/edit");
  
  // Determine current route and get work order ID
  const currentView = editRouteParams ? 'edit' : (viewRouteParams ? 'view' : 'list');
  const workOrderId = editRouteParams?.id || viewRouteParams?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    partnerId: "",
    dateFrom: "",
    limit: 50,
    offset: 0
  });

  // Search filters state
  const [searchFilters, setSearchFilters] = useState({
    workOrderNumber: '',
    customerName: '',
    status: '',
    vehicleModel: '',
    serviceName: '',
    partnerName: ''
  });
  
  // Debounce search filters to avoid filtering on every keystroke
  const debouncedSearchFilters = {
    workOrderNumber: useDebounce(searchFilters.workOrderNumber, 500),
    customerName: useDebounce(searchFilters.customerName, 500),
    status: searchFilters.status, // No debounce for dropdown selection
    vehicleModel: useDebounce(searchFilters.vehicleModel, 500),
    serviceName: useDebounce(searchFilters.serviceName, 500),
    partnerName: useDebounce(searchFilters.partnerName, 500)
  };

  // Check if user can create work orders (showroom managers, dealership admins, sales persons, and super admin)
  const canCreateWorkOrder = user && ['SHOWROOM_MANAGER', 'DEALERSHIP_ADMIN', 'SALES_PERSON', 'SUPER_ADMIN'].includes(user.role);

  // Query for work orders list
  const { data: allWorkOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.append('status', filters.status);
      if (filters.partnerId) searchParams.append('partnerId', filters.partnerId);
      if (filters.dateFrom) searchParams.append('dateFrom', filters.dateFrom);
      searchParams.append('limit', filters.limit.toString());
      searchParams.append('offset', filters.offset.toString());
      
      const response = await fetch(`/api/work-orders?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch work orders');
      }
      
      return response.json();
    },
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: currentView === 'list' // Only fetch when in list view
  });

  // Query for individual work order (for view/edit)
  const { data: workOrder, isLoading: isLoadingWorkOrder } = useQuery<WorkOrder>({
    queryKey: ["/api/work-orders", workOrderId],
    queryFn: async () => {
      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch work order');
      }
      
      return response.json();
    },
    enabled: currentView !== 'list' && !!workOrderId // Only fetch when not in list view and we have an ID
  });

  // Query for work order in edit modal
  const { data: editWorkOrder } = useQuery<WorkOrder>({
    queryKey: ["/api/work-orders", selectedWorkOrder],
    queryFn: async () => {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch work order');
      }
      
      return response.json();
    },
    enabled: !!selectedWorkOrder && showEditModal // Only fetch when modal is open
  });

  // Apply search filters to work orders (using debounced filters)
  const workOrders = allWorkOrders.filter((order) => {
    const workOrderNumber = `WO-${order.id.slice(-6)}`.toLowerCase();
    const customerName = (order.customerName || '').toLowerCase();
    const status = (order.status || '').toLowerCase();
    const vehicleModel = ((order as any).vehicleModelName || '').toLowerCase();
    const serviceName = ((order as any).serviceName || '').toLowerCase();
    const partnerName = ((order as any).assignedPartner?.displayName || '').toLowerCase();

    return (
      (!debouncedSearchFilters.workOrderNumber || workOrderNumber.includes(debouncedSearchFilters.workOrderNumber.toLowerCase())) &&
      (!debouncedSearchFilters.customerName || customerName.includes(debouncedSearchFilters.customerName.toLowerCase())) &&
      (!debouncedSearchFilters.status || status === debouncedSearchFilters.status.toLowerCase()) &&
      (!debouncedSearchFilters.vehicleModel || vehicleModel.includes(debouncedSearchFilters.vehicleModel.toLowerCase())) &&
      (!debouncedSearchFilters.serviceName || serviceName.includes(debouncedSearchFilters.serviceName.toLowerCase())) &&
      (!debouncedSearchFilters.partnerName || partnerName.includes(debouncedSearchFilters.partnerName.toLowerCase()))
    );
  });

  const handleCreateWorkOrder = () => {
    setShowCreateModal(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    // Invalidate and refetch work orders
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
  };

  const handleViewWorkOrder = (id: string) => {
    setLocation(`/work-orders/${id}`);
  };

  const handleEditWorkOrder = (id: string) => {
    setSelectedWorkOrder(id);
    setShowEditModal(true);
  };

  const handleSubmitWorkOrder = async (id: string) => {
    try {
      const response = await apiRequest('POST', `/api/work-orders/${id}/submit`);
      toast({
        title: "Success",
        description: "Work order submitted successfully and assigned to partner"
      });
      // Refetch work orders to show updated status
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
    } catch (error: any) {
      console.error("Submit work order error:", error);
      
      // Extract detailed error message from backend
      let errorMessage = "Failed to submit work order";
      
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleBackToList = () => {
    setLocation('/work-orders');
  };

  // Check if user can cancel work orders (admins only)
  const canEditWorkOrder = user && ['SUPER_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON'].includes(user.role);
  const canCancelWorkOrder = user && ['SUPER_ADMIN', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'].includes(user.role);
  const canAllocatePartner = user?.role === 'SUPER_ADMIN';

  // Fetch partners for manual allocation (only for SUPER_ADMIN)
  const { data: partners = [] } = useQuery({
    queryKey: ["/api/partners"],
    queryFn: async () => {
      const response = await fetch('/api/partners', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch partners');
      return response.json();
    },
    enabled: canAllocatePartner && currentView === 'list',
    staleTime: 300000, // Cache for 5 minutes
  });

  // Handle cancel work order
  const handleCancelWorkOrder = async () => {
    if (!selectedWorkOrder || !cancelReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a cancellation reason",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);
    try {
      await apiRequest('POST', `/api/work-orders/${selectedWorkOrder}/cancel`, { reason: cancelReason });

      toast({
        title: "Success",
        description: "Work order cancelled successfully",
      });

      setShowCancelDialog(false);
      setSelectedWorkOrder(null);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
    } catch (error: any) {
      console.error("Cancel work order error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel work order",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle manual allocation
  const handleAllocatePartner = async () => {
    if (!selectedWorkOrder || !selectedPartnerId) {
      toast({
        title: "Error",
        description: "Please select a partner",
        variant: "destructive",
      });
      return;
    }

    setIsAllocating(true);
    try {
      await apiRequest('POST', `/api/work-orders/${selectedWorkOrder}/allocate`, { partnerId: selectedPartnerId });

      toast({
        title: "Success",
        description: "Partner allocated successfully",
      });

      setShowAllocateDialog(false);
      setSelectedWorkOrder(null);
      setSelectedPartnerId("");
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
    } catch (error: any) {
      console.error("Allocate partner error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to allocate partner",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  // Open cancel dialog
  const openCancelDialog = (workOrderId: string) => {
    setSelectedWorkOrder(workOrderId);
    setShowCancelDialog(true);
  };

  // Open allocate dialog
  const openAllocateDialog = (workOrderId: string) => {
    setSelectedWorkOrder(workOrderId);
    setShowAllocateDialog(true);
  };

  // Show loading state
  if (isLoading || isLoadingWorkOrder) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
      </div>
    );
  }

  // Render individual work order view
  if (currentView === 'view' && workOrder) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={handleBackToList} className="self-start sm:mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Work Order Details</h2>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">WO-{workOrder.id.slice(-6)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Work Order Information */}
          <Card>
            <CardHeader>
              <CardTitle>Work Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Status</h3>
                  <Badge className={statusColors[workOrder.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
                    {workOrder.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Registration Number</h3>
                  <p className="text-sm">{workOrder.regNo || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Quantity</h3>
                  <p className="text-sm">{workOrder.quantity || 1} unit(s)</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Created Date</h3>
                  <p className="text-sm">{new Date(workOrder.createdAt!).toLocaleDateString()}</p>
                </div>
                {(workOrder as any).submittedAt && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Submitted Date</h3>
                    <p className="text-sm">{new Date((workOrder as any).submittedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {(workOrder as any).assignedAt && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Assigned Date</h3>
                    <p className="text-sm">{new Date((workOrder as any).assignedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Information */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Vehicle Model</h3>
                <p className="text-sm">
                  {(workOrder as any).vehicleModelBrand ? `${(workOrder as any).vehicleModelBrand} ` : ""}
                  {(workOrder as any).vehicleModelName || "Not specified"}
                </p>
              </div>
              {workOrder.variant && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Variant</h3>
                  <p className="text-sm">{workOrder.variant}</p>
                </div>
              )}
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Registration Number</h3>
                <p className="text-sm">{workOrder.regNo || "Not provided"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Service Information */}
          <Card>
            <CardHeader>
              <CardTitle>Service Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Service</h3>
                <p className="text-sm font-medium">{(workOrder as any).serviceName || "Service not specified"}</p>
              </div>
              {(workOrder as any).serviceDescription && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Description</h3>
                  <p className="text-sm text-muted-foreground">{(workOrder as any).serviceDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Customer Name</h3>
                <p className="text-sm">{workOrder.customerName || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Phone Number</h3>
                <p className="text-sm">{workOrder.customerPhone || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Email Address</h3>
                <p className="text-sm">{workOrder.customerEmail || "N/A"}</p>
              </div>
              {workOrder.customerAddress && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Address</h3>
                  <p className="text-sm">{workOrder.customerAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization Information */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">OEM</h3>
                <p className="text-sm">{(workOrder as any).oemName || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Dealership</h3>
                <p className="text-sm">{(workOrder as any).dealershipName || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Showroom</h3>
                <p className="text-sm">{(workOrder as any).showroomName || "N/A"}</p>
              </div>
              {(workOrder as any).salesPersonName && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Sales Person</h3>
                  <p className="text-sm">{(workOrder as any).salesPersonName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Partner Information */}
          <Card>
            <CardHeader>
              <CardTitle>Partner Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workOrder.assignedPartnerId ? (
                <>
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Partner Name</h3>
                    <p className="text-sm font-medium">{(workOrder as any).assignedPartner?.displayName || "Partner Assigned"}</p>
                  </div>
                  {(workOrder as any).partnerType && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Partner Type</h3>
                      <Badge variant="secondary">{(workOrder as any).partnerType}</Badge>
                    </div>
                  )}
                  {workOrder.assignedJobCardId && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground">Job Card ID</h3>
                      <p className="text-sm font-mono">{workOrder.assignedJobCardId.slice(-8)}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No partner assigned yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notes Section */}
        {workOrder.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{workOrder.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Job Card Information */}
        {(workOrder as any).jobCard && (
          <Card>
            <CardHeader>
              <CardTitle>Job Card Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Job Card Status</h3>
                  <Badge variant="outline">{(workOrder as any).jobCard.status?.replace(/_/g, " ")}</Badge>
                </div>
                {(workOrder as any).jobCard.scheduledAt && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground">Scheduled At</h3>
                    <p className="text-sm">{new Date((workOrder as any).jobCard.scheduledAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              {workOrder.status === 'DRAFT' && canEditWorkOrder && (
                <>
                  <Button 
                    onClick={() => {
                      setSelectedWorkOrder(workOrder.id);
                      setShowEditModal(true);
                    }} 
                    variant="outline"
                    className="w-full sm:w-auto"
                    data-testid="button-edit-work-order"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Work Order
                  </Button>
                  <Button 
                    onClick={() => handleSubmitWorkOrder(workOrder.id)} 
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    data-testid="button-submit-work-order-detail"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit Work Order
                  </Button>
                </>
              )}
              {workOrder.status === 'PENDING' && canAllocatePartner && (
                <Button 
                  onClick={() => openAllocateDialog(workOrder.id)} 
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
                  data-testid="button-allocate-from-detail"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Allocate Partner
                </Button>
              )}
              {workOrder.status && !['CANCELLED', 'COMPLETED_PENDING_APPROVAL', 'APPROVED', 'CLOSED'].includes(workOrder.status) && canCancelWorkOrder && (
                <Button 
                  onClick={() => openCancelDialog(workOrder.id)} 
                  variant="destructive"
                  className="w-full sm:w-auto"
                  data-testid="button-cancel-from-detail"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Work Order
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Render work orders list (default view)
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Work Orders</h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage PPF installation requests</p>
        </div>
        {canCreateWorkOrder && (
          <Button onClick={handleCreateWorkOrder} data-testid="button-create-work-order" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Create Work Order
          </Button>
        )}
      </div>

      {/* Search Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Input
              placeholder="Work Order Number (e.g., WO-123456)"
              value={searchFilters.workOrderNumber}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, workOrderNumber: e.target.value }))}
              data-testid="input-work-order-search"
            />
            
            <Input
              placeholder="Customer Name"
              value={searchFilters.customerName}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, customerName: e.target.value }))}
              data-testid="input-customer-search"
            />

            <Select 
              value={searchFilters.status || undefined} 
              onValueChange={(value) => setSearchFilters(prev => ({ ...prev, status: value || '' }))}
            >
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED_PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Vehicle Model"
              value={searchFilters.vehicleModel}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, vehicleModel: e.target.value }))}
              data-testid="input-vehicle-search"
            />

            <Input
              placeholder="Service Name"
              value={searchFilters.serviceName}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, serviceName: e.target.value }))}
              data-testid="input-service-search"
            />

            <Input
              placeholder="Partner Name"
              value={searchFilters.partnerName}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, partnerName: e.target.value }))}
              data-testid="input-partner-search"
            />
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {workOrders.length} of {allWorkOrders.length} work orders
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchFilters({
                workOrderNumber: '',
                customerName: '',
                status: '',
                vehicleModel: '',
                serviceName: '',
                partnerName: ''
              })}
              data-testid="button-clear-filters"
            >
              <Search className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders List - Responsive */}
      {!isLoading && workOrders.length === 0 && allWorkOrders.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-filtered-results">
                No work orders match your search criteria
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setSearchFilters({
                  workOrderNumber: '',
                  customerName: '',
                  status: '',
                  vehicleModel: '',
                  serviceName: '',
                  partnerName: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && allWorkOrders.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No work orders found. Create your first work order to get started.
          </CardContent>
        </Card>
      )}

      {workOrders.length > 0 && (
        <>
          {/* Desktop & Large Table View */}
          <div className="hidden lg:block rounded-lg border border-border overflow-hidden">
            {/* Table Header */}
            <div className="bg-muted/50 border-b border-border px-4 py-3">
              <div className="grid gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{gridTemplateColumns: '100px 1fr 1fr 200px 130px 180px 110px 120px'}}>
                <div className="truncate">WO ID</div>
                <div className="truncate">Vehicle</div>
                <div className="truncate">Service</div>
                <div className="truncate">Customer</div>
                <div className="truncate">Status</div>
                <div className="truncate">Partner</div>
                <div className="truncate">Created</div>
                <div className="truncate">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {workOrders.map((order) => (
                <div 
                  key={order.id}
                  className="px-4 py-4 hover:bg-muted/30 transition-colors"
                  data-testid={`row-work-order-${order.id}`}
                >
                  <div className="grid gap-3 items-center min-h-[60px]" style={{gridTemplateColumns: '100px 1fr 1fr 200px 130px 180px 110px 120px'}}>
                    {/* WO ID Column */}
                    <div className="min-w-0 overflow-hidden">
                      <span className="font-mono text-sm font-semibold text-primary block truncate">
                        WO-{order.id.slice(-6)}
                      </span>
                    </div>

                    {/* Vehicle Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" title={(order as any).vehicleModelName || "Vehicle Model"}>
                        {(order as any).vehicleModelName || "Vehicle Model"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={order.regNo || "Not specified"}>
                        {order.regNo || "Not specified"}
                      </div>
                    </div>

                    {/* Service Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" title={(order as any).serviceName || "Service Name"}>
                        {(order as any).serviceName || "Service Name"}
                      </div>
                    </div>

                    {/* Customer Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" title={order.customerName || "N/A"}>
                        {order.customerName || "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={order.customerPhone || ""}>
                        {order.customerPhone || "No phone"}
                      </div>
                    </div>

                    {/* Status Column */}
                    <div className="min-w-0 overflow-hidden">
                      <Badge 
                        className={statusColors[order.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}
                        data-testid={`status-${order.id}`}
                      >
                        {order.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    {/* Partner Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate" title={order.assignedPartnerId ? ((order as any).assignedPartner?.displayName || "Partner Assigned") : "Not assigned"}>
                        {order.assignedPartnerId ? ((order as any).assignedPartner?.displayName || "Partner Assigned") : "Not assigned"}
                      </div>
                    </div>

                    {/* Created Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm truncate" title={new Date(order.createdAt!).toLocaleDateString()}>
                        {new Date(order.createdAt!).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewWorkOrder(order.id)}
                          data-testid={`button-view-${order.id}`}
                          className="text-xs px-2"
                          title="View"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {order.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            onClick={() => handleSubmitWorkOrder(order.id)}
                            data-testid={`button-submit-${order.id}`}
                            className="text-xs px-2 bg-green-600 hover:bg-green-700 text-white"
                            title="Submit"
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                        {order.status === 'PENDING' && canAllocatePartner && (
                          <Button
                            size="sm"
                            onClick={() => openAllocateDialog(order.id)}
                            data-testid={`button-allocate-${order.id}`}
                            className="text-xs px-2 bg-purple-600 hover:bg-purple-700 text-white"
                            title="Allocate Partner"
                          >
                            <UserPlus className="h-3 w-3" />
                          </Button>
                        )}
                        {order.status && !['CANCELLED', 'COMPLETED_PENDING_APPROVAL', 'APPROVED', 'CLOSED'].includes(order.status) && canCancelWorkOrder && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openCancelDialog(order.id)}
                            data-testid={`button-cancel-${order.id}`}
                            className="text-xs px-2"
                            title="Cancel"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tablet Compact View */}
          <div className="hidden md:block lg:hidden rounded-lg border border-border overflow-hidden">
            {/* Table Header */}
            <div className="bg-muted/50 border-b border-border px-3 py-2">
              <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-1">WO ID</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Customer</div>
                <div className="col-span-2">Vehicle</div>
                <div className="col-span-1">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {workOrders.map((order) => (
                <div 
                  key={order.id}
                  className="px-3 py-3 hover:bg-muted/30 transition-colors"
                  data-testid={`row-tablet-work-order-${order.id}`}
                >
                  <div className="grid grid-cols-7 gap-2 items-center">
                    {/* WO ID Column */}
                    <div className="col-span-1">
                      <span className="font-mono text-xs font-semibold text-primary">
                        WO-{order.id.slice(-6)}
                      </span>
                    </div>

                    {/* Status Column */}
                    <div className="col-span-1">
                      <Badge 
                        className={`text-xs ${statusColors[order.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}`}
                        data-testid={`status-${order.id}`}
                      >
                        {order.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    {/* Customer Column */}
                    <div className="col-span-2">
                      <div className="text-xs font-medium truncate">
                        {order.customerName || "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {order.customerPhone || "No phone"}
                      </div>
                    </div>

                    {/* Vehicle Column */}
                    <div className="col-span-2">
                      <div className="text-xs font-medium truncate">
                        {(order as any).vehicleModelName || "Vehicle Model"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(order as any).serviceName || "Service Name"}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-1">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewWorkOrder(order.id)}
                          data-testid={`button-view-${order.id}`}
                          className="text-xs px-1"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditWorkOrder(order.id)}
                          data-testid={`button-edit-${order.id}`}
                          className="text-xs px-1"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-4">
            {workOrders.map((order) => (
              <Card key={order.id} className="shadow-sm border-l-4 border-l-blue-500" data-testid={`card-mobile-work-order-${order.id}`}>
                <CardContent className="p-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        WO-{order.id.slice(-6)}
                      </span>
                    </div>
                    <Badge 
                      className={statusColors[order.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}
                      data-testid={`status-${order.id}`}
                    >
                      {order.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  
                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-2 text-sm mb-4">
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Customer</div>
                        <div className="font-medium truncate">
                          {order.customerName || "N/A"}
                        </div>
                        {order.customerPhone && (
                          <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Vehicle</div>
                        <div className="font-medium truncate">
                          {(order as any).vehicleModelName || "Vehicle Model"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {order.regNo || "Not specified"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Service</div>
                        <div className="font-medium truncate">
                          {(order as any).serviceName || "Service Name"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                        <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">Partner</div>
                          <div className="text-xs font-medium truncate">
                            {order.assignedPartnerId ? ((order as any).assignedPartner?.displayName || "Assigned") : "Not assigned"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                        <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">Created</div>
                          <div className="text-xs font-medium">
                            {new Date(order.createdAt!).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewWorkOrder(order.id)}
                      data-testid={`button-view-${order.id}`}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditWorkOrder(order.id)}
                        data-testid={`button-edit-${order.id}`}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {order.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          onClick={() => handleSubmitWorkOrder(order.id)}
                          data-testid={`button-submit-${order.id}`}
                          className="flex-1"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Submit
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Cancel Work Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent data-testid="dialog-cancel-work-order">
          <DialogHeader>
            <DialogTitle>Cancel Work Order</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this work order. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Enter the reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                data-testid="textarea-cancel-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancelReason("");
              }}
              disabled={isCancelling}
              data-testid="button-cancel-dialog-close"
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelWorkOrder}
              disabled={isCancelling || !cancelReason.trim()}
              data-testid="button-confirm-cancel"
            >
              {isCancelling ? "Cancelling..." : "Cancel Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Allocation Dialog */}
      <Dialog open={showAllocateDialog} onOpenChange={setShowAllocateDialog}>
        <DialogContent data-testid="dialog-allocate-partner">
          <DialogHeader>
            <DialogTitle>Allocate Partner</DialogTitle>
            <DialogDescription>
              Manually assign this work order to a partner. The partner will receive a notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partner-select">Select Partner *</Label>
              <Select
                value={selectedPartnerId}
                onValueChange={setSelectedPartnerId}
              >
                <SelectTrigger id="partner-select" data-testid="select-partner">
                  <SelectValue placeholder="Choose a partner..." />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner: any) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAllocateDialog(false);
                setSelectedPartnerId("");
              }}
              disabled={isAllocating}
              data-testid="button-allocate-dialog-close"
            >
              Close
            </Button>
            <Button
              onClick={handleAllocatePartner}
              disabled={isAllocating || !selectedPartnerId}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-confirm-allocate"
            >
              {isAllocating ? "Allocating..." : "Allocate Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Work Order Modal */}
      <CreateWorkOrderModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Work Order Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) {
          setSelectedWorkOrder(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Edit Work Order
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedWorkOrder && `WO-${selectedWorkOrder.slice(-6)}`}
            </p>
          </DialogHeader>
          
          {editWorkOrder && (
            <div className="space-y-6">
              {/* Vehicle Information - Read-only */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle Information (Read-only)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Vehicle Brand</Label>
                    <p className="font-medium">{(editWorkOrder as any).vehicleBrandName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Vehicle Model</Label>
                    <p className="font-medium">{(editWorkOrder as any).vehicleModelName}</p>
                  </div>
                  {editWorkOrder.variant && (
                    <div>
                      <Label className="text-muted-foreground">Variant</Label>
                      <p className="font-medium">{editWorkOrder.variant}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Information - Read-only */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Service Information (Read-only)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Service</Label>
                    <p className="font-medium">{(editWorkOrder as any).serviceName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quantity</Label>
                    <p className="font-medium">{editWorkOrder.quantity} unit(s)</p>
                  </div>
                </div>
              </div>

              {/* Editable Customer Information */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-modal-customer-name">Customer Name</Label>
                    <Input
                      key={`customer-name-${editWorkOrder.id}`}
                      id="edit-modal-customer-name"
                      defaultValue={editWorkOrder.customerName || ""}
                      data-testid="input-edit-modal-customer-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-modal-customer-phone">Customer Phone</Label>
                    <Input
                      key={`customer-phone-${editWorkOrder.id}`}
                      id="edit-modal-customer-phone"
                      defaultValue={editWorkOrder.customerPhone || ""}
                      data-testid="input-edit-modal-customer-phone"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-modal-customer-email">Customer Email</Label>
                    <Input
                      key={`customer-email-${editWorkOrder.id}`}
                      id="edit-modal-customer-email"
                      type="email"
                      defaultValue={editWorkOrder.customerEmail || ""}
                      data-testid="input-edit-modal-customer-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-modal-reg-no">Registration Number</Label>
                    <Input
                      key={`reg-no-${editWorkOrder.id}`}
                      id="edit-modal-reg-no"
                      defaultValue={editWorkOrder.regNo || ""}
                      data-testid="input-edit-modal-reg-no"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-modal-customer-address">Customer Address</Label>
                    <Textarea
                      key={`customer-address-${editWorkOrder.id}`}
                      id="edit-modal-customer-address"
                      defaultValue={editWorkOrder.customerAddress || ""}
                      rows={2}
                      data-testid="textarea-edit-modal-customer-address"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-modal-notes">Notes</Label>
                    <Textarea
                      key={`notes-${editWorkOrder.id}`}
                      id="edit-modal-notes"
                      defaultValue={editWorkOrder.notes || ""}
                      rows={3}
                      data-testid="textarea-edit-modal-notes"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal(false)}
              disabled={isSaving}
              data-testid="button-edit-modal-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedWorkOrder) return;
                
                const customerName = (document.getElementById('edit-modal-customer-name') as HTMLInputElement)?.value;
                const customerPhone = (document.getElementById('edit-modal-customer-phone') as HTMLInputElement)?.value;
                const customerEmail = (document.getElementById('edit-modal-customer-email') as HTMLInputElement)?.value;
                const regNo = (document.getElementById('edit-modal-reg-no') as HTMLInputElement)?.value;
                const customerAddress = (document.getElementById('edit-modal-customer-address') as HTMLTextAreaElement)?.value;
                const notes = (document.getElementById('edit-modal-notes') as HTMLTextAreaElement)?.value;
                
                setIsSaving(true);
                try {
                  await apiRequest('PUT', `/api/work-orders/${selectedWorkOrder}`, {
                    customerName: customerName || null,
                    customerPhone: customerPhone || null,
                    customerEmail: customerEmail || null,
                    regNo: regNo || null,
                    customerAddress: customerAddress || null,
                    notes: notes || null,
                  });
                  
                  toast({
                    title: "Success",
                    description: "Work order updated successfully",
                  });
                  
                  queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
                  setShowEditModal(false);
                  setSelectedWorkOrder(null);
                } catch (error: any) {
                  console.error("Update work order error:", error);
                  toast({
                    title: "Error",
                    description: error.message || "Failed to update work order",
                    variant: "destructive",
                  });
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
              data-testid="button-save-work-order-modal"
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
