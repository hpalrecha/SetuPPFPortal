import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import { emailService } from './email-service';
import { nanoid } from 'nanoid';

interface PulseWebhookPayload {
  action: 'activate' | 'deactivate';
  user: {
    name: string; // Partner business name (from Pulse)
    username?: string; // Username (from Pulse - not used)
    contactPersonName?: string; // Contact person name (optional)
    email: string; // Partner/User email
    phone?: string; // Partner/User phone (Pulse sends "phone")
    mobile?: string; // Partner/User phone (alternative field name)
    role: 'STUDIO' | 'INSTALLER'; // Partner type (from Pulse)
    partnerId?: string; // Partner ID from Pulse (not used)
    address?: string; // Partner address (optional)
    city?: string; // Partner city (optional)
    state?: string; // Partner state (optional)
    pincode?: string; // Partner pincode (optional)
    gstin?: string; // Partner GSTIN (optional)
    pan?: string; // Partner PAN (optional)
    // Staff-level fields (absent for legacy partner-level payloads):
    userLevel?: 'PARTNER' | 'STAFF'; // STAFF = user under an existing partner
    setuRole?: 'PARTNER_STAFF' | 'DETAILING_PARTNER'; // Setu role for STAFF users
    setuPartnerId?: string | null; // AUDIT-ONLY tag from the invite — never auto-assigns
    invitedByUserId?: string | null; // Which Setu user sent the invite (audit)
    invitedByName?: string | null;
    invitedByRole?: string | null;
    territory?: { // For future territory-based auto-assignment
      state?: string;
      city?: string;
      postalCode?: string;
    };
  };
  timestamp: string;
}

