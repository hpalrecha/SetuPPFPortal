import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UserPlus, Users, MapPin, ChevronDown, X, Edit, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { User as StaffUser, Partner } from "@shared/schema";

const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` });

// Multi-select partner picker: Popover + checkbox list, selected shown as chips.
function PartnerMultiSelect({
  partners, selected, onChange,
}: { partners: Partner[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-between">
            {selected.length ? `${selected.length} selected` : "Select partners"}
            <ChevronDown className="h-3 w-3 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto">
          {partners.map(p => (
            <label key={p.id} className="flex items-center gap-2 py-1 px-1 text-sm cursor-pointer hover:bg-muted/50 rounded">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              {p.displayName} <span className="text-xs text-muted-foreground">({p.type})</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const p = partners.find(p => p.id === id);
            if (!p) return null;
            return (
              <Badge key={id} variant="secondary" className="text-xs">
                {p.displayName}
                <button onClick={() => toggle(id)} className="ml-1"><X className="h-2.5 w-2.5" /></button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PulsePendingUsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [selectedFilterRole, setSelectedFilterRole] = useState<string>("ALL");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [editingUserRole, setEditingUserRole] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pending");

  const headerText: Record<string, { title: string; subtitle: string }> = {
    pending: {
      title: "Allocation Staff to Partner",
      subtitle: "Staff can work for multiple partners. Assign or edit their working-partner set here.",
    },
    all: {
      title: "By All Staff",
      subtitle: "we mean that it includes all the detailers and installers which are in this Portal",
    },
    "all-users": {
      title: "All Users",
      subtitle: "All the users present in Portal from OEMs to Installers with edit role option.",
    },
  };

  const { data: allUsers = [], isLoading: loadingAllUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/all-users"],
    queryFn: async () => {
      const r = await fetch('/api/admin/all-users', { headers: authHeaders(), credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch users');
      return r.json();
    },
  });

  const handleChangeRole = async (userId: string, newRole: string) => {
    const r = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      credentials: 'include',
      body: JSON.stringify({ role: newRole }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Failed to update role');
  };

  const handleSaveUserEdit = async (userId: string, originalRole: string, updates: {
    name: string; email: string; phone: string; password: string;
    isActive: boolean; showServicePrices: boolean; role: string;
  }) => {
    setBusyId(userId);
    try {
      if (updates.role !== originalRole) {
        await handleChangeRole(userId, updates.role);
      }

      const patchBody: any = {
        name: updates.name,
        email: updates.email,
        phone: updates.phone,
        isActive: updates.isActive,
        showServicePrices: updates.showServicePrices,
      };
      if (updates.password) patchBody.password = updates.password;

      const r = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(patchBody),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to update user');

      toast({ title: "User updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-pending-users"] });
      setEditingUserRole(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;
    setBusyId(userId);
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to delete user');
      toast({ title: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-pending-users"] });
      setEditingUserRole(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const { data: pendingUsers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pulse-pending-users"],
    queryFn: async () => {
      const r = await fetch('/api/admin/pulse-pending-users', { headers: authHeaders(), credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch pending users');
      return r.json();
    },
  });

  const { data: allStaff = [], isLoading: loadingAllStaff } = useQuery<any[]>({
    queryKey: ["/api/admin/staff-users"],
    queryFn: async () => {
      const r = await fetch('/api/admin/staff-users', { headers: authHeaders(), credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch staff');
      return r.json();
    },
  });

  const { data: partners = [] } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    queryFn: async () => {
      const r = await fetch('/api/partners', { headers: authHeaders(), credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch partners');
      return r.json();
    },
  });

  const activePartners = partners.filter((p: any) => p.active);

  const handleAssign = async (userId: string) => {
    const partnerIds = selectedPartners[userId] || [];
    if (partnerIds.length === 0) {
      toast({ title: "Select at least one partner", variant: "destructive" });
      return;
    }
    setBusyId(userId);
    try {
      const r = await fetch(`/api/admin/pulse-pending-users/${userId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ partnerIds }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to assign partners');
      toast({ title: "Partners assigned", description: "The user now appears under their staff list." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-users"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async (partnerIds: string[]) => {
    if (!editingStaff) return;
    setBusyId(editingStaff.id);
    try {
      const r = await fetch(`/api/admin/staff/${editingStaff.id}/partners`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ partnerIds }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to update');
      toast({ title: "Partners updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-pending-users"] });
      setEditingStaff(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const formatTerritory = (u: any) => {
    const meta = u.pulseMetadata;
    if (!meta) return '—';
    const parts = [meta.city, meta.state, meta.postalCode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{headerText[activeTab].title}</h2>
        <p className="text-muted-foreground mt-1">
          {headerText[activeTab].subtitle}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all-users">All Users</TabsTrigger>
          <TabsTrigger value="all">All Staff</TabsTrigger>
          <TabsTrigger value="pending">Pending Allocation ({pendingUsers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all-users">
          {loadingAllUsers ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end gap-2 items-center">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search name, email, phone, partner..."
                    className="pl-8 pr-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground w-64"
                  />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Filter by Role:</span>
                <select
                  value={selectedFilterRole}
                  onChange={(e) => setSelectedFilterRole(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                >
                  <option value="ALL">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OEM_ADMIN">OEM Admin</option>
                  <option value="DEALERSHIP_ADMIN">Dealership Admin</option>
                  <option value="SHOWROOM_MANAGER">Showroom Manager</option>
                  <option value="SALES_PERSON">Sales Person</option>
                  <option value="PARTNER_ADMIN">Partner Admin</option>
                  <option value="PARTNER_STAFF">Partner Staff / Installer</option>
                  <option value="DETAILING_PARTNER">Detailing Partner</option>
                </select>
              </div>

              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email / Phone</TableHead>
                      <TableHead>User Group</TableHead>
                      <TableHead>Database Role</TableHead>
                      <TableHead>Partner / Showroom</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers
                      .filter(user => selectedFilterRole === "ALL" || user.role === selectedFilterRole)
                      .filter(user => {
                        if (!userSearchQuery.trim()) return true;
                        const q = userSearchQuery.trim().toLowerCase();
                        return [user.name, user.email, user.phone, user.partnerName]
                          .filter(Boolean)
                          .some((f: string) => f.toLowerCase().includes(q));
                      })
                      .map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span>{user.email || '—'}</span>
                              <span className="text-xs text-muted-foreground">{user.phone || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              user.role === 'PARTNER_ADMIN' ? 'bg-orange-50 text-orange-700' :
                              user.role === 'DETAILING_PARTNER' ? 'bg-purple-50 text-purple-700' :
                              user.role === 'PARTNER_STAFF' ? 'bg-blue-50 text-blue-700' :
                              user.role === 'SHOWROOM_MANAGER' ? 'bg-teal-50 text-teal-700' :
                              'bg-gray-50 text-gray-700'
                            }>
                              {user.role === 'SUPER_ADMIN' ? 'Super Admin' :
                               user.role === 'ADMIN' ? 'Admin' :
                               user.role === 'MANAGER' ? 'Manager' :
                               user.role === 'OEM_ADMIN' ? 'OEM Admin' :
                               user.role === 'DEALERSHIP_ADMIN' ? 'Dealership Admin' :
                               user.role === 'SHOWROOM_MANAGER' ? 'Showroom Manager' :
                               user.role === 'SALES_PERSON' ? 'Sales Person' :
                               user.role === 'PARTNER_ADMIN' ? 'Partner Admin' :
                               user.role === 'PARTNER_STAFF' ? 'Installer (Staff)' :
                               user.role === 'DETAILING_PARTNER' ? 'Detailing Partner' : user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{user.role}</TableCell>
                          <TableCell className="text-sm">
                            {user.partnerName ? (
                              <Badge variant="secondary">{user.partnerName}</Badge>
                            ) : user.showroomName ? (
                              <Badge variant="secondary">{user.showroomName}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => setEditingUserRole(user)}
                            >
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {loadingAllStaff ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Working Partners</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allStaff.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={user.role === 'DETAILING_PARTNER' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}>
                          {user.role === 'DETAILING_PARTNER' ? 'Detailing Partner' : 'Installer (Staff)'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.partners?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {user.partners.map((p: any) => (
                              <Badge key={p.partnerId} variant="secondary" className="text-xs">{p.displayName}</Badge>
                            ))}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => setEditingStaff({ ...user, _selected: (user.partners || []).map((p: any) => p.partnerId) })}
                        >
                          <Edit className="h-3 w-3 mr-1" />Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {isLoading ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : pendingUsers.length === 0 ? (
            <Card><CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Pending Users</h3>
              <p className="text-sm text-muted-foreground">All staff have at least one working partner.</p>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Invited by</TableHead>
                    <TableHead>Assign Partners</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={user.role === 'DETAILING_PARTNER' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}>
                          {user.role === 'DETAILING_PARTNER' ? 'Detailing Partner' : 'Installer (Staff)'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />{formatTerritory(user)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.invitedByPartnerName || user.invitedByName || '—'}
                      </TableCell>
                      <TableCell>
                        <PartnerMultiSelect
                          partners={activePartners}
                          selected={selectedPartners[user.id] || []}
                          onChange={(ids) => setSelectedPartners(prev => ({ ...prev, [user.id]: ids }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleAssign(user.id)} disabled={busyId === user.id}>
                          <UserPlus className="h-3 w-3 mr-1" />
                          {busyId === user.id ? 'Assigning...' : 'Assign'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {editingStaff && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingStaff(null)}>
          <Card className="w-96" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Edit Partners — {editingStaff.name}</h3>
              <PartnerMultiSelect
                partners={activePartners}
                selected={editingStaff._selected}
                onChange={(ids) => setEditingStaff((prev: any) => ({ ...prev, _selected: ids }))}
              />
              <p className="text-xs text-muted-foreground">Removing all partners returns this staff member to Pending.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingStaff(null)}>Cancel</Button>
                <Button size="sm" onClick={() => handleSaveEdit(editingStaff._selected)} disabled={busyId === editingStaff.id}>
                  {busyId === editingStaff.id ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingUserRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingUserRole(null)}>
          <Card className="w-[28rem] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-lg text-foreground">Edit User</h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <input
                  id="edit-user-name"
                  defaultValue={editingUserRole.name || ''}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email</label>
                <input
                  id="edit-user-email"
                  type="email"
                  defaultValue={editingUserRole.email || ''}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Phone</label>
                <input
                  id="edit-user-phone"
                  defaultValue={editingUserRole.phone || ''}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">New Password (leave blank to keep current)</label>
                <input
                  id="edit-user-password"
                  type="password"
                  placeholder="Enter new password..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Role</label>
                <select
                  defaultValue={editingUserRole.role}
                  id="edit-user-role"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground"
                >
                  <option value="PARTNER_ADMIN">Partner Admin (PARTNER_ADMIN)</option>
                  <option value="DETAILING_PARTNER">Detailing Partner (DETAILING_PARTNER)</option>
                  <option value="PARTNER_STAFF">Partner Staff / Installer (PARTNER_STAFF)</option>
                  <option value="DEALERSHIP_ADMIN">Dealership Admin (DEALERSHIP_ADMIN)</option>
                  <option value="SHOWROOM_MANAGER">Showroom Manager (SHOWROOM_MANAGER)</option>
                  <option value="SALES_PERSON">Sales Person (SALES_PERSON)</option>
                  <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
                  <option value="ADMIN">Admin (ADMIN)</option>
                  <option value="MANAGER">Manager (MANAGER)</option>
                  <option value="OEM_ADMIN">OEM Admin (OEM_ADMIN)</option>
                </select>
              </div>

              <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-foreground">Active</div>
                  <div className="text-xs text-muted-foreground">Deactivate to prevent user from logging in</div>
                </div>
                <input id="edit-user-active" type="checkbox" defaultChecked={editingUserRole.isActive ?? true} className="h-4 w-4" />
              </label>

              <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-foreground">Show Service Prices</div>
                  <div className="text-xs text-muted-foreground">Allow this user to see service prices in work orders and job cards</div>
                </div>
                <input id="edit-user-show-prices" type="checkbox" defaultChecked={editingUserRole.showServicePrices ?? true} className="h-4 w-4" />
              </label>

              <div className="flex justify-between items-center gap-2 pt-2">
                {currentUser?.role === 'SUPER_ADMIN' ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteUser(editingUserRole.id, editingUserRole.name)}
                    disabled={busyId === editingUserRole.id}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Delete
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingUserRole(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const name = (document.getElementById("edit-user-name") as HTMLInputElement).value;
                      const email = (document.getElementById("edit-user-email") as HTMLInputElement).value;
                      const phone = (document.getElementById("edit-user-phone") as HTMLInputElement).value;
                      const password = (document.getElementById("edit-user-password") as HTMLInputElement).value;
                      const role = (document.getElementById("edit-user-role") as HTMLSelectElement).value;
                      const isActive = (document.getElementById("edit-user-active") as HTMLInputElement).checked;
                      const showServicePrices = (document.getElementById("edit-user-show-prices") as HTMLInputElement).checked;
                      handleSaveUserEdit(editingUserRole.id, editingUserRole.role, {
                        name, email, phone, password, isActive, showServicePrices, role,
                      });
                    }}
                    disabled={busyId === editingUserRole.id}
                  >
                    {busyId === editingUserRole.id ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
