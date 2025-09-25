import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Users, Calendar, CheckCircle, FileText, CreditCard, Wrench, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function PayoutSettlementPage() {
  const [payoutType, setPayoutType] = useState<"detailers" | "sales_persons">("detailers");
  const [settlementData, setSettlementData] = useState<{
    id: string;
    type: "payout" | "commission";
    amount: string;
  } | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [settledAt, setSettledAt] = useState(new Date().toISOString().split('T')[0]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch payouts for detailers/installers
  const { data: payouts = [], isLoading: isLoadingPayouts } = useQuery({
    queryKey: ["/api/payouts"],
    enabled: payoutType === "detailers"
  });

  // Fetch commissions for sales persons
  const { data: commissionsData = { commissions: [] }, isLoading: isLoadingCommissions } = useQuery({
    queryKey: ["/api/commissions-for-settlement"],
    enabled: payoutType === "sales_persons"
  });

  const commissions = commissionsData.commissions || [];

  // Settlement mutations
  const settleMutation = useMutation({
    mutationFn: async (data: { id: string; type: "payout" | "commission"; paymentReference: string; settledAt: string }) => {
      const endpoint = data.type === "payout" 
        ? `/api/payouts/${data.id}/settle`
        : `/api/commissions/${data.id}/settle`;
      
      return apiRequest("POST", endpoint, {
        paymentReference: data.paymentReference,
        settledAt: data.settledAt
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commissions-for-settlement"] });
      setSettlementData(null);
      setPaymentReference("");
      setSettledAt(new Date().toISOString().split('T')[0]);
      toast({
        title: "Success",
        description: "Payout settled successfully",
      });
    },
    onError: (error: any) => {
      console.error("Settlement error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to settle payout",
        variant: "destructive",
      });
    }
  });

  const handleSettle = (item: any, type: "payout" | "commission") => {
    const amount = type === "payout" ? item.netAmount : item.computedAmount;
    setSettlementData({
      id: item.id,
      type,
      amount
    });
  };

  const handleSubmitSettlement = () => {
    if (!settlementData || !paymentReference || !settledAt) return;

    settleMutation.mutate({
      id: settlementData.id,
      type: settlementData.type,
      paymentReference,
      settledAt
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'due': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate totals
  const currentData = payoutType === "detailers" ? payouts : commissions;
  const pendingData = currentData.filter((item: any) => item.status === 'PENDING' || item.status === 'due');
  const totalPending = pendingData.reduce((sum: number, item: any) => {
    const amount = payoutType === "detailers" ? item.netAmount : item.computedAmount;
    return sum + Number(amount);
  }, 0);

  const paidData = currentData.filter((item: any) => item.status === 'PAID');
  const totalPaid = paidData.reduce((sum: number, item: any) => {
    const amount = payoutType === "detailers" ? item.netAmount : item.computedAmount;
    return sum + Number(amount);
  }, 0);

  if (isLoadingPayouts || isLoadingCommissions) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
        <div className="h-96 bg-muted rounded-lg animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Payout Settlement</h2>
          <p className="text-muted-foreground mt-1">Manage payments for detailers and sales persons</p>
        </div>
        
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <Button
            variant={payoutType === "detailers" ? "default" : "outline"}
            onClick={() => setPayoutType("detailers")}
            className="flex items-center space-x-2"
            data-testid="button-detailer-payouts"
          >
            <Wrench className="h-4 w-4" />
            <span>Detailer Payouts</span>
          </Button>
          <Button
            variant={payoutType === "sales_persons" ? "default" : "outline"}
            onClick={() => setPayoutType("sales_persons")}
            className="flex items-center space-x-2"
            data-testid="button-sales-commissions"
          >
            <UserCheck className="h-4 w-4" />
            <span>Sales Commissions</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  Pending {payoutType === "detailers" ? "Payouts" : "Commissions"}
                </p>
                <p className="text-2xl font-semibold text-foreground" data-testid="text-pending-amount">
                  {formatCurrency(totalPending.toString())}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Pending Items</p>
                <p className="text-2xl font-semibold text-foreground" data-testid="text-pending-count">
                  {pendingData.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Paid This Month</p>
                <p className="text-2xl font-semibold text-foreground" data-testid="text-paid-amount">
                  {formatCurrency(totalPaid.toString())}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {payoutType === "detailers" ? "Detailer/Installer Payouts" : "Sales Person Commissions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentData.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No {payoutType === "detailers" ? "payouts" : "commissions"} found
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentData.map((item: any) => (
                <div 
                  key={item.id} 
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`item-${payoutType}-${item.id.slice(-6)}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between space-y-3 md:space-y-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium">
                          {payoutType === "detailers" ? item.partnerName : item.salesPersonName || "N/A"}
                        </h3>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                        {item.status === 'PAID' && item.paymentReference && (
                          <Badge variant="outline" className="font-mono text-xs">
                            Ref: {item.paymentReference}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <span>
                          Amount: <span className="font-medium text-foreground">
                            {formatCurrency(payoutType === "detailers" ? item.netAmount : item.computedAmount)}
                          </span>
                        </span>
                        <span>Created: {formatDate(item.createdAt)}</span>
                        {item.status === 'PAID' && item.settledAt && (
                          <span>Settled: {formatDate(item.settledAt)}</span>
                        )}
                      </div>
                      
                      {/* Work Order and Job Card Information */}
                      <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                        {payoutType === "detailers" ? (
                          // Detailers are linked to Job Cards
                          <>
                            {item.jobCardId && (
                              <span className="font-mono bg-muted px-2 py-1 rounded">
                                JC: {item.jobCardId.slice(-8)}
                              </span>
                            )}
                            {item.workOrderId && (
                              <span className="font-mono bg-muted px-2 py-1 rounded">
                                WO: {item.workOrderId.slice(-8)}
                              </span>
                            )}
                          </>
                        ) : (
                          // Sales persons are linked to Work Orders
                          <>
                            {item.workOrderId && (
                              <span className="font-mono bg-muted px-2 py-1 rounded">
                                WO: {item.workOrderId.slice(-8)}
                              </span>
                            )}
                          </>
                        )}
                        {item.customerName && (
                          <span>Customer: {item.customerName}</span>
                        )}
                      </div>
                      {payoutType === "detailers" && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Type: {item.partnerType} | Job Status: {item.jobCardStatus}
                        </div>
                      )}
                      {payoutType === "sales_persons" && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Showroom: {item.showroomName} | Basis: {item.basis} | Work Order Status: {item.workOrderStatus}
                        </div>
                      )}
                    </div>
                    
                    {(item.status === 'PENDING' || item.status === 'due') && (
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleSettle(item, payoutType === "detailers" ? "payout" : "commission")}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`button-settle-${item.id.slice(-6)}`}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Settle Payment
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Modal */}
      <Dialog open={!!settlementData} onOpenChange={(open) => !open && setSettlementData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Payment</DialogTitle>
          </DialogHeader>
          
          {settlementData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Settlement Amount</div>
                <div className="text-xl font-semibold">{formatCurrency(settlementData.amount)}</div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Payment Reference Number *</Label>
                <Input
                  id="payment-reference"
                  placeholder="Enter payment reference/transaction ID"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  data-testid="input-payment-reference"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="settled-date">Settlement Date *</Label>
                <Input
                  id="settled-date"
                  type="date"
                  value={settledAt}
                  onChange={(e) => setSettledAt(e.target.value)}
                  data-testid="input-settled-date"
                />
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSettlementData(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitSettlement}
                  disabled={!paymentReference || !settledAt || settleMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm-settlement"
                >
                  {settleMutation.isPending ? "Processing..." : "Confirm Settlement"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}