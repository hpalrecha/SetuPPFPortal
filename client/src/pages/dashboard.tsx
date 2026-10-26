import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  Eye,
  Filter,
  FileWarning,
  CalendarClock,
  RotateCcw
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
  // Admin/OEM analytics (server/services/dashboardAnalytics.ts); absent for partner roles.
  revenue?: number;
  revenueGrowthPct?: number | null;
  unpricedJobs?: number;
  tatMedianDays?: number;
  tatAvgDays?: number;
  ordersRegistered?: number;
  ordersGrowthPct?: number | null;
  overdueSchedules?: number;
  unscheduledJobs?: number;
  invoiceBacklog?: { count: number; amount: number; avgAgeDays: number };
  reschedules?: number;
  reworkRequests?: number;
  reworkRatePct?: number | null;
  cancellations?: number;
  overdueJobs?: number;
  pendingJobs?: number;
  inProgressJobs?: number;
  completedJobs?: number;
  thisMonthEarnings?: number;
  completedJobsGrowthPct?: number | null;
  earningsGrowthPct?: number | null;
}

// Real-time dashboard with database-driven insights

type PeriodKey = 'this_month' | 'last_month' | 'last_7' | 'last_30' | 'this_quarter' | 'this_fy' | 'custom';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_7: 'Last 7 days',
  last_30: 'Last 30 days',
  this_quarter: 'This quarter',
  this_fy: 'This financial year',
  custom: 'Custom range',
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Inclusive IST date range for a period preset. Dates are computed on an IST-shifted clock and
// read with UTC getters so the browser's own timezone never moves a day boundary.
function periodRange(period: PeriodKey, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date(Date.now() + 330 * 60_000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = isoDate(now);
  const daysAgo = (n: number) => isoDate(new Date(now.getTime() - n * 86_400_000));
  switch (period) {
    case 'last_month':
      return { from: isoDate(new Date(Date.UTC(y, m - 1, 1))), to: isoDate(new Date(Date.UTC(y, m, 0))) };
    case 'last_7':
      return { from: daysAgo(6), to: today };
    case 'last_30':
      return { from: daysAgo(29), to: today };
    case 'this_quarter':
      return { from: isoDate(new Date(Date.UTC(y, m - (m % 3), 1))), to: today };
    case 'this_fy':
      return { from: isoDate(new Date(Date.UTC(m >= 3 ? y : y - 1, 3, 1))), to: today };
    case 'custom':
      if (customFrom && customTo) return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
      return { from: isoDate(new Date(Date.UTC(y, m, 1))), to: today };
    default:
      return { from: isoDate(new Date(Date.UTC(y, m, 1))), to: today };
  }
}

const formatRange = (r: { from: string; to: string }) => {
  const f = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return r.from === r.to ? f(r.from) : `${f(r.from)} – ${f(r.to)}`;
};

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

  // Dashboard-wide filters. Partner roles keep their own fixed partner dashboard.
  const isPartnerUser = ['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER'].includes(user?.role || '');
  const isAdminUser = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [brand, setBrand] = useState('all');
  const [oemFilter, setOemFilter] = useState('all');
  const range = periodRange(period, customFrom, customTo);
  const filterParams = new URLSearchParams();
  if (brand !== 'all') filterParams.set('brand', brand);
  if (oemFilter !== 'all') filterParams.set('oemId', oemFilter);
  const filterQs = filterParams.toString();
  const rangeQs = `from=${range.from}&to=${range.to}${filterQs ? `&${filterQs}` : ''}`;
  const periodLabel = period === 'custom' ? formatRange(range) : PERIOD_LABELS[period];

  const { data: filterOptions } = useQuery<{ brands: string[]; oems: { id: string; name: string }[] }>({
    queryKey: ["/api/dashboard/filters"],
    staleTime: 300000,
    enabled: !!user && !isPartnerUser,
  });

  const { data: metrics, isLoading} = useQuery<DashboardMetrics>({
    queryKey: [`/api/dashboard/metrics?${rangeQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
    staleTime: 60000 // Consider data fresh for 1 minute
  });

  // Chart data queries
  const { data: ordersRevenueTrend = [] } = useQuery<{
    month: string;
    orders: number;
    revenue: number;
  }[]>({
    queryKey: [`/api/dashboard/charts/orders-trend?${filterQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'])
  });

  const { data: dealershipPerformance = [] } = useQuery<{
    name: string;
    orders: number;
    completedJobs: number;
    revenue: number;
    growth: number | null;
  }[]>({
    queryKey: [`/api/dashboard/charts/dealership-performance?${rangeQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN'])
  });

  const { data: topPartners = [] } = useQuery<{
    id: string;
    name: string;
    completedJobs: number;
    revenue: number;
    growth: number | null;
  }[]>({
    queryKey: [`/api/dashboard/charts/top-partners?${rangeQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
    staleTime: 60000,
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN'])
  });

  const { data: topShowrooms = [] } = useQuery<{
    id: string;
    name: string;
    orders: number;
    completedJobs: number;
    revenue: number;
    growth: number | null;
  }[]>({
    queryKey: [`/api/dashboard/charts/top-showrooms?${rangeQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
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
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
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
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
    staleTime: 60000,
    enabled: canViewSection(['PARTNER_ADMIN'])
  });

  const { data: territoryPerformance = [] } = useQuery<{
    territory: string;
    orders: number;
    revenue: number;
    completedJobs: number;
  }[]>({
    queryKey: [`/api/dashboard/charts/territory-performance?${rangeQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
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
    queryKey: [`/api/dashboard/charts/service-popularity?${rangeQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
    staleTime: 60000, // Consider data fresh for 1 minute
    enabled: canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN'])
  });

  const { data: monthlyTrends = [] } = useQuery<{
    month: string;
    completedOrders: number;
    avgTAT: number | null;
  }[]>({
    queryKey: [`/api/dashboard/charts/monthly-trends?${filterQs}`],
    refetchOnWindowFocus: true, // Active users get fresh data on focus
    refetchInterval: 900000, // 15-min fallback keeps unattended showroom displays live
    refetchIntervalInBackground: true,
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

  // Compact growth label for ranked lists: null = no activity in the previous period.
  const renderGrowthText = (growth: number | null | undefined) => {
    if (growth === null || growth === undefined) {
      return <p className="text-sm text-blue-600">New</p>;
    }
    return (
      <p className={`text-sm ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
        {growth > 0 ? '+' : ''}{growth}%
      </p>
    );
  };

  // Growth vs the previous period of equal length (admin analytics).
  const renderPeriodGrowth = (growthPct?: number | null) => {
    if (growthPct === null || growthPct === undefined) {
      return <span className="text-muted-foreground">No data for the previous period</span>;
    }
    const isUp = growthPct >= 0;
    const Icon = isUp ? TrendingUp : TrendingDown;
    return (
      <>
        <span className={`flex items-center ${isUp ? 'text-green-600' : 'text-red-600'}`}>
          <Icon className="h-3 w-3 mr-1" />
          {isUp ? '+' : ''}{growthPct}%
        </span>
        vs previous period
      </>
    );
  };

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

  const formatLakh = (amount: number) => `₹${(amount / 100000).toFixed(1)}L`;

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
              <span className="text-orange-600 font-medium"> (Previewing the {viewAsRole.replace('_', ' ')} layout — numbers are still Super Admin totals)</span>
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

      {/* Dashboard filters: period drives KPIs and ranked lists; brand/OEM apply everywhere */}
      {!isPartnerUser && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <SelectTrigger className="w-44" data-testid="select-dashboard-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{PERIOD_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === 'custom' && (
                <>
                  <Input type="date" className="w-40" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} data-testid="input-dashboard-from" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" className="w-40" value={customTo} onChange={(e) => setCustomTo(e.target.value)} data-testid="input-dashboard-to" />
                </>
              )}
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="w-36" data-testid="select-dashboard-brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {(filterOptions?.brands ?? []).map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdminUser && (filterOptions?.oems?.length ?? 0) > 1 && (
                <Select value={oemFilter} onValueChange={setOemFilter}>
                  <SelectTrigger className="w-48" data-testid="select-dashboard-oem">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All OEMs</SelectItem>
                    {filterOptions!.oems.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <span className="text-xs text-muted-foreground sm:ml-auto">
                {formatRange(range)} · IST
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Calendar - registrations & completions by day/month */}
      <ActivityTimeline filters={filterQs} />

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
                Open installs right now (not yet approved)
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
              <p className="text-sm text-muted-foreground mt-2">Completed jobs awaiting approval</p>
            </CardContent>
          </Card>
        )}

        {/* This Month Revenue - Visible to Admin, OEM, Dealership, Showroom */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Billed Revenue · {periodLabel}</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-revenue">
                    {formatCurrency(metrics?.revenue ?? metrics?.thisMonthRevenue ?? 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1 flex-wrap">
                {renderPeriodGrowth(metrics?.revenueGrowthPct)}
              </p>
              {(metrics?.unpricedJobs ?? 0) > 0 && (
                <p className="text-xs text-amber-600 mt-1" data-testid="text-unpriced-jobs">
                  {metrics!.unpricedJobs} approved job{metrics!.unpricedJobs === 1 ? '' : 's'} have no billing price
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Avg TAT - Visible to Admin, OEM, Dealership, Showroom, Detailer */}
        {canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER', 'PARTNER_ADMIN', 'PARTNER_STAFF']) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Median TAT</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-avg-tat">
                    {metrics?.tatMedianDays ?? metrics?.avgTAT ?? 0} days
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Timer className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {metrics?.tatMedianDays !== undefined
                  ? `Order created → approved · avg ${metrics.tatAvgDays ?? 0} days`
                  : 'Job assigned → completed · last 90 days'}
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
              <p className="text-sm text-muted-foreground mt-2">
                Awaiting your action
                {(metrics?.overdueJobs ?? 0) > 0 && (
                  <span className="text-red-600"> · {metrics!.overdueJobs} past scheduled date</span>
                )}
              </p>
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
                  <p className="text-muted-foreground text-sm">Jobs Completed · this month</p>
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

      {/* Period throughput + backlog - Admin, OEM, Dealership, Showroom */}
      {!isPartnerUser && canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && metrics?.invoiceBacklog && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Jobs Approved · {periodLabel}</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-period-completed">
                    {metrics.completedJobs ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1 flex-wrap">
                {renderPeriodGrowth(metrics.completedJobsGrowthPct)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Orders Registered · {periodLabel}</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-period-orders">
                    {metrics.ordersRegistered ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1 flex-wrap">
                {renderPeriodGrowth(metrics.ordersGrowthPct)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Approved, Not Invoiced</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-invoice-backlog">
                    {metrics.invoiceBacklog.count}
                    <span className="text-base font-normal text-muted-foreground"> · {formatCurrency(metrics.invoiceBacklog.amount)}</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <FileWarning className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {metrics.invoiceBacklog.count > 0
                  ? `Waiting ${metrics.invoiceBacklog.avgAgeDays} days on average since approval`
                  : 'Every approved job is invoiced'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Overdue Schedules</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-overdue-schedules">
                    {metrics.overdueSchedules ?? 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <CalendarClock className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Scheduled date passed, job not started
                {(metrics.unscheduledJobs ?? 0) > 0 ? ` · ${metrics.unscheduledJobs} with no date` : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operations health in the selected period */}
      {!isPartnerUser && canViewSection(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OEM_ADMIN', 'DEALERSHIP_ADMIN', 'SHOWROOM_MANAGER']) && metrics?.invoiceBacklog && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-medium text-foreground flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                Operations · {periodLabel}
              </span>
              <span data-testid="text-ops-in-progress"><span className="font-semibold">{metrics.inProgressJobs ?? 0}</span> <span className="text-muted-foreground">in progress now</span></span>
              <span data-testid="text-ops-reschedules"><span className="font-semibold">{metrics.reschedules ?? 0}</span> <span className="text-muted-foreground">reschedules</span></span>
              <span data-testid="text-ops-rework">
                <span className="font-semibold">{metrics.reworkRequests ?? 0}</span>{' '}
                <span className="text-muted-foreground">
                  rework requests{metrics.reworkRatePct !== null && metrics.reworkRatePct !== undefined ? ` (${metrics.reworkRatePct}% of approved jobs)` : ''}
                </span>
              </span>
              <span data-testid="text-ops-cancellations"><span className="font-semibold">{metrics.cancellations ?? 0}</span> <span className="text-muted-foreground">cancelled orders</span></span>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <p className="font-medium text-foreground">₹{(showroom.revenue / 100000).toFixed(1)}L earned</p>
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
                      <p className="font-medium text-foreground">₹{(dp.revenue / 100000).toFixed(1)}L earned</p>
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
              <span>Orders & Billed Revenue · last 9 months</span>
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
                  name === 'Billed revenue' ? `₹${(value as number).toLocaleString('en-IN')}` : value,
                  name
                ]} />
                <Legend />
                <Bar yAxisId="left" dataKey="orders" fill="#8884d8" name="Orders registered" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" strokeWidth={3} name="Billed revenue" />
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
              <span>Top Performing Dealerships · {periodLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
              <BarChart data={dealershipPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="#8884d8" name="Orders registered" />
                <Bar dataKey="completedJobs" fill="#82ca9d" name="Jobs approved" />
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
                <span>Territory (showroom city) · {periodLabel}</span>
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
                <span>Orders by Service Category · {periodLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {servicePopularity.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No orders in this period</div>
              ) : (
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
              )}
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
              <span>Jobs Approved & Median TAT · last 9 months</span>
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
                  name === 'Median TAT (days)' ? `${value} days` : value,
                  name
                ]} />
                <Legend />
                <Bar yAxisId="left" dataKey="completedOrders" fill="#8884d8" name="Jobs approved" />
                <Line yAxisId="right" type="monotone" dataKey="avgTAT" stroke="#ff7300" strokeWidth={2} connectNulls={false} name="Median TAT (days)" />
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
              <CardTitle>Dealership Performance · {periodLabel}</CardTitle>
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
                        <p className="text-sm text-muted-foreground">{dealership.orders} orders · {dealership.completedJobs} approved</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatLakh(dealership.revenue)}</p>
                      {renderGrowthText(dealership.growth)}
                    </div>
                  </div>
                ))}
                {dealershipPerformance.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No dealership activity in this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Territory Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Territory Performance · {periodLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {territoryPerformance.map((territory, index) => (
                  <div key={territory.territory} className="flex items-center justify-between p-3 border border-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-foreground">{territory.territory}</p>
                        <p className="text-sm text-muted-foreground">{territory.orders} orders · {territory.completedJobs} approved</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatLakh(territory.revenue)} billed</p>
                    </div>
                  </div>
                ))}
                {territoryPerformance.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No territory activity in this period
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
                <span>Top Detailing Partners · {periodLabel}</span>
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
                        <p className="text-sm text-muted-foreground">{partner.completedJobs} jobs approved</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatLakh(partner.revenue)}</p>
                      {renderGrowthText(partner.growth)}
                    </div>
                  </div>
                ))}
                {topPartners.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No approved jobs in this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Top Performing Showrooms · {periodLabel}</span>
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
                        <p className="text-sm text-muted-foreground">{showroom.orders} orders · {showroom.completedJobs} approved</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatLakh(showroom.revenue)}</p>
                      {renderGrowthText(showroom.growth)}
                    </div>
                  </div>
                ))}
                {topShowrooms.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No showroom activity in this period
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
