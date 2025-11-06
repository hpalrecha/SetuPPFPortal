import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, X, Trash2, Building, Users, Wrench } from "lucide-react";
import type { PricingRule } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CreatePricingRuleModal } from "@/components/modals/CreatePricingRuleModal";

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dealership'); // dealership, detailer
  const [selectedPricingType, setSelectedPricingType] = useState<'DEALERSHIP_PRICING' | 'DETAILER_PRICING'>('DEALERSHIP_PRICING');
  
  // Redirect if not SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [user, navigate, toast]);
  
  // Only admins can access pricing rules
  const canAccessPricing = user && user.role === 'SUPER_ADMIN';
  
  const { data: pricingRules = [], isLoading } = useQuery<PricingRule[]>({
    queryKey: ["/api/pricing-rules", selectedPricingType],
    queryFn: async () => {
      const url = `/api/pricing-rules?pricingType=${selectedPricingType}`;
      const response = await fetch(url, {
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
    staleTime: 300000, // Cache for 5 minutes - pricing rules don't change often
    enabled: !!canAccessPricing // Only fetch if user has access
  });

  const handleAddPricingRule = () => {
    setEditingRule(null);
    setShowCreateModal(true);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'dealership') {
      setSelectedPricingType('DEALERSHIP_PRICING');
    } else if (value === 'detailer') {
      setSelectedPricingType('DETAILER_PRICING');
    }
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

  const renderPricingTable = (pricingType: 'DEALERSHIP_PRICING' | 'DETAILER_PRICING') => {
    const filteredRules = pricingRules.filter(rule => rule.pricingType === pricingType);
    
    const getColumns = () => {
      switch (pricingType) {
        case 'DEALERSHIP_PRICING':
          return ['Dealership', 'Vehicle Model', 'Service', 'Price', 'Effective From', 'Status', 'Actions'];
        case 'DETAILER_PRICING':
          return ['Detailer', 'Vehicle Model', 'Service Category', 'Payout', 'Effective From', 'Status', 'Actions'];
        default:
          return [];
      }
    };

    const getRowData = (rule: any) => {
      switch (pricingType) {
        case 'DEALERSHIP_PRICING':
          return [
            rule.dealershipName || 'Unknown Dealership',
            rule.vehicleModelName || 'Unknown Vehicle Model',
            rule.serviceName || 'Unknown Service',
            formatCurrency(rule.priceAmount),
            new Date(rule.effectiveFrom).toLocaleDateString(),
            rule.status
          ];
        case 'DETAILER_PRICING':
          return [
            rule.detailerName || 'Unknown Detailer',
            rule.vehicleModelName || 'Unknown Vehicle Model', 
            rule.serviceCategoryName || 'Unknown Service Category',
            formatCurrency(rule.priceAmount),
            new Date(rule.effectiveFrom).toLocaleDateString(),
            rule.status
          ];
        default:
          return [];
      }
    };

    const columns = getColumns();

    if (filteredRules.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">No {pricingType.replace('_', ' ').toLowerCase()} rules</h3>
            <p className="text-muted-foreground">
              Create pricing rules to define costs for this category.
            </p>
            <Button onClick={handleAddPricingRule}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Rule
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {columns.map((column, index) => (
                <th key={index} className="text-left py-3 px-4 font-medium text-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRules.map((rule: PricingRule) => {
              const rowData = getRowData(rule);
              return (
                <tr key={rule.id} className="hover:bg-accent" data-testid={`row-pricing-rule-${rule.id}`}>
                  {rowData.map((cell, index) => (
                    <td key={index} className="py-3 px-4 text-sm text-foreground">
                      {cell}
                    </td>
                  ))}
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
              );
            })}
          </tbody>
        </table>
      </div>
    );
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
          <p className="text-muted-foreground mt-1">Configure pricing for partners, dealerships, and detailers</p>
        </div>
        <Button onClick={handleAddPricingRule} data-testid="button-add-pricing-rule">
          <Plus className="mr-2 h-4 w-4" />
          Add Pricing Rule
        </Button>
      </div>

      {/* Pricing Rules Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dealership" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Dealership Pricing
          </TabsTrigger>
          <TabsTrigger value="detailer" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Detailer Pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dealership" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dealership Pricing List</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure what dealerships are charged for services and vehicle combinations
              </p>
            </CardHeader>
            <CardContent>
              {renderPricingTable('DEALERSHIP_PRICING')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailer" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailer/Installer Payout List</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure what detailers and installers earn for completing jobs
              </p>
            </CardHeader>
            <CardContent>
              {renderPricingTable('DETAILER_PRICING')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pricing Rule Modal */}
      <CreatePricingRuleModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        editingRule={editingRule}
        pricingType={selectedPricingType}
      />
    </div>
  );
}
