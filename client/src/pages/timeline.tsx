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
  FileText, BellOff, ArrowUpRight, Sparkles, Users, XCircle, Pencil, CircleDot, Layers,
  Receipt, Building2, Store, ArrowRight,
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
// Flow Blueprint — the CORRECTED job-card lifecycle (my understanding, for you
// to validate BEFORE I build it). Every stage shows who is notified on which
// channel, and is marked NEW / CHANGED vs. what's currently built. Followed by
// the core rules and a worked example that covers every case.
// ---------------------------------------------------------------------------

type Side = 'supply' | 'demand';
type Channel = 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'SMS';
type Change = 'new' | 'changed';

interface Recipient { role: string; side: Side; channels: Channel[] }
interface Stage {
  id: string;
  title: string;
  status?: string;
  icon: any;
  accent: string;      // dot + status tint
  change?: Change;     // vs. what's currently built
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

const CHANGE_META: Record<Change, { label: string; color: string }> = {
  new: { label: 'New', color: '#c026d3' },
  changed: { label: 'Changed', color: '#d97706' },
};

const FLOW: Stage[] = [
  {
    id: 'wo_created', title: 'Work Order created', status: 'DRAFT', icon: ClipboardList, accent: '#7c3aed',
    trigger: 'Salesperson / Showroom / Partner Admin / Super Admin creates the work order.',
    recipients: [],
  },
  {
    id: 'wo_assigned', title: 'Submitted → Assigned to partner', status: 'ASSIGNED', icon: Send, accent: '#7c3aed',
    trigger: 'On submit the WO is assigned to a partner; the (single, primary) job card is created here.',
    recipients: [{ role: 'Partner Admin', side: 'supply', channels: ['EMAIL'] }],
  },
  {
    id: 'awaiting_ack', title: 'Job Card created', status: 'AWAITING_ACK', icon: Wrench, accent: '#2563eb',
    trigger: 'The primary job card is auto-created the moment the WO is assigned.',
    recipients: [{ role: 'Partner Admin', side: 'supply', channels: ['EMAIL', 'WHATSAPP'] }],
    note: 'This one job card lives all the way to CLOSED — reschedules & warranty all stay on it.',
  },
  {
    id: 'acknowledged', title: 'Acknowledged — team assignment REQUIRED', status: 'ACKNOWLEDGED', icon: Users, accent: '#2563eb', change: 'changed',
    trigger: 'Partner Admin acknowledges AND must pick the team member (installer/detailer) at the same time — acknowledge cannot happen without assigning a team.',
    recipients: [{ role: 'Assigned team member', side: 'supply', channels: ['WHATSAPP', 'EMAIL'] }],
    note: '#1 (new) — assigning the team is now mandatory to acknowledge.',
  },
  {
    id: 'scheduled', title: 'Scheduled', status: 'SCHEDULED', icon: Clock, accent: '#2563eb',
    trigger: 'A date & time is set for the job.',
    recipients: [
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['EMAIL', 'WHATSAPP'] },
      { role: 'Partner Admin', side: 'supply', channels: ['EMAIL', 'WHATSAPP'] },
      { role: 'Assigned team', side: 'supply', channels: ['WHATSAPP'] },
    ],
  },
  {
    id: 'rescheduled', title: 'Reschedule — SAME job card, timeline trail', status: 'RESCHEDULED', icon: RotateCcw, accent: '#d97706', change: 'changed',
    trigger: 'Reschedule → new time + reason (+ optionally a different team member). 3× max for partner level; Super Admin unlimited.',
    recipients: [
      { role: 'Partner Admin / Partner Staff', side: 'supply', channels: ['WHATSAPP', 'EMAIL'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['WHATSAPP', 'EMAIL'] },
    ],
    note: '#2 (corrected) — changing the team here does NOT create a new job card. It stays the same card; the change is recorded as a trail entry in this card’s timeline. Reschedule is available at Scheduled, Reached, and even after a failed pre-install check.',
  },
  {
    id: 'remind_3h', title: 'Reminder — 3 hours before', icon: Clock, accent: '#0284c7',
    trigger: '3 hours before the scheduled time, an automatic check-in fires.',
    recipients: [
      { role: 'Team + Partner Admin / Super Admin', side: 'supply', channels: ['WHATSAPP'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['WHATSAPP'] },
    ],
    note: '“Are you going to site?” to supply, “Is the car ready to dispatch?” to demand. Replies show under the eye button. A reschedule at this moment supersedes.',
  },
  {
    id: 'remind_time', title: 'Reminder — at scheduled time', icon: Send, accent: '#0284c7',
    trigger: 'At the scheduled time, a confirm-arrival prompt fires; 60-minute wait, then the authority sets Reached.',
    recipients: [
      { role: 'Team + Showroom', side: 'supply', channels: ['WHATSAPP'] },
      { role: 'Partner Admin / Super Admin', side: 'supply', channels: ['WHATSAPP'] },
    ],
  },
  {
    id: 'reached', title: 'Reached', status: 'REACHED', icon: MapPin, accent: '#0d9488',
    trigger: 'Team on site → “Reached” pressed. Partner level can only do this within 4h of the scheduled time; Super Admin any time. Reschedule is still possible here.',
    recipients: [],
  },
  {
    id: 'preinstall', title: 'Pre-installation CHECK — Pass / Fail', icon: Camera, accent: '#4f46e5', change: 'changed',
    trigger: 'After Reached, the pre-installation check is done with an explicit outcome.',
    recipients: [],
    note: '#3 (new) — FAIL → job goes back to Reschedule. PASS → the Start button appears. Rescheduling is still allowed up until Start.',
  },
  {
    id: 'start', title: 'Start work → In Progress', status: 'IN_PROGRESS', icon: Play, accent: '#ea580c', change: 'changed',
    trigger: '“Start Work” appears once pre-install passes.',
    recipients: [],
    note: '#3 (new) — AFTER start, only Super Admin may reschedule + reassign a new team; that keeps the same card and the card simply shows the Start button directly again. Partner level can no longer reschedule once started.',
  },
  {
    id: 'completed', title: 'Completed — notify EVERYONE incl. customer', status: 'COMPLETED', icon: CheckCircle2, accent: '#059669', change: 'changed',
    trigger: 'Team marks the job complete.',
    recipients: [
      { role: 'Customer', side: 'demand', channels: ['EMAIL', 'WHATSAPP'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['EMAIL', 'WHATSAPP'] },
      { role: 'Team + Partner Admin', side: 'supply', channels: ['EMAIL', 'WHATSAPP'] },
    ],
    note: '#4 (changed) — message to all (mail + WhatsApp): “the job is completed; for any rework a 15-day buffer applies during which the rework is reviewed and a team assigned; after 15 days a car checkup is scheduled and its availability is informed accordingly.” Once Completed, “Apply for e-Warranty” is also available (both brands — the invoice is no longer required).',
  },
  {
    id: 'pending_approval', title: 'Pending approval', status: 'PENDING_APPROVAL', icon: Clock, accent: '#64748b',
    trigger: 'Awaiting showroom / admin approval.',
    recipients: [],
  },
  {
    id: 'rework', title: 'Rework', status: 'REWORK', icon: AlertTriangle, accent: '#d97706', change: 'changed',
    trigger: 'Rework requested from the job card.',
    recipients: [{ role: 'Team + Partner Admin', side: 'supply', channels: ['EMAIL', 'WHATSAPP'] }],
    note: '#5 (changed) — NEW team → a new linked rework card is created, with a trail entry in the primary card. SAME team → no new card (handled on the same card). Photos are mapped & attached PER affected part (not one shared bundle). Each part has FOC (free of cost) or a cost, and the cost stays EDITABLE even after submit (it depends on manual assessment).',
  },
  {
    id: 'approved', title: 'Approved', status: 'APPROVED', icon: ShieldCheck, accent: '#059669',
    trigger: 'Job approved by showroom / admin.',
    recipients: [
      { role: 'Allocated team + Partner Admin / Super Admin', side: 'supply', channels: ['EMAIL'] },
      { role: 'Showroom / Salesperson', side: 'demand', channels: ['EMAIL'] },
    ],
    note: '“Apply for e-Warranty” is available from the Completed stage onward (both brands) — it is no longer gated on the invoice, and the claim is registered against this same primary card.',
  },
  {
    id: 'warranty', title: 'Invoice → Closed', status: 'INVOICE_RAISED', icon: FileText, accent: '#059669', change: 'changed',
    trigger: 'Sales invoice entered; card moves toward Closed.',
    recipients: [],
    note: '#2/#4 (corrected) — e-Warranty may already have been issued from Completed onward; either way it is registered against the SAME primary job card (never a spawned one). The card stays open through Payment and finally CLOSED.',
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
  const changeMeta = stage.change ? CHANGE_META[stage.change] : null;
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
          </div>
          {changeMeta && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{ color: changeMeta.color, backgroundColor: `${changeMeta.color}1a` }}
            >
              <Sparkles className="h-2.5 w-2.5" /> {changeMeta.label}
            </span>
          )}
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

// The load-bearing rules that the whole flow turns on.
const CORE_RULES: { icon: any; title: string; body: string }[] = [
  { icon: Layers, title: 'One primary job card, cradle to grave', body: 'A single job card lives from creation until CLOSED. Every reschedule (including a team change) and the warranty all stay ON this same card, recorded as trail entries in its timeline.' },
  { icon: Users, title: 'Acknowledge = assign the team', body: 'A job card cannot be acknowledged without also assigning the team member who will do the work.' },
  { icon: RotateCcw, title: 'Reschedule never spawns a card', body: 'Reschedule updates the time (and optionally the team) on the SAME card and logs a trail entry. Before Start: partner + Super Admin (3× cap, SA unlimited). After Start: Super Admin only (may reassign a new team; card keeps its Start button).' },
  { icon: Camera, title: 'Pre-installation is a pass/fail gate', body: 'After Reached, the pre-install check has an explicit outcome: FAIL → back to Reschedule; PASS → Start becomes available.' },
  { icon: AlertTriangle, title: 'Rework is the only thing that can branch', body: 'Rework with a NEW team → a new linked card (trail in the primary). Rework with the SAME team → stays on the primary card. Photos are attached per affected part, each with FOC or an editable cost.' },
  { icon: Receipt, title: 'Billing follows the work (post-approval)', body: 'After approval a 3-party trail is recorded — detailer/staff → company/Partner Admin → showroom. If the Partner Admin IS the company, the company invoices the showroom directly. If our detailer did the work under a DIFFERENT Partner Admin, we bill that Partner Admin (who bills the showroom). Team changes via reschedule/rework make the price variable and editable.' },
];

function CoreRules() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><CircleDot className="h-4 w-4" /> Core rules</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {CORE_RULES.map((r) => (
          <div key={r.title} className="flex gap-3">
            <span className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
              <r.icon className="h-4 w-4 text-foreground" />
            </span>
            <div>
              <div className="text-sm font-medium">{r.title}</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Coloured inline tag used in the worked example.
function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded whitespace-nowrap"
      style={{ color, backgroundColor: `${color}1a` }}>{label}</span>
  );
}

const SAME = { label: 'Same card', color: '#059669' };
const NEWC = { label: 'New linked card', color: '#c026d3' };
const TRAIL = { label: 'Trail entry', color: '#0284c7' };
const FAIL = { label: 'Fail', color: '#dc2626' };
const PASS = { label: 'Pass', color: '#059669' };
const SAONLY = { label: 'Super Admin only', color: '#d97706' };
const VARPRICE = { label: 'Variable pricing', color: '#d97706' };

// Which record the event touches — colour-coded so WO vs JC vs the rework card read apart.
type Entity = 'WO' | 'JC' | 'JC2' | 'BILL';
const ENTITY_META: Record<Entity, { label: string; color: string }> = {
  WO: { label: 'WO-1234', color: '#7c3aed' },
  JC: { label: 'JC-0001', color: '#2563eb' },
  JC2: { label: 'JC-0002', color: '#c026d3' },
  BILL: { label: 'Billing', color: '#059669' },
};

interface ExEvent {
  time: string;
  entity: Entity;
  icon: any;
  accent: string;
  title: string;
  detail?: string;
  notify?: string[];
  escalation?: string;
  tags?: { label: string; color: string }[];
}

// One job walked left→right through every branch, with real dates/times.
const EXAMPLE: ExEvent[] = [
  { time: 'Day 1 · 10:00', entity: 'WO', icon: ClipboardList, accent: '#7c3aed', title: 'Work order created', detail: 'Salesperson books PPF Full Body — Hyundai Creta.', tags: [{ label: 'DRAFT', color: '#7c3aed' }] },
  { time: 'Day 1 · 10:05', entity: 'JC', icon: Send, accent: '#2563eb', title: 'Assigned → primary card', detail: 'Assigned to partner GlossPro; JC-0001 created.', notify: ['Partner Admin (email + WA)'], tags: [{ label: 'AWAITING ACK', color: '#2563eb' }] },
  { time: 'Day 1 · 10:30', entity: 'JC', icon: Users, accent: '#2563eb', title: 'Acknowledged + team assigned', detail: 'Installer Ravi assigned (required to acknowledge).', notify: ['Ravi (WA + email)'], tags: [{ label: 'ACKNOWLEDGED', color: '#2563eb' }] },
  { time: 'Day 1 · 11:00', entity: 'JC', icon: Clock, accent: '#2563eb', title: 'Scheduled — Day 2, 3:00 PM', notify: ['Showroom/sales', 'Partner Admin', 'Ravi'], tags: [{ label: 'SCHEDULED', color: '#2563eb' }] },
  { time: 'Day 2 · 12:00', entity: 'JC', icon: Clock, accent: '#0284c7', title: 'Reminder — 3h before', notify: ['Ravi/partner: “going to site?”', 'Showroom: “car ready?”'] },
  { time: 'Day 2 · 15:00', entity: 'JC', icon: Send, accent: '#0284c7', title: 'Reminder — at time', detail: '60-min wait, no confirmation.', escalation: 'Escalated to Partner Admin (→ Super Admin if none)' },
  { time: 'Day 2 · 15:10', entity: 'JC', icon: MapPin, accent: '#0d9488', title: 'Reached', detail: 'Partner Admin marks on-site (within 4h window).', tags: [{ label: 'REACHED', color: '#0d9488' }] },
  { time: 'Day 2 · 15:20', entity: 'JC', icon: XCircle, accent: '#dc2626', title: 'Pre-install FAIL → Reschedule', detail: 'Car not ready → new time Day 3, 11:00 AM + reason.', notify: ['Both parties (WA + email)'], tags: [FAIL, SAME, TRAIL] },
  { time: 'Day 3 · 11:05', entity: 'JC', icon: CheckCircle2, accent: '#059669', title: 'Reached → Pre-install PASS', detail: 'Start button now appears.', tags: [PASS] },
  { time: 'Day 3 · 11:30', entity: 'JC', icon: Play, accent: '#ea580c', title: 'Start → In Progress', tags: [{ label: 'IN PROGRESS', color: '#ea580c' }] },
  { time: 'Day 3 · 13:00', entity: 'JC', icon: RotateCcw, accent: '#d97706', title: 'Mid-job reassign (Super Admin)', detail: 'Ravi ill → reassigned to Sonu. Same card, keeps Start.', notify: ['Both parties'], tags: [SAONLY, SAME, TRAIL] },
  { time: 'Day 3 · 16:00', entity: 'JC', icon: CheckCircle2, accent: '#059669', title: 'Completed', detail: 'e-Warranty can be applied from here (both brands — no invoice required).', notify: ['Everyone incl. customer (mail + WA): 15-day buffer + checkup'], tags: [{ label: 'COMPLETED', color: '#059669' }] },
  { time: 'Day 4 · 10:00', entity: 'JC', icon: ShieldCheck, accent: '#059669', title: 'Approved', notify: ['Team + Partner Admin + showroom (email)'], tags: [{ label: 'APPROVED', color: '#059669' }] },
  { time: 'Day 4 · 10:05', entity: 'BILL', icon: Receipt, accent: '#059669', title: 'Billing trail recorded', detail: 'Detailer = ours, Partner Admin = GlossPro (≠ company) ⇒ we bill GlossPro; GlossPro bills showroom.', tags: [VARPRICE] },
  { time: 'Day 6 · 09:30', entity: 'JC2', icon: AlertTriangle, accent: '#c026d3', title: 'Rework — NEW team (Amit)', detail: 'Edge-lifting. New linked card JC-0002; per-part photos — bumper ×2 (FOC), left door ×1 (₹800, editable).', notify: ['Team + Partner Admin (mail + WA)'], tags: [NEWC, TRAIL, VARPRICE] },
  { time: 'Day 20', entity: 'JC', icon: FileText, accent: '#059669', title: 'Invoice → Closed', detail: 'e-Warranty already issued at completion on JC-0001; invoice → payment → CLOSED.', tags: [SAME] },
];

// A single horizontal event card (one column of the timeline).
function ExCard({ e }: { e: ExEvent }) {
  const Icon = e.icon;
  const ent = ENTITY_META[e.entity];
  return (
    <div className="flex-1 min-w-0 rounded-lg border bg-card p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: e.accent }}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[9px] font-semibold px-1 py-0.5 rounded" style={{ color: ent.color, backgroundColor: `${ent.color}1a` }}>{ent.label}</span>
      </div>
      <div className="text-xs font-semibold leading-tight">{e.title}</div>
      {e.detail && <p className="text-[11px] text-muted-foreground leading-snug">{e.detail}</p>}
      {e.notify?.map((n, i) => (
        <div key={i} className="flex items-start gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
          <Bell className="h-2.5 w-2.5 mt-0.5 shrink-0" /><span className="leading-snug">{n}</span>
        </div>
      ))}
      {e.escalation && (
        <div className="flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-400">
          <ArrowUpRight className="h-2.5 w-2.5 mt-0.5 shrink-0" /><span className="leading-snug">{e.escalation}</span>
        </div>
      )}
      {e.tags && <div className="flex flex-wrap gap-1 mt-auto pt-1">{e.tags.map((t) => <Tag key={t.label} label={t.label} color={t.color} />)}</div>}
    </div>
  );
}

function ExampleScenario() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4" /> Worked example — one job, left → right through every case</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Horizontal timeline: scrolls sideways; each column is a dated event with its own
            notifications / escalations. The continuous rail joins the dots between columns. */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-stretch min-w-max">
            {EXAMPLE.map((e, i) => (
              <div key={i} className="flex flex-col w-[210px] shrink-0 px-1.5">
                <ExCard e={e} />
                {/* rail */}
                <div className="relative h-7">
                  {i > 0 && <span className="absolute left-0 top-1/2 w-1/2 h-px bg-border" />}
                  {i < EXAMPLE.length - 1 && <span className="absolute right-0 top-1/2 w-1/2 h-px bg-border" />}
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-4 ring-background" style={{ backgroundColor: e.accent }} />
                </div>
                <div className="text-center text-[10px] font-medium text-muted-foreground">{e.time}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Branch not shown: had the rework gone to the <span className="font-medium">same</span> team (Sonu), no new card would be created — it would be handled on JC-0001 directly.
        </p>
      </CardContent>
    </Card>
  );
}

// The post-approval 3-party billing trail and its rules.
function BillingTrail() {
  const node = (icon: any, n: string, title: string, sub: string, color: string) => {
    const Icon = icon;
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: `${color}55`, backgroundColor: `${color}0f` }}>
        <span className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
          <Icon className="h-4 w-4 text-white" />
        </span>
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground">{n}</div>
          <div className="text-sm font-medium leading-tight">{title}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </div>
    );
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Post-approval billing trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {node(Users, '1 · Work done by', 'Detailing partner / staff', 'ours, or a partner’s team', '#2563eb')}
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          {node(Building2, '2 · Intermediary', 'Company / Partner Admin', 'the billing middle party', '#d97706')}
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          {node(Store, '3 · Billed to', 'Showroom', 'the end recipient', '#7c3aed')}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-md border p-2.5">
            <div className="font-semibold mb-0.5 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> If ② is the company</div>
            <p className="text-muted-foreground">The Partner Admin IS us → the company invoices the showroom directly (① → ③).</p>
          </div>
          <div className="rounded-md border p-2.5">
            <div className="font-semibold mb-0.5 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> If ① is ours under a different Partner Admin</div>
            <p className="text-muted-foreground">Our detailer did the work but the Partner Admin is a separate company → we bill the Partner Admin, who bills the showroom.</p>
          </div>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <Pencil className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Team changes (reschedule reassignment or rework to a new team) can change who performed the work, so the price is <span className="font-medium">variable and editable</span> per job / per rework part — including after the form is submitted.</span>
        </div>
      </CardContent>
    </Card>
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
              <span className="font-semibold">vs. current build:</span>
              {(['new', 'changed'] as Change[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px]"
                  style={{ color: CHANGE_META[c].color, backgroundColor: `${CHANGE_META[c].color}1a` }}>
                  <Sparkles className="h-2.5 w-2.5" /> {CHANGE_META[c].label}
                </span>
              ))}
              <span className="text-muted-foreground">(unmarked = already built)</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Escalation up a chain resolves to Partner Admin, or Super Admin if the team has no partner admin.
            </div>
          </div>
        </CardContent>
      </Card>

      <CoreRules />

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

      <ExampleScenario />

      <BillingTrail />
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
            My <span className="font-medium">corrected</span> understanding of the end-to-end job-card lifecycle — for you
            to validate before I build it. Stages are marked <span className="text-fuchsia-600 dark:text-fuchsia-400 font-medium">New</span> or
            <span className="text-amber-600 dark:text-amber-400 font-medium"> Changed</span> vs. what's currently built; unmarked = already built.
            Below the flow are the <span className="font-medium">core rules</span> and a <span className="font-medium">worked example</span> covering every case.
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
