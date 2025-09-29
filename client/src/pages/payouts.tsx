import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Calendar,
  Eye,
  Wallet,
  TrendingDown,
  BarChart3,
  Building2,
  Percent
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

// Types
interface Payout {
  id: string;
  jobCardId: string;
  grossAmount: string;
  netAmount: string;
  status: string;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
  jobCardNumber: string;
  workOrderId: string;
  customerName: string;
  regNo: string;
  serviceName: string;
  vehicleModelName: string;
}

interface EarningsSummary {
  totalEarnings: number;
  paidAmount: number;
  pendingAmount: number;
  thisMonthEarnings: number;
  completedJobs: number;
  pendingJobs: number;
}

interface ServiceRate {
  id: string;
  serviceCategoryName: string;
  serviceName: string;
  vehicleModelName: string;
  vehicleVariantName: string;
  priceAmount: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}

interface OEMRoyaltyCalculation {
  id: string;
  oemId: string;
  oemName: string;
  workOrderId: string;
  jobCardId: string;
  jobCardNumber: string;
  workOrderValue: string;
  royaltyPercentage: string;
  royaltyAmount: string;
  calculatedAt: string;
  customerName: string;
  regNo: string;
  serviceName: string;
  vehicleModelName: string;
}

interface OEMRoyaltySummary {
  totalRoyaltyEarned: number;
  thisMonthRoyalty: number;
  totalJobs: number;
  thisMonthJobs: number;
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
    case 'pending_review':
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Pending Review</Badge>;
    case 'due':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Due</Badge>;
    // Legacy status support
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
    case 'needs_review':
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Needs Review</Badge>;
    case 'processing':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatCurrency(amount: string | number, currency: string = 'INR') {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(numAmount);
}

export default function PayoutsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Fetch earnings summary
  const { data: summary, isLoading: summaryLoading } = useQuery<EarningsSummary>({
    queryKey: ['/api/partner-staff/earnings-summary'],
  });

  // Fetch payouts
  const { data: payouts = [], isLoading: payoutsLoading } = useQuery<Payout[]>({
    queryKey: ['/api/partner-staff/payouts'],
  });

  // Fetch service rates
  const { data: serviceRates = [], isLoading: ratesLoading } = useQuery<ServiceRate[]>({
    queryKey: ['/api/partner-staff/service-rates'],
  });

