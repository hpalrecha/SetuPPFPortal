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
import {
  Route, Search, Eye, Wrench, ClipboardList, Bell, Mail, MessageCircle, Smartphone,
  Send, CheckCircle2, Clock, RotateCcw, MapPin, Camera, Play, AlertTriangle, ShieldCheck,
  FileText, BellOff, ArrowUpRight, Sparkles,
} from "lucide-react";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Groups a same-day cluster under "Today" / "Yesterday" / a full date — this is
// what actually answers "what happened and when" at a glance, rather than a
// timestamp buried in every row.
const dayLabel = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

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

// Each timeline event is one of three kinds, told apart by dot colour + icon
// shape (not colour alone): job-card progress, work-order-level actions, and
// notifications sent.
type EventKind = 'job_card' | 'work_order' | 'notification';

const EVENT_META: Record<EventKind, { icon: any; label: string; ring: string; dotClass: string }> = {
  job_card: {
    icon: Wrench,
    label: 'Job card',
    ring: '#2563eb',
    dotClass: 'bg-blue-600 dark:bg-blue-500',
  },
  work_order: {
    icon: ClipboardList,
    label: 'Work order',
    ring: '#7c3aed',
    dotClass: 'bg-violet-600 dark:bg-violet-500',
  },
  notification: {
    icon: Bell,
    label: 'Notification',
    ring: '#059669',
    dotClass: 'bg-emerald-600 dark:bg-emerald-500',
  },
};

// A notification is always green; anything tagged "Work Order" is a work-order
// action (violet); everything else is job-card progress (blue).
function eventKind(event: any): EventKind {
  if (event.category === 'notification') return 'notification';
  if (event.jobCardTag === 'Work Order') return 'work_order';
  return 'job_card';
}

