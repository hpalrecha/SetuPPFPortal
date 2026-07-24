import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, Search, Phone, Mail, MapPin, Car, Wrench, RotateCcw, Edit, ChevronLeft, ChevronRight, Package, Store, Calendar,
  ChevronUp, ChevronDown, ChevronsUpDown, ClipboardList, CheckSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
});

const PAGE_SIZE = 50;

// ---- small helpers -------------------------------------------------------
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const shortId = (id?: string | null) => (id ? id.slice(-6).toUpperCase() : '—');

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  APPROVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  REWORK_REQUESTED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-red-100 text-red-700',
};
const statusClass = (s?: string) => STATUS_COLORS[s || ''] || 'bg-slate-100 text-slate-700';

// Clickable, sortable column header. Shows an up/down arrow for the active column.
function SortHead({
  col, label, sortBy, sortDir, onSort, center,
}: { col: string; label: string; sortBy: string; sortDir: 'asc' | 'desc'; onSort: (c: string) => void; center?: boolean }) {
  const active = sortBy === col;
  return (
    <TableHead className={center ? 'text-center' : ''}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground font-semibold' : 'text-muted-foreground'} ${center ? 'justify-center w-full' : ''}`}
        data-testid={`sort-${col}`}
      >
        {label}
        {active
          ? (sortDir === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />)
          : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
      </button>
    </TableHead>
  );
}

// Render material consumption JSON in a readable way (object/array/string all handled).
function MaterialConsumption({ value }: { value: any }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  let data = value;
  if (typeof value === 'string') {
    try { data = JSON.parse(value); } catch { return <span>{value}</span>; }
  }
  // Planned material chosen up-front at rework time (from the Request Rework dialog).
  if (data && typeof data === 'object' && !Array.isArray(data) && ('plannedMaterial' in data || 'plannedQuantity' in data)) {
    const qty = data.plannedQuantity;
    return (
      <span className="text-amber-800">
        Planned: {data.plannedMaterial || '—'}{qty ? ` × ${qty}` : ''}
      </span>
    );
  }
  const entries: Array<[string, any]> = Array.isArray(data)
    ? data.map((v, i) => [String(i + 1), v])
    : (typeof data === 'object' ? Object.entries(data) : [['value', data]]);
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="text-xs space-y-0.5">
      {entries.map(([k, v]) => (
        <li key={k} className="flex gap-1">
          <span className="text-muted-foreground">{k}:</span>
          <span className="font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </li>
      ))}
    </ul>
  );
}

// Job-card statuses from which a rework may be requested (mirrors server REWORK_ALLOWED_FROM).
const REWORK_ALLOWED = new Set([
  'COMPLETED', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_SALES_INVOICE',
  'INVOICE_RAISED', 'WARRANTY_REGISTRATION', 'PAYMENT_PENDING', 'CLOSED',
]);

