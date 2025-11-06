import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, BarChart3, DollarSign, Users, TrendingUp } from "lucide-react";
import type { CommissionRuleWithContext } from "@shared/types";
import { CreateCommissionRuleModal } from "@/components/modals/CreateCommissionRuleModal";
import { EditCommissionRuleModal } from "@/components/modals/EditCommissionRuleModal";

export default function CommissionsPage() {
  const [editingRule, setEditingRule] = useState<CommissionRuleWithContext | null>(null);
  
  const { data: commissionRules = [], isLoading } = useQuery<CommissionRuleWithContext[]>({
    queryKey: ["/api/commission-rules"],
    staleTime: 300000 // Cache for 5 minutes - commission rules don't change often
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    totalCommissionThisMonth: number;
    activeSalesPersons: number;
    avgCommissionRate: number;
  }>({
    queryKey: ['/api/commissions/summary'],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000 // Consider data fresh for 1 minute
  });

  const handleAddCommissionRule = () => {
    // Modal is handled by the CreateCommissionRuleModal component
  };

  const handleEditCommissionRule = (ruleId: string) => {
    // Find the rule to edit
    const rule = commissionRules.find(r => r.id === ruleId);
    if (rule) {
      setEditingRule(rule);
    }
  };

  const handleViewEarningsReport = (ruleId: string) => {
    // TODO: Open earnings report/analytics view
    const rule = commissionRules.find(r => r.id === ruleId);
    if (rule) {
      console.log("Viewing earnings for rule:", rule);
      alert(`Commission Analytics for rule ${ruleId} - this would show commission earnings, performance metrics, and analytics charts.`);
    }
  };


  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(amount));
  };

  if (isLoading) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Commission Rules</h2>
          <p className="text-muted-foreground mt-1">Configure sales person commission structures</p>
        </div>
        <CreateCommissionRuleModal>
          <Button data-testid="button-add-commission-rule">
            <Plus className="mr-2 h-4 w-4" />
            Add Commission Rule
          </Button>
        </CreateCommissionRuleModal>
      </div>

      {/* Commission Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            {summaryLoading ? (
              <div className="animate-pulse h-16" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Commission This Month</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-total-commission">
                    ₹{summaryData?.totalCommissionThisMonth.toLocaleString('en-IN') || '0'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {summaryLoading ? (
              <div className="animate-pulse h-16" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Sales Persons</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-active-sales-persons">
                    {summaryData?.activeSalesPersons || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {summaryLoading ? (
              <div className="animate-pulse h-16" />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Avg Commission Rate</p>
                  <p className="text-2xl font-semibold text-foreground" data-testid="text-avg-commission-rate">
                    {summaryData?.avgCommissionRate || 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Rules Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Sales Person</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Organization</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Service</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Value</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Cap/Floor</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissionRules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">No Commission Rules</h3>
                        <p className="text-muted-foreground">
                          Create commission rules to define earnings for sales persons.
                        </p>
                        <CreateCommissionRuleModal>
                          <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add First Commission Rule
                          </Button>
                        </CreateCommissionRuleModal>
                      </div>
                    </td>
                  </tr>
                ) : (
                  commissionRules.map((rule: CommissionRuleWithContext) => {
                    // Determine organizational level
                    const getOrganizationLevel = () => {
                      if (rule.oemId && rule.oem) return { type: "OEM", name: rule.oem.name };
                      if (rule.dealershipId && rule.dealership) return { type: "Dealership", name: rule.dealership.name };
                      if (rule.showroomId && rule.showroom) return { type: "Showroom", name: rule.showroom.name };
                      return { type: "Unknown", name: "-" };
                    };

                    const orgLevel = getOrganizationLevel();
                    
                    // Determine service scope
                    const getServiceScope = () => {
                      if (rule.serviceId && rule.service) return rule.service.name;
                      if (rule.serviceCategoryId && rule.serviceCategory) return `${rule.serviceCategory.name} (Category)`;
                      return "All Services";
                    };

                    return (
                      <tr key={rule.id} className="hover:bg-accent" data-testid={`row-commission-rule-${rule.id}`}>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {rule.salesPerson ? rule.salesPerson.name : "All Sales Persons"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {rule.salesPerson ? rule.salesPerson.phone || rule.salesPerson.email : "Applies to all"}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">{orgLevel.name}</p>
                            <p className="text-xs text-muted-foreground">{orgLevel.type} Level</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {getServiceScope()}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground capitalize">
                          {rule.type.toLowerCase()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {rule.type === 'PERCENT' ? `${rule.valueNumeric}%` : formatCurrency(rule.valueNumeric)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {rule.floorAmount || rule.capAmount ? (
                            <>
                              {rule.floorAmount && `Min: ${formatCurrency(rule.floorAmount)}`}
                              {rule.floorAmount && rule.capAmount && " | "}
                              {rule.capAmount && `Max: ${formatCurrency(rule.capAmount)}`}
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            className={rule.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                            data-testid={`status-${rule.id}`}
                          >
                            {rule.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditCommissionRule(rule.id)}
                              data-testid={`button-edit-${rule.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewEarningsReport(rule.id)}
                              data-testid={`button-report-${rule.id}`}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Commission Rule Modal */}
      {editingRule && (
        <EditCommissionRuleModal
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
          commissionRule={editingRule}
        />
      )}
    </div>
  );
}
