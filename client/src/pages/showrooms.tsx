import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, MapPin, Phone, Users, Handshake } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CreateShowroomModal } from "@/components/modals/CreateShowroomModal";

export default function ShowroomsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingShowroom, setEditingShowroom] = useState<any>(null);
  
  // Only Super Admin can access showroom management
  const canAccessShowrooms = user?.role === 'SUPER_ADMIN';
  
  const { data: showrooms = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/showrooms"],
    queryFn: async () => {
      const response = await fetch('/api/showrooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch showrooms');
      }
      
      return response.json();
    },
    refetchInterval: 30000,
    enabled: canAccessShowrooms
  });

  // Fetch allocations to show assigned partners
  const { data: allocations = [] } = useQuery<any[]>({
    queryKey: ["/api/allocations"],
    queryFn: async () => {
      const response = await fetch('/api/allocations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch allocations');
      return response.json();
    },
    enabled: canAccessShowrooms
  });

  // Helper function to get assigned partner for a showroom
  const getAssignedPartner = (showroomId: string) => {
    return allocations.find(allocation => 
      allocation.level === 'SHOWROOM' && 
      allocation.levelId === showroomId && 
      allocation.active
    );
  };

  const handleAddShowroom = () => {
    setEditingShowroom(null);
    setShowCreateModal(true);
  };

  const handleEditShowroom = (showroom: any) => {
    setEditingShowroom(showroom);
    setShowCreateModal(true);
  };

  const handleDeleteShowroom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this showroom? This will also delete all associated sales persons.')) {
      return;
    }

    try {
      const response = await fetch(`/api/showrooms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete showroom');
      }

      toast({
        title: "Success",
        description: "Showroom deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/showrooms"] });
    } catch (error) {
      console.error('Error deleting showroom:', error);
      toast({
        title: "Error",
        description: "Failed to delete showroom",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingShowroom(null);
    queryClient.invalidateQueries({ queryKey: ["/api/showrooms"] });
  };

  // Show access denied for non-admin users
  if (!canAccessShowrooms) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md">
              Showroom management is only available to Super Administrators.
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
          <h2 className="text-2xl font-semibold text-foreground">Showroom Management</h2>
          <p className="text-muted-foreground mt-1">Manage individual showroom locations</p>
        </div>
        <Button onClick={handleAddShowroom} data-testid="button-add-showroom">
          <Plus className="mr-2 h-4 w-4" />
          Add Showroom
        </Button>
      </div>

      {/* Showrooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {showrooms.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Showrooms Found</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first showroom to start managing individual locations.
                </p>
                <Button onClick={handleAddShowroom}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Showroom
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          showrooms.map((showroom) => (
            <Card key={showroom.id} data-testid={`card-showroom-${showroom.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{showroom.name}</h3>
                      <p className="text-sm text-muted-foreground">Showroom</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">
                    Active
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  {showroom.city && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{showroom.city}, {showroom.state}</span>
                    </div>
                  )}
                  {showroom.contactPhone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>{showroom.contactPhone}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-2" />
                    <span>Manager: {showroom.managerName || 'Not assigned'}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Handshake className="h-4 w-4 mr-2" />
                    <span>
                      Partner: {(() => {
                        const assignedPartner = getAssignedPartner(showroom.id);
                        return assignedPartner ? assignedPartner.partner.displayName : 'Not assigned';
                      })()}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
                  <div>
                    <p className="font-semibold text-foreground">{showroom.salesStaffCount || 0}</p>
                    <p className="text-muted-foreground">Sales Staff</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{showroom.workOrdersCount || 0}</p>
                    <p className="text-muted-foreground">Work Orders</p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-sm"
                    onClick={() => handleEditShowroom(showroom)}
                    data-testid={`button-edit-${showroom.id}`}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 text-sm"
                    onClick={() => handleDeleteShowroom(showroom.id)}
                    data-testid={`button-delete-${showroom.id}`}
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

      {/* Create/Edit Showroom Modal */}
      <CreateShowroomModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        showroom={editingShowroom}
      />
    </div>
  );
}