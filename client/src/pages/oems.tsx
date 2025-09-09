import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CreateOEMModal } from "@/components/modals/CreateOEMModal";

export default function OEMsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOEM, setEditingOEM] = useState<any>(null);
  
  // Only Super Admin can access OEM management
  const canAccessOEMs = user?.role === 'SUPER_ADMIN';
  
  const { data: oems = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/oems"],
    queryFn: async () => {
      const response = await fetch('/api/oems', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch OEMs');
      }
      
      return response.json();
    },
    refetchInterval: 30000,
    enabled: canAccessOEMs
  });

  const handleAddOEM = () => {
    setEditingOEM(null);
    setShowCreateModal(true);
  };

  const handleEditOEM = (oem: any) => {
    setEditingOEM(oem);
    setShowCreateModal(true);
  };

  const handleDeleteOEM = async (id: string) => {
    if (!confirm('Are you sure you want to delete this OEM? This will also delete all associated dealerships and showrooms.')) {
      return;
    }

    try {
      const response = await fetch(`/api/oems/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete OEM');
      }

      toast({
        title: "Success",
        description: "OEM deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/oems"] });
    } catch (error) {
      console.error('Error deleting OEM:', error);
      toast({
        title: "Error",
        description: "Failed to delete OEM",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingOEM(null);
    queryClient.invalidateQueries({ queryKey: ["/api/oems"] });
  };

  // Show access denied for non-admin users
  if (!canAccessOEMs) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md">
              OEM management is only available to Super Administrators.
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
          <h2 className="text-2xl font-semibold text-foreground">OEM Management</h2>
          <p className="text-muted-foreground mt-1">Manage vehicle Original Equipment Manufacturers</p>
        </div>
        <Button onClick={handleAddOEM} data-testid="button-add-oem">
          <Plus className="mr-2 h-4 w-4" />
          Add OEM
        </Button>
      </div>

      {/* OEMs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {oems.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No OEMs Found</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first OEM to start managing the organizational hierarchy.
                </p>
                <Button onClick={handleAddOEM}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First OEM
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          oems.map((oem) => (
            <Card key={oem.id} data-testid={`card-oem-${oem.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{oem.name}</h3>
                      <p className="text-sm text-muted-foreground">OEM</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    Active
                  </Badge>
                </div>
                
                {oem.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {oem.description}
                  </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
                  <div>
                    <p className="font-semibold text-foreground">{oem.dealershipsCount || 0}</p>
                    <p className="text-muted-foreground">Dealerships</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{oem.showroomsCount || 0}</p>
                    <p className="text-muted-foreground">Showrooms</p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-sm"
                    onClick={() => handleEditOEM(oem)}
                    data-testid={`button-edit-${oem.id}`}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 text-sm"
                    onClick={() => handleDeleteOEM(oem.id)}
                    data-testid={`button-delete-${oem.id}`}
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

      {/* Create/Edit OEM Modal */}
      <CreateOEMModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        oem={editingOEM}
      />
    </div>
  );
}