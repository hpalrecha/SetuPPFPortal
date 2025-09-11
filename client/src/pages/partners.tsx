import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Store, User, MapPin, Phone, Star, BarChart3, Edit, Trash2, Filter } from "lucide-react";
import type { Partner } from "@shared/schema";
import { EditPartnerModal } from "@/components/modals/EditPartnerModal";
import { useToast } from "@/hooks/use-toast";

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  
  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["/api/partners-with-categories"],
    queryFn: async () => {
      const response = await fetch('/api/partners-with-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch partners');
      }
      
      return response.json();
    },
    refetchInterval: 30000
  });

  // Fetch service categories for filtering
  const { data: serviceCategories = [] } = useQuery({
    queryKey: ["/api/service-categories"],
    queryFn: async () => {
      const response = await fetch('/api/service-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch service categories');
      return response.json();
    },
  });

  // Filter partners based on selected filters
  const filteredPartners = partners.filter((partner) => {
    const categoryMatch = selectedCategory === "all" || 
      partner.serviceCategories?.some((cat: any) => cat.id === selectedCategory);
    const typeMatch = selectedType === "all" || partner.type === selectedType;
    return categoryMatch && typeMatch;
  });

  const handleAddPartner = () => {
    setEditingPartner(null);
    setShowEditModal(true);
  };

  const handleEditPartner = (partner: any) => {
    setEditingPartner(partner);
    setShowEditModal(true);
  };

  const handleViewPartner = (id: string) => {
    // TODO: Navigate to partner detail view
    alert(`View partner ${id} dashboard`);
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/partners/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete partner');
      }

      toast({
        title: "Success",
        description: `Partner "${name}" deleted successfully`,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/partners-with-categories"] });
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast({
        title: "Error",
        description: "Failed to delete partner",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowEditModal(false);
    setEditingPartner(null);
    // Refresh the data
    queryClient.invalidateQueries({ queryKey: ["/api/partners-with-categories"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-72"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-80 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Partners Management</h2>
          <p className="text-muted-foreground mt-1">Manage detailers and installers</p>
        </div>
        <Button onClick={handleAddPartner} data-testid="button-add-partner">
          <Plus className="mr-2 h-4 w-4" />
          Add Partner
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        
        <div className="flex gap-4">
          <div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40" data-testid="filter-type">
                <SelectValue placeholder="Partner Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="INSTALLER">Installer</SelectItem>
                <SelectItem value="STUDIO">Studio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="filter-specialization">
                <SelectValue placeholder="Specialization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specializations</SelectItem>
                {serviceCategories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground flex items-center">
          Showing {filteredPartners.length} of {partners.length} partners
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPartners.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Partners Found</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first partner to start managing PPF installations.
                </p>
                <Button onClick={handleAddPartner}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Partner
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredPartners.map((partner) => (
            <Card key={partner.id} data-testid={`card-partner-${partner.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      {partner.type === 'STUDIO' ? (
                        <Store className="h-6 w-6 text-primary" />
                      ) : (
                        <User className="h-6 w-6 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{partner.displayName}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {partner.type.toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {partner.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  {partner.address && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{partner.city}, {partner.state}</span>
                    </div>
                  )}
                  {partner.phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>{partner.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Star className="h-4 w-4 mr-2" />
                    <span>Priority: 1</span>
                  </div>
                </div>


                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-sm"
                    onClick={() => handleEditPartner(partner)}
                    data-testid={`button-edit-${partner.id}`}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    className="flex-1 text-sm"
                    onClick={() => handleViewPartner(partner.id)}
                    data-testid={`button-view-${partner.id}`}
                  >
                    <BarChart3 className="mr-1 h-3 w-3" />
                    View
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeletePartner(partner.id, partner.name)}
                    data-testid={`button-delete-${partner.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Partner Modal */}
      <EditPartnerModal 
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSuccess={handleModalSuccess}
        partner={editingPartner}
      />
    </div>
  );
}
