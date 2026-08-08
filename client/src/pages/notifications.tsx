import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Bell, Mail, MessageCircle, Smartphone, Search, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, ExternalLink, Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
});

const PAGE_SIZE = 50;

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Channel → icon + colour. Keeps the list scannable at a glance.
const CHANNEL_META: Record<string, { icon: any; className: string; label: string }> = {
  EMAIL: { icon: Mail, className: 'bg-blue-100 text-blue-800', label: 'Email' },
  WHATSAPP: { icon: MessageCircle, className: 'bg-green-100 text-green-800', label: 'WhatsApp' },
  SMS: { icon: Smartphone, className: 'bg-purple-100 text-purple-800', label: 'SMS' },
  PUSH: { icon: Bell, className: 'bg-amber-100 text-amber-800', label: 'In-app' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const meta = CHANNEL_META[channel] || { icon: Bell, className: 'bg-slate-100 text-slate-700', label: channel };
  const Icon = meta.icon;
  return (
    <Badge className={`${meta.className} gap-1`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === 'SENT'
    ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" /> Sent</Badge>
    : <Badge className="bg-red-100 text-red-700 gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
}

// ---- detail dialog (fetches full payload/body on open) --------------------
function NotificationDetailDialog({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/notification-logs", id],
    queryFn: async () => {
      const res = await fetch(`/api/notification-logs/${id}`, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch notification');
      return res.json();
    },
    enabled: open && !!id,
  });

  // Manual reply/outcome logging (the eye button) — replies aren't auto-captured.
  const [reply, setReply] = useState('');
  const [savingReply, setSavingReply] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (data && data.id !== lastId) {
    setLastId(data.id);
    setReply(data.reply || '');
  }
  const saveReply = async () => {
    if (!id) return;
    setSavingReply(true);
    try {
      const res = await fetch(`/api/notification-logs/${id}/reply`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reply: reply.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Reply saved' });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-logs"] });
    } catch (e: any) {
      toast({ title: 'Failed to save reply', description: e.message, variant: 'destructive' });
    } finally {
      setSavingReply(false);
    }
  };

  const payload = data?.payloadJson;
  const html = payload?.html as string | undefined;
  const text = (payload?.text as string | undefined) || data?.bodyPreview;

  const entityLink = data?.relatedEntityType === 'job_card'
    ? `/job-cards/${data.relatedEntityId}`
    : data?.relatedEntityType === 'work_order'
      ? `/work-orders/${data.relatedEntityId}`
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data && <ChannelBadge channel={data.channel} />}
            {data?.subject || 'Notification'}
          </DialogTitle>
          <DialogDescription>{data ? fmtDateTime(data.createdAt) : ''}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : !data ? (
          <div className="py-10 text-center text-muted-foreground">No data.</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border rounded-lg p-3">
              <div><span className="text-muted-foreground">Recipient: </span>{data.recipientName || '—'}</div>
              <div><span className="text-muted-foreground">Address: </span>{data.recipient || '—'}</div>
              <div><span className="text-muted-foreground">Event: </span>{data.eventType || '—'}</div>
              <div><span className="text-muted-foreground">Provider: </span>{data.provider || '—'}</div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Status:</span> <StatusBadge status={data.status} /></div>
              {entityLink && (
                <div>
                  <Button variant="link" className="h-auto p-0 text-primary" onClick={() => { setLocation(entityLink); onClose(); }}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open {data.relatedEntityType.replace('_', ' ')}
                  </Button>
                </div>
              )}
            </div>

            {data.status === 'FAILED' && data.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
                <span className="font-medium">Error: </span>{data.errorMessage}
              </div>
            )}

            {/* Rendered message content */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Message</div>
              {html ? (
                <div className="border rounded-md overflow-hidden">
                  <iframe title="notification-preview" srcDoc={html} className="w-full h-96 bg-white" sandbox="" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap bg-muted/50 rounded-md p-3 text-sm">{text || '—'}</pre>
              )}
            </div>

            {/* Manual reply / outcome (eye button) */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Reply / outcome
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Replies aren't captured automatically — log what the recipient said (e.g. "confirmed, on the way", "car not ready — reschedule").
              </p>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Log the reply / outcome…"
                data-testid="input-notification-reply"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground">{data.replyAt ? `Last updated ${fmtDateTime(data.replyAt)}` : 'No reply logged yet'}</span>
                <Button size="sm" onClick={saveReply} disabled={savingReply} data-testid="button-save-reply">
                  {savingReply ? 'Saving…' : 'Save reply'}
                </Button>
              </div>
            </div>

            {payload && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Raw payload</summary>
                <pre className="mt-2 whitespace-pre-wrap bg-muted/50 rounded-md p-3 overflow-x-auto">{JSON.stringify(payload, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- templates editor -----------------------------------------------------
// One editable card per lifecycle event. Email subject/body are freely editable (with
// {placeholders}); WhatsApp is a Meta-approved template NAME + language mapping.
function TemplateRow({ tpl, onSaved }: { tpl: any; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({ ...tpl });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/notification-templates/${tpl.eventType}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emailSubject: form.emailSubject, emailBody: form.emailBody, emailActive: !!form.emailActive,
          whatsappTemplateName: form.whatsappTemplateName, whatsappLanguage: form.whatsappLanguage, whatsappActive: !!form.whatsappActive,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Save failed');
      toast({ title: 'Template saved', description: tpl.label });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {tpl.label}
          <code className="text-[11px] font-normal text-muted-foreground">{tpl.eventType}</code>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</div>
            <Input value={form.emailSubject || ''} onChange={(e) => setForm({ ...form, emailSubject: e.target.value })} placeholder="Subject" />
            <textarea
              value={form.emailBody || ''}
              onChange={(e) => setForm({ ...form, emailBody: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Body (use {vehicle}, {jobId}, {when}…)"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!form.emailActive} onChange={(e) => setForm({ ...form, emailActive: e.target.checked })} /> Email active
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp (Meta template)</div>
            <Input value={form.whatsappTemplateName || ''} onChange={(e) => setForm({ ...form, whatsappTemplateName: e.target.value })} placeholder="Meta-approved template name" />
            <Input value={form.whatsappLanguage || ''} onChange={(e) => setForm({ ...form, whatsappLanguage: e.target.value })} placeholder="Language (en, en_IN)" className="w-40" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!form.whatsappActive} onChange={(e) => setForm({ ...form, whatsappActive: e.target.checked })} /> WhatsApp active
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving} data-testid={`save-template-${tpl.eventType}`}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesEditor() {
  const { data, isLoading, refetch } = useQuery<{ templates: any[]; placeholders: string[] }>({
    queryKey: ["/api/notification-templates"],
    queryFn: async () => {
      const res = await fetch('/api/notification-templates', { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load templates');
      return res.json();
    },
  });
  const templates = data?.templates || [];
  const placeholders = data?.placeholders || [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edit the message sent at each job status. Email subject &amp; body are fully editable and support placeholders
        {placeholders.length > 0 && <> — {placeholders.map((p) => <code key={p} className="mx-0.5 px-1 rounded bg-muted text-[11px]">{p}</code>)}</>}.
        WhatsApp uses a Meta-approved template: you can change the template name/language and toggle it, but the wording is approved on Meta's side.
      </p>
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading templates…</div>
      ) : (
        templates.map((t) => <TemplateRow key={t.eventType} tpl={t} onSaved={refetch} />)
      )}
    </div>
  );
}

// ---- page -----------------------------------------------------------------
export default function NotificationsPage() {
  const { user } = useAuth();
  const canAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [view, setView] = useState<'log' | 'templates'>('log');

  const { data, isLoading } = useQuery<{ rows: any[]; total: number }>({
    queryKey: ["/api/notification-logs", channel, status, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (channel !== 'all') params.set('channel', channel);
      if (status !== 'all') params.set('status', status);
      if (search) params.set('search', search);
      const res = await fetch(`/api/notification-logs?${params.toString()}`, { headers: authHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch notification logs');
      return res.json();
    },
    enabled: canAccess,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Access restricted. Notifications are available to admins only.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setView('log')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'log' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="toggle-log"
        >
          Sent log
        </button>
        <button
          type="button"
          onClick={() => setView('templates')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'templates' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="toggle-templates"
        >
          Templates
        </button>
      </div>

      {view === 'templates' ? (
        <TemplatesEditor />
      ) : (
      <>
      <p className="text-sm text-muted-foreground">
        Every outbound message the system has sent — <span className="font-medium">what</span> was sent,
        <span className="font-medium"> to whom</span>, and through <span className="font-medium">which channel</span>
        (email, WhatsApp, SMS, or in-app). Click a row to see the full content and delivery status.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{total} notification{total === 1 ? '' : 's'}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(0); }}>
                <SelectTrigger className="w-36" data-testid="filter-channel"><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="PUSH">In-app</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
                <SelectTrigger className="w-32" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipient, subject…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-8"
                  data-testid="input-search-notifications"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No notifications found.</TableCell></TableRow>
              ) : rows.map((n) => (
                <TableRow
                  key={n.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetailId(n.id)}
                  data-testid={`row-notification-${n.id}`}
                >
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(n.createdAt)}</TableCell>
                  <TableCell><ChannelBadge channel={n.channel} /></TableCell>
                  <TableCell>
                    <div className="font-medium">{n.recipientName || <span className="text-muted-foreground">—</span>}</div>
                    <div className="text-xs text-muted-foreground">{n.recipient || '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm">{n.eventType || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate">{n.subject || <span className="text-muted-foreground">—</span>}</div>
                    {n.bodyPreview && <div className="text-xs text-muted-foreground truncate">{n.bodyPreview}</div>}
                  </TableCell>
                  <TableCell><StatusBadge status={n.status} /></TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={n.reply ? 'text-emerald-600' : 'text-muted-foreground'}
                      onClick={(e) => { e.stopPropagation(); setDetailId(n.id); }}
                      title={n.reply ? `Reply logged: ${n.reply}` : 'No reply logged — click to add'}
                      data-testid={`reply-eye-${n.id}`}
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

      <NotificationDetailDialog id={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
      </>
      )}
    </div>
  );
}
