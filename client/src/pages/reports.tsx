import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, BarChart3, PieChart, TrendingUp, TrendingDown } from "lucide-react";

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    dateRange: "this_month",
    partnerId: "all",
    serviceType: "all"
  });

  const { data: metricsData, isLoading, refetch } = useQuery<{
    totalWorkOrders: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    avgTAT: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    firstPassRate: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
    customerSatisfaction: { thisMonth: number; lastMonth: number; change: number; isPositive: boolean };
  }>({
    queryKey: ['/api/reports/metrics'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleExportReport = () => {
    alert("Report export functionality would be implemented here");
  };

  const handleGenerateReport = () => {
    alert("Report generation functionality would be implemented here");
  };

  const performanceMetrics = metricsData ? [
    { 
      metric: "Total Work Orders", 
      thisMonth: metricsData.totalWorkOrders.thisMonth, 
      lastMonth: metricsData.totalWorkOrders.lastMonth, 
      change: metricsData.totalWorkOrders.change, 
      isPositive: metricsData.totalWorkOrders.isPositive 
    },
    { 
      metric: "Avg TAT (days)", 
      thisMonth: metricsData.avgTAT.thisMonth, 
      lastMonth: metricsData.avgTAT.lastMonth, 
      change: metricsData.avgTAT.change, 
      isPositive: metricsData.avgTAT.isPositive 
    },
    { 
      metric: "First Pass Rate", 
      thisMonth: metricsData.firstPassRate.thisMonth, 
      lastMonth: metricsData.firstPassRate.lastMonth, 
      change: metricsData.firstPassRate.change, 
      isPositive: metricsData.firstPassRate.isPositive 
    },
    { 
      metric: "Customer Satisfaction", 
      thisMonth: metricsData.customerSatisfaction.thisMonth, 
      lastMonth: metricsData.customerSatisfaction.lastMonth, 
      change: metricsData.customerSatisfaction.change, 
      isPositive: metricsData.customerSatisfaction.isPositive 
    }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Reports & Analytics</h2>
          <p className="text-muted-foreground mt-1">Comprehensive business insights and performance metrics</p>
        </div>
        <Button onClick={handleExportReport} data-testid="button-export-report">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Report Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Date Range</label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
                data-testid="select-date-range"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Partner</label>
              <Select 
                value={filters.partnerId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, partnerId: value }))}
                data-testid="select-partner"
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Partners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  <SelectItem value="partner1">DetailCare Studio</SelectItem>
                  <SelectItem value="partner2">ProShield Installers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Service Type</label>
              <Select 
                value={filters.serviceType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, serviceType: value }))}
                data-testid="select-service-type"
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="ppf_full">PPF Full Body</SelectItem>
                  <SelectItem value="ppf_partial">PPF Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">&nbsp;</label>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={handleGenerateReport}
                data-testid="button-generate-report"
              >
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Revenue Chart</p>
                <p className="text-sm text-muted-foreground mt-2">Monthly revenue: ₹2.4L</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partner Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="mr-2 h-5 w-5" />
              Partner Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Performance Chart</p>
                <p className="text-sm text-muted-foreground mt-2">Top performer: DetailCare Studio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading performance metrics...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Metric</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">This Month</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Last Month</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Change</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {performanceMetrics.map((metric, index) => (
                  <tr key={index} className="hover:bg-accent" data-testid={`row-metric-${index}`}>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{metric.metric}</td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {metric.metric.includes("Satisfaction") ? metric.thisMonth + "/5" : metric.thisMonth}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {metric.metric.includes("Satisfaction") ? metric.lastMonth + "/5" : metric.lastMonth}
                    </td>
                    <td className={`py-3 px-4 text-sm ${metric.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.isPositive ? '+' : ''}{metric.change}%
                    </td>
                    <td className="py-3 px-4">
                      {metric.isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
