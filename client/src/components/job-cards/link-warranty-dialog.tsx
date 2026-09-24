import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * SUPER_ADMIN reconciliation: attach a warranty that already exists in P91Elite to a
 * job card. Used when both sides were recorded by hand and share no key — the admin
 * looks the code up, checks it against the job card, then confirms.
 */

interface PreviewResponse {
  warranty: {
    warrantyCode: string;
    name?: string | null;
    vehicleMake?: string | null;
    vehicleModel?: string | null;
    vehicleVIN?: string | null;
    storeName?: string | null;
    installer?: string | null;
    installationDate?: string | null;
    status?: string | null;
  };
  jobCardRegNo: string | null;
  jobCardCustomer: string | null;
  vehicleMatches: boolean;
  linkedToJobCardIds: string[];
  currentCode: string | null;
}

interface Candidate {
  warrantyCode: string;
  name: string | null;
  phoneLast4: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleVIN: string | null;
  storeName: string | null;
  installer: string | null;
  installationDate: string | null;
  score: number;
  reasons: string[];
  linkedToJobCardId: string | null;
}

interface CandidatesResponse {
  jobCard: {
    regNo: string | null;
    customerName: string | null;
    customerPhoneLast4: string | null;
    completedAt: string | null;
    showroomName: string | null;
    currentCode: string | null;
  };
  candidates: Candidate[];
}

/** Rough confidence band from the match score, so the list reads at a glance. */
function confidence(score: number): { label: string; className: string } {
  if (score >= 100) return { label: 'Strong', className: 'bg-green-100 text-green-800' };
  if (score >= 60) return { label: 'Likely', className: 'bg-blue-100 text-blue-800' };
  return { label: 'Weak', className: 'bg-gray-100 text-gray-700' };
}

/** apiRequest throws "<status>: <body>"; pull the server's error text out of the JSON body. */
function readError(error: unknown): string {
  const message = (error as Error)?.message || 'Request failed';
  const body = message.replace(/^\d{3}:\s*/, '');
  try {
    return JSON.parse(body).error || body;
  } catch {
    return body;
  }
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'font-medium text-amber-700' : 'font-medium'}>{value}</span>
    </div>
  );
}

export function LinkWarrantyDialog({
  jobCardId,
  open,
  onOpenChange,
}: {
  jobCardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode('');
      setPreview(null);
      setLookupError(null);
    }
  }, [open]);

  const candidatesQuery = useQuery<CandidatesResponse>({
    queryKey: ['/api/job-cards', jobCardId, 'link-warranty', 'candidates'],
    enabled: open && !!jobCardId,
    staleTime: 0,
    retry: false,
  });

  const lookup = useMutation({
    mutationFn: async (warrantyCode: string) => {
      const response = await apiRequest(
        'GET',
        `/api/job-cards/${jobCardId}/link-warranty/preview?code=${encodeURIComponent(warrantyCode)}`,
      );
      return (await response.json()) as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreview(data);
      setLookupError(null);
    },
    onError: (error) => {
      setPreview(null);
      setLookupError(readError(error));
    },
  });

  const link = useMutation({
    mutationFn: async (warrantyCode: string) => {
      const response = await apiRequest('POST', `/api/job-cards/${jobCardId}/link-warranty`, { warrantyCode });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-cards'] });
      onOpenChange(false);
      toast({
        title: 'Warranty linked',
        description:
          data?.status && data.status !== data.previousStatus
            ? `Job card moved from ${data.previousStatus} to ${data.status}.`
            : 'The warranty card now shows on this job card.',
      });
    },
    onError: (error) => {
      toast({ title: 'Could not link warranty', description: readError(error), variant: 'destructive' });
    },
  });

  const trimmed = code.trim();
  const alreadyLinkedElsewhere = (preview?.linkedToJobCardIds.length ?? 0) > 0;
  const w = preview?.warranty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link P91 warranty</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* What we searched with — so the admin can see why candidates were picked. */}
          {candidatesQuery.data?.jobCard && (
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-0.5">
              <div className="font-medium text-muted-foreground uppercase tracking-wide mb-1">This job card</div>
              <div>Customer: <span className="font-medium">{candidatesQuery.data.jobCard.customerName || '—'}</span>
                {candidatesQuery.data.jobCard.customerPhoneLast4 && <> · phone ••••{candidatesQuery.data.jobCard.customerPhoneLast4}</>}
              </div>
              <div>VIN / Reg: <span className="font-mono">{candidatesQuery.data.jobCard.regNo || '—'}</span></div>
              <div>Completed: {candidatesQuery.data.jobCard.completedAt ? String(candidatesQuery.data.jobCard.completedAt).slice(0, 10) : '—'}
                {candidatesQuery.data.jobCard.showroomName && <> · {candidatesQuery.data.jobCard.showroomName}</>}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">Suggested from P91 Elite</div>
            {candidatesQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching P91 Elite…
              </div>
            )}
            {candidatesQuery.error && (
              <div className="text-sm text-red-700">{readError(candidatesQuery.error)}</div>
            )}
            {candidatesQuery.data && candidatesQuery.data.candidates.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No likely matches. If you know the code, enter it below.
              </div>
            )}
            {candidatesQuery.data?.candidates.map((c) => {
              const band = confidence(c.score);
              const selected = trimmed === c.warrantyCode;
              return (
                <button
                  key={c.warrantyCode}
                  type="button"
                  onClick={() => {
                    setCode(c.warrantyCode);
                    lookup.mutate(c.warrantyCode);
                  }}
                  className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${selected ? 'border-primary ring-1 ring-primary' : ''}`}
                  data-testid={`candidate-${c.warrantyCode}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{c.warrantyCode}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${band.className}`}>
                      {band.label} · {c.score}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    {c.name || '—'}
                    {c.phoneLast4 && <span className="text-muted-foreground"> · ••••{c.phoneLast4}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[c.vehicleMake, c.vehicleModel].filter(Boolean).join(' ') || '—'}
                    {' · '}<span className="font-mono">{c.vehicleVIN || '—'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.storeName || '—'}{c.installer ? ` · ${c.installer}` : ''} · installed {c.installationDate || '—'}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.reasons.map((r) => (
                      <span key={r} className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-800">{r}</span>
                    ))}
                    {c.linkedToJobCardId && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-800">
                        Already linked to job {c.linkedToJobCardId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground">
            Or enter the code from P91 Elite. Check the details match this job before linking.
          </p>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="link-warranty-code">Warranty code</Label>
              <Input
                id="link-warranty-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setPreview(null);
                  setLookupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && trimmed) lookup.mutate(trimmed);
                }}
                placeholder="P91-XXXX0000000"
                className="font-mono"
                data-testid="input-link-warranty-code"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => lookup.mutate(trimmed)}
              disabled={!trimmed || lookup.isPending}
              data-testid="button-lookup-warranty"
            >
              {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5">Look up</span>
            </Button>
          </div>

          {lookupError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {preview && w && (
            <div className="space-y-3">
              <div className="space-y-1.5 rounded-md border p-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  In P91 Elite
                </div>
                <Row label="Customer" value={w.name || '—'} />
                <Row label="Vehicle" value={[w.vehicleMake, w.vehicleModel].filter(Boolean).join(' ') || '—'} />
                <Row label="VIN / Reg" value={w.vehicleVIN || '—'} highlight={!preview.vehicleMatches} />
                <Row label="Store" value={w.storeName || '—'} />
                <Row label="Installed" value={w.installationDate || '—'} />
              </div>

              <div className="space-y-1.5 rounded-md border p-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  This job card
                </div>
                <Row label="Customer" value={preview.jobCardCustomer || '—'} />
                <Row label="VIN / Reg" value={preview.jobCardRegNo || '—'} highlight={!preview.vehicleMatches} />
              </div>

              {preview.vehicleMatches ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Vehicle matches.
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Vehicle numbers differ. Confirm by customer and date before linking — the job may
                    have been entered by registration number on one side and chassis number on the other.
                  </span>
                </div>
              )}

              {alreadyLinkedElsewhere && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This code is already linked to another job card ({preview.linkedToJobCardIds.join(', ')}).
                    One warranty can belong to only one job card.
                  </span>
                </div>
              )}

              {preview.currentCode && preview.currentCode !== w.warrantyCode && (
                <p className="text-xs text-muted-foreground">
                  Replaces the current code <span className="font-mono">{preview.currentCode}</span> on this job card.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={link.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => link.mutate(trimmed)}
            disabled={!preview || alreadyLinkedElsewhere || link.isPending}
            data-testid="button-confirm-link-warranty"
          >
            {link.isPending ? 'Linking…' : 'Link warranty'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
