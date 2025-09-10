import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Edit, ArrowLeft, Save } from "lucide-react";
import type { WorkOrder } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreateWorkOrderModal } from "@/components/modals/CreateWorkOrderModal";

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
  const [filters, setFilters] = useState({
    status: "",
    partnerId: "",
    dateFrom: "",
    limit: 50,
    offset: 0
  });

  // Check if user can create work orders (showroom managers, sales persons, and super admin)
  const canCreateWorkOrder = user && ['SHOWROOM_MANAGER', 'SALES_PERSON', 'SUPER_ADMIN'].includes(user.role);

  // Query for work orders list
  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
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
    refetchInterval: 30000,
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
    setLocation(`/work-orders/${id}/edit`);
  };

  const handleSubmitWorkOrder = async (id: string) => {
    try {
      const response = await apiRequest(`/api/work-orders/${id}/submit`, {
        method: 'POST'
      });
      toast({
        title: "Success",
        description: "Work order submitted successfully and assigned to partner"
      });
      // Refetch work orders to show updated status
      workOrdersQuery.refetch();
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
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Button>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Work Order Details</h2>
            <p className="text-muted-foreground mt-1">WO-{workOrder.id.slice(-6)}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Work Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium">Status</h3>
                <Badge className={statusColors[workOrder.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
                  {workOrder.status?.replace(/_/g, " ")}
                </Badge>
              </div>
              <div>
                <h3 className="font-medium">Registration Number</h3>
                <p>{workOrder.regNo || "Not specified"}</p>
              </div>
              <div>
                <h3 className="font-medium">Customer Name</h3>
                <p>{workOrder.customerName || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium">Customer Phone</h3>
                <p>{workOrder.customerPhone || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium">Customer Email</h3>
                <p>{workOrder.customerEmail || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-medium">Partner Assignment</h3>
                <p>{workOrder.assignedPartnerId ? "Partner Assigned" : "Not assigned"}</p>
              </div>
              <div>
                <h3 className="font-medium">Quantity</h3>
                <p>{workOrder.quantity || 1}</p>
              </div>
              <div>
                <h3 className="font-medium">Created Date</h3>
                <p>{new Date(workOrder.createdAt!).toLocaleDateString()}</p>
              </div>
            </div>
            
            {workOrder.notes && (
              <div>
                <h3 className="font-medium">Notes</h3>
                <p className="text-muted-foreground">{workOrder.notes}</p>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button onClick={() => setLocation(`/work-orders/${workOrder.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Work Order
              </Button>
              {workOrder.status === 'PENDING' && (
                <Button onClick={() => handleSubmitWorkOrder(workOrder.id)} variant="default">
                  Submit Work Order
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render edit work order view
  if (currentView === 'edit' && workOrder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Button>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Edit Work Order</h2>
            <p className="text-muted-foreground mt-1">WO-{workOrder.id.slice(-6)}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edit Work Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Edit functionality is coming soon. For now, you can view work order details.
            </p>
            <Button onClick={() => setLocation(`/work-orders/${workOrder.id}`)}>
              View Work Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render work orders list (default view)
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Work Orders</h2>
          <p className="text-muted-foreground mt-1">Manage PPF installation requests</p>
        </div>
        {canCreateWorkOrder && (
          <Button onClick={handleCreateWorkOrder} data-testid="button-create-work-order">
            <Plus className="mr-2 h-4 w-4" />
            Create Work Order
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              data-testid="select-status-filter"
            >
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED_PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.partnerId} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, partnerId: value }))}
              data-testid="select-partner-filter"
            >
              <SelectTrigger>
                <SelectValue placeholder="All Partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner1">DetailCare Studio</SelectItem>
                <SelectItem value="partner2">ProShield Installers</SelectItem>
              </SelectContent>
            </Select>

            <Input 
              type="date" 
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              data-testid="input-date-filter"
            />

            <Button variant="secondary" data-testid="button-search">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-foreground">WO ID</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Vehicle</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Service</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Partner</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Created</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No work orders found. Create your first work order to get started.
                    </td>
                  </tr>
                ) : (
                  workOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-accent" data-testid={`row-work-order-${order.id}`}>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-primary">WO-{order.id.slice(-6)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{(order as any).vehicleModelName || "Vehicle Model"}</p>
                          <p className="text-xs text-muted-foreground">{order.regNo || "Not specified"}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">{(order as any).serviceName || "Service Name"}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{order.customerName || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{order.customerPhone || ""}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          className={statusColors[order.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}
                          data-testid={`status-${order.id}`}
                        >
                          {order.status?.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {order.assignedPartnerId ? ((order as any).partnerName || "Partner Assigned") : "Not assigned"}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(order.createdAt!).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          {order.status === 'PENDING' && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => handleSubmitWorkOrder(order.id)}
                              data-testid={`button-submit-${order.id}`}
                            >
                              Submit
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewWorkOrder(order.id)}
                            data-testid={`button-view-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditWorkOrder(order.id)}
                            data-testid={`button-edit-${order.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Work Order Modal */}
      <CreateWorkOrderModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
