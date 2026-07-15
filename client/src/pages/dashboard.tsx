import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import ConnectionsSection from "@/components/dashboard/ConnectionsSection";
import { 
  BarChart3, 
  Clock, 
  DollarSign, 
  Timer, 
  TrendingUp, 
  TrendingDown,
  Plus,
  CheckCircle,
  AlertCircle,
  Users,
  Activity,
  MapPin,
  Building2,
  Target,
  Eye
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

interface DashboardMetrics {
  activeWorkOrders: number;
  pendingApprovals: number;
  thisMonthRevenue: number;
  avgTAT: number;
  pendingJobs?: number;
  inProgressJobs?: number;
  completedJobs?: number;
  thisMonthEarnings?: number;
  completedJobsGrowthPct?: number | null;
  earningsGrowthPct?: number | null;
}

// Real-time dashboard with database-driven insights

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff88'];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Role switcher for SUPER_ADMIN (Admin can view as other roles)
  const [viewAsRole, setViewAsRole] = useState<string | null>(null);
  const effectiveRole = viewAsRole || user?.role;

  // Role-based visibility helper
  const canViewSection = (allowedRoles: string[]) => {
    return allowedRoles.includes(effectiveRole || '');
  };

  const { data: metrics, isLoading} = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000 // Consider data fresh for 1 minute
  });

  // Chart data queries
  const { data: ordersRevenueTrend = [] } = useQuery<{
    month: string;
    orders: number;
    revenue: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/orders-trend"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'])
  });

  const { data: dealershipPerformance = [] } = useQuery<{
    name: string;
    orders: number;
    revenue: number;
    growth: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/dealership-performance"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN'])
  });

  const { data: topPartners = [] } = useQuery<{
    id: string;
    name: string;
    completedJobs: number;
    revenue: number;
    growth: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/top-partners"],
    refetchInterval: 120000,
    staleTime: 60000,
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN'])
  });

  const { data: topShowrooms = [] } = useQuery<{
    id: string;
    name: string;
    orders: number;
    revenue: number;
    growth: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/top-showrooms"],
    refetchInterval: 120000,
    staleTime: 60000,
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN'])
  });

  const { data: partnerTopShowrooms = [] } = useQuery<{
    id: string;
    name: string;
    dealershipName: string;
    territory: string;
    totalJobs: number;
    completedJobs: number;
    revenue: number;
    growth: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/partner-top-showrooms"],
    refetchInterval: 120000,
    staleTime: 60000,
    enabled: canViewSection(['PARTNER_ADMIN'])
  });

  const { data: partnerTopDetailingPartners = [] } = useQuery<{
    id: string;
    name: string;
    showrooms: { id: string; name: string }[];
    totalJobs: number;
    completedJobs: number;
    revenue: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/partner-top-detailing-partners"],
    refetchInterval: 120000,
    staleTime: 60000,
    enabled: canViewSection(['PARTNER_ADMIN'])
  });

  const { data: territoryPerformance = [] } = useQuery<{
    territory: string;
    orders: number;
    revenue: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/territory-performance"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'])
  });

  // Fetch dealership/showroom name for welcome message
  const { data: myDealership } = useQuery({
    queryKey: ["/api/dealerships", user?.dealershipId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships/${user?.dealershipId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: user?.role === 'DEALERSHIP_ADMIN' && !!user?.dealershipId,
    staleTime: 300000 // Cache for 5 minutes - dealership data doesn't change often
  });

  const { data: myShowroom } = useQuery({
    queryKey: ["/api/showrooms", user?.showroomId],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms/${user?.showroomId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: (user?.role === 'SHOWROOM_MANAGER' || user?.role === 'SALES_PERSON') && !!user?.showroomId,
    staleTime: 300000 // Cache for 5 minutes - showroom data doesn't change often
  });

  // Resolve the OEM name for the OEM_ADMIN welcome line
  const { data: myOem } = useQuery({
    queryKey: ["/api/oems", user?.oemId, "welcome"],
    queryFn: async () => {
      const response = await fetch(`/api/oems/${user?.oemId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: user?.role === 'OEM_ADMIN' && !!user?.oemId,
    staleTime: 300000
  });

  // Resolve the partner name for the PARTNER_ADMIN / PARTNER_STAFF welcome line
  const { data: myPartner } = useQuery({
    queryKey: ["/api/partners", user?.partnerId, "welcome"],
    queryFn: async () => {
      const response = await fetch(`/api/partners/${user?.partnerId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: (user?.role === 'PARTNER_ADMIN' || user?.role === 'PARTNER_STAFF') && !!user?.partnerId,
    staleTime: 300000
  });

  const { data: servicePopularity = [] } = useQuery<{
    name: string;
    value: number;
    color: string;
  }[]>({
    queryKey: ["/api/dashboard/charts/service-popularity"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'])
  });

  const { data: monthlyTrends = [] } = useQuery<{
    month: string;
    completedOrders: number;
    avgTAT: number;
  }[]>({
    queryKey: ["/api/dashboard/charts/monthly-trends"],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER'])
  });

  // Human-friendly role label + organisation name for the welcome header
  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    OEM_ADMIN: 'OEM Admin',
    DEALERSHIP_ADMIN: 'Dealership Admin',
    SHOWROOM_MANAGER: 'Showroom Manager',
    SALES_PERSON: 'Sales Person',
    PARTNER_ADMIN: 'Partner Admin',
    PARTNER_STAFF: 'Partner Staff',
  };
  const roleLabel = roleLabels[effectiveRole || ''] || 'User';
  const orgName = myOem?.name || myDealership?.name || myShowroom?.name || myPartner?.displayName || '';
  const identityLine = `${orgName ? orgName + ' ' : ''}${roleLabel}`;

  const renderGrowthBadge = (growthPct?: number | null) => {
    if (growthPct === null || growthPct === undefined) {
      return <span className="text-muted-foreground">No data from last month</span>;
    }
    const isUp = growthPct >= 0;
    const Icon = isUp ? TrendingUp : TrendingDown;
    return (
      <>
        <span className={`flex items-center ${isUp ? 'text-green-600' : 'text-red-600'}`}>
          <Icon className="h-3 w-3 mr-1" />
          {isUp ? '+' : ''}{growthPct}%
        </span>
        from last month
      </>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-muted rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground truncate">
            Welcome to P91 Pulse VAS{user?.name ? `, ${user.name}` : ''}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{identityLine}</span>
            {' · '}Overview of your PPF installation operations
            {viewAsRole && (
              <span className="text-orange-600 font-medium"> (Viewing as {viewAsRole.replace('_', ' ')})</span>
            )}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex-shrink-0 flex items-center space-x-2 sm:space-x-3">
          {/* Role Switcher for Super Admin */}
          {user?.role === 'SUPER_ADMIN' && (
            <Select value={viewAsRole || user?.role || 'SUPER_ADMIN'} onValueChange={(value) => setViewAsRole(value === user?.role ? null : value)}>
              <SelectTrigger className="w-48" data-testid="select-view-as-role">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4" />
                  <SelectValue placeholder="View as role" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">View as Super Admin</SelectItem>
                <SelectItem value="OEM_ADMIN">View as OEM Admin</SelectItem>
                <SelectItem value="DEALERSHIP_ADMIN">View as Dealership Admin</SelectItem>
                <SelectItem value="SHOWROOM_MANAGER">View as Showroom Manager</SelectItem>
                <SelectItem value="SALES_PERSON">View as Sales Person</SelectItem>
                <SelectItem value="PARTNER_ADMIN">View as Detailer Admin</SelectItem>
                <SelectItem value="PARTNER_STAFF">View as Detailer Staff</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'SALES_PERSON']) && (
            <Button 
              onClick={() => setLocation("/work-orders")}
              data-testid="button-new-work-order"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Work Order
            </Button>
          )}
        </div>
      </div>

      {/* Activity Calendar - registrations & completions by day/month */}
      <ActivityTimeline />

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 ${effectiveRole === 'PARTNER_ADMIN' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {/* Active Work Orders - Visible to Admin, OEM, Dealership, Showroom */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Work Orders</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-active-orders">
                    {metrics?.activeWorkOrders ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Current active orders
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Approvals - Visible to Admin, OEM, Dealership, Showroom */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Pending Approvals</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-pending-approvals">
                    {metrics?.pendingApprovals ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Requires your attention</p>
            </CardContent>
          </Card>
        )}

        {/* This Month Revenue - Visible to Admin, OEM, Dealership, Showroom */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">This Month Revenue</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-revenue">
                    {formatCurrency(metrics?.thisMonthRevenue ?? 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Revenue generated this month
              </p>
            </CardContent>
          </Card>
        )}

        {/* Avg TAT - Visible to Admin, OEM, Dealership, Showroom, Detailer */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'PARTNER_ADMIN', 'PARTNER_STAFF']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Avg. TAT</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-avg-tat">
                    {metrics?.avgTAT ?? 0} days
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Timer className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Average turnaround time
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Job Cards - Specific for Detailer roles */}
        {canViewSection(['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Pending Job Cards</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-pending-jobs">
                    {metrics?.pendingJobs || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Awaiting your action</p>
            </CardContent>
          </Card>
        )}

        {/* In Progress Job Cards - Specific for Detailer roles */}
        {canViewSection(['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">In Progress Jobs</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-in-progress-jobs">
                    {metrics?.inProgressJobs || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="text-blue-600 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Active work
                </span>
                in progress
              </p>
            </CardContent>
          </Card>
        )}

        {/* Jobs Completed Card - Specific for Detailer roles */}
        {canViewSection(['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Jobs Completed</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-jobs-completed">
                    {metrics?.completedJobs || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {renderGrowthBadge(metrics?.completedJobsGrowthPct)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Earnings Card - Only for Partner Admin */}
        {canViewSection(['PARTNER_ADMIN']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">This Month Earnings</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-earnings">
                    {formatCurrency(metrics?.thisMonthEarnings || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {renderGrowthBadge(metrics?.earningsGrowthPct)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Connections - assigned dealerships/showrooms/partners + territory */}
      {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER']) && (
        <ConnectionsSection />
      )}

      {/* Analytics Charts Section */}
      <div className="space-y-6">
        {/* Partner: your showrooms (ranked by work) & your detailing partners */}
        {canViewSection(['PARTNER_ADMIN']) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Your Showrooms</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {partnerTopShowrooms.map((showroom, index) => (
                  <div key={showroom.id} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{showroom.name}</p>
                        <p className="text-sm text-muted-foreground">{showroom.dealershipName} · {showroom.territory}</p>
                        <p className="text-sm text-muted-foreground">{showroom.totalJobs} jobs · {showroom.completedJobs} completed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">₹{(showroom.revenue / 100000).toFixed(1)}L</p>
                      <p className="text-sm">{renderGrowthBadge(showroom.growth)}</p>
                    </div>
                  </div>
                ))}
                {partnerTopShowrooms.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No showroom activity in the last 3 months
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Your Top Performing Detailing Partners</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {partnerTopDetailingPartners.map((dp, index) => (
                  <div key={dp.id} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{dp.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {dp.totalJobs} jobs · {dp.completedJobs} completed
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dp.showrooms.length > 0
                            ? dp.showrooms.map(s => s.name).join(', ')
                            : 'No showrooms assigned'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">₹{(dp.revenue / 100000).toFixed(1)}L</p>
                    </div>
                  </div>
                ))}
                {partnerTopDetailingPartners.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No detailing partners added yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* PPF Orders Trend - Visible to Admin, OEM, Dealership */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']) && (
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>PPF Orders & Revenue Trend</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
              <ComposedChart data={ordersRevenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => [
                  name === 'orders' ? value : `₹${(value as number).toLocaleString('en-IN')}`,
                  name === 'orders' ? 'Orders' : 'Revenue'
                ]} />
                <Legend />
                <Bar yAxisId="left" dataKey="orders" fill="#8884d8" name="Orders" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" strokeWidth={3} name="Revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}

        {/* Dealership Performance - Visible to Admin, OEM */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN']) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Top Performing Dealerships</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
              <BarChart data={dealershipPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'growth' ? `${value}%` : value,
                  name === 'orders' ? 'Orders' : name === 'growth' ? 'Growth' : 'Revenue'
                ]} />
                <Legend />
                <Bar dataKey="orders" fill="#8884d8" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}

        {/* Territory Performance & Service Popularity - Visible to Admin, OEM, Dealership */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN']) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Territory Performance Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
                <AreaChart data={territoryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="territory" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, 'Orders']} />
                  <Legend />
                  <Area type="monotone" dataKey="orders" stroke="#8884d8" fill="#8884d8" name="Orders" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Service Category Popularity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
                <PieChart>
                  <Pie
                    data={servicePopularity}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {servicePopularity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Monthly Performance Trends - Visible to Admin, OEM, Dealership, Showroom */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Monthly Performance Trends</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
              <ComposedChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => [
                  name === 'avgTAT' ? `${value} days` : value,
                  name === 'completedOrders' ? 'Completed Orders' : 'Avg TAT'
                ]} />
                <Legend />
                <Bar yAxisId="left" dataKey="completedOrders" fill="#8884d8" name="Completed Orders" />
                <Line yAxisId="right" type="monotone" dataKey="avgTAT" stroke="#ff7300" strokeWidth={2} name="Avg TAT (days)" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}

        {/* Performance Summary Tables - Visible to Admin, OEM */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN']) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top Dealerships Table */}
          <Card>
            <CardHeader>
              <CardTitle>Dealership Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dealershipPerformance.map((dealership, index) => (
                  <div key={dealership.name} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{dealership.name}</p>
                        <p className="text-sm text-muted-foreground">{dealership.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">₹{(dealership.revenue / 100000).toFixed(1)}L</p>
                      <p className={`text-sm ${dealership.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dealership.growth > 0 ? '+' : ''}{dealership.growth}%
                      </p>
                    </div>
                  </div>
                ))}
                {dealershipPerformance.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No dealership data available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Territory Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Territory Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {territoryPerformance.map((territory, index) => (
                  <div key={territory.territory} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-foreground">{territory.territory}</p>
                        <p className="text-sm text-muted-foreground">{territory.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">₹{(territory.revenue / 100000).toFixed(1)}L revenue</p>
                    </div>
                  </div>
                ))}
                {territoryPerformance.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No territory data available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Top Detailing Partners & Top Performing Showrooms - Visible to Admin, OEM */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN']) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Top Detailing Partners</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPartners.map((partner, index) => (
                  <div key={partner.id} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{partner.name}</p>
                        <p className="text-sm text-muted-foreground">{partner.completedJobs} jobs completed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">₹{(partner.revenue / 100000).toFixed(1)}L</p>
                      <p className={`text-sm ${partner.growth > 0 ? 'text-green-600' : partner.growth < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {partner.growth > 0 ? '+' : ''}{partner.growth}%
                      </p>
                    </div>
                  </div>
                ))}
                {topPartners.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No partner data available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Top Performing Showrooms</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topShowrooms.map((showroom, index) => (
                  <div key={showroom.id} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{showroom.name}</p>
                        <p className="text-sm text-muted-foreground">{showroom.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">₹{(showroom.revenue / 100000).toFixed(1)}L</p>
                      <p className={`text-sm ${showroom.growth > 0 ? 'text-green-600' : showroom.growth < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {showroom.growth > 0 ? '+' : ''}{showroom.growth}%
                      </p>
                    </div>
                  </div>
                ))}
                {topShowrooms.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No showroom data available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
