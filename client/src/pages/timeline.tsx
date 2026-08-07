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
import { Route, Search, Eye, CheckSquare, History, Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Job card statuses (jobCardStatusEnum) — the list's Status column shows the active job card's status.
const STATUS_OPTIONS = ['AWAITING_ACK', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_SALES_INVOICE', 'INVOICE_RAISED', 'WARRANTY_REGISTRATION', 'PAYMENT_PENDING', 'REWORK_PERMISSION_REQUESTED', 'REWORK_REQUESTED', 'CLOSED', 'NO_SHOW', 'CANCELLED_BY_CUSTOMER', 'CANCELLED', 'PARTS_PENDING', 'RESCHEDULED'];

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

const CATEGORY_ICON: Record<string, any> = {
  status: CheckSquare,
  audit: History,
  notification: Bell,
};

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
          <div className="space-y-3">
            {events.map((event: any, index: number) => {
              const Icon = CATEGORY_ICON[event.category] || History;
              const ChannelIcon = event.channel ? (CHANNEL_ICON[event.channel] || Bell) : null;
              return (
                <div key={index} className="flex gap-3 border-b pb-3 last:border-b-0">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
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
      if (status !== 'all' && wo.jobCardStatus !== status) return false;
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
                <TableHead>Job Card</TableHead>
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
                  <TableCell>{wo.jobCardStatus ? <Badge variant="outline">{wo.jobCardStatus.replace(/_/g, ' ')}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
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