export class PulseWebhookService {
  private readonly webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.PULSE_WEBHOOK_SECRET || '';
    if (!this.webhookSecret) {
      console.warn('⚠️ PULSE_WEBHOOK_SECRET not configured - webhook security disabled!');
    }
  }

  /**
   * Verify HMAC signature from Pulse
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('⚠️ No webhook secret configured - skipping signature verification');
      return false;
    }

    if (!signature) {
      console.warn('⚠️ No signature provided in webhook request');
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');

      // Ensure both buffers are the same length before comparing
      if (signature.length !== expectedSignature.length) {
        console.warn('⚠️ Signature length mismatch');
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('❌ Signature verification error:', error);
      return false;
    }
  }

  /**
   * Process webhook request from Pulse
   */
  async processWebhook(payload: PulseWebhookPayload, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    partnerId?: string;
    pendingAssignment?: boolean;
  }> {
    try {
      // Log received payload for debugging
      console.log('📥 Pulse webhook payload received:', JSON.stringify(payload, null, 2));

      // Validate payload
      this.validatePayload(payload);

      // Staff-level users (installer staff / detailing partners invited by a
      // Setu partner) live UNDER an existing partner — they must never go
      // through ensurePartner, which would create a bogus partner named after
      // the person.
      if (payload.user.userLevel === 'STAFF') {
        if (payload.action === 'activate') {
          return await this.handleStaffActivate(payload, actorId);
        }
        return await this.handleStaffDeactivate(payload, actorId);
      }

      // Create or update partner first (pass full user data for contact details)
      // This also creates a PARTNER_ADMIN user if it's a new partner
      const partnerResult = await this.ensurePartner(payload.user, actorId);

      if (payload.action === 'activate') {
        // If user was already created during partner creation, just return success
        if (partnerResult.userCreated && partnerResult.userId) {
          return {
            success: true,
            message: 'Partner and user created successfully',
            userId: partnerResult.userId,
            partnerId: partnerResult.partnerId
          };
        }
        // Otherwise, handle user activation (for existing partners)
        return await this.activateUser(payload, partnerResult.partnerId, actorId);
      } else if (payload.action === 'deactivate') {
        return await this.deactivateUser(payload, partnerResult.partnerId, actorId);
      } else {
        throw new Error(`Invalid action: ${payload.action}`);
      }
    } catch (error: any) {
      console.error('❌ Pulse webhook error:', error);
      return {
        success: false,
        message: error.message || 'Failed to process webhook'
      };
    }
  }

  /**
   * Ensure partner exists (create if new, update if exists)
   * Looks up partner by displayName to find existing partners
   * Also creates a PARTNER_ADMIN user for new partners
   */
  private async ensurePartner(userData: PulseWebhookPayload['user'], actorId?: string): Promise<{ partnerId: string; userCreated: boolean; userId?: string }> {
    try {
      // Try to find existing partner by name OR email
      const allPartners = await storage.getPartners({});
      const existingPartner = allPartners.find(p => 
        p.displayName === userData.name || 
        (userData.email && p.email === userData.email)
      );

      // Prepare partner data with all contact details
      // Handle both "phone" and "mobile" field names from different sources
      const phoneNumber = userData.phone || userData.mobile;
      
      const partnerData: any = {
        type: userData.role,
        active: true,
        email: userData.email,
        phone: phoneNumber,
        contactPersonName: userData.contactPersonName,
        address: userData.address,
        city: userData.city,
        state: userData.state,
        pincode: userData.pincode,
        gstin: userData.gstin,
        pan: userData.pan
      };

      // Remove undefined fields
      Object.keys(partnerData).forEach(key => 
        partnerData[key] === undefined && delete partnerData[key]
      );

      if (existingPartner) {
        // Partner exists - update with all details
        await storage.updatePartner(existingPartner.id, partnerData);

        console.log(`✅ Partner updated: ${userData.name} (${existingPartner.id})`, {
          email: userData.email,
          phone: phoneNumber,
          contactPerson: userData.contactPersonName
        });
        return { partnerId: existingPartner.id, userCreated: false };
      }

      // Create new partner with all contact details
      const newPartner = await storage.createPartner({
        displayName: userData.name,
        ...partnerData,
        canViewJobCardPrice: false
      });

      // Audit log for partner
      await storage.createAuditLog({
        actorUserId: actorId,
        entity: 'partner',
        entityId: newPartner.id,
        action: 'CREATED_BY_PULSE',
        diffJson: {
          displayName: userData.name,
          email: userData.email,
          phone: phoneNumber,
          contactPersonName: userData.contactPersonName,
          type: userData.role,
          source: 'pulse_webhook'
        }
      });

      console.log(`✅ Partner created: ${userData.name} (${newPartner.id})`, {
        email: userData.email,
        phone: phoneNumber,
        contactPerson: userData.contactPersonName,
        address: userData.address,
        city: userData.city
      });

      // Create PARTNER_ADMIN user for new partner
      const userId = await this.createPartnerAdminUser(userData, newPartner.id, actorId);

      // Send notification emails to configured recipients
      await this.sendPartnerApplicationNotifications(
        userData.name,
        userData.email,
        phoneNumber,
        userData.city,
        userData.state,
        userData.role
      );

      return { partnerId: newPartner.id, userCreated: true, userId };
    } catch (error: any) {
      console.error('❌ Failed to ensure partner:', error);
      throw new Error(`Failed to create/update partner: ${error.message}`);
    }
  }

  /**
   * Create a PARTNER_ADMIN user for a new partner
   */
  private async createPartnerAdminUser(userData: PulseWebhookPayload['user'], partnerId: string, actorId?: string): Promise<string> {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      console.log(`⚠️ User already exists for email: ${userData.email}`);
      // Update existing user to link to this partner if not already linked
      if (!existingUser.partnerId) {
        await storage.updateUser(existingUser.id, {
          partnerId,
          isActive: true
        });
      }
      return existingUser.id;
    }

    // Use contact person name if provided, otherwise extract from email
    const userName = userData.contactPersonName || 
      userData.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Handle both "phone" and "mobile" field names
    const phoneNumber = userData.phone || userData.mobile;

    // Create new user
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    // Generate username from email
    const username = userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const newUser = await storage.createUser({
      username,
      email: userData.email,
      name: userName,
      phone: phoneNumber,
      role: 'PARTNER_ADMIN',
      partnerId,
      passwordHash,
      isActive: true
    });

    // Send welcome email with password reset link
    if (newUser.email) {
      await this.sendWelcomeEmail(newUser.email, newUser.name, newUser.id);
    }

    // Audit log for user
    await storage.createAuditLog({
      actorUserId: actorId,
      entity: 'user',
      entityId: newUser.id,
      action: 'CREATED_BY_PULSE',
      diffJson: {
        email: userData.email,
        role: 'PARTNER_ADMIN',
        partnerId,
        source: 'pulse_webhook'
      }
    });

    console.log(`✅ User created for partner: ${userData.email} (${newUser.id})`);
    return newUser.id;
  }

  /**
   * Activate user (create if new, enable if exists)
   */
  private async activateUser(payload: PulseWebhookPayload, partnerId: string, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId: string;
    partnerId: string;
  }> {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(payload.user.email);

    // Use contact person name if provided, otherwise extract from email
    const userName = payload.user.contactPersonName || 
      payload.user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Handle both "phone" and "mobile" field names
    const phoneNumber = payload.user.phone || payload.user.mobile;

    if (existingUser) {
      // User exists - activate if inactive
      if (existingUser.isActive) {
        return {
          success: true,
          message: 'User already active',
          userId: existingUser.id,
          partnerId
        };
      }

      // Activate existing user
      await storage.updateUser(existingUser.id, {
        isActive: true,
        phone: phoneNumber,
        role: 'PARTNER_ADMIN', // Default role for Pulse users
        partnerId
      });

      // Audit log
      await storage.createAuditLog({
        actorUserId: actorId,
        entity: 'user',
        entityId: existingUser.id,
        action: 'ACTIVATED_BY_PULSE',
        diffJson: {
          email: payload.user.email,
          source: 'pulse_webhook'
        }
      });

      console.log(`✅ User activated: ${payload.user.email}`);

      return {
        success: true,
        message: 'User activated successfully',
        userId: existingUser.id,
        partnerId
      };
    }

    // Create new user
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    // Generate username from email
    const username = payload.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const newUser = await storage.createUser({
      username,
      email: payload.user.email,
      name: userName,
      phone: phoneNumber,
      role: 'PARTNER_ADMIN', // Default role for Pulse users
      partnerId,
      passwordHash,
      isActive: true
    });

    // Send welcome email with password reset link
    if (newUser.email) {
      await this.sendWelcomeEmail(newUser.email, newUser.name, newUser.id);
    }

    // Audit log
    await storage.createAuditLog({
      actorUserId: actorId,
      entity: 'user',
      entityId: newUser.id,
      action: 'CREATED_BY_PULSE',
      diffJson: {
        email: payload.user.email,
        role: 'PARTNER_ADMIN',
        partnerId,
        source: 'pulse_webhook'
      }
    });

    console.log(`✅ User created: ${payload.user.email}`);

    return {
      success: true,
      message: 'User created successfully',
      userId: newUser.id,
      partnerId
    };
  }

  /**
   * Activate a staff-level user (PARTNER_STAFF / DETAILING_PARTNER).
   * If the tagged Setu partner is known and active, the user is created under
   * it; otherwise the user is created unassigned (partnerId null) and surfaces
   * in the admin "pending assignment" list for manual assignment.
   */
  private async handleStaffActivate(payload: PulseWebhookPayload, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    partnerId?: string;
    pendingAssignment?: boolean;
  }> {
    const staffRole = payload.user.setuRole!;
    const phoneNumber = payload.user.phone || payload.user.mobile;
    const userName = payload.user.name || payload.user.contactPersonName ||
      payload.user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // The invite tag is AUDIT-ONLY — it NEVER auto-assigns a working partner.
    // Every activation lands unassigned; a Setu admin assigns working
    // partner(s) from the Pending Partners screen (many-to-many).
    const pulseMetadata = {
      state: payload.user.territory?.state,
      city: payload.user.territory?.city,
      postalCode: payload.user.territory?.postalCode,
      requestedSetuPartnerId: payload.user.setuPartnerId || undefined,
      invitedByUserId: payload.user.invitedByUserId || undefined,
      invitedByName: payload.user.invitedByName || undefined,
      invitedByRole: payload.user.invitedByRole || undefined,
      source: 'pulse_webhook'
    };

    const existingUser = await storage.getUserByEmail(payload.user.email);

    if (existingUser) {
      // Never silently repurpose a non-partner account (admins, dealership users, ...)
      const partnerScopedRoles = ['PARTNER_ADMIN', 'PARTNER_STAFF', 'DETAILING_PARTNER'];
      if (!partnerScopedRoles.includes(existingUser.role)) {
        return {
          success: false,
          message: `Email belongs to an existing user with role ${existingUser.role}`
        };
      }

      // Idempotent update: reactivate and refresh details. Never touch
      // working-partner assignments here — that's admin-only, in the junction table.
      await storage.updateUser(existingUser.id, {
        isActive: true,
        role: staffRole,
        phone: phoneNumber || existingUser.phone,
        pulseMetadata
      });

      await storage.createAuditLog({
        actorUserId: actorId,
        entity: 'user',
        entityId: existingUser.id,
        action: 'ACTIVATED_BY_PULSE',
        diffJson: { email: payload.user.email, role: staffRole, userLevel: 'STAFF', source: 'pulse_webhook' }
      });

      const partnerIds = await storage.getActiveStaffPartnerIds(existingUser.id);
      console.log(`✅ Staff user activated: ${payload.user.email} (${staffRole})${partnerIds.length ? ` — ${partnerIds.length} working partner(s)` : ' - pending assignment'}`);

      return {
        success: true,
        message: partnerIds.length ? 'Staff user activated' : 'Staff user activated - pending partner assignment',
        userId: existingUser.id,
        pendingAssignment: partnerIds.length === 0
      };
    }

    // Create new staff user — always unassigned (partnerId null); the
    // requested partner is preserved as an audit hint in pulseMetadata only.
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const username = payload.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const newUser = await storage.createUser({
      username,
      email: payload.user.email,
      name: userName,
      phone: phoneNumber,
      role: staffRole,
      partnerId: null,
      pulseMetadata,
      passwordHash,
      isActive: true
    });

    // Send welcome email with password reset link
    if (newUser.email) {
      await this.sendWelcomeEmail(newUser.email, newUser.name, newUser.id);
    }

    await storage.createAuditLog({
      actorUserId: actorId,
      entity: 'user',
      entityId: newUser.id,
      action: 'CREATED_BY_PULSE',
      diffJson: {
        email: payload.user.email,
        role: staffRole,
        userLevel: 'STAFF',
        requestedSetuPartnerId: payload.user.setuPartnerId,
        invitedByName: payload.user.invitedByName,
        territory: payload.user.territory,
        source: 'pulse_webhook'
      }
    });

    console.log(`✅ Staff user created: ${payload.user.email} (${staffRole}) - pending partner assignment`);

    return {
      success: true,
      message: 'Staff user created - pending partner assignment',
      userId: newUser.id,
      pendingAssignment: true
    };
  }

  /**
   * Deactivate a staff-level user by email (no ensurePartner involved)
   */
  private async handleStaffDeactivate(payload: PulseWebhookPayload, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
  }> {
    const existingUser = await storage.getUserByEmail(payload.user.email);

    if (!existingUser) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    if (!existingUser.isActive) {
      return {
        success: true,
        message: 'User already inactive',
        userId: existingUser.id
      };
    }

    await storage.updateUser(existingUser.id, { isActive: false });

    await storage.createAuditLog({
      actorUserId: actorId,
      entity: 'user',
      entityId: existingUser.id,
      action: 'DEACTIVATED_BY_PULSE',
      diffJson: {
        email: payload.user.email,
        userLevel: 'STAFF',
        source: 'pulse_webhook'
      }
    });

    console.log(`✅ Staff user deactivated: ${payload.user.email}`);

    return {
      success: true,
      message: 'Staff user deactivated successfully',
      userId: existingUser.id
    };
  }

  /**
   * Deactivate user
   */
  private async deactivateUser(payload: PulseWebhookPayload, partnerId: string, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    partnerId?: string;
  }> {
    const existingUser = await storage.getUserByEmail(payload.user.email);

    if (!existingUser) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    if (!existingUser.isActive) {
      return {
        success: true,
        message: 'User already inactive',
        userId: existingUser.id
      };
    }

    // Deactivate user
    await storage.updateUser(existingUser.id, {
      isActive: false
    });

    // Audit log
    await storage.createAuditLog({
      actorUserId: actorId,
      entity: 'user',
      entityId: existingUser.id,
      action: 'DEACTIVATED_BY_PULSE',
      diffJson: {
        email: payload.user.email,
        source: 'pulse_webhook'
      }
    });

    console.log(`✅ User deactivated: ${payload.user.email}`);

    return {
      success: true,
      message: 'User deactivated successfully',
      userId: existingUser.id
    };
  }

  /**
   * Send partner application notification emails to configured recipients
   */
  private async sendPartnerApplicationNotifications(
    partnerName: string,
    partnerEmail: string,
    partnerPhone?: string,
    partnerCity?: string,
    partnerState?: string,
    partnerType?: string
  ): Promise<void> {
    try {
      const setting = await storage.getSystemSetting('partner_application_notification_emails');
      if (!setting) {
        console.log('ℹ️ No partner application notification emails configured - skipping');
        return;
      }

      const emails: string[] = Array.isArray(setting.value) ? setting.value : [];
      if (emails.length === 0) {
        console.log('ℹ️ Partner application notification emails list is empty - skipping');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Partner Application Activated</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #4db848 0%, #38a334 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 30px; }
            .details { background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">New Partner Application Activated</h1>
            </div>
            <div class="content">
              <p>A new partner application has been activated via the Pulse platform and onboarded to Pulse VAS.</p>
              <div class="details">
                <h3 style="margin-top: 0; color: #166534;">Partner Details</h3>
                <p><strong>Business Name:</strong> ${partnerName}</p>
                <p><strong>Email:</strong> ${partnerEmail}</p>
                ${partnerPhone ? `<p><strong>Phone:</strong> ${partnerPhone}</p>` : ''}
                ${partnerType ? `<p><strong>Partner Type:</strong> ${partnerType}</p>` : ''}
                ${partnerCity ? `<p><strong>City:</strong> ${partnerCity}</p>` : ''}
                ${partnerState ? `<p><strong>State:</strong> ${partnerState}</p>` : ''}
              </div>
              <p>The partner account has been created in Pulse VAS and a welcome email with login instructions has been sent to the partner.</p>
              <p style="color: #64748b; font-size: 13px;">This is an automated notification. You are receiving this because your email is configured to receive partner application alerts.</p>
            </div>
            <div class="footer">
              <p>Pulse VAS &mdash; Professional Paint Protection Film Services</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await Promise.all(emails.map(email =>
        emailService.sendEmail({
          to: email,
          subject: `New Partner Application Activated: ${partnerName}`,
          html
        })
      ));

      console.log(`✅ Partner application notification sent to: ${emails.join(', ')}`);
    } catch (error) {
      console.error('❌ Failed to send partner application notification emails:', error);
    }
  }

  /**
   * Generate temporary password
   */
  private generateTempPassword(): string {
    return nanoid(16); // Generate 16-character random password
  }

  /**
   * Send welcome email with password reset link
   */
  private async sendWelcomeEmail(email: string, name: string, userId: string): Promise<void> {
    try {
      // Generate password reset token
      const resetToken = nanoid(32);
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await storage.updateUser(userId, {
        resetToken,
        resetTokenExpiry
      });

      // Get domain for reset link - use PRODUCTION_URL first
      const domain = process.env.PRODUCTION_URL 
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
        || 'http://localhost:5000';

      const resetLink = `${domain}/reset-password?token=${resetToken}`;

      // Send email
      await emailService.sendEmail({
        to: email,
        subject: 'Welcome to Pulse VAS - Set Your Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4db848; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: #4db848; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Welcome to Pulse VAS! 🎉</h1>
              </div>
              <div class="content">
                <p>Hello ${name},</p>
                
                <p>Your account has been created in the Pulse VAS portal. You now have access to manage your installation services and track job cards.</p>
                
                <p><strong>To get started, please set your password:</strong></p>
                
                <a href="${resetLink}" class="button">Set Your Password</a>
                
                <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser:<br>${resetLink}</p>
                
                <p style="color: #ef4444; font-size: 14px;"><strong>Important:</strong> This link will expire in 24 hours.</p>
                
                <p>Once you've set your password, you can log in at:<br>
                <strong>${domain}/login</strong></p>
                
                <p>If you have any questions, please contact your administrator.</p>
              </div>
              <div class="footer">
                <p>Pulse VAS - Professional Paint Protection Film Services</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log(`✅ Welcome email sent to: ${email}`);
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      // Don't throw - user creation should still succeed
    }
  }

  /**
   * Validate webhook payload from Pulse
   */
  private validatePayload(payload: PulseWebhookPayload): void {
    if (!payload.action || !['activate', 'deactivate'].includes(payload.action)) {
      throw new Error('Invalid action - must be "activate" or "deactivate"');
    }

    if (!payload.user) {
      throw new Error('Missing user data');
    }

    if (!payload.user.email) {
      throw new Error('Missing required field: user.email');
    }

    if (payload.user.userLevel === 'STAFF') {
      // Staff-level payloads carry a Setu role instead of a partner type
      if (payload.action === 'activate' &&
          !['PARTNER_STAFF', 'DETAILING_PARTNER'].includes(payload.user.setuRole || '')) {
        throw new Error('Invalid setuRole - only PARTNER_STAFF and DETAILING_PARTNER are supported for staff users');
      }
      return this.validateTimestamp(payload);
    }

    if (!payload.user.name) {
      throw new Error('Missing required field: user.name (partner business name)');
    }

    if (!payload.user.role) {
      throw new Error('Missing required field: user.role (partner type)');
    }

    if (!['STUDIO', 'INSTALLER'].includes(payload.user.role)) {
      throw new Error('Invalid partner type - only STUDIO and INSTALLER are supported');
    }

    this.validateTimestamp(payload);
  }

  /**
   * Warn if the webhook timestamp is stale (within 5 minutes expected)
   */
  private validateTimestamp(payload: PulseWebhookPayload): void {
    if (payload.timestamp) {
      const timestamp = new Date(payload.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);

      if (diffMinutes > 5) {
        console.warn('⚠️ Webhook timestamp is more than 5 minutes old');
      }
    }
  }
}

export const pulseWebhookService = new PulseWebhookService();
