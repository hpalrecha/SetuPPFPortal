import crypto from 'crypto';

/**
 * Outbound API client for the Pulse platform (P91 Pulse / Elite).
 * Requests are signed with HMAC-SHA256 over the JSON body using the shared
 * PULSE_WEBHOOK_SECRET (same secret Pulse uses for its inbound webhook to us),
 * sent in the `x-setu-signature` header.
 */

export interface StaffInviteRequest {
  setuPartnerId?: string;
  setuPartnerName?: string;
  userRole: 'PARTNER_STAFF' | 'DETAILING_PARTNER';
  email?: string;
  inviterUserId?: string;
  inviterName?: string;
  inviterRole?: string;
}

export interface StaffInviteResponse {
  success: boolean;
  token?: string;
  registrationLink?: string;
  expiresAt?: string;
  emailSent?: boolean;
  error?: string;
}

/**
 * Payload pushed to P91Elite to register a P91-branded e-warranty for a settled
 * job card. Mirrors P91Elite's detailer warranty registration sub-forms.
 */
export interface WarrantyRegistrationRequest {
  // Identity: P91Elite resolves its own user via users.ppf_setu_user_id = setuUserId
  setuUserId: string;
  setuJobCardId: string;
  // Installer & showroom
  installerName?: string;
  installerMobile?: string;
  storeName?: string;
  storeEmail?: string;
  storeLocation?: string;
  // Customer (HNI flags allow blank contact fields)
  customerFirstName?: string;
  customerLastName?: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  hniMobile?: boolean;
  hniEmail?: boolean;
  hniAddress?: boolean;
  // Car
  carMake?: string;
  carModel?: string;
  carRegOrVIN?: string;
  carColor?: string;
  // Installation
  productInstalled?: string;
  installationDate?: string; // yyyy-MM-dd
  fullCarPPF?: boolean;
  // Product & photos
  lotNumbers: Array<{ lotNumber: string; quantity: number }>;
  photos?: string[];
}

export interface WarrantyRegistrationResponse {
  success: boolean;
  warranty?: { code: string; status: string };
  /** Machine-readable failure reason, e.g. USER_NOT_LINKED | BATCH_INVALID */
  errorCode?: string;
  error?: string;
}

export class PulseApiService {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor() {
    this.baseUrl = (process.env.PULSE_API_URL || '').replace(/\/$/, '');
    this.secret = process.env.PULSE_WEBHOOK_SECRET || '';

    if (!this.baseUrl) {
      console.warn('⚠️ PULSE_API_URL not configured - Pulse staff invites disabled');
    }
    if (!this.secret) {
      console.warn('⚠️ PULSE_WEBHOOK_SECRET not configured - Pulse API requests cannot be signed');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.secret);
  }

  private sign(body: string): string {
    return crypto.createHmac('sha256', this.secret).update(body).digest('hex');
  }

  /**
   * Ask Pulse to create a partner-tagged staff invite link.
   * The invited person registers on Pulse; once approved and granted Setu
   * access there, Pulse's webhook creates them here under this partner.
   */
  async requestStaffInvite(request: StaffInviteRequest): Promise<StaffInviteResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Pulse integration is not configured (PULSE_API_URL / PULSE_WEBHOOK_SECRET)' };
    }

    const payload = {
      ...request,
      setuInviterUserId: request.inviterUserId,
      setuInviterName: request.inviterName,
      setuInviterRole: request.inviterRole,
      timestamp: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/api/integrations/setu/staff-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-setu-signature': this.sign(body),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        console.error('❌ Pulse staff-invite request failed:', response.status, data);
        return { success: false, error: data.error || `Pulse responded with status ${response.status}` };
      }

      return data as StaffInviteResponse;
    } catch (error: any) {
      console.error('❌ Pulse staff-invite request error:', error);
      const message = error?.name === 'AbortError' ? 'Pulse request timed out' : (error?.message || 'Failed to reach Pulse');
      return { success: false, error: message };
    }
  }

  /**
   * Register a P91-branded e-warranty in P91Elite for a settled job card.
   * Synchronous: the caller only marks the job card e-warranty-applied on success,
   * so a rejected batch number / unlinked user leaves the job card re-tryable.
   */
  async requestWarrantyRegistration(request: WarrantyRegistrationRequest): Promise<WarrantyRegistrationResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Pulse integration is not configured (PULSE_API_URL / PULSE_WEBHOOK_SECRET)' };
    }

    const payload = { ...request, timestamp: new Date().toISOString() };
    const body = JSON.stringify(payload);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/api/integrations/setu/warranty-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-setu-signature': this.sign(body),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await response.json().catch(() => ({} as any));

      if (!response.ok || !data.success) {
        console.error('❌ Pulse warranty-registration request failed:', response.status, data);
        return {
          success: false,
          errorCode: data.errorCode,
          error: data.error || `Pulse responded with status ${response.status}`,
        };
      }

      return data as WarrantyRegistrationResponse;
    } catch (error: any) {
      console.error('❌ Pulse warranty-registration request error:', error);
      const message = error?.name === 'AbortError' ? 'Pulse request timed out' : (error?.message || 'Failed to reach Pulse');
      return { success: false, error: message };
    }
  }
}

export const pulseApiService = new PulseApiService();
