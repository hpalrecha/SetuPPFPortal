import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit } from "lucide-react";

interface WorkOrder {
  id: string;
  status: string;
  vehicleBrand?: { name: string };
  vehicleModel?: { modelName: string };
  service?: { name: string };
  regNo?: string;
  customerName?: string;
  customerPhone?: string;
  assignedPartner?: { displayName: string };
  createdAt: string;
}

interface WorkOrdersTableProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function WorkOrdersTable({
  workOrders,
  isLoading,
  onRefresh,
}: WorkOrdersTableProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; className?: string }> = {
      DRAFT: { variant: "secondary" },
      SUBMITTED: { variant: "default" },
      ASSIGNED: { variant: "default", className: "bg-purple-100 text-purple-800" },
      IN_PROGRESS: { variant: "default", className: "bg-blue-100 text-blue-800" },
      COMPLETED_PENDING_APPROVAL: { variant: "secondary", className: "bg-orange-100 text-orange-800" },
      APPROVED: { variant: "default", className: "bg-green-100 text-green-800" },
      CLOSED: { variant: "secondary" },
      CANCELLED: { variant: "destructive" },
      REWORK_REQUESTED: { variant: "secondary", className: "bg-yellow-100 text-yellow-800" },
    };

    const config = statusConfig[status] || { variant: "secondary" };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Eye className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No work orders found</h3>
        <p className="text-muted-foreground mb-4">Create your first work order to get started.</p>
        <Button onClick={onRefresh}>Refresh</Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table data-testid="work-orders-table">
        <TableHeader>
          <TableRow>
            <TableHead>WO ID</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((workOrder) => (
            <TableRow key={workOrder.id} data-testid={`row-work-order-${workOrder.id}`}>
              <TableCell>
                <span className="font-mono text-sm text-primary">
                  {workOrder.id.slice(0, 8)}
                </span>
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {workOrder.vehicleBrand?.name} {workOrder.vehicleModel?.modelName}
                  </p>
                  {workOrder.regNo && (
                    <p className="text-xs text-muted-foreground">{workOrder.regNo}</p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-foreground">
                {workOrder.service?.name}
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {workOrder.customerName}
                  </p>
                  {workOrder.customerPhone && (
                    <p className="text-xs text-muted-foreground">
                      {workOrder.customerPhone}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {getStatusBadge(workOrder.status)}
              </TableCell>
              <TableCell className="text-sm text-foreground">
                {workOrder.assignedPartner?.displayName || "Not assigned"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(workOrder.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`button-view-${workOrder.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`button-edit-${workOrder.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