// ---- request rework dialog ----------------------------------------------
// Creates a new rework job card on the same work order, optionally pre-assigning a detailer and the
// roll/material to use. Backed by GET /rework-options and POST /request-rework.
function RequestReworkDialog({
  jobCard, open, onClose, onDone,
}: { jobCard: any | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [installerId, setInstallerId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: options } = useQuery<{ installers: any[]; materials: any[] }>({
    queryKey: ["/api/job-cards", jobCard?.id, "rework-options"],
    queryFn: async () => {
      const res = await fetch(`/api/job-cards/${jobCard!.id}/rework-options`, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load rework options');
      return res.json();
    },
    enabled: open && !!jobCard,
  });

  // Reset the form when a different job card is opened.
  const [lastId, setLastId] = useState<string | null>(null);
  if (open && jobCard && jobCard.id !== lastId) {
    setLastId(jobCard.id);
    setReason(''); setInstallerId(''); setMaterialId(''); setQuantity('');
  }

  const submit = async () => {
    if (!jobCard || !reason.trim()) { toast({ title: 'Reason is required', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const material = options?.materials.find((m) => m.id === materialId);
      const res = await fetch(`/api/job-cards/${jobCard.id}/request-rework`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          remarks: reason.trim(),
          assignedInstallerId: installerId || undefined,
          plannedMaterialId: materialId || undefined,
          plannedMaterialName: material?.name || undefined,
          plannedQuantity: quantity ? Number(quantity) : undefined,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Rework request failed'); }
      toast({ title: 'Rework requested', description: 'A new rework job card was created on the same work order.' });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: 'Rework request failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request rework</DialogTitle>
          <DialogDescription>
            Creates a new job card on the same work order, linked to JC-{shortId(jobCard?.id)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason <span className="text-red-500">*</span></Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="What needs to be redone?"
              data-testid="input-rework-reason"
            />
          </div>
          <div>
            <Label>Assign detailer / installer</Label>
            <select
              value={installerId}
              onChange={(e) => setInstallerId(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="select-rework-installer"
            >
              <option value="">— Leave unassigned —</option>
              {options?.installers.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.role === 'DETAILING_PARTNER' ? 'Detailer' : 'Installer'})</option>
              ))}
            </select>
            {options && options.installers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No detailers registered under this partner — assign later from Job Cards.</p>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Roll / material</Label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-rework-material"
              >
                <option value="">— Not specified —</option>
                {options?.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="w-28">
              <Label>Qty</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1"
                placeholder="e.g. 5"
                data-testid="input-rework-quantity"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} data-testid="button-submit-rework">
            {submitting ? 'Requesting…' : 'Request rework'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- customer detail dialog ---------------------------------------------
function CustomerDetailDialog({
  entityKey, open, onClose, onEdit,
}: { entityKey: string | null; open: boolean; onClose: () => void; onEdit: (c: any) => void }) {
  const queryClient = useQueryClient();
  const [reworkCard, setReworkCard] = useState<any | null>(null);
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/customers", entityKey],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${encodeURIComponent(entityKey!)}`, {
        headers: authHeaders(), credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch customer');
      return res.json();
    },
    enabled: open && !!entityKey,
  });

  const customer = data?.customer;
  const visits: any[] = data?.visits || [];

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {customer?.name || 'Customer'}
          </DialogTitle>
          <DialogDescription>Visit history, jobs and rework for this customer.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : !customer ? (
          <div className="py-10 text-center text-muted-foreground">No data.</div>
        ) : (
          <div className="space-y-4">
            {/* Contact + stats */}
            <div className="flex flex-wrap items-start justify-between gap-3 border rounded-lg p-3">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{customer.phone || '—'}</div>
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{customer.email || '—'}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{customer.address || '—'}</div>
              </div>
              <div className="flex gap-4 text-center">
                <div><div className="text-lg font-bold">{customer.workOrderCount}</div><div className="text-xs text-muted-foreground">Work Orders</div></div>
                <div><div className="text-lg font-bold">{customer.jobCount}</div><div className="text-xs text-muted-foreground">Jobs</div></div>
                <div><div className="text-lg font-bold text-amber-600">{customer.reworkCount}</div><div className="text-xs text-muted-foreground">Reworks</div></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => onEdit(customer)} data-testid="button-edit-customer">
                <Edit className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              First seen {fmtDate(customer.firstVisit)} · Last seen {fmtDate(customer.lastVisit)}
            </div>
            {/* How to read this view */}
            <div className="text-xs bg-muted/50 rounded-md p-2 leading-relaxed">
              Each <span className="font-medium">Work Order</span> below is a separate time this customer came in
              (a new booking → new work order + new job). A <span className="font-medium text-amber-700">Rework</span> is
              a re-do of a job on the <span className="font-medium">same</span> work order — a new job card linked back to the original.
            </div>

            {/* Visit timeline */}
            <div className="space-y-3">
              {visits.map((v, i) => {
                // visits are newest-first; number them chronologically (oldest = Work Order 1).
                const woNumber = visits.length - i;
                // Show the original job first, then its rework(s).
                const orderedCards = [...v.jobCards].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const woReworkCount = orderedCards.filter((jc: any) => jc.isRework).length;
                return (
                <div key={v.workOrderId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">Work Order {woNumber}</span>
                      <span className="text-sm text-muted-foreground">· {fmtDate(v.createdAt)}</span>
                      <Badge className={statusClass(v.status)}>{v.status}</Badge>
                      {woReworkCount > 0 && (
                        <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" /> {woReworkCount} rework{woReworkCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">WO-{shortId(v.workOrderId)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {v.service && <span className="flex items-center gap-1"><Wrench className="h-3.5 w-3.5 text-muted-foreground" />{v.service.name}</span>}
                    {v.vehicle && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5 text-muted-foreground" />{v.vehicle.name}{v.variant ? ` (${v.variant})` : ''}</span>}
                    {v.regNo && <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{v.regNo}</span>}
                    {v.showroom && <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5 text-muted-foreground" />{v.showroom.name}</span>}
                  </div>

                  {/* Job cards for this work order (original → rework) */}
                  <div className="space-y-2 pl-2 border-l-2 border-muted mt-2">
                    {orderedCards.length === 0 && <div className="text-xs text-muted-foreground">No job card yet.</div>}
                    {orderedCards.map((jc: any) => (
                      <div key={jc.id} className={`rounded-md p-2 text-sm ${jc.isRework ? 'bg-amber-50 border border-amber-200 ml-3' : 'bg-muted/40'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {jc.isRework
                              ? <span className="flex items-center gap-1 text-xs font-medium text-amber-800"><CheckSquare className="h-3.5 w-3.5" />↳ Rework job</span>
                              : <span className="flex items-center gap-1 text-xs font-medium"><CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />Original job</span>}
                            <span className="font-mono text-xs">JC-{shortId(jc.id)}</span>
                            <Badge className={statusClass(jc.status)}>{jc.status}</Badge>
                            {jc.isRework && (
                              <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                                <RotateCcw className="h-3 w-3" /> redo of JC-{shortId(jc.reworkOfJobCardId)}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{fmtDate(jc.completedAt || jc.createdAt)}</span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
                          <div><span className="text-muted-foreground">Partner: </span>{jc.partner?.name || '—'}</div>
                          <div><span className="text-muted-foreground">Detailer / Installer: </span>{jc.assignedInstaller?.name || <span className="text-amber-600">Unassigned</span>}</div>
                          <div className="flex items-start gap-1">
                            <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                            <div><span className="text-muted-foreground">Material: </span><MaterialConsumption value={jc.materialConsumption} /></div>
                          </div>
                          {jc.batchNumbers && <div><span className="text-muted-foreground">Batch: </span>{jc.batchNumbers}</div>}
                        </div>
                        {jc.reworkReason && (
                          <div className="mt-1 text-xs text-amber-800">
                            <span className="font-medium">Rework reason: </span>{jc.reworkReason}
                          </div>
                        )}
                        {REWORK_ALLOWED.has(jc.status) && (
                          <div className="mt-2 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                              onClick={() => setReworkCard(jc)}
                              data-testid={`button-request-rework-${jc.id}`}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Request rework
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <RequestReworkDialog
      jobCard={reworkCard}
      open={!!reworkCard}
      onClose={() => setReworkCard(null)}
      onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/customers"] })}
    />
    </>
  );
}

// ---- edit customer dialog ------------------------------------------------
function EditCustomerDialog({
  customer, open, onClose, onSaved,
}: { customer: any | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' });
  const [saving, setSaving] = useState(false);

  // Sync form when a customer is opened for editing.
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (open && customer && customer.key !== lastKey) {
    setLastKey(customer.key);
    setForm({
      customerName: customer.name || '',
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
      customerAddress: customer.address || '',
    });
  }

  const save = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customer.key)}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      const result = await res.json();
      toast({ title: 'Customer updated', description: result.message });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>Changes apply to all work orders for this customer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} data-testid="input-customer-name" /></div>
          <div><Label>Phone</Label><Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} data-testid="input-customer-phone" /></div>
          <div><Label>Email</Label><Input value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} data-testid="input-customer-email" /></div>
          <div><Label>Address</Label><Input value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} data-testid="input-customer-address" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-customer">{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- page ----------------------------------------------------------------
export default function CustomersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [onlyRepeat, setOnlyRepeat] = useState(false);
  const [onlyRework, setOnlyRework] = useState(false);
  const [sortBy, setSortBy] = useState<string>('lastVisit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pageRework, setPageRework] = useState<any | null>(null);

  // Click a column header: first click sorts descending, second toggles to ascending.
  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(0);
  };

  const { data, isLoading } = useQuery<{ customers: any[]; total: number; totalWorkOrders: number }>({
    queryKey: ["/api/customers", search, page, sortBy, sortDir, onlyRepeat, onlyRework],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE), sortBy, sortDir });
      if (search) params.set('search', search);
      if (onlyRepeat) params.set('onlyRepeat', 'true');
      if (onlyRework) params.set('onlyRework', 'true');
      const res = await fetch(`/api/customers?${params.toString()}`, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
    enabled: canAccess,
  });

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalWorkOrders = data?.totalWorkOrders || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openDetail = (key: string) => { setSelectedKey(key); setDetailOpen(true); };
  const openEdit = (customer: any) => { setEditCustomer(customer); setEditOpen(true); };
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Access restricted. Customer Management is available to admins only.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Customer Management</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Each row is a <span className="font-medium">customer</span> (grouped by phone). A
        <span className="font-medium"> Work Order</span> is one time they came in — more than one means a
        repeat customer (<Badge className="bg-blue-100 text-blue-800 text-[10px] align-middle">Repeat</Badge>).
        Orders entered without a phone can't be grouped, so each shows as a
        <Badge variant="secondary" className="text-[10px] align-middle"> single work order</Badge>.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {total} customer{total === 1 ? '' : 's'}
              <span className="ml-2 font-normal text-sm text-muted-foreground">across {totalWorkOrders} work order{totalWorkOrders === 1 ? '' : 's'}</span>
            </CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, reg no…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8"
                data-testid="input-search-customers"
              />
            </div>
          </div>
          {/* Quick filters */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <Button
              variant={onlyRepeat ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setOnlyRepeat((v) => !v); setPage(0); }}
              data-testid="filter-repeat"
            >
              <Users className="h-3 w-3 mr-1" /> Repeat customers
            </Button>
            <Button
              variant={onlyRework ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-xs ${onlyRework ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-800 border-amber-300 hover:bg-amber-50'}`}
              onClick={() => { setOnlyRework((v) => !v); setPage(0); }}
              data-testid="filter-rework"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Has rework
            </Button>
            {(onlyRepeat || onlyRework) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => { setOnlyRepeat(false); setOnlyRework(false); setPage(0); }}
                data-testid="filter-clear"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead col="name" label="Customer" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <TableHead>Phone</TableHead>
                <SortHead col="workOrders" label="Work Orders" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} center />
                <SortHead col="jobs" label="Jobs" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} center />
                <SortHead col="reworks" label="Reworks" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} center />
                <TableHead>Latest job</TableHead>
                <SortHead col="lastVisit" label="Last visit" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No customers found.</TableCell></TableRow>
              ) : customers.map((c) => {
                const hasPhone = !!c.customerPhone;
                const canRework = !!c.latestJobCardId && REWORK_ALLOWED.has(c.latestJobStatus);
                return (
                <TableRow
                  key={c.groupKey}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(c.groupKey)}
                  data-testid={`row-customer-${c.groupKey}`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {c.customerName || <span className="text-muted-foreground">Unnamed</span>}
                      {/* Differentiate a repeat customer from a one-off, and a phone-less standalone work order */}
                      {!hasPhone
                        ? <Badge variant="secondary" className="text-[10px]">single work order</Badge>
                        : c.workOrderCount > 1
                          ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">Repeat · {c.workOrderCount} visits</Badge>
                          : <Badge variant="secondary" className="text-[10px]">Customer</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{c.customerPhone || <span className="text-muted-foreground italic">no phone</span>}</TableCell>
                  <TableCell className="text-center">{c.workOrderCount}</TableCell>
                  <TableCell className="text-center">{c.jobCount}</TableCell>
                  <TableCell className="text-center">
                    {c.reworkCount > 0
                      ? <Badge className="bg-amber-100 text-amber-800">{c.reworkCount}</Badge>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell>
                    {c.latestJobStatus
                      ? <Badge className={statusClass(c.latestJobStatus)}>{c.latestJobStatus}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{fmtDate(c.lastVisit)}</TableCell>
                  <TableCell className="text-right">
                    {canRework ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                        onClick={(e) => { e.stopPropagation(); setPageRework({ id: c.latestJobCardId, status: c.latestJobStatus }); }}
                        data-testid={`row-rework-${c.groupKey}`}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Rework
                      </Button>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CustomerDetailDialog
        entityKey={selectedKey}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={openEdit}
      />
      <EditCustomerDialog
        customer={editCustomer}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
      />
      <RequestReworkDialog
        jobCard={pageRework}
        open={!!pageRework}
        onClose={() => setPageRework(null)}
        onDone={refresh}
      />
    </div>
  );
}
