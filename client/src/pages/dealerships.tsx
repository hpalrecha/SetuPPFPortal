import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Store, MapPin, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CreateDealershipModal } from "@/components/modals/CreateDealershipModal";

export default function DealershipsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDealership, setEditingDealership] = useState<any>(null);
  
  // Only Super Admin can access dealership management
  const canAccessDealerships = user?.role === 'SUPER_ADMIN';
  
  const { data: dealerships = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dealerships"],
    queryFn: async () => {
      const response = await fetch('/api/dealerships', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dealerships');
      }
      
      return response.json();
    },
    refetchInterval: 30000,
    enabled: canAccessDealerships
  });

  const handleAddDealership = () => {
    setEditingDealership(null);
    setShowCreateModal(true);
  };

  const handleEditDealership = (dealership: any) => {
    setEditingDealership(dealership);
    setShowCreateModal(true);
  };

  const handleDeleteDealership = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dealership? This will also delete all associated showrooms.')) {
      return;
    }

    try {
      const response = await fetch(`/api/dealerships/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete dealership');
      }

      toast({
        title: "Success",
        description: "Dealership deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/dealerships"] });
    } catch (error) {
      console.error('Error deleting dealership:', error);
      toast({
        title: "Error",
        description: "Failed to delete dealership",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingDealership(null);
    queryClient.invalidateQueries({ queryKey: ["/api/dealerships"] });
  };

  // Show access denied for non-admin users
  if (!canAccessDealerships) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md">
              Dealership management is only available to Super Administrators.
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
          <h2 className="text-2xl font-semibold text-foreground">Dealership Management</h2>
          <p className="text-muted-foreground mt-1">Manage vehicle dealerships across regions</p>
        </div>
        <Button onClick={handleAddDealership} data-testid="button-add-dealership">
          <Plus className="mr-2 h-4 w-4" />
          Add Dealership
        </Button>
      </div>

      {/* Dealerships Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dealerships.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Dealerships Found</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first dealership to start managing regional operations.
                </p>
                <Button onClick={handleAddDealership}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Dealership
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          dealerships.map((dealership) => (
            <Card key={dealership.id} data-testid={`card-dealership-${dealership.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Store className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{dealership.name}</h3>
                      <p className="text-sm text-muted-foreground">Dealership</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  {dealership.city && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{dealership.city}, {dealership.state}</span>
                    </div>
                  )}
                  {dealership.contactPhone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>{dealership.contactPhone}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
                  <div>
                    <p className="font-semibold text-foreground">8</p>
                    <p className="text-muted-foreground">Showrooms</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">45</p>
                    <p className="text-muted-foreground">Sales Staff</p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-sm"
                    onClick={() => handleEditDealership(dealership)}
                    data-testid={`button-edit-${dealership.id}`}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 text-sm"
                    onClick={() => handleDeleteDealership(dealership.id)}
                    data-testid={`button-delete-${dealership.id}`}
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

      {/* Create/Edit Dealership Modal */}
      <CreateDealershipModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        dealership={editingDealership}
      />
    </div>
  );
}