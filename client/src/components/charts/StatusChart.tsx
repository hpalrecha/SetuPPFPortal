import { useMemo } from "react";

interface StatusChartProps {
  data: Array<{ status: string; count: number }>;
}

export function StatusChart({ data }: StatusChartProps) {
  const chartData = useMemo(() => {
    const statusColors: Record<string, string> = {
      DRAFT: "#94a3b8",
      SUBMITTED: "#3b82f6",
      ASSIGNED: "#8b5cf6",
      IN_PROGRESS: "#06b6d4",
      COMPLETED_PENDING_APPROVAL: "#f59e0b",
      APPROVED: "#10b981",
      CLOSED: "#6b7280",
      CANCELLED: "#ef4444",
      REWORK_REQUESTED: "#f97316",
    };

    const statusLabels: Record<string, string> = {
      DRAFT: "Draft",
      SUBMITTED: "Submitted",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In Progress",
      COMPLETED_PENDING_APPROVAL: "Pending Approval",
      APPROVED: "Approved",
      CLOSED: "Closed",
      CANCELLED: "Cancelled",
      REWORK_REQUESTED: "Rework Requested",
    };

    return data.map((item) => ({
      ...item,
      label: statusLabels[item.status] || item.status,
      color: statusColors[item.status] || "#6b7280",
    }));
  }, [data]);

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="status-chart">
      {chartData.map((item) => {
        const percentage = ((item.count / total) * 100).toFixed(1);
        
        return (
          <div key={item.status} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">
                {item.count}
              </span>
              <span className="text-xs text-muted-foreground">
                ({percentage}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
