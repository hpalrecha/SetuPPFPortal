import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users, Phone, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CreateSalesPersonModal } from "@/components/modals/CreateSalesPersonModal";

// Sales Person Metrics Component
function SalesPersonMetrics({ salesPersonId }: { salesPersonId: string }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/sales-persons", salesPersonId, "metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/sales-persons/${salesPersonId}/metrics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales person metrics');
      }
      
      return response.json();
    },
    refetchInterval: 60000,
    enabled: !!salesPersonId
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-8 mx-auto mb-1"></div>
          <p className="text-muted-foreground">Active Orders</p>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-12 mx-auto mb-1"></div>
          <p className="text-muted-foreground">This Month</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '₹0';
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  return (
    <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
      <div>
        <p className="font-semibold text-foreground">{metrics?.activeOrders || 0}</p>
        <p className="text-muted-foreground">Active Orders</p>
      </div>
      <div>
        <p className="font-semibold text-foreground">{formatCurrency(metrics?.thisMonthRevenue || 0)}</p>
        <p className="text-muted-foreground">This Month</p>
      </div>
    </div>
  );
}

export default function SalesPersonsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSalesPerson, setEditingSalesPerson] = useState<any>(null);
  
  // Only Super Admin can access sales person management
  const canAccessSalesPersons = user?.role === 'SUPER_ADMIN';
  
  const { data: salesPersons = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sales-persons"],
    queryFn: async () => {
      const response = await fetch('/api/sales-persons', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales persons');
      }
      
      return response.json();
    },
    staleTime: 300000, // Cache for 5 minutes - sales persons don't change often
    enabled: canAccessSalesPersons
  });

  // Hook to get sales person metrics
  const getSalesPersonMetrics = (salesPersonId: string) => {
    return useQuery({
      queryKey: ["/api/sales-persons", salesPersonId, "metrics"],
      queryFn: async () => {
        const response = await fetch(`/api/sales-persons/${salesPersonId}/metrics`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch sales person metrics');
        }
        
        return response.json();
      },
      refetchInterval: 60000,
      enabled: canAccessSalesPersons && !!salesPersonId
    });
  };

  const handleAddSalesPerson = () => {
    setEditingSalesPerson(null);
    setShowCreateModal(true);
  };

  const handleEditSalesPerson = (salesPerson: any) => {
    setEditingSalesPerson(salesPerson);
    setShowCreateModal(true);
  };

  const handleDeleteSalesPerson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sales person?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sales-persons/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete sales person');
      }

      toast({
        title: "Success",
        description: "Sales person deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/sales-persons"] });
    } catch (error) {
      console.error('Error deleting sales person:', error);
      toast({
        title: "Error",
        description: "Failed to delete sales person",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingSalesPerson(null);
    queryClient.invalidateQueries({ queryKey: ["/api/sales-persons"] });
  };

  // Show access denied for non-admin users
  if (!canAccessSalesPersons) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md">
              Sales person management is only available to Super Administrators.
            </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Sales Person Management</h2>
          <p className="text-muted-foreground mt-1">Manage sales staff across all showrooms</p>
        </div>
        <Button onClick={handleAddSalesPerson} data-testid="button-add-sales-person">
          <Plus className="mr-2 h-4 w-4" />
          Add Sales Person
        </Button>
      </div>

      {/* Sales Persons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {salesPersons.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Sales Persons Found</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first sales person to start managing the sales team.
                </p>
                <Button onClick={handleAddSalesPerson}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Sales Person
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          salesPersons.map((salesPerson) => (
            <Card key={salesPerson.id} data-testid={`card-sales-person-${salesPerson.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{salesPerson.name}</h3>
                      <p className="text-sm text-muted-foreground">Sales Person</p>
                    </div>
                  </div>
                  <Badge className={salesPerson.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {salesPerson.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  {salesPerson.email && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>{salesPerson.email}</span>
                    </div>
                  )}
                  {salesPerson.phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>{salesPerson.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>Showroom: {salesPerson.showroomName || 'Not assigned'}</span>
                  </div>
                </div>

                {/* Performance Stats */}
                <SalesPersonMetrics salesPersonId={salesPerson.id} />

                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-sm"
                    onClick={() => handleEditSalesPerson(salesPerson)}
                    data-testid={`button-edit-${salesPerson.id}`}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 text-sm"
                    onClick={() => handleDeleteSalesPerson(salesPerson.id)}
                    data-testid={`button-delete-${salesPerson.id}`}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Sales Person Modal */}
      <CreateSalesPersonModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        salesPerson={editingSalesPerson}
      />
    </div>
  );
}