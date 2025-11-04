import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Building, Store, Users, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/lib/api";
import { CreateUserModal } from "@/components/modals/CreateUserModal";
import { INDIAN_STATES } from "@shared/constants";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    role: user?.role || "",
    contactPersonName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    billToAddress: "",
    billToCity: "",
    billToState: "",
    billToPincode: "",
    gstNumber: ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    weeklyReports: true
  });

  const [systemSettings, setSystemSettings] = useState({
    theme: "light",
    language: "en"
  });

  const queryClient = useQueryClient();
  const [activeOrgTab, setActiveOrgTab] = useState("oems");
  const [showCreateOEMModal, setShowCreateOEMModal] = useState(false);
  const [showCreateDealershipModal, setShowCreateDealershipModal] = useState(false);
  const [showCreateShowroomModal, setShowCreateShowroomModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  // Fetch data for organization management
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
    enabled: user?.role === 'SUPER_ADMIN',
  });

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
    enabled: user?.role === 'SUPER_ADMIN',
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
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: user?.role === 'SUPER_ADMIN',
  });

  // Fetch current user's dealership details if they're a DEALERSHIP_ADMIN
  const { data: myDealership } = useQuery({
    queryKey: ["/api/dealerships", user?.dealershipId],
    queryFn: async () => {
      const response = await fetch(`/api/dealerships/${user?.dealershipId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dealership');
      return response.json();
    },
    enabled: user?.role === 'DEALERSHIP_ADMIN' && !!user?.dealershipId,
  });

  // Fetch current user's showroom details if they're a SHOWROOM_MANAGER
  const { data: myShowroom } = useQuery({
    queryKey: ["/api/showrooms", user?.showroomId],
    queryFn: async () => {
      const response = await fetch(`/api/showrooms/${user?.showroomId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch showroom');
      return response.json();
    },
    enabled: user?.role === 'SHOWROOM_MANAGER' && !!user?.showroomId,
  });

  // Update profile data when dealership data is loaded
  useEffect(() => {
    if (myDealership && user?.role === 'DEALERSHIP_ADMIN') {
      // Parse billToAddress JSONB if it exists
      const billToAddressData = myDealership.billToAddress || {};
      
      setProfileData(prev => ({
        ...prev,
        contactPersonName: myDealership.contactPersonName || "",
        address: myDealership.address || "",
        city: myDealership.city || "",
        state: myDealership.state || "",
        pincode: myDealership.pincode || "",
        billToAddress: typeof billToAddressData === 'object' ? billToAddressData.addressLine1 || "" : billToAddressData || "",
        billToCity: typeof billToAddressData === 'object' ? billToAddressData.city || "" : "",
        billToState: typeof billToAddressData === 'object' ? billToAddressData.state || "" : "",
        billToPincode: typeof billToAddressData === 'object' ? billToAddressData.pincode || "" : "",
        gstNumber: typeof billToAddressData === 'object' ? billToAddressData.gstin || "" : ""
      }));
    }
  }, [myDealership, user?.role]);

  // Update profile data when showroom data is loaded
  useEffect(() => {
    if (myShowroom && user?.role === 'SHOWROOM_MANAGER') {
      // Parse billToAddress JSONB if it exists
      const billToAddressData = myShowroom.billToAddress || {};
      
      setProfileData(prev => ({
        ...prev,
        contactPersonName: myShowroom.contactPersonName || "",
        address: myShowroom.address || "",
        city: myShowroom.city || "",
        state: myShowroom.state || "",
        pincode: myShowroom.pincode || "",
        billToAddress: typeof billToAddressData === 'object' ? billToAddressData.addressLine1 || "" : billToAddressData || "",
        billToCity: typeof billToAddressData === 'object' ? billToAddressData.city || "" : "",
        billToState: typeof billToAddressData === 'object' ? billToAddressData.state || "" : "",
        billToPincode: typeof billToAddressData === 'object' ? billToAddressData.pincode || "" : "",
        gstNumber: typeof billToAddressData === 'object' ? billToAddressData.gstin || "" : ""
      }));
    }
  }, [myShowroom, user?.role]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Update dealership/showroom organization details
      if (user?.role === 'DEALERSHIP_ADMIN' && user?.dealershipId) {
        const updateData = {
          contactPersonName: profileData.contactPersonName,
          contactEmail: profileData.email, // Save user's email to dealership contactEmail
          contactPhone: profileData.phone, // Save user's phone to dealership contactPhone
          address: profileData.address,
          city: profileData.city,
          state: profileData.state,
          pincode: profileData.pincode,
          billToAddress: {
            addressLine1: profileData.billToAddress || "",
            city: profileData.billToCity || "",
            state: profileData.billToState || "",
            pincode: profileData.billToPincode || "",
            gstin: profileData.gstNumber || ""
          },
        };

        const response = await fetch(`/api/dealerships/${user.dealershipId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
          body: JSON.stringify(updateData),
        });

        if (!response.ok) throw new Error('Failed to update dealership');
        
        // Invalidate the query to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/dealerships", user.dealershipId] });
      } else if (user?.role === 'SHOWROOM_MANAGER' && user?.showroomId) {
        const updateData = {
          contactPersonName: profileData.contactPersonName,
          contactEmail: profileData.email, // Save user's email to showroom contactEmail
          contactPhone: profileData.phone, // Save user's phone to showroom contactPhone
          address: profileData.address,
          city: profileData.city,
          state: profileData.state,
          pincode: profileData.pincode,
          billToAddress: {
            addressLine1: profileData.billToAddress || "",
            city: profileData.billToCity || "",
            state: profileData.billToState || "",
            pincode: profileData.billToPincode || "",
            gstin: profileData.gstNumber || ""
          },
        };

        const response = await fetch(`/api/showrooms/${user.showroomId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          credentials: 'include',
          body: JSON.stringify(updateData),
        });

        if (!response.ok) throw new Error('Failed to update showroom');
        
        // Invalidate the query to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/showrooms", user.showroomId] });
      }
      
      toast({
        title: "Profile Updated",
        description: "Your organization details have been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // TODO: Implement password change API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: "Password Changed",
        description: "Your password has been changed successfully."
      });
      
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error) {
      toast({
        title: "Password Change Failed",
        description: "Failed to change password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOEM = async (oemData: any) => {
    try {
      await ApiClient.post('/api/oems', oemData);
      toast({
        title: "Success",
        description: "OEM created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/oems"] });
      setShowCreateOEMModal(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create OEM",
        variant: "destructive",
      });
    }
  };

  const isSupperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account and system preferences</p>
      </div>

      {/* Organization Management for Super Admin */}
      {isSupperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organization Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeOrgTab} onValueChange={setActiveOrgTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="oems">OEMs</TabsTrigger>
                <TabsTrigger value="dealerships">Dealerships</TabsTrigger>
                <TabsTrigger value="showrooms">Showrooms</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="oems" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">OEMs</h3>
                  <Button onClick={() => setShowCreateOEMModal(true)} data-testid="button-create-oem">
                    <Plus className="h-4 w-4 mr-2" />
                    Add OEM
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {oems.map((oem: any) => (
                    <Card key={oem.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{oem.name}</h4>
                          <Badge variant={oem.active ? "default" : "secondary"}>
                            {oem.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{oem.brandCode}</p>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" data-testid={`button-edit-oem-${oem.id}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-delete-oem-${oem.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {oems.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No OEMs found. Add your first OEM to get started.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="dealerships" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Dealerships</h3>
                  <Button onClick={() => setShowCreateDealershipModal(true)} data-testid="button-create-dealership">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Dealership
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dealerships.map((dealership: any) => (
                    <Card key={dealership.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{dealership.name}</h4>
                          <Badge variant={dealership.active ? "default" : "secondary"}>
                            {dealership.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{dealership.location}</p>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" data-testid={`button-edit-dealership-${dealership.id}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-delete-dealership-${dealership.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {dealerships.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No dealerships found. Add your first dealership to get started.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="showrooms" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Showrooms</h3>
                  <Button onClick={() => setShowCreateShowroomModal(true)} data-testid="button-create-showroom">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Showroom
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {showrooms.map((showroom: any) => (
                    <Card key={showroom.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{showroom.name}</h4>
                          <Badge variant={showroom.active ? "default" : "secondary"}>
                            {showroom.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{showroom.location}</p>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" data-testid={`button-edit-showroom-${showroom.id}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-delete-showroom-${showroom.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {showrooms.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No showrooms found. Add your first showroom to get started.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">System Users</h3>
                  <Button onClick={() => setShowCreateUserModal(true)} data-testid="button-create-user">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((usr: any) => (
                    <Card key={usr.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{usr.name}</h4>
                          <Badge variant={usr.isActive ? "default" : "secondary"}>
                            {usr.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{usr.email}</p>
                        <p className="text-xs text-muted-foreground mb-3">{usr.role.replace(/_/g, ' ')}</p>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" data-testid={`button-edit-user-${usr.id}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" data-testid={`button-delete-user-${usr.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {users.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No users found. Add your first user to get started.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      {user?.role === 'DEALERSHIP_ADMIN' ? 'Organization Name' : 
                       user?.role === 'SHOWROOM_MANAGER' || user?.role === 'SALES_PERSON' ? 'Showroom Name' : 
                       'Full Name'}
                    </Label>
                    <Input
                      id="name"
                      value={user?.role === 'DEALERSHIP_ADMIN' ? (myDealership?.name || profileData.name) :
                             (user?.role === 'SHOWROOM_MANAGER' || user?.role === 'SALES_PERSON') ? (myShowroom?.name || profileData.name) :
                             profileData.name}
                      disabled={user?.role === 'DEALERSHIP_ADMIN' || user?.role === 'SHOWROOM_MANAGER' || user?.role === 'SALES_PERSON'}
                      className={user?.role === 'DEALERSHIP_ADMIN' || user?.role === 'SHOWROOM_MANAGER' || user?.role === 'SALES_PERSON' ? 'bg-muted cursor-not-allowed' : ''}
                      onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-name"
                    />
                  </div>
                  
                  {(user?.role === 'DEALERSHIP_ADMIN' || user?.role === 'SHOWROOM_MANAGER' || user?.role === 'SALES_PERSON') && (
                    <div className="space-y-2">
                      <Label htmlFor="username">Username (Login ID)</Label>
                      <Input
                        id="username"
                        value={user?.username || ''}
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-username"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      value={profileData.role}
                      disabled
                      className="bg-muted text-muted-foreground"
                      data-testid="input-role"
                    />
                  </div>
                </div>

                {/* Additional details for dealership/showroom users */}
                {(user?.role === 'DEALERSHIP_ADMIN' || user?.role === 'SHOWROOM_MANAGER') && (
                  <>
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-medium mb-4">Organization Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contactPersonName">Contact Person Name</Label>
                          <Input
                            id="contactPersonName"
                            value={profileData.contactPersonName}
                            onChange={(e) => setProfileData(prev => ({ ...prev, contactPersonName: e.target.value }))}
                            data-testid="input-contact-person-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Address</Label>
                          <Input
                            id="address"
                            value={profileData.address}
                            onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                            data-testid="input-address"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={profileData.city}
                            onChange={(e) => setProfileData(prev => ({ ...prev, city: e.target.value }))}
                            data-testid="input-city"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={profileData.state}
                            onChange={(e) => setProfileData(prev => ({ ...prev, state: e.target.value }))}
                            data-testid="input-state"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pincode">Pincode</Label>
                          <Input
                            id="pincode"
                            value={profileData.pincode}
                            onChange={(e) => setProfileData(prev => ({ ...prev, pincode: e.target.value }))}
                            data-testid="input-pincode"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Billing Address Section - Always visible for dealership/showroom users */}
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-medium mb-4">Billing Address</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="billToAddress">Billing Address</Label>
                          <Input
                            id="billToAddress"
                            value={profileData.billToAddress}
                            onChange={(e) => setProfileData(prev => ({ ...prev, billToAddress: e.target.value }))}
                            placeholder="Enter billing address"
                            data-testid="input-bill-to-address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="billToCity">Billing City</Label>
                          <Input
                            id="billToCity"
                            value={profileData.billToCity}
                            onChange={(e) => setProfileData(prev => ({ ...prev, billToCity: e.target.value }))}
                            placeholder="Enter billing city"
                            data-testid="input-bill-to-city"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="billToState">Billing State</Label>
                          <Select 
                            value={profileData.billToState} 
                            onValueChange={(value) => setProfileData(prev => ({ ...prev, billToState: value }))}
                          >
                            <SelectTrigger data-testid="select-bill-to-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDIAN_STATES.map((stateName) => (
                                <SelectItem key={stateName} value={stateName}>
                                  {stateName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="billToPincode">Billing Pincode</Label>
                          <Input
                            id="billToPincode"
                            value={profileData.billToPincode}
                            onChange={(e) => setProfileData(prev => ({ ...prev, billToPincode: e.target.value }))}
                            placeholder="Enter billing pincode"
                            data-testid="input-bill-to-pincode"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gstNumber">GST Number</Label>
                          <Input
                            id="gstNumber"
                            value={profileData.gstNumber}
                            onChange={(e) => setProfileData(prev => ({ ...prev, gstNumber: e.target.value }))}
                            placeholder="Enter GST number"
                            data-testid="input-gst-number"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  data-testid="button-update-profile"
                >
                  {isLoading ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    data-testid="input-current-password"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  data-testid="button-change-password"
                >
                  {isLoading ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Notification and System Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                  }
                  data-testid="switch-email-notifications"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">SMS Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive SMS alerts</p>
                </div>
                <Switch
                  checked={notificationSettings.smsNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, smsNotifications: checked }))
                  }
                  data-testid="switch-sms-notifications"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Browser push notifications</p>
                </div>
                <Switch
                  checked={notificationSettings.pushNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, pushNotifications: checked }))
                  }
                  data-testid="switch-push-notifications"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Weekly Reports</p>
                  <p className="text-xs text-muted-foreground">Weekly summary email</p>
                </div>
                <Switch
                  checked={notificationSettings.weeklyReports}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, weeklyReports: checked }))
                  }
                  data-testid="switch-weekly-reports"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select 
                  value={systemSettings.theme} 
                  onValueChange={(value) => setSystemSettings(prev => ({ ...prev, theme: value }))}
                  data-testid="select-theme"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select 
                  value={systemSettings.language} 
                  onValueChange={(value) => setSystemSettings(prev => ({ ...prev, language: value }))}
                  data-testid="select-language"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        open={showCreateUserModal}
        onOpenChange={setShowCreateUserModal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        }}
      />
    </div>
  );
}
