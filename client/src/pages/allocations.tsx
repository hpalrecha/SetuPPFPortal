import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Building, MapPin, Filter } from "lucide-react";
import { CreateAllocationModal } from "@/components/modals/CreateAllocationModal";
import { useToast } from "@/hooks/use-toast";

interface Allocation {
  id: string;
  level: 'DEALERSHIP' | 'SHOWROOM';
  levelId: string;
  partnerId: string;
  priority: number;
  active: boolean;
  partner: {
    id: string;
    displayName: string;
    type: string;
    phone: string;
    email: string;
  };
}

export default function Allocations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLevelEntity, setSelectedLevelEntity] = useState<string>("all");

  // Fetch allocations
  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ["/api/allocations-with-categories"],
    queryFn: async () => {
      const response = await fetch('/api/allocations-with-categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch allocations');
      return response.json();
    },
  });

  // Fetch dealerships and showrooms for display names
  const { data: dealerships = [] } = useQuery({
    queryKey: ["/api/dealerships"],
    queryFn: async () => {
      const response = await fetch('/api/dealerships', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
  });

  const { data: showrooms = [] } = useQuery({
    queryKey: ["/api/showrooms"],
    queryFn: async () => {
      const response = await fetch('/api/showrooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showrooms');
      return response.json();
    },
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

  // Filter allocations based on selected filters
  const filteredAllocations = allocations.filter((allocation) => {
    const levelMatch = selectedLevel === "all" || allocation.level === selectedLevel;
    const categoryMatch = selectedCategory === "all" || 
      allocation.partner.serviceCategories?.some((cat: any) => cat.id === selectedCategory);
    const entityMatch = selectedLevelEntity === "all" || allocation.levelId === selectedLevelEntity;
    return levelMatch && categoryMatch && entityMatch;
  });

  // Get level entities for dropdown based on selected level
  const getLevelEntities = () => {
    if (selectedLevel === "DEALERSHIP") {
      return dealerships.map((d) => ({ value: d.id, label: d.name }));
    } else if (selectedLevel === "SHOWROOM") {
      return showrooms.map((s) => ({ value: s.id, label: s.name }));
    }
    return [];
  };

  // Delete allocation mutation
  const deleteAllocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/allocations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete allocation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations-with-categories"] });
      toast({
        title: "Success",
        description: "Allocation deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete allocation",
        variant: "destructive",
      });
    },
  });

  const getLevelDisplayName = (allocation: Allocation) => {
    if (allocation.level === 'DEALERSHIP') {
      const dealership = dealerships.find(d => d.id === allocation.levelId);
      return dealership?.name || 'Unknown Dealership';
    } else {
      const showroom = showrooms.find(s => s.id === allocation.levelId);
      return showroom?.name || 'Unknown Showroom';
    }
  };

  const handleAddAllocation = () => {
    setEditingAllocation(null);
    setShowCreateModal(true);
  };

  const handleEditAllocation = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setShowCreateModal(true);
  };

  const handleDeleteAllocation = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this allocation?')) {
      deleteAllocationMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading allocations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Partner Allocations</h2>
          <p className="text-muted-foreground mt-1">Manage partner assignments to dealerships and showrooms</p>
        </div>
        <Button onClick={handleAddAllocation} data-testid="button-add-allocation">
          <Plus className="mr-2 h-4 w-4" />
          Add Allocation
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
            <Select value={selectedLevel} onValueChange={(value) => {
              setSelectedLevel(value);
              setSelectedLevelEntity("all"); // Reset entity when level changes
            }}>
              <SelectTrigger className="w-40" data-testid="filter-level">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="DEALERSHIP">Dealership</SelectItem>
                <SelectItem value="SHOWROOM">Showroom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedLevel !== "all" && (
            <div>
              <Select value={selectedLevelEntity} onValueChange={setSelectedLevelEntity}>
                <SelectTrigger className="w-48" data-testid="filter-entity">
                  <SelectValue placeholder={`Select ${selectedLevel === "DEALERSHIP" ? "Dealership" : "Showroom"}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {selectedLevel === "DEALERSHIP" ? "Dealerships" : "Showrooms"}</SelectItem>
                  {getLevelEntities().map((entity) => (
                    <SelectItem key={entity.value} value={entity.value}>
                      {entity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="filter-specialization">
                <SelectValue placeholder="Partner Specialization" />
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
          Showing {filteredAllocations.length} of {allocations.length} allocations
        </div>
      </div>

      {/* Allocations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAllocations.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Allocations Found</h3>
                <p className="text-muted-foreground mb-4">
                  Start by allocating partners to dealerships and showrooms.
                </p>
                <Button onClick={handleAddAllocation}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Allocation
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredAllocations.map((allocation) => (
            <Card key={allocation.id} data-testid={`card-allocation-${allocation.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      allocation.level === 'DEALERSHIP' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      {allocation.level === 'DEALERSHIP' ? (
                        <Building className={`h-6 w-6 ${allocation.level === 'DEALERSHIP' ? 'text-green-600' : 'text-purple-600'}`} />
                      ) : (
                        <MapPin className="h-6 w-6 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{getLevelDisplayName(allocation)}</CardTitle>
                      <p className="text-sm text-muted-foreground">{allocation.level}</p>
                    </div>
                  </div>
                  <Badge variant={allocation.active ? "default" : "secondary"}>
                    {allocation.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Assigned Partner</h4>
                    <p className="text-sm text-muted-foreground">{allocation.partner.displayName}</p>
                    <p className="text-xs text-muted-foreground">{allocation.partner.type}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Contact</h4>
                    <p className="text-sm text-muted-foreground">{allocation.partner.phone}</p>
                    {allocation.partner.email && (
                      <p className="text-sm text-muted-foreground">{allocation.partner.email}</p>
                    )}
                  </div>

                  {/* Service Categories */}
                  {allocation.partner.serviceCategories && allocation.partner.serviceCategories.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Specializations</h4>
                      <div className="flex flex-wrap gap-1">
                        {allocation.partner.serviceCategories.map((category: any) => (
                          <Badge 
                            key={category.id} 
                            variant="secondary" 
                            className="text-xs px-2 py-1 bg-green-100 text-green-800 hover:bg-green-200"
                            data-testid={`tag-allocation-category-${category.code}`}
                          >
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditAllocation(allocation)}
                      data-testid={`button-edit-${allocation.id}`}
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAllocation(allocation.id)}
                      data-testid={`button-delete-${allocation.id}`}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Allocation Modal */}
      <CreateAllocationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/allocations-with-categories"] });
          setShowCreateModal(false);
        }}
        allocation={editingAllocation}
      />
    </div>
  );
}