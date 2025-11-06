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
  }> {
    try {
      // Log received payload for debugging
      console.log('📥 Pulse webhook payload received:', JSON.stringify(payload, null, 2));
      
      // Validate payload
      this.validatePayload(payload);

      // Create or update partner first (pass full user data for contact details)
      const partnerId = await this.ensurePartner(payload.user, actorId);

      if (payload.action === 'activate') {
        return await this.activateUser(payload, partnerId, actorId);
      } else if (payload.action === 'deactivate') {
        return await this.deactivateUser(payload, partnerId, actorId);
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
   */
  private async ensurePartner(userData: PulseWebhookPayload['user'], actorId?: string): Promise<string> {
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
        return existingPartner.id;
      }

      // Create new partner with all contact details
      const newPartner = await storage.createPartner({
        displayName: userData.name,
        ...partnerData,
        canViewJobCardPrice: false
      });

      // Audit log
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
      return newPartner.id;
    } catch (error: any) {
      console.error('❌ Failed to ensure partner:', error);
      throw new Error(`Failed to create/update partner: ${error.message}`);
    }
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

    if (!payload.user.name) {
      throw new Error('Missing required field: user.name (partner business name)');
    }

    if (!payload.user.role) {
      throw new Error('Missing required field: user.role (partner type)');
    }

    if (!['STUDIO', 'INSTALLER'].includes(payload.user.role)) {
      throw new Error('Invalid partner type - only STUDIO and INSTALLER are supported');
    }

    // Validate timestamp is recent (within 5 minutes)
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
