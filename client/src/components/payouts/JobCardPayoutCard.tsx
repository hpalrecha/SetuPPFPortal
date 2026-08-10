import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wrench } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// One Payout Settlement card = one completed job card and its per-team payout lines.
// Team lines come frozen (single team) or blank (multi team, split by roll); rework lines
// are added by hand. Every amount / paid-by is editable here — nothing is recomputed.

interface Line {
  id: string;
  staffUserId: string;
  staffName: string | null;
  teamType: string | null;
  lineType: "TEAM" | "REWORK";
  paidByParty: string | null;
  rollUsedSqft: string | null;
  amount: string | null;
  amountSource: string | null;
  note: string | null;
}

interface Card {
  jobCardId: string;
  status: string;
  regNo: string | null;
  customerName: string | null;
  showroomName: string | null;
  serviceName: string | null;
  vehicleModelName: string | null;
  billingParty: { type: string; name: string };
  lines: Line[];
}

const inr = (v: string | null) =>
  v == null || v === ""
    ? null
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v));

// Team type → who bills / is paid (see billing rules).
function billingDirection(teamType: string | null): { label: string; cls: string } {
  switch (teamType) {
    case "COMPANY": return { label: "we bill the partner", cls: "text-sky-700" };
    case "PARTNER": return { label: "partner bills us", cls: "text-amber-700" };
    case "FREELANCE": return { label: "we pay directly", cls: "text-green-700" };
    default: return { label: "team type not set", cls: "text-red-600" };
  }
}

const teamTypeLabel = (t: string | null) =>
  t === "COMPANY" ? "Company" : t === "PARTNER" ? "Partner" : t === "FREELANCE" ? "Freelance" : "—";

