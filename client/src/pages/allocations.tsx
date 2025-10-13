import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Building, MapPin, Filter, Search } from "lucide-react";
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
  brands?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}

export default function Allocations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedDealership, setSelectedDealership] = useState<string>("all");
  const [selectedShowroom, setSelectedShowroom] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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

  // Fetch OEMs/Brands for filtering
  const { data: oems = [] } = useQuery({
    queryKey: ["/api/oems"],
    queryFn: async () => {
      const response = await fetch('/api/oems', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch OEMs');
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

  // Helper function to get OEM/Brand ID from allocation
  const getOemIdFromAllocation = (allocation: Allocation) => {
    if (allocation.level === 'DEALERSHIP') {
      const dealership = dealerships.find((d: any) => d.id === allocation.levelId);
      return dealership?.oemId;
    } else {
      const showroom = showrooms.find((s: any) => s.id === allocation.levelId);
      if (showroom) {
        const dealership = dealerships.find((d: any) => d.id === showroom.dealershipId);
        return dealership?.oemId;
      }
    }
    return null;
  };

  // Helper function to get Dealership ID from allocation
  const getDealershipIdFromAllocation = (allocation: Allocation) => {
    if (allocation.level === 'DEALERSHIP') {
      return allocation.levelId;
    } else {
      const showroom = showrooms.find((s: any) => s.id === allocation.levelId);
      return showroom?.dealershipId;
    }
  };

  // Filter allocations based on selected filters
  const filteredAllocations = allocations.filter((allocation: any) => {
    // Text search - search in partner name and level entity name
    const searchMatch = searchTerm === "" || 
      allocation.partner.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getLevelDisplayName(allocation).toLowerCase().includes(searchTerm.toLowerCase());
    
    // Brand/OEM filter
    const brandMatch = selectedBrand === "all" || getOemIdFromAllocation(allocation) === selectedBrand;
    
    // Dealership filter
    const dealershipMatch = selectedDealership === "all" || getDealershipIdFromAllocation(allocation) === selectedDealership;
    
    // Showroom filter
    const showroomMatch = selectedShowroom === "all" || 
      (allocation.level === 'SHOWROOM' && allocation.levelId === selectedShowroom);
    
    // Service Category filter
    const categoryMatch = selectedCategory === "all" || 
      allocation.partner.serviceCategories?.some((cat: any) => cat.id === selectedCategory);
    
    return searchMatch && brandMatch && dealershipMatch && showroomMatch && categoryMatch;
  });

  const getLevelDisplayName = (allocation: Allocation) => {
    if (allocation.level === 'DEALERSHIP') {
      const dealership = dealerships.find((d: any) => d.id === allocation.levelId);
      return dealership?.name || 'Unknown Dealership';
    } else {
      const showroom = showrooms.find((s: any) => s.id === allocation.levelId);
      return showroom?.name || 'Unknown Showroom';
    }
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
          <p className="text-muted-foreground mt-1">Manage partner assignments to dealerships and showrooms (you can now select multiple showrooms at once)</p>
        </div>
        <Button onClick={handleAddAllocation} data-testid="button-add-allocation">
          <Plus className="mr-2 h-4 w-4" />
          Add Allocation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by partner or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-allocation"
            />
          </div>

          <div>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-48" data-testid="filter-brand">
                <SelectValue placeholder="Filter by Brand/OEM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands/OEMs</SelectItem>
                {oems.map((oem: any) => (
                  <SelectItem key={oem.id} value={oem.id}>
                    {oem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={selectedDealership} onValueChange={setSelectedDealership}>
              <SelectTrigger className="w-48" data-testid="filter-dealership">
                <SelectValue placeholder="Filter by Dealership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealerships</SelectItem>
                {dealerships.map((dealership: any) => (
                  <SelectItem key={dealership.id} value={dealership.id}>
                    {dealership.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={selectedShowroom} onValueChange={setSelectedShowroom}>
              <SelectTrigger className="w-48" data-testid="filter-showroom">
                <SelectValue placeholder="Filter by Showroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Showrooms</SelectItem>
                {showrooms.map((showroom: any) => (
                  <SelectItem key={showroom.id} value={showroom.id}>
                    {showroom.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="filter-category">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {serviceCategories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
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
          filteredAllocations.map((allocation: any) => (
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

                  {/* Brands */}
                  {allocation.brands && allocation.brands.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Product Brands</h4>
                      <div className="flex flex-wrap gap-1">
                        {allocation.brands.map((brand: any) => (
                          <Badge 
                            key={brand.id} 
                            variant="secondary" 
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200"
                            data-testid={`tag-allocation-brand-${brand.code}`}
                          >
                            {brand.name}
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