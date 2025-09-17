import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Edit } from "lucide-react";
import type { WorkOrder } from "@shared/schema";

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

interface WorkOrderListProps {
  workOrders: WorkOrder[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export default function WorkOrderList({ workOrders, onView, onEdit }: WorkOrderListProps) {
  if (workOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">No Work Orders Found</h3>
          <p className="text-muted-foreground">Create your first work order to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
              {workOrders.map((order) => (
                <tr key={order.id} className="hover:bg-accent" data-testid={`row-work-order-${order.id}`}>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-primary">WO-{order.id.slice(-6)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Vehicle Model</p>
                      <p className="text-xs text-muted-foreground">{order.regNo || "Not specified"}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">Service Name</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.customerName || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{order.customerPhone || ""}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      className={statusColors[order.status] || "bg-gray-100 text-gray-800"}
                      data-testid={`status-${order.id}`}
                    >
                      {order.status?.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">
                    {order.assignedPartner?.displayName || "Not assigned"}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {new Date(order.createdAt!).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onView?.(order.id)}
                        data-testid={`button-view-${order.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onEdit?.(order.id)}
                        data-testid={`button-edit-${order.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