// Consecutive same-day runs — events already arrive sorted ascending, so a
// single pass is enough (no need to bucket + re-sort).
function groupByDay(events: any[]): { day: string; items: any[] }[] {
  const groups: { day: string; items: any[] }[] = [];
  for (const event of events) {
    const day = dayLabel(event.timestamp);
    const current = groups[groups.length - 1];
    if (current && current.day === day) {
      current.items.push(event);
    } else {
      groups.push({ day, items: [event] });
    }
  }
  return groups;
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
  const dayGroups = useMemo(() => groupByDay(events), [events]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            {data?.workOrder?.regNo || 'Timeline'}
          </DialogTitle>
          <DialogDescription>{data?.workOrder?.customerName || ''}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No timeline events yet.</div>
        ) : (
          <div>
            {dayGroups.map((group) => (
              <div key={group.day}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-4 pb-2 first:pt-0">
                  {group.day}
                </div>
                {group.items.map((event, i) => {
                  const kind = eventKind(event);
                  const meta = EVENT_META[kind];
                  const Icon = meta.icon;
                  const ChannelIcon = event.channel ? (CHANNEL_ICON[event.channel] || Bell) : null;
                  const isLast = i === group.items.length - 1;
                  return (
                    <div key={i} className="relative flex gap-3 pb-5 last:pb-0">
                      {/* connecting rail, one continuous line per day-group */}
                      {!isLast && (
                        <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
                      )}
                      <span
                        className={`relative z-10 h-7 w-7 shrink-0 rounded-full flex items-center justify-center ring-4 ring-background ${meta.dotClass}`}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </span>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium leading-tight">{event.label}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{fmtTime(event.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span
                            className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ color: meta.ring, backgroundColor: `${meta.ring}1a` }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{event.jobCardTag}</span>
                        </div>
                        {event.category === 'notification' && (
                          <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full px-2 py-1">
                            {ChannelIcon && <ChannelIcon className="h-3 w-3" />}
                            Sent to <span className="font-medium">{event.recipientName || 'unknown recipient'}</span> via {CHANNEL_LABEL[event.channel] || event.channel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Flow Blueprint — a designed, in-app rendering of the full job-card lifecycle
// notification/status flow (the "understanding"): every stage, who is notified,
// on which channel, and which build cluster it belongs to. New capabilities
// (Reschedule, Reached, time-based reminders, eye button) are marked NEW.
// ---------------------------------------------------------------------------

type Side = 'supply' | 'demand';
type Channel = 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'SMS';

interface Recipient { role: string; side: Side; channels: Channel[] }
interface Stage {
  id: string;
  title: string;
  status?: string;
  icon: any;
  accent: string;      // dot + status tint
  cluster: 1 | 2 | 3;
  isNew?: boolean;
  trigger: string;
  recipients: Recipient[];   // empty ⇒ no notification
  note?: string;
}

// Supply = the people doing the work (partner / installer / super-admin fallback).
// Demand = the people who own the car (showroom / salesperson / customer).
const SIDE_META: Record<Side, { label: string; color: string }> = {
  supply: { label: 'Supply', color: '#2563eb' },
  demand: { label: 'Demand', color: '#7c3aed' },
};

// Build phasing, colour-coded so the reader sees what ships first.
const CLUSTER_META: Record<1 | 2 | 3, { label: string; color: string }> = {
  1: { label: 'Cluster 1 · Notifications + fixes', color: '#059669' },
  2: { label: 'Cluster 2 · Reschedule + Reached', color: '#d97706' },
  3: { label: 'Cluster 3 · Reminders + eye button', color: '#0284c7' },
};

const FLOW: Stage[] = [
  {
    id: 'wo_created', title: 'Work Order created', status: 'DRAFT', icon: ClipboardList, accent: '#7c3aed', cluster: 1,
    trigger: 'Salesperson / Showroom / Partner Admin / Super Admin creates the work order.',
    recipients: [],
    note: 'Fix #1 — a Partner Admin’s own draft now appears in his Work Orders list (it was hidden because assignedPartnerId was null).',
  },
  {
    id: 'wo_assigned', title: 'Submitted → Assigned to partner', status: 'ASSIGNED', icon: Send, accent: '#7c3aed', cluster: 1,
    trigger: 'On submit: a partner-created WO self-assigns to that partner; a super-admin / showroom WO auto-assigns. The job card is created here.',
    recipients: [{ role: 'Partner Admin', side: 'supply', channels: ['EMAIL'] }],
    note: '#2 — Partner Admin receives an email: “work order assigned”, with full details.',
  },
  {
    id: 'awaiting_ack', title: 'Job Card created', status: 'AWAITING_ACK', icon: Wrench, accent: '#2563eb', cluster: 1,
    trigger: 'Job card is auto-created the moment the WO is assigned.',
    recipients: [{ role: 'Partner Admin', side: 'supply', channels: ['EMAIL', 'WHATSAPP'] }],
    note: '#3 — Partner Admin is notified every single time a job card lands.',
  },
  {
    id: 'acknowledged', title: 'Acknowledged', status: 'ACKNOWLEDGED', icon: CheckCircle2, accent: '#2563eb', cluster: 1,
    trigger: 'Partner acknowledges the job card.',
    recipients: [{ role: 'Assigned team (installer / detailer)', side: 'supply', channels: ['WHATSAPP', 'EMAIL'] }],
    note: '#3 — the “assigned” message goes to the team that will actually do the work.',
  },
  {
    id: 'scheduled', title: 'Scheduled', status: 'SCHEDULED', icon: Clock, accent: '#2563eb', cluster: 1,
    trigger: 'A date & time is set for the job.',
    recipients: [
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['EMAIL', 'WHATSAPP'] },
      { role: 'Partner Admin', side: 'supply', channels: ['EMAIL', 'WHATSAPP'] },
      { role: 'Assigned team', side: 'supply', channels: ['WHATSAPP'] },
    ],
    note: '#4 — both external (showroom / sales) and internal (partner + team) are told.',
  },
  {
    id: 'rescheduled', title: 'Reschedule', status: 'RESCHEDULED', icon: RotateCcw, accent: '#d97706', cluster: 2, isNew: true,
    trigger: 'New “Reschedule” button → pick a new time + reason. Allowed 3× max (Super Admin unlimited).',
    recipients: [
      { role: 'Partner Admin / Partner Staff', side: 'supply', channels: ['WHATSAPP', 'EMAIL'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['WHATSAPP', 'EMAIL'] },
    ],
    note: 'Both sides are messaged; the timeline is updated with the reason.',
  },
  {
    id: 'remind_3h', title: 'Reminder — 3 hours before', icon: Clock, accent: '#0284c7', cluster: 3, isNew: true,
    trigger: '3 hours before the scheduled time, an automatic check-in fires.',
    recipients: [
      { role: 'Team + Partner Admin / Super Admin', side: 'supply', channels: ['WHATSAPP'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['WHATSAPP'] },
    ],
    note: '#5 — “Are you going to site?” to supply, “Is the car ready to dispatch?” to demand. Replies show under the new eye button. If a reschedule happens meanwhile, its message supersedes. Escalation goes to the Partner Admin — or Super Admin when the team has no partner admin.',
  },
  {
    id: 'remind_time', title: 'Reminder — at scheduled time', icon: Send, accent: '#0284c7', cluster: 3, isNew: true,
    trigger: 'At the scheduled time, a confirm-arrival prompt fires; 60-minute wait.',
    recipients: [
      { role: 'Team + Showroom', side: 'supply', channels: ['WHATSAPP'] },
      { role: 'Partner Admin / Super Admin', side: 'supply', channels: ['WHATSAPP'] },
    ],
    note: '#6 — after confirmation, the authority sets the Reached status.',
  },
  {
    id: 'reached', title: 'Reached', status: 'REACHED', icon: MapPin, accent: '#d97706', cluster: 2, isNew: true,
    trigger: 'New “Reached” button (with confirm) — set by Partner Admin / Super Admin once the team is on site.',
    recipients: [],
    note: '#6 — no notification. Lives on the same row as Reschedule.',
  },
  {
    id: 'preinstall', title: 'Pre-installation photos', icon: Camera, accent: '#2563eb', cluster: 2, isNew: true,
    trigger: '4 inspection photos — now shown AFTER Reached and BEFORE Start.',
    recipients: [],
    note: '#7 — new order is Scheduled → Reached → Pre-install → Start. Still required before Start.',
  },
  {
    id: 'start', title: 'Start work → In Progress', status: 'IN_PROGRESS', icon: Play, accent: '#2563eb', cluster: 2,
    trigger: '“Start Work” button (appears after Reached) — Partner Admin / Super Admin / Detailing Partner / Partner Staff.',
    recipients: [],
    note: '#7 / #8 — no notification for Start or In-Progress.',
  },
  {
    id: 'completed', title: 'Completed', status: 'COMPLETED', icon: CheckCircle2, accent: '#059669', cluster: 1,
    trigger: 'Team marks the job complete.',
    recipients: [{ role: 'Customer', side: 'demand', channels: ['EMAIL'] }],
    note: '#8 — customer email (details pulled from the job card) noting that rework needs a 15-day buffer, subject to availability & urgency after consideration.',
  },
  {
    id: 'pending_approval', title: 'Pending approval', status: 'PENDING_APPROVAL', icon: Clock, accent: '#64748b', cluster: 1,
    trigger: 'Awaiting showroom / admin approval.',
    recipients: [],
    note: '#9 — no notification.',
  },
  {
    id: 'rework', title: 'Rework', status: 'REWORK', icon: AlertTriangle, accent: '#d97706', cluster: 1,
    trigger: 'Rework requested from the job card.',
    recipients: [{ role: 'Team + Partner Admin', side: 'supply', channels: ['EMAIL'] }],
    note: '#10 — email includes Reason, Affected Parts, and Assign-to (straight from the rework form).',
  },
  {
    id: 'approved', title: 'Approved', status: 'APPROVED', icon: ShieldCheck, accent: '#059669', cluster: 1,
    trigger: 'Job approved by showroom / admin.',
    recipients: [
      { role: 'Allocated team + Partner Admin / Super Admin', side: 'supply', channels: ['EMAIL'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['EMAIL'] },
    ],
    note: '#11 — email only. “Apply for e-Warranty” unlocks here; the warranty claim itself stays locked until Invoice Raised.',
  },
  {
    id: 'invoice', title: 'Invoice raised → warranty / closed', status: 'INVOICE_RAISED', icon: FileText, accent: '#059669', cluster: 1,
    trigger: 'Sales invoice entered.',
    recipients: [],
    note: '#11 — the warranty can now be claimed by any authorised person; then Payment → Closed.',
  },
];

function ChannelChip({ channel }: { channel: Channel }) {
  const Icon = CHANNEL_ICON[channel] || Bell;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Icon className="h-3 w-3" />{CHANNEL_LABEL[channel] || channel}
    </span>
  );
}

function RecipientChip({ r }: { r: Recipient }) {
  const c = SIDE_META[r.side].color;
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2 py-1"
      style={{ borderColor: `${c}55`, backgroundColor: `${c}0f` }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
      <span className="text-xs font-medium">{r.role}</span>
      <span className="flex items-center gap-1.5 ml-auto pl-1">
        {r.channels.map((ch) => <ChannelChip key={ch} channel={ch} />)}
      </span>
    </div>
  );
}

function StageCard({ stage, isLast }: { stage: Stage; isLast: boolean }) {
  const cluster = CLUSTER_META[stage.cluster];
  const Icon = stage.icon;
  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-border" />}
      <span
        className="relative z-10 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ring-4 ring-background"
        style={{ backgroundColor: stage.accent }}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>

      <div className="flex-1 min-w-0 rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{stage.title}</span>
            {stage.status && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ color: stage.accent, backgroundColor: `${stage.accent}1a` }}
              >
                {stage.status.replace(/_/g, ' ')}
              </span>
            )}
            {stage.isNew && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
                <Sparkles className="h-2.5 w-2.5" /> New
              </span>
            )}
          </div>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ color: cluster.color, backgroundColor: `${cluster.color}1a` }}
            title={cluster.label}
          >
            Cluster {stage.cluster}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-1.5">{stage.trigger}</p>

        <div className="mt-2.5">
          {stage.recipients.length === 0 ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-md px-2 py-1">
              <BellOff className="h-3 w-3" /> No notification
            </div>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {stage.recipients.map((r, i) => <RecipientChip key={i} r={r} />)}
            </div>
          )}
        </div>

        {stage.note && (
          <p className="text-[11px] text-muted-foreground/90 mt-2 leading-relaxed">{stage.note}</p>
        )}
      </div>
    </div>
  );
}

function FlowBlueprint() {
  return (
    <div className="space-y-4">
      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Sides:</span>
              {(['supply', 'demand'] as Side[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SIDE_META[s].color }} />
                  {SIDE_META[s].label}
                  <span className="text-muted-foreground">
                    ({s === 'supply' ? 'partner / installer' : 'showroom / sales / customer'})
                  </span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Channels:</span>
              {(['WHATSAPP', 'EMAIL', 'PUSH', 'SMS'] as Channel[]).map((c) => <ChannelChip key={c} channel={c} />)}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Build:</span>
              {([1, 2, 3] as const).map((n) => (
                <span key={n} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px]"
                  style={{ color: CLUSTER_META[n].color, backgroundColor: `${CLUSTER_META[n].color}1a` }}>
                  {CLUSTER_META[n].label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Escalation up a chain resolves to Partner Admin, or Super Admin if the team has no partner admin.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The flow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="h-4 w-4" /> Lifecycle flow — every status, trigger & who is notified
          </CardTitle>
        </CardHeader>
        <CardContent>
          {FLOW.map((stage, i) => (
            <StageCard key={stage.id} stage={stage} isLast={i === FLOW.length - 1} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TimelinePage() {
  const { user } = useAuth();
  const canAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showroom, setShowroom] = useState('all');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [view, setView] = useState<'flow' | 'orders'>('flow');

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
      {/* View toggle: the designed flow blueprint vs. live per-order timelines */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setView('flow')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'flow' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="toggle-flow"
        >
          Flow blueprint
        </button>
        <button
          type="button"
          onClick={() => setView('orders')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'orders' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="toggle-orders"
        >
          Work orders
        </button>
      </div>

      {view === 'flow' ? (
        <>
          <p className="text-sm text-muted-foreground">
            The end-to-end job-card lifecycle — every status, what triggers it, and who gets notified on which
            channel. <span className="text-fuchsia-600 dark:text-fuchsia-400 font-medium">New</span> steps
            (Reschedule, Reached, time-based reminders, reply eye button) are marked, and each stage is tagged with
            the build cluster it ships in.
          </p>
          <FlowBlueprint />
        </>
      ) : (
      <>
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
      </>
      )}
    </div>
  );
}
