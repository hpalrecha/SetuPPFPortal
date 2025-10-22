import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import { emailService } from './email-service';
import { nanoid } from 'nanoid';

interface PulseWebhookPayload {
  action: 'activate' | 'deactivate';
  user: {
    email: string;
    name: string;
    phone?: string;
    role: 'PARTNER_ADMIN' | 'PARTNER_STAFF';
    partnerId: string;
    partnerType?: 'STUDIO' | 'INSTALLER';
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

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process webhook request from Pulse
   */
  async processWebhook(payload: PulseWebhookPayload, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
  }> {
    try {
      // Validate payload
      this.validatePayload(payload);

      // Verify partner exists
      const partner = await storage.getPartner(payload.user.partnerId);
      if (!partner) {
        throw new Error(`Partner not found: ${payload.user.partnerId}`);
      }

      if (payload.action === 'activate') {
        return await this.activateUser(payload, actorId);
      } else if (payload.action === 'deactivate') {
        return await this.deactivateUser(payload, actorId);
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
   * Activate user (create if new, enable if exists)
   */
  private async activateUser(payload: PulseWebhookPayload, actorId?: string): Promise<{
    success: boolean;
    message: string;
    userId: string;
  }> {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(payload.user.email);

    if (existingUser) {
      // User exists - activate if inactive
      if (existingUser.isActive) {
        return {
          success: true,
          message: 'User already active',
          userId: existingUser.id
        };
      }

      // Activate existing user
      await storage.updateUser(existingUser.id, {
        isActive: true,
        name: payload.user.name, // Update name in case it changed
        phone: payload.user.phone,
        role: payload.user.role,
        partnerId: payload.user.partnerId
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
        userId: existingUser.id
      };
    }

    // Create new user
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newUser = await storage.createUser({
      email: payload.user.email,
      name: payload.user.name,
      phone: payload.user.phone,
      role: payload.user.role,
      partnerId: payload.user.partnerId,
      passwordHash,
      isActive: true
    });

    // Send welcome email with password reset link
    await this.sendWelcomeEmail(newUser.email, newUser.name, newUser.id);

    // Audit log
    await storage.createAuditLog({
      actorUserId: actorId,
      entity: 'user',
      entityId: newUser.id,
      action: 'CREATED_BY_PULSE',
      diffJson: {
        email: payload.user.email,
        role: payload.user.role,
        partnerId: payload.user.partnerId,
        source: 'pulse_webhook'
      }
    });

    console.log(`✅ User created: ${payload.user.email}`);

    return {
      success: true,
      message: 'User created successfully',
      userId: newUser.id
    };
  }

  /**
   * Deactivate user
   */
  private async deactivateUser(payload: PulseWebhookPayload, actorId?: string): Promise<{
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

      // Get domain for reset link
      const domain = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';

      const resetLink = `${domain}/reset-password?token=${resetToken}`;

      // Send email
      await emailService.sendEmail({
        to: email,
        subject: 'Welcome to PPF Setu - Set Your Password',
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
                <h1 style="margin: 0;">Welcome to PPF Setu! 🎉</h1>
              </div>
              <div class="content">
                <p>Hello ${name},</p>
                
                <p>Your account has been created in the PPF Setu portal. You now have access to manage your installation services and track job cards.</p>
                
                <p><strong>To get started, please set your password:</strong></p>
                
                <a href="${resetLink}" class="button">Set Your Password</a>
                
                <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser:<br>${resetLink}</p>
                
                <p style="color: #ef4444; font-size: 14px;"><strong>Important:</strong> This link will expire in 24 hours.</p>
                
                <p>Once you've set your password, you can log in at:<br>
                <strong>${domain}/login</strong></p>
                
                <p>If you have any questions, please contact your administrator.</p>
              </div>
              <div class="footer">
                <p>SetuPPF - Professional Paint Protection Film Services</p>
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
   * Validate webhook payload
   */
  private validatePayload(payload: PulseWebhookPayload): void {
    if (!payload.action || !['activate', 'deactivate'].includes(payload.action)) {
      throw new Error('Invalid action');
    }

    if (!payload.user) {
      throw new Error('Missing user data');
    }

    if (!payload.user.email || !payload.user.name || !payload.user.role || !payload.user.partnerId) {
      throw new Error('Missing required user fields');
    }

    if (!['PARTNER_ADMIN', 'PARTNER_STAFF'].includes(payload.user.role)) {
      throw new Error('Invalid role - only PARTNER_ADMIN and PARTNER_STAFF are supported');
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
