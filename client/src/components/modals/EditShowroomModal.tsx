import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin } from "lucide-react";
import type { User as StaffUser } from "@shared/schema";

const authHeaders = () => ({
  "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
  "Content-Type": "application/json",
});

interface EditShowroomModalProps {
  partnerId: string;
  staff: StaffUser;
  onClose: () => void;
  onSuccess: () => void;
}

// One showroom can only be assigned to one staff member (installer or
// detailing partner) at a time within a partner — enforced both here
// (greyed-out / disabled options) and server-side (409 on conflict).
export function EditShowroomModal({ partnerId, staff, onClose, onSuccess }: EditShowroomModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Partner's own showrooms (direct, allocated, or cascaded from a dealership allocation)
  const { data: partnerShowrooms = [], isLoading: loadingShowrooms } = useQuery({
    queryKey: ["/api/partners", partnerId, "showrooms"],
    queryFn: async () => {
      const r = await fetch(`/api/partners/${partnerId}/showrooms`, {
        headers: authHeaders(),
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60000,
  });

  // This staff member's current assignment
  const { data: currentShowrooms, isLoading: loadingCurrent } = useQuery({
    queryKey: ["/api/partners", partnerId, "staff", staff.id, "showrooms"],
    queryFn: async () => {
      const r = await fetch(`/api/partners/${partnerId}/staff/${staff.id}/showrooms`, {
        headers: authHeaders(),
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Showrooms already assigned to OTHER staff members of this partner
  const { data: takenAllocations = [] } = useQuery({
    queryKey: ["/api/partners", partnerId, "staff-showroom-allocations", staff.id],
    queryFn: async () => {
      const r = await fetch(
        `/api/partners/${partnerId}/staff-showroom-allocations?excludeUserId=${staff.id}`,
        { headers: authHeaders(), credentials: "include" }
      );
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (currentShowrooms) {
      setSelected(currentShowrooms.map((s: any) => s.id));
    }
  }, [currentShowrooms]);

  const takenIds = useMemo(
    () => new Set<string>((takenAllocations as any[]).map((a: any) => a.showroomId)),
    [takenAllocations]
  );

  const filteredShowrooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return partnerShowrooms;
    return partnerShowrooms.filter((s: any) =>
      s.name?.toLowerCase().includes(term) || s.city?.toLowerCase().includes(term)
    );
  }, [partnerShowrooms, search]);

  const toggle = (id: string) => {
    if (takenIds.has(id)) return;
    setSelected(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/partners/${partnerId}/staff/${staff.id}/showrooms`, {
        method: "PUT",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ showroomIds: selected }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        if (r.status === 409 && err.conflicts) {
          throw new Error("Some showrooms were just taken by another staff member. Please refresh and try again.");
        }
        throw new Error(err.error || "Failed to update showrooms");
      }
      toast({ title: "Success", description: `Showrooms updated for ${staff.name}` });
      queryClient.invalidateQueries({ queryKey: ["/api/partners", partnerId, "staff", staff.id, "showrooms"] });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingShowrooms || loadingCurrent;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Showrooms</DialogTitle>
          <DialogDescription>
            Assign showrooms to <span className="font-medium">{staff.name}</span>. Each showroom can only be assigned to one staff member at a time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search showrooms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-showrooms"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filteredShowrooms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {partnerShowrooms.length === 0
                ? "No showrooms allocated to your partner account yet."
                : "No showrooms match your search."}
            </p>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                {filteredShowrooms.map((s: any) => {
                  const taken = takenIds.has(s.id);
                  return (
                    <label
                      key={s.id}
                      htmlFor={`showroom-${s.id}`}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        taken ? "opacity-50 cursor-not-allowed bg-muted/30" : "cursor-pointer hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        id={`showroom-${s.id}`}
                        checked={selected.includes(s.id)}
                        onCheckedChange={() => toggle(s.id)}
                        disabled={taken}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="font-medium block truncate">{s.name}</span>
                        {s.city && <span className="text-xs text-muted-foreground">{s.city}</span>}
                      </span>
                      {taken && (
                        <Badge variant="secondary" className="text-xs shrink-0 text-orange-600">
                          Assigned
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map((id) => {
                const s = partnerShowrooms.find((p: any) => p.id === id);
                if (!s) return null;
                return (
                  <Badge key={id} variant="outline" className="text-xs">
                    <MapPin className="h-2.5 w-2.5 mr-1" />{s.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading} data-testid="button-save-showrooms">
            {saving ? "Saving..." : "Save Showrooms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
