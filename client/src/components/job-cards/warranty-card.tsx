import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { buildVerifyUrl, verifyCaptionFor } from '@/lib/warranty-brand';

/**
 * The P91 e-warranty card issued by P91Elite, rendered inside the job card.
 *
 * Data comes from `/api/job-cards/:id/warranty-card`, which merges our stored
 * snapshot with a live status lookup. Mirrors the card design in P91Elite's
 * `p91-erp/src/components/warranty/WarrantyCard.tsx`.
 */

/** P91 brand green — matches the card face in P91Elite. */
const GREEN = '#4DB848';

export interface WarrantyCardData {
  warrantyCode: string;
  status: string;
  statusStale?: boolean;
  name?: string | null;
  installer?: string | null;
  installerMobile?: string | null;
  storeName?: string | null;
  storeLocation?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleVIN?: string | null;
  vehicleYear?: string | null;
  productType?: string | null;
  installationDate?: string | null;
  expiryDate?: string | null;
  lotNumbers?: Array<{ lotNumber: string; quantity?: number }> | string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Elite issues 5-year cover and stores no expiry, so derive it the same way its card does. */
function resolveExpiry(card: WarrantyCardData): string {
  if (card.expiryDate) return formatDate(card.expiryDate);
  if (!card.installationDate) return '—';
  const parsed = new Date(card.installationDate);
  if (Number.isNaN(parsed.getTime())) return '—';
  parsed.setFullYear(parsed.getFullYear() + 5);
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatLots(lots: WarrantyCardData['lotNumbers']): string {
  if (!lots) return '—';
  if (typeof lots === 'string') return lots;
  if (!Array.isArray(lots) || lots.length === 0) return '—';
  return lots
    .map((lot) => (lot.quantity != null ? `${lot.lotNumber} (${lot.quantity})` : lot.lotNumber))
    .join(', ');
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

export function WarrantyCard({ jobCardId }: { jobCardId: string }) {
  const { data: card, isLoading, error } = useQuery<WarrantyCardData>({
    queryKey: ['/api/job-cards', jobCardId, 'warranty-card'],
    enabled: !!jobCardId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground" data-testid="warranty-card-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading warranty card…
      </div>
    );
  }

  if (error || !card) {
    // A 404 here is the normal case for STEK jobs and for P91 jobs registered before
    // the code was persisted — say so plainly rather than showing a broken card.
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground" data-testid="warranty-card-unavailable">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Warranty card details aren't available for this job card.</span>
      </div>
    );
  }

  const vehicle = [card.vehicleMake, card.vehicleModel].filter(Boolean).join(' ') || '—';
  const verifyUrl = buildVerifyUrl(card.productType, card.warrantyCode);
  const isApproved = String(card.status).toLowerCase() === 'approved';

  return (
    <div className="space-y-3" data-testid="warranty-card">
      {/* Card face — mirrors the P91Elite certificate */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-4 text-white shadow-lg"
        style={{ backgroundColor: GREEN }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="text-sm font-bold tracking-widest">P91</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">
            E-Warranty Card
          </div>
        </div>

        <div className="relative z-10 mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">
              Vehicle Model
            </div>
            <div className="truncate text-lg font-bold leading-tight">{vehicle}</div>

            <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">
              Warranty ID
            </div>
            <div className="truncate font-mono text-sm font-semibold" data-testid="text-warranty-code">
              {card.warrantyCode}
            </div>
          </div>

          <div className="shrink-0 text-center">
            <div className="rounded-md bg-white p-1.5">
              <QRCodeCanvas value={verifyUrl} size={68} level="M" />
            </div>
            <div className="mt-1 text-[8px] text-white/70">{verifyCaptionFor(card.productType)}</div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            isApproved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
          data-testid="badge-warranty-status"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {isApproved ? 'Approved' : String(card.status)}
        </span>
        {card.statusStale && (
          <span className="text-[11px] text-muted-foreground">
            Status couldn't be refreshed from P91 Elite — showing last known.
          </span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3">
        <Field label="Customer" value={card.name || '—'} />
        <Field label="VIN / Reg no." value={card.vehicleVIN || '—'} />
        <Field label="Installer" value={card.installer || '—'} />
        <Field label="Store" value={card.storeName || '—'} />
        <Field label="Installed on" value={formatDate(card.installationDate)} />
        <Field label="Valid until" value={resolveExpiry(card)} />
        <Field label="Product" value={card.productType || '—'} />
        <Field label="Location" value={card.storeLocation || '—'} />
        <div className="col-span-2">
          <Field label="Batch / lot numbers" value={formatLots(card.lotNumbers)} />
        </div>
      </div>

      <a
        href={verifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
        data-testid="link-verify-warranty"
      >
        Verify online
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
