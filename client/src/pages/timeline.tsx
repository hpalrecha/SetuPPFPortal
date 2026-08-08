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
    note: '#4 (changed) — message to all (mail + WhatsApp): “the job is completed; for any rework a 15-day buffer applies during which the rework is reviewed and a team assigned; after 15 days a car checkup is scheduled and its availability is informed accordingly.”',
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
    note: '“Apply for e-Warranty” unlocks here; the warranty claim itself stays locked until Invoice Raised.',
  },
  {
    id: 'warranty', title: 'Warranty + Invoice → Closed', status: 'INVOICE_RAISED', icon: FileText, accent: '#059669', change: 'changed',
    trigger: 'Sales invoice entered; warranty issued.',
    recipients: [],
    note: '#2/#4 (corrected) — the warranty is issued against the SAME primary job card (never a spawned one). The card stays open through Payment and finally CLOSED.',
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
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ color, backgroundColor: `${color}1a` }}>{label}</span>
  );
}

interface ExStep { icon: any; accent: string; title: string; detail: string; tags?: { label: string; color: string }[] }
const SAME = { label: 'Same card', color: '#059669' };
const NEWC = { label: 'New linked card', color: '#c026d3' };
const TRAIL = { label: 'Trail entry', color: '#0284c7' };
const FAIL = { label: 'Fail', color: '#dc2626' };
const PASS = { label: 'Pass', color: '#059669' };
const SAONLY = { label: 'Super Admin only', color: '#d97706' };

// One job walked through every branch of the flow.
const EXAMPLE: ExStep[] = [
  { icon: ClipboardList, accent: '#7c3aed', title: 'WO-1234 created & assigned', detail: 'Salesperson books PPF Full Body for a Hyundai Creta; on submit it’s assigned to partner “GlossPro”, and primary job card JC-0001 is created (AWAITING_ACK). Partner Admin notified.' },
  { icon: Users, accent: '#2563eb', title: 'Acknowledged + team assigned', detail: 'Partner Admin acknowledges JC-0001 and, in the same step, assigns installer Ravi. Ravi is notified on WhatsApp + email.', tags: [SAME] },
  { icon: Clock, accent: '#2563eb', title: 'Scheduled for tomorrow 3:00 PM', detail: 'Showroom/salesperson + Partner Admin + Ravi all notified.' },
  { icon: Clock, accent: '#0284c7', title: '3h & at-time reminders', detail: '“Heading to site?” to Ravi/partner, “Car ready to dispatch?” to the showroom; replies logged under the eye button.' },
  { icon: MapPin, accent: '#0d9488', title: 'Reached', detail: 'Team on site; Partner Admin presses Reached (allowed — within 4h of schedule).' },
  { icon: XCircle, accent: '#dc2626', title: 'Pre-install check FAILS', detail: 'Car has prior damage / isn’t ready. Job is rescheduled to tomorrow 11:00 AM with a reason — recorded on JC-0001’s timeline. Both parties notified.', tags: [FAIL, SAME, TRAIL] },
  { icon: CheckCircle2, accent: '#059669', title: 'Reached again → pre-install PASSES', detail: 'Next day the check passes and the Start Work button appears.', tags: [PASS] },
  { icon: RotateCcw, accent: '#d97706', title: 'Mid-job reassignment by Super Admin', detail: 'Ravi falls ill after Start. Super Admin reschedules and reassigns to installer Sonu — still JC-0001, a new trail entry, and the card keeps its Start button. (Partner level could not do this post-Start.)', tags: [SAONLY, SAME, TRAIL] },
  { icon: Play, accent: '#ea580c', title: 'Started → Completed', detail: 'Sonu starts and completes the job on JC-0001.' },
  { icon: CheckCircle2, accent: '#059669', title: 'Completion message to everyone', detail: 'Customer + showroom + team + partner get mail & WhatsApp: job complete; 15-day rework buffer (reviewed + team assigned); a car checkup after 15 days whose availability will be informed.' },
  { icon: AlertTriangle, accent: '#d97706', title: 'Rework — NEW team (Amit)', detail: 'Showroom spots edge-lifting. Rework goes to a different team (Amit) → a new linked rework card JC-0002 is created, with a trail entry in JC-0001. The form maps photos per part — “Front bumper: 2 photos (FOC)”, “Left door: 1 photo (₹800, editable later)”.', tags: [NEWC, TRAIL] },
  { icon: FileText, accent: '#6b7280', title: '(If instead the SAME team) ', detail: 'Had the rework stayed with Sonu, no new card would be created — it would be handled on JC-0001 directly.', tags: [SAME] },
  { icon: ShieldCheck, accent: '#059669', title: 'Approved → warranty on JC-0001 → Closed', detail: 'After approval and invoice, the warranty is issued against the primary card JC-0001 (never a spawned one); the card runs through Payment and finally CLOSED.', tags: [SAME] },
];

function ExampleScenario() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4" /> Worked example — one job through every case</CardTitle>
      </CardHeader>
      <CardContent>
        {EXAMPLE.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === EXAMPLE.length - 1;
          return (
            <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {!isLast && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-border" />}
              <span className="relative z-10 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ring-4 ring-background" style={{ backgroundColor: s.accent }}>
                <Icon className="h-4 w-4 text-white" />
              </span>
              <div className="flex-1 min-w-0 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                  <span className="font-semibold text-sm">{s.title}</span>
                  {s.tags?.map((t) => <Tag key={t.label} label={t.label} color={t.color} />)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.detail}</p>
              </div>
            </div>
          );
        })}
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