  // Fetch OEM royalty calculations (only for Super Admin)
  const { data: oemRoyalties = [], isLoading: oemRoyaltiesLoading } = useQuery<OEMRoyaltyCalculation[]>({
    queryKey: ['/api/oem-royalty-calculations'],
    queryFn: async () => {
      const response = await fetch('/api/oem-royalty-calculations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch OEM royalty calculations');
      }
      
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  // Calculate OEM royalty summary
  const oemRoyaltySummary: OEMRoyaltySummary = {
    totalRoyaltyEarned: oemRoyalties.reduce((sum, royalty) => sum + parseFloat(royalty.royaltyAmount), 0),
    thisMonthRoyalty: oemRoyalties
      .filter(royalty => {
        const calculatedDate = new Date(royalty.calculatedAt);
        const now = new Date();
        return calculatedDate.getMonth() === now.getMonth() && calculatedDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, royalty) => sum + parseFloat(royalty.royaltyAmount), 0),
    totalJobs: oemRoyalties.length,
    thisMonthJobs: oemRoyalties.filter(royalty => {
      const calculatedDate = new Date(royalty.calculatedAt);
      const now = new Date();
      return calculatedDate.getMonth() === now.getMonth() && calculatedDate.getFullYear() === now.getFullYear();
    }).length,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Payouts & Earnings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track your earnings, payment status, and service rates
          </p>
        </div>
      </div>

      {/* Earnings Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Earnings
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(summary?.totalEarnings || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Paid Amount
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(summary?.paidAmount || 0)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Pending Amount
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(summary?.pendingAmount || 0)}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    This Month
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(summary?.thisMonthEarnings || 0)}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Jobs Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Completed Jobs
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {summary.completedJobs}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                  <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Pending Jobs
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {summary.pendingJobs}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for detailed views */}
      <Tabs defaultValue="payouts" className="w-full">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="payouts" data-testid="tab-payouts">
            <Wallet className="h-4 w-4 mr-2" />
            Payment History
          </TabsTrigger>
          <TabsTrigger value="rates" data-testid="tab-rates">
            <DollarSign className="h-4 w-4 mr-2" />
            Service Rate Cards
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="oem-royalties" data-testid="tab-oem-royalties">
              <Building2 className="h-4 w-4 mr-2" />
              OEM Royalties
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payoutsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse border rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : payouts.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No payment history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      data-testid={`payout-${payout.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              Job #{payout.jobCardNumber}
                            </h3>
                            {getStatusBadge(payout.status)}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div>Customer: {payout.customerName}</div>
                            <div>Vehicle: {payout.vehicleModelName} ({payout.regNo})</div>
                            <div>Service: {payout.serviceName}</div>
                            <div>Date: {format(new Date(payout.createdAt), 'MMM dd, yyyy')}</div>
                          </div>
                          {payout.paidAt && (
                            <div className="text-sm text-green-600 dark:text-green-400 mt-2">
                              Paid on {format(new Date(payout.paidAt), 'MMM dd, yyyy')}
                              {payout.paymentReference && ` • Ref: ${payout.paymentReference}`}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatCurrency(payout.netAmount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Gross: {formatCurrency(payout.grossAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Your Service Rate Cards
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ratesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse border rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : serviceRates.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No service rates configured</p>
                  <p className="text-sm text-gray-500 mt-2">Contact your admin to set up service rates</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {serviceRates.map((rate) => (
                    <Card key={rate.id} className="hover:shadow-md transition-shadow" data-testid={`rate-${rate.id}`}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                                {rate.serviceCategoryName}
                              </h3>
                              {rate.serviceName && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {rate.serviceName}
                                </p>
                              )}
                            </div>
                            <Badge variant={rate.status === 'ACTIVE' ? 'default' : 'secondary'}>
                              {rate.status}
                            </Badge>
                          </div>
                          
                          <div className="border-t pt-2">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(rate.priceAmount, rate.currency)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {rate.vehicleModelName}
                              {rate.vehicleVariantName && ` - ${rate.vehicleVariantName}`}
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-500 pt-2 border-t">
                            <div>Effective: {format(new Date(rate.effectiveFrom), 'MMM dd, yyyy')}</div>
                            {rate.effectiveTo && (
                              <div>Until: {format(new Date(rate.effectiveTo), 'MMM dd, yyyy')}</div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="oem-royalties" className="space-y-4">
            {/* OEM Royalty Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Royalty Earned
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(oemRoyaltySummary.totalRoyaltyEarned)}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                      <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        This Month Royalty
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(oemRoyaltySummary.thisMonthRoyalty)}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                      <Percent className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Jobs
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {oemRoyaltySummary.totalJobs}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                      <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        This Month Jobs
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {oemRoyaltySummary.thisMonthJobs}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                      <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* OEM Royalty Calculations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  OEM Royalty Calculations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {oemRoyaltiesLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse border rounded-lg p-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : oemRoyalties.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No OEM royalty calculations found</p>
                    <p className="text-sm text-gray-500 mt-2">Royalties will appear here after job completions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {oemRoyalties.map((royalty) => (
                      <div
                        key={royalty.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        data-testid={`royalty-${royalty.id}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {royalty.oemName} - Job #{royalty.jobCardNumber}
                              </h3>
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                {royalty.royaltyPercentage}% Royalty
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <div>Customer: {royalty.customerName}</div>
                              <div>Vehicle: {royalty.vehicleModelName} ({royalty.regNo})</div>
                              <div>Service: {royalty.serviceName}</div>
                              <div>Calculated: {format(new Date(royalty.calculatedAt), 'MMM dd, yyyy')}</div>
                            </div>
                            <div className="text-sm text-gray-500 mt-2">
                              Work Order Value: {formatCurrency(royalty.workOrderValue)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {formatCurrency(royalty.royaltyAmount)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Royalty Amount
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}