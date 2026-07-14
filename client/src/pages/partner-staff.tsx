import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Phone, Mail, Shield, Edit, UserMinus, UserCheck, UserX, MapPin } from "lucide-react";
import type { User as StaffUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { AddStaffModal } from "../components/modals/AddStaffModal";
import { EditStaffModal } from "../components/modals/EditStaffModal";
import { EditShowroomModal } from "../components/modals/EditShowroomModal";

const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` });

// A staff member's specific showroom assignment (installer or detailing
// partner — both use the same assignment mechanism, one showroom per staff member).
function StaffShowroomBadges({ partnerId, userId }: { partnerId: string; userId: string }) {
  const { data: showrooms = [] } = useQuery({
    queryKey: ["/api/partners", partnerId, "staff", userId, "showrooms"],
    queryFn: async () => {
      const r = await fetch(`/api/partners/${partnerId}/staff/${userId}/showrooms`, {
        headers: authHeaders(),
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!partnerId && !!userId,
    staleTime: 60000,
  });

  if (!showrooms.length) return <span className="text-xs text-muted-foreground">No showrooms assigned</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {showrooms.map((s: any) => (
        <Badge key={s.id} variant="secondary" className="text-xs">
          <MapPin className="h-2.5 w-2.5 mr-1" />{s.name}
        </Badge>
      ))}
    </div>
  );
}

export default function PartnerStaffPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editingShowroomsFor, setEditingShowroomsFor] = useState<StaffUser | null>(null);

  // Get current user's partner ID from session
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      return data.user;
    },
  });

  const partnerId = currentUser?.partnerId;

  // Fetch staff for the current partner
  const { data: staff = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ["/api/partners", partnerId, "staff"],
    queryFn: async () => {
      if (!partnerId) return [];
      
      const response = await fetch(`/api/partners/${partnerId}/staff`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch staff');
      }
      
      return response.json();
    },
    enabled: !!partnerId,
  });

  const handleAddStaff = () => {
    setShowAddModal(true);
  };

  const handleEditStaff = (staffMember: StaffUser) => {
    setEditingStaff(staffMember);
    setShowEditModal(true);
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: boolean, name: string) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/partners/${partnerId}/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} staff member`);
      }

      toast({
        title: "Success",
        description: `Staff member "${name}" ${action}d successfully`,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "staff"] });
    } catch (error) {
      console.error(`Error ${action}ing staff member:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} staff member`,
        variant: "destructive",
      });
    }
  };

  const handleUnassignStaff = async (staffId: string, name: string) => {
    if (!confirm(`Remove "${name}" from your partner account? They'll be unassigned and available for another admin to reassign to a different partner.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/partners/${partnerId}/staff/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to unassign staff member');
      }

      toast({
        title: "Success",
        description: `"${name}" has been unassigned from your partner account`,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "staff"] });
    } catch (error) {
      console.error('Error unassigning staff member:', error);
      toast({
        title: "Error",
        description: "Failed to unassign staff member",
        variant: "destructive",
      });
    }
  };

  const handleModalSuccess = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingStaff(null);
    // Refresh the data
    queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "staff"] });
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
          <h2 className="text-2xl font-semibold text-foreground">Staff Management</h2>
          <p className="text-muted-foreground mt-1">Manage your detailer staff members</p>
        </div>
        <Button onClick={handleAddStaff} data-testid="button-add-staff">
          <Plus className="mr-2 h-4 w-4" />
          Invite Staff Member
        </Button>
      </div>

      {/* Staff Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                <p className="text-2xl font-bold" data-testid="text-total-staff">{staff.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Staff</p>
                <p className="text-2xl font-bold" data-testid="text-active-staff">
                  {staff.filter(s => s.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <UserX className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inactive Staff</p>
                <p className="text-2xl font-bold" data-testid="text-inactive-staff">
                  {staff.filter(s => !s.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      {staff.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Staff Members</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't added any staff members yet. Invite your first installer or detailing partner to get started.
            </p>
            <Button onClick={handleAddStaff} data-testid="button-add-first-staff">
              <Plus className="mr-2 h-4 w-4" />
              Invite First Staff Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((staffMember) => (
            <Card key={staffMember.id} className="hover:shadow-md transition-shadow" data-testid={`card-staff-${staffMember.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-staff-name-${staffMember.id}`}>
                        {staffMember.name}
                      </CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={staffMember.isActive ? "default" : "secondary"} data-testid={`badge-staff-status-${staffMember.id}`}>
                          {staffMember.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={staffMember.role === 'DETAILING_PARTNER' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}
                          data-testid={`badge-staff-role-${staffMember.id}`}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {staffMember.role === 'DETAILING_PARTNER' ? 'Detailing Partner' : 'Installer (Staff)'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span data-testid={`text-staff-email-${staffMember.id}`}>{staffMember.email}</span>
                  </div>
                  
                  {staffMember.phone && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span data-testid={`text-staff-phone-${staffMember.id}`}>{staffMember.phone}</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground">Showrooms</p>
                      <button
                        type="button"
                        onClick={() => setEditingShowroomsFor(staffMember)}
                        className="text-xs text-primary hover:underline"
                        data-testid={`button-edit-showroom-${staffMember.id}`}
                      >
                        Edit Showroom
                      </button>
                    </div>
                    <StaffShowroomBadges partnerId={partnerId!} userId={staffMember.id} />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditStaff(staffMember)}
                      data-testid={`button-edit-staff-${staffMember.id}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStaffStatus(
                        staffMember.id, 
                        !!staffMember.isActive, 
                        staffMember.name
                      )}
                      data-testid={`button-toggle-staff-${staffMember.id}`}
                    >
                      {staffMember.isActive ? (
                        <>
                          <UserX className="h-3 w-3 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnassignStaff(staffMember.id, staffMember.name)}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                      data-testid={`button-unassign-staff-${staffMember.id}`}
                    >
                      <UserMinus className="h-3 w-3 mr-1" />
                      Unassign
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddStaffModal
          partnerId={partnerId}
          onSuccess={handleModalSuccess}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showEditModal && editingStaff && (
        <EditStaffModal
          partnerId={partnerId}
          staff={editingStaff}
          onSuccess={handleModalSuccess}
          onClose={() => {
            setShowEditModal(false);
            setEditingStaff(null);
          }}
        />
      )}

      {editingShowroomsFor && partnerId && (
        <EditShowroomModal
          partnerId={partnerId}
          staff={editingShowroomsFor}
          onClose={() => setEditingShowroomsFor(null)}
          onSuccess={() => setEditingShowroomsFor(null)}
        />
      )}
    </div>
  );
}