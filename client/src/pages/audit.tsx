import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, Upload, Edit, Plus, Clock } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  details?: string;
}

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState("all");

  const handleExportAudit = () => {
    alert("Audit export functionality would be implemented here");
  };

  // Mock audit logs for display
  const auditLogs: AuditLog[] = [
    {
      id: "1",
      action: "APPROVE",
      entity: "work_order",
      entityId: "WO-2024-001",
      actorName: "Sarah Johnson",
      actorRole: "Showroom Manager",
      timestamp: "2 hours ago",
      details: "Status: COMPLETED_PENDING_APPROVAL → APPROVED"
    },
    {
      id: "2",
      action: "UPLOAD",
      entity: "job_card",
      entityId: "JC-003",
      actorName: "DetailCare Studio",
      actorRole: "Partner",
      timestamp: "4 hours ago",
      details: "4 images uploaded"
    },
    {
      id: "3",
      action: "UPDATE",
      entity: "pricing_rule",
      entityId: "PR-123",
      actorName: "Admin User",
      actorRole: "OEM Admin",
      timestamp: "6 hours ago",
      details: "Price: ₹42,000 → ₹45,000"
    },
    {
      id: "4",
      action: "CREATE",
      entity: "work_order",
      entityId: "WO-2024-004",
      actorName: "Sarah Johnson",
      actorRole: "Showroom Manager",
      timestamp: "1 day ago",
      details: "Vehicle: Honda City | Service: PPF Partial"
    }
  ];

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'approve':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'upload':
        return <Upload className="h-4 w-4 text-blue-600" />;
      case 'update':
        return <Edit className="h-4 w-4 text-orange-600" />;
      case 'create':
        return <Plus className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'approve':
        return 'bg-green-100 text-green-800';
      case 'upload':
        return 'bg-blue-100 text-blue-800';
      case 'update':
        return 'bg-orange-100 text-orange-800';
      case 'create':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLogs = actionFilter && actionFilter !== "all"
    ? auditLogs.filter(log => log.action.toLowerCase() === actionFilter.toLowerCase())
    : auditLogs;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Audit Logs</h2>
          <p className="text-muted-foreground mt-1">Complete activity trail and system changes</p>
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <Select 
            value={actionFilter} 
            onValueChange={setActionFilter}
            data-testid="select-action-filter"
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="secondary" 
            onClick={handleExportAudit}
            data-testid="button-export-audit"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Audit Logs Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Activity Found</h3>
              <p className="text-muted-foreground">
                {actionFilter ? `No ${actionFilter} activities found.` : "No audit logs available."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start space-x-4" data-testid={`audit-log-${log.id}`}>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-background border-2 border-border rounded-full flex items-center justify-center">
                      {getActionIcon(log.action)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-foreground">
                          {log.entity.replace('_', ' ')} <span className="text-primary">{log.entityId}</span> {log.action.toLowerCase()}d
                        </p>
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      By {log.actorName} ({log.actorRole})
                    </p>
                    {log.details && (
                      <div className="text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {log.details}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