export function JobCardPayoutCard({ card, onChanged }: { card: Card; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [addingRework, setAddingRework] = useState(false);
  // draft rework line
  const [rwStaff, setRwStaff] = useState("");
  const [rwAmount, setRwAmount] = useState("");
  const [rwPaidBy, setRwPaidBy] = useState("");
  const [rwNote, setRwNote] = useState("");

  // Staff options for a rework line: the teams already on this card.
  const teamOptions = Array.from(
    new Map(card.lines.filter((l) => l.staffName).map((l) => [l.staffUserId, l.staffName])).entries()
  );

  const patchLine = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await apiRequest("PATCH", `/api/job-card-payout-lines/${id}`, body);
      onChanged();
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteLine = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest("DELETE", `/api/job-card-payout-lines/${id}`);
      onChanged();
    } catch (e: any) {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addRework = async () => {
    if (!rwStaff) { toast({ title: "Pick a team member for the rework", variant: "destructive" }); return; }
    setBusy(true);
    try {
      await apiRequest("POST", `/api/job-cards/${card.jobCardId}/payout-lines`, {
        staffUserId: rwStaff,
        amount: rwAmount || undefined,
        paidByParty: rwPaidBy || undefined,
        note: rwNote || undefined,
      });
      setAddingRework(false);
      setRwStaff(""); setRwAmount(""); setRwPaidBy(""); setRwNote("");
      onChanged();
    } catch (e: any) {
      toast({ title: "Could not add rework", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const total = card.lines.reduce((s, l) => s + (l.amount ? Number(l.amount) : 0), 0);
  const anyBlank = card.lines.some((l) => l.amount == null || l.amount === "");
  const teamCount = card.lines.filter((l) => l.lineType === "TEAM").length;

  return (
    <div className="border rounded-lg bg-card" data-testid={`payout-card-${card.jobCardId.slice(-6)}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 border-b">
        <div>
          <div className="font-mono text-sm font-semibold">
            JC-{card.jobCardId.slice(-6)} · {card.vehicleModelName || "Vehicle"} {card.regNo ? `· ${card.regNo}` : ""}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {[card.showroomName, card.serviceName, card.customerName].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">WO by: {card.billingParty.name}</Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">{card.status}</Badge>
          {teamCount > 1 && <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">{teamCount} teams · manual split</Badge>}
        </div>
      </div>

      {/* Lines */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 620 }}>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
              <th className="py-2 px-4">Line</th>
              <th className="py-2 px-4">Team</th>
              <th className="py-2 px-4">Type → billing</th>
              <th className="py-2 px-4">Roll</th>
              <th className="py-2 px-4 text-right">Amount</th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {card.lines.map((l) => {
              const dir = billingDirection(l.teamType);
              return (
                <tr key={l.id} className="border-b last:border-0" data-testid={`payout-line-${l.id.slice(-6)}`}>
                  <td className="py-2.5 px-4">
                    {l.lineType === "REWORK" ? (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 text-[10px]"><Wrench className="h-2.5 w-2.5 mr-1" />Rework</Badge>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] ${l.amountSource === "MATRIX" ? "bg-gray-50 text-gray-600" : "bg-amber-50 text-amber-700"}`}>
                        {l.amountSource === "MATRIX" ? "Frozen" : "Manual"}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {l.staffName || "—"}
                    {l.note && <div className="text-xs text-muted-foreground">{l.note}</div>}
                  </td>
                  <td className="py-2.5 px-4">
                    {l.lineType === "REWORK" ? (
                      <Select value={l.paidByParty || ""} onValueChange={(v) => patchLine(l.id, { paidByParty: v })}>
                        <SelectTrigger className="h-8 w-[150px]" data-testid={`select-paidby-${l.id.slice(-6)}`}>
                          <SelectValue placeholder="Paid by…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMPANY">Paid by Company</SelectItem>
                          <SelectItem value="PARTNER">Paid by Partner</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs">
                        <Badge variant="outline" className="text-[10px] mr-1">{teamTypeLabel(l.teamType)}</Badge>
                        <span className={dir.cls}>→ {dir.label}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs tabular-nums">{l.rollUsedSqft ? `${l.rollUsedSqft} sqft` : "—"}</td>
                  <td className="py-2.5 px-4">
                    <Input
                      // key includes the server amount so the (uncontrolled) input remounts
                      // with the fresh value after a refetch instead of keeping a stale DOM value.
                      key={`${l.id}-${l.amount ?? ""}`}
                      type="number"
                      defaultValue={l.amount ?? ""}
                      placeholder="enter ₹"
                      className="h-8 w-28 ml-auto text-right"
                      data-testid={`input-amount-${l.id.slice(-6)}`}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if ((v || "") !== (l.amount ?? "")) patchLine(l.id, { amount: v === "" ? null : v });
                      }}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {l.lineType === "REWORK" && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => deleteLine(l.id)} data-testid={`button-delete-line-${l.id.slice(-6)}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={4} className="py-2.5 px-4">Total{anyBlank ? " (some amounts pending)" : ""}</td>
              <td className="py-2.5 px-4 text-right tabular-nums">{inr(String(total))}{anyBlank ? " +" : ""}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add rework */}
      <div className="p-3 border-t">
        {addingRework ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Team member</span>
              <Select value={rwStaff} onValueChange={setRwStaff}>
                <SelectTrigger className="h-8 w-[170px]" data-testid="select-rework-staff"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {teamOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Amount</span>
              <Input type="number" value={rwAmount} onChange={(e) => setRwAmount(e.target.value)} placeholder="₹" className="h-8 w-24" data-testid="input-rework-amount" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Paid by</span>
              <Select value={rwPaidBy} onValueChange={setRwPaidBy}>
                <SelectTrigger className="h-8 w-[140px]" data-testid="select-rework-paidby"><SelectValue placeholder="Company / Partner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">Company</SelectItem>
                  <SelectItem value="PARTNER">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <span className="text-xs text-muted-foreground">Note</span>
              <Input value={rwNote} onChange={(e) => setRwNote(e.target.value)} placeholder="e.g. bumper redo" className="h-8" data-testid="input-rework-note" />
            </div>
            <Button size="sm" disabled={busy} onClick={addRework} data-testid="button-save-rework">Add</Button>
            <Button size="sm" variant="outline" onClick={() => setAddingRework(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAddingRework(true)} data-testid={`button-add-rework-${card.jobCardId.slice(-6)}`}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add rework line
          </Button>
        )}
      </div>
    </div>
  );
}
