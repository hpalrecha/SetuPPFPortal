import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Route, Search, Eye, CheckSquare, ClipboardList, Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Work order statuses (workOrderStatusEnum) — the list's Status column shows the work order status.
const STATUS_OPTIONS = ['PENDING', 'DRAFT', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED_PENDING_APPROVAL', 'APPROVED', 'CLOSED', 'CANCELLED', 'REWORK_REQUESTED'];

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  PUSH: 'In-app',
};

const CHANNEL_ICON: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
  PUSH: Bell,
};

// Each timeline event is colour-coded into one of three kinds so the trail is
// scannable at a glance: job-card progress (blue), work-order-level actions
// (purple), and notifications sent (green).
type EventKind = 'job_card' | 'work_order' | 'notification';

const EVENT_META: Record<EventKind, { icon: any; label: string; dot: string; chip: string; border: string }> = {
  job_card: {
    icon: CheckSquare,
    label: 'Job card',
    dot: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    border: 'border-l-blue-400 dark:border-l-blue-500',
  },
  work_order: {
    icon: ClipboardList,
    label: 'Work order',
    dot: 'bg-purple-500',
    chip: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    border: 'border-l-purple-400 dark:border-l-purple-500',
  },
  notification: {
    icon: Bell,
    label: 'Notification',
    dot: 'bg-green-500',
    chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    border: 'border-l-green-400 dark:border-l-green-500',
  },
};

// A notification is always green; anything tagged "Work Order" is a work-order
// action (purple); everything else is job-card progress (blue).
function eventKind(event: any): EventKind {
  if (event.category === 'notification') return 'notification';
  if (event.jobCardTag === 'Work Order') return 'work_order';
  return 'job_card';
}

function TimelineModal({ workOrderId, open, onClose }: { workOrderId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/work-orders', workOrderId, 'timeline'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/work-orders/${workOrderId}/timeline`);
      return res.json();
    },
    enabled: open && !!workOrderId,
  });

  const events = data?.events || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Timeline{data?.workOrder?.regNo ? ` — ${data.workOrder.regNo}` : ''}
          </DialogTitle>
          <DialogDescription>{data?.workOrder?.customerName || ''}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No timeline events yet.</div>
        ) : (
          <div>
            {/* Colour legend so it's clear what each event kind is */}
            <div className="flex flex-wrap items-center gap-4 pb-3 mb-3 border-b text-xs text-muted-foreground">
              {(Object.keys(EVENT_META) as EventKind[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${EVENT_META[k].dot}`} />
                  {EVENT_META[k].label}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              {events.map((event: any, index: number) => {
                const kind = eventKind(event);
                const meta = EVENT_META[kind];
                const Icon = meta.icon;
                const ChannelIcon = event.channel ? (CHANNEL_ICON[event.channel] || Bell) : null;
                return (
                  <div key={index} className={`flex gap-3 border-l-4 ${meta.border} pl-3 py-1`}>
                    <span className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${meta.chip}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{event.label}</span>
                        <Badge variant="outline" className="text-xs">{event.jobCardTag}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(event.timestamp)} · {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </div>
                      {event.category === 'notification' && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {ChannelIcon && <ChannelIcon className="h-3 w-3" />}
                          Sent to {event.recipientName || 'unknown recipient'} via {CHANNEL_LABEL[event.channel] || event.channel}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TimelinePage() {
  const { user } = useAuth();
  const canAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showroom, setShowroom] = useState('all');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['/api/work-orders'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/work-orders');
      return res.json();
    },
    enabled: canAccess,
  });

  const workOrders = data || [];

  // Distinct showroom names present in the loaded work orders, for the filter dropdown.
  const showroomOptions = useMemo(() => {
    const names = new Set<string>();
    for (const wo of workOrders) {
      if (wo.showroomName) names.add(wo.showroomName);
    }
    return Array.from(names).sort();
  }, [workOrders]);

  const filtered = useMemo(() => {
    return workOrders.filter((wo) => {
      if (status !== 'all' && wo.status !== status) return false;
      if (showroom !== 'all' && wo.showroomName !== showroom) return false;
      if (search) {
        const term = search.toLowerCase();
        const haystack = [wo.regNo, wo.customerName, wo.customerPhone, wo.showroomName, wo.id].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [workOrders, search, status, showroom]);

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Access restricted. Timeline is available to admins only.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Route className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Timeline</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        The full trail for a work order and every job card in its rework chain — status changes,
        admin actions, and notifications — in one place. Click the eye icon to view.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{filtered.length} work order{filtered.length === 1 ? '' : 's'}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={showroom} onValueChange={setShowroom}>
                <SelectTrigger className="w-48" data-testid="filter-showroom"><SelectValue placeholder="Showroom" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All showrooms</SelectItem>
                  {showroomOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reg no, customer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-timeline"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Showroom</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No work orders found.</TableCell></TableRow>
              ) : filtered.map((wo) => (
                <TableRow key={wo.id} data-testid={`row-work-order-${wo.id}`}>
                  <TableCell className="font-mono text-sm">{wo.regNo || '—'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{wo.customerName || <span className="text-muted-foreground">—</span>}</div>
                    <div className="text-xs text-muted-foreground">{wo.customerPhone || '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm">{wo.showroomName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><Badge variant="outline">{wo.status}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(wo.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedWorkOrderId(wo.id)}
                      data-testid={`button-view-timeline-${wo.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TimelineModal
        workOrderId={selectedWorkOrderId}
        open={!!selectedWorkOrderId}
        onClose={() => setSelectedWorkOrderId(null)}
      />
    </div>
  );
}
