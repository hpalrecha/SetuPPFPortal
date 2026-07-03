import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, User, Search, Edit, Trash2, UserCheck, UserX,
  MapPin, ClipboardList, CheckSquare, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User as AppUser } from "@shared/schema";

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
  "Content-Type": "application/json",
});

// ── Add / Edit Detailing Partner Modal ───────────────────────────────────────
function DetailingPartnerModal({
  partnerId,
  partnerShowrooms,
  editing,
  onClose,
  onSuccess,
}: {
  partnerId: string;
  partnerShowrooms: any[];
  editing: AppUser | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: editing?.username ?? "",
    name: editing?.name ?? "",
    email: editing?.email ?? "",
    phone: editing?.phone ?? "",
    password: "",
  });
  const [selectedShowrooms, setSelectedShowrooms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load existing showroom allocations when editing
  const { data: existingShowroomData } = useQuery({
    queryKey: ["/api/detailing-partner-showrooms", editing?.id],
    queryFn: async () => {
      if (!editing) return [];
      const r = await fetch(
        `/api/partners/${partnerId}/detailing-partners/${editing.id}/showrooms`,
        { headers: authHeaders(), credentials: "include" }
      );
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!editing,
  });

  // Sync fetched showroom IDs into state once loaded
  useEffect(() => {
    if (existingShowroomData && existingShowroomData.length > 0) {
      setSelectedShowrooms(existingShowroomData.map((s: any) => s.id));
    }
  }, [existingShowroomData]);

  // Fetch which showrooms are already taken by OTHER detailing partners.
  // When editing, exclude the current DP so their own allocations aren't blocked.
  const { data: takenAllocations = [] } = useQuery({
    queryKey: ["/api/detailing-partner-allocations", partnerId, editing?.id],
    queryFn: async () => {
      const url = editing
        ? `/api/partners/${partnerId}/detailing-partners/allocations?excludeUserId=${editing.id}`
        : `/api/partners/${partnerId}/detailing-partners/allocations`;
      const r = await fetch(url, { headers: authHeaders(), credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 0, // always fresh when modal opens
  });

  const takenShowroomIds = new Set<string>((takenAllocations as any[]).map((a: any) => a.showroomId));

  const toggleShowroom = (id: string) => {
    if (takenShowroomIds.has(id)) return; // already allocated to another DP
    setSelectedShowrooms(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!form.name || !form.username) {
      toast({ title: "Error", description: "Name and username are required", variant: "destructive" });
      return;
    }
    if (!editing && !form.password) {
      toast({ title: "Error", description: "Password is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/partners/${partnerId}/detailing-partners/${editing.id}`
        : `/api/partners/${partnerId}/detailing-partners`;
      const body: any = { ...form, showroomIds: selectedShowrooms };
      if (!form.password) delete body.password;

      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to save");
      }
      toast({ title: "Success", description: editing ? "Detailing partner updated" : "Detailing partner created" });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Detailing Partner" : "Add Detailing Partner"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="login username" disabled={!!editing} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{editing ? "New Password (leave blank to keep current)" : "Password *"}</Label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </div>

          {/* Showroom allocation */}
          <div className="space-y-2">
            <Label>Allocate Showrooms</Label>
            <p className="text-xs text-muted-foreground">Each showroom can only be assigned to one detailing partner at a time.</p>
            {partnerShowrooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No showrooms assigned to your partner account yet.</p>
            ) : (
              <div className="rounded-md border divide-y">
                {partnerShowrooms.map((s: any) => {
                  const taken = takenShowroomIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 px-3 py-2 ${taken ? "opacity-50 bg-muted/30" : ""}`}
                    >
                      <Checkbox
                        id={`sr-${s.id}`}
                        checked={selectedShowrooms.includes(s.id)}
                        onCheckedChange={() => toggleShowroom(s.id)}
                        disabled={taken}
                      />
                      <label
                        htmlFor={`sr-${s.id}`}
                        className={`flex-1 text-sm ${taken ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <span className="font-medium">{s.name}</span>
                        {s.city && <span className="text-muted-foreground ml-2">· {s.city}</span>}
                      </label>
                      {taken ? (
                        <Badge variant="secondary" className="text-xs text-orange-600">Allocated</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{s.code}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : editing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Showroom Chips for a detailing partner card ───────────────────────────────
function ShowroomBadges({ partnerId, userId }: { partnerId: string; userId: string }) {
  const { data: showrooms = [] } = useQuery({
    queryKey: ["/api/detailing-partner-showrooms", userId],
    queryFn: async () => {
      const r = await fetch(
        `/api/partners/${partnerId}/detailing-partners/${userId}/showrooms`,
        { headers: authHeaders(), credentials: "include" }
      );
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60000,
  });

  if (!showrooms.length) return <span className="text-xs text-muted-foreground">No showrooms</span>;
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DetailingPartnersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ dp: AppUser; type: "toggle" | "delete" } | null>(null);

  // Current user
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me", { headers: authHeaders(), credentials: "include" });
      if (!r.ok) throw new Error("Unauthorized");
      const d = await r.json();
      return d.user;
    },
  });

  const partnerId: string | undefined = currentUser?.partnerId;

  // Detailing partners list
  const { data: detailingPartners = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/partners", partnerId, "detailing-partners"],
    queryFn: async () => {
      if (!partnerId) return [];
      const r = await fetch(`/api/partners/${partnerId}/detailing-partners`, {
        headers: authHeaders(), credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch detailing partners");
      return r.json();
    },
    enabled: !!partnerId,
    staleTime: 30000,
  });

  // Partner's own showrooms (for the allocation picker)
  const { data: partnerShowrooms = [] } = useQuery({
    queryKey: ["/api/partners", partnerId, "showrooms"],
    queryFn: async () => {
      if (!partnerId) return [];
      const r = await fetch(`/api/partners/${partnerId}/showrooms`, {
        headers: authHeaders(), credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!partnerId,
    staleTime: 300000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "detailing-partners"] });

  const handleToggle = async (dp: AppUser) => {
    const action = dp.isActive ? "deactivate" : "activate";
    try {
      const r = await fetch(`/api/partners/${partnerId}/detailing-partners/${dp.id}`, {
        method: "PUT",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ isActive: !dp.isActive }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Success", description: `${dp.name} ${action}d` });
      invalidate();
    } catch {
      toast({ title: "Error", description: `Failed to ${action}`, variant: "destructive" });
    } finally {
      setConfirmAction(null);
    }
  };

  const handleDelete = async (dp: AppUser) => {
    try {
      const r = await fetch(`/api/partners/${partnerId}/detailing-partners/${dp.id}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      toast({ title: "Success", description: `${dp.name} removed` });
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } finally {
      setConfirmAction(null);
    }
  };

  const filtered = detailingPartners.filter(dp =>
    dp.name.toLowerCase().includes(search.toLowerCase()) ||
    dp.username.toLowerCase().includes(search.toLowerCase()) ||
    (dp.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const active = detailingPartners.filter(d => d.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Detailing Partners</h2>
        <p className="text-muted-foreground mt-1">Manage your detailing partners and their showroom allocations</p>
      </div>

      <Tabs defaultValue="detailing-partners">
        <TabsList className="mb-4">
          <TabsTrigger value="detailing-partners">
            <User className="h-4 w-4 mr-2" />
            Detailing Partners
          </TabsTrigger>
          <TabsTrigger value="work-orders">
            <ClipboardList className="h-4 w-4 mr-2" />
            Work Orders
          </TabsTrigger>
          <TabsTrigger value="job-cards">
            <CheckSquare className="h-4 w-4 mr-2" />
            Job Cards
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Detailing Partners ── */}
        <TabsContent value="detailing-partners">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <User className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{detailingPartners.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{active}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <UserX className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold">{detailingPartners.length - active}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search + Add */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, username or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={() => { setEditing(null); setShowModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Detailing Partner
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  {search ? "No results" : "No Detailing Partners"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {search ? "Try a different search term." : "Add your first detailing partner to get started."}
                </p>
                {!search && (
                  <Button onClick={() => { setEditing(null); setShowModal(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Detailing Partner
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(dp => (
                <Card key={dp.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{dp.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">@{dp.username}</p>
                        </div>
                      </div>
                      <Badge variant={dp.isActive ? "default" : "secondary"}>
                        {dp.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {dp.email && <p className="text-sm text-muted-foreground">{dp.email}</p>}
                    {dp.phone && <p className="text-sm text-muted-foreground">{dp.phone}</p>}

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Allocated Showrooms</p>
                      <ShowroomBadges partnerId={partnerId!} userId={dp.id} />
                    </div>

                    <div className="flex gap-2 pt-1 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => { setEditing(dp); setShowModal(true); }}>
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmAction({ dp, type: "toggle" })}>
                        {dp.isActive
                          ? <><UserX className="h-3 w-3 mr-1" />Deactivate</>
                          : <><UserCheck className="h-3 w-3 mr-1" />Activate</>}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                        onClick={() => setConfirmAction({ dp, type: "delete" })}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Work Orders ── */}
        <TabsContent value="work-orders">
          <Card>
            <CardContent className="p-8 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Work Orders</h3>
              <p className="text-sm text-muted-foreground mb-4">
                View all work orders across your detailing partners' allocated showrooms.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/work-orders"}>
                Open Work Orders
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Job Cards ── */}
        <TabsContent value="job-cards">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Job Cards</h3>
              <p className="text-sm text-muted-foreground mb-4">
                View all job cards assigned across your detailing partners.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/job-cards"}>
                Open Job Cards
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={open => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" ? "Remove Detailing Partner" : confirmAction?.dp.isActive ? "Deactivate" : "Activate"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? `This will deactivate "${confirmAction.dp.name}". They will no longer be able to log in.`
                : confirmAction?.dp.isActive
                  ? `Deactivate "${confirmAction?.dp.name}"? They won't be able to log in until reactivated.`
                  : `Reactivate "${confirmAction?.dp.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "delete" ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "delete") handleDelete(confirmAction.dp);
                else handleToggle(confirmAction.dp);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Modal */}
      {showModal && partnerId && (
        <DetailingPartnerModal
          partnerId={partnerId}
          partnerShowrooms={partnerShowrooms}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSuccess={() => { setShowModal(false); setEditing(null); invalidate(); }}
        />
      )}
    </div>
  );
}
