import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Store, User, MapPin, Phone, Star, BarChart3, Edit } from "lucide-react";
import type { Partner } from "@shared/schema";

export default function PartnersPage() {
  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    refetchInterval: 30000
  });

  const handleAddPartner = () => {
    // TODO: Open partner creation modal
    alert("Partner creation form would open here");
  };

  const handleEditPartner = (id: string) => {
    // TODO: Open partner edit modal
    alert(`Edit partner ${id}`);
  };

  const handleViewPartner = (id: string) => {
    // TODO: Navigate to partner detail view
    alert(`View partner ${id} dashboard`);
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

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {partners.length === 0 ? (
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
          partners.map((partner) => (
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

                {/* Performance Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                  <div>
                    <p className="font-semibold text-foreground">15</p>
                    <p className="text-muted-foreground">Active Jobs</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">94%</p>
                    <p className="text-muted-foreground">Success Rate</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">2.1d</p>
                    <p className="text-muted-foreground">Avg TAT</p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 text-sm"
                    onClick={() => handleEditPartner(partner.id)}
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
