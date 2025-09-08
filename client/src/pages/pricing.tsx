import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, X, Trash2 } from "lucide-react";
import type { PricingRule } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CreatePricingRuleModal } from "@/components/modals/CreatePricingRuleModal";

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  // Only admins can access pricing rules
  const canAccessPricing = user && ['SUPER_ADMIN', 'OEM_ADMIN'].includes(user.role);
  
  const { data: pricingRules = [], isLoading } = useQuery<PricingRule[]>({
    queryKey: ["/api/pricing-rules"],
    queryFn: async () => {
      const response = await fetch('/api/pricing-rules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch pricing rules');
      }
      
      return response.json();
    },
    refetchInterval: 30000,
    enabled: !!canAccessPricing // Only fetch if user has access
  });

  const handleAddPricingRule = () => {
    setEditingRule(null);
    setShowCreateModal(true);
  };

  const handleEditPricingRule = (rule: any) => {
    setEditingRule(rule);
    setShowCreateModal(true);
  };

  const handleDeletePricingRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/pricing-rules/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete pricing rule');
      }

      toast({
        title: "Success",
        description: "Pricing rule deleted successfully",
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete pricing rule",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingRule(null);
    // Refresh the data
    queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(amount));
  };

  // Show access denied for non-admin users
  if (!canAccessPricing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md">
              Pricing rules management is only available to administrators. 
              Contact your system administrator if you need access.
            </p>
            <div className="text-sm text-muted-foreground">
              Current role: {user?.role || 'Unknown'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="h-96 bg-muted rounded-lg animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Pricing Rules</h2>
          <p className="text-muted-foreground mt-1">Configure service pricing by partner and vehicle</p>
        </div>
        <Button onClick={handleAddPricingRule} data-testid="button-add-pricing-rule">
          <Plus className="mr-2 h-4 w-4" />
          Add Pricing Rule
        </Button>
      </div>

      {/* Pricing Rules Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Partner</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Scope</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Vehicle Model</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Service</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Effective From</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(pricingRules || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">No Pricing Rules</h3>
                        <p className="text-muted-foreground">
                          Create pricing rules to define service costs for different partners and vehicles.
                        </p>
                        <Button onClick={handleAddPricingRule}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Pricing Rule
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (pricingRules || []).map((rule: PricingRule) => (
                    <tr key={rule.id} className="hover:bg-accent" data-testid={`row-pricing-rule-${rule.id}`}>
                      <td className="py-3 px-4 text-sm text-foreground">
                        Partner Name
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {rule.scope} - Scope Name
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        Vehicle Model
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        Service Name
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        {formatCurrency(rule.priceAmount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(rule.effectiveFrom).toLocaleDateString()}
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
                            onClick={() => handleEditPricingRule(rule)}
                            data-testid={`button-edit-${rule.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeletePricingRule(rule.id)}
                            data-testid={`button-delete-${rule.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Rule Modal */}
      <CreatePricingRuleModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        editingRule={editingRule}
      />
    </div>
  );
}
