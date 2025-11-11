import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Edit, Trash2, MapPin, Phone, Users, Handshake, Search, Filter, Upload, Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { CreateShowroomModal } from "@/components/modals/CreateShowroomModal";
import { BulkUploadShowroomsModal } from "@/components/modals/BulkUploadShowroomsModal";
import { cn } from "@/lib/utils";

export default function ShowroomsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingShowroom, setEditingShowroom] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedOEM, setSelectedOEM] = useState<string>("all");
  const [selectedDealership, setSelectedDealership] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [openCityCombobox, setOpenCityCombobox] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Super Admin, Admin, and Manager can access showroom management
  const canAccessShowrooms = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  
  const { data: showroomData, isLoading } = useQuery<{ showrooms: any[]; total: number }>({
    queryKey: ["/api/showrooms", debouncedSearchTerm, selectedOEM !== "all" ? selectedOEM : undefined, selectedDealership !== "all" ? selectedDealership : undefined, selectedState !== "all" ? selectedState : undefined, selectedCity !== "all" ? selectedCity : undefined, currentPage, itemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      if (selectedOEM !== "all") params.append('oemId', selectedOEM);
      if (selectedDealership !== "all") params.append('dealershipId', selectedDealership);
      if (selectedState !== "all") params.append('state', selectedState);
      if (selectedCity !== "all") params.append('city', selectedCity);
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      const response = await fetch(`/api/showrooms?${params.toString()}`, {
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
    staleTime: 300000, // Cache for 5 minutes - showroom data doesn't change often
    enabled: canAccessShowrooms
  });

  const showrooms = showroomData?.showrooms || [];
  const totalShowrooms = showroomData?.total || 0;
  const totalPages = Math.ceil(totalShowrooms / itemsPerPage);

  // Fetch filter options (states and cities)
  const { data: filterOptions } = useQuery<{ states: Array<{ value: string; count: number }>; cities: Array<{ value: string; count: number }> }>({
    queryKey: ["/api/showrooms/filter-options"],
    queryFn: async () => {
      const response = await fetch('/api/showrooms/filter-options', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch filter options');
      return response.json();
    },
    staleTime: 300000, // Cache for 5 minutes - filter options don't change often
    enabled: canAccessShowrooms
  });

  // Fetch OEMs for filtering
  const { data: oems = [] } = useQuery<any[]>({
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
    staleTime: 300000, // Cache for 5 minutes - OEM data doesn't change often
    enabled: canAccessShowrooms
  });

  // Fetch Dealerships for filtering
  const { data: dealershipData } = useQuery<{ dealerships: any[]; total: number }>({
    queryKey: ["/api/dealerships"],
    queryFn: async () => {
      const response = await fetch('/api/dealerships?limit=1000', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    staleTime: 300000, // Cache for 5 minutes - dealership data doesn't change often
    enabled: canAccessShowrooms
  });

  const dealerships = dealershipData?.dealerships || [];

  // Filter dealerships based on selected OEM (cascading filter)
  const filteredDealerships = useMemo(() => {
    if (selectedOEM === "all") {
      return dealerships;
    }
    // Dealerships have oemIds (array) because they can belong to multiple OEMs
    return dealerships.filter(d => d.oemIds && d.oemIds.includes(selectedOEM));
  }, [dealerships, selectedOEM]);

  // Reset dealership selection when OEM changes if current selection is not valid
  useEffect(() => {
    if (selectedDealership !== "all" && selectedOEM !== "all") {
      const isDealershipValid = filteredDealerships.some(d => d.id === selectedDealership);
      if (!isDealershipValid) {
        setSelectedDealership("all");
      }
    }
  }, [selectedOEM, selectedDealership, filteredDealerships]);

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
    staleTime: 300000, // Cache for 5 minutes - allocation data doesn't change often
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

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedOEM, selectedDealership, selectedState, selectedCity]);

  // Show access denied for non-admin users
  if (!canAccessShowrooms) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md">
              Showroom management is only available to Super Administrators, Admins, and Managers.
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Showroom Management</h2>
          <p className="text-muted-foreground mt-1">Manage individual showroom locations</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowBulkUploadModal(true)} 
            data-testid="button-bulk-upload-showrooms"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={handleAddShowroom} data-testid="button-add-showroom">
            <Plus className="mr-2 h-4 w-4" />
            Add Showroom
          </Button>
        </div>
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
              placeholder="Search by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-showroom"
            />
          </div>

          <div>
            <Select value={selectedOEM} onValueChange={setSelectedOEM}>
              <SelectTrigger className="w-48" data-testid="filter-oem">
                <SelectValue placeholder="Filter by OEM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All OEMs</SelectItem>
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
                {filteredDealerships.map((dealership: any) => (
                  <SelectItem key={dealership.id} value={dealership.id}>
                    {dealership.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger className="w-48" data-testid="filter-state">
                <SelectValue placeholder="Filter by State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {filterOptions?.states.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.value} ({state.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Popover open={openCityCombobox} onOpenChange={setOpenCityCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCityCombobox}
                  className="w-48 justify-between"
                  data-testid="filter-city"
                >
                  {selectedCity !== "all"
                    ? filterOptions?.cities.find((city) => city.value === selectedCity)?.value
                    : "Filter by City"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0">
                <Command>
                  <CommandInput placeholder="Search city..." />
                  <CommandList>
                    <CommandEmpty>No city found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedCity("all");
                          setOpenCityCombobox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCity === "all" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Cities
                      </CommandItem>
                      {filterOptions?.cities.map((city) => (
                        <CommandItem
                          key={city.value}
                          value={city.value}
                          onSelect={(currentValue) => {
                            setSelectedCity(currentValue);
                            setOpenCityCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCity === city.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {city.value} ({city.count})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {showrooms.length} of {totalShowrooms} showrooms
        </div>
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
                  {searchTerm || selectedOEM !== "all" || selectedDealership !== "all" || selectedState !== "all" || selectedCity !== "all" 
                    ? "No showrooms match your search criteria."
                    : "Add your first showroom to start managing individual locations."}
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

      {/* Pagination Controls */}
      {totalShowrooms > 0 && (
        <div className="flex items-center justify-between px-4 py-4 border-t">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalShowrooms)} of {totalShowrooms} showrooms
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={itemsPerPage.toString()} onValueChange={(value) => {
              setItemsPerPage(parseInt(value));
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="20">20 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Showroom Modal */}
      <CreateShowroomModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleModalSuccess}
        showroom={editingShowroom}
      />

      {/* Bulk Upload Showrooms Modal */}
      <BulkUploadShowroomsModal
        open={showBulkUploadModal}
        onOpenChange={setShowBulkUploadModal}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}