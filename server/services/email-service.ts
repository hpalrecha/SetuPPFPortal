import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private sesClient: SESClient | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;
  private sesConfigured = false;
  private smtpConfigured = false;
  private senderEmail: string;

  constructor() {
    this.senderEmail = process.env.FROM_EMAIL || process.env.EMAIL_SENDER || 'noreply@p91india.com';
    this.initialize();
  }

  private initialize() {
    const {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION = 'ap-south-1',
      SES_SMTP_USERNAME,
      SES_SMTP_PASSWORD
    } = process.env;

    // Initialize AWS SES SDK (Primary method)
    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
      try {
        this.sesClient = new SESClient({
          region: AWS_REGION,
          credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY
          }
        });
        this.sesConfigured = true;
        console.log('✅ AWS SES SDK configured successfully (Primary)');
      } catch (error) {
        console.error('❌ Failed to configure AWS SES SDK:', error);
        this.sesConfigured = false;
      }
    }

    // Initialize SMTP as fallback
    if (SES_SMTP_USERNAME && SES_SMTP_PASSWORD) {
      try {
        const cleanRegion = AWS_REGION.trim();
        const sesHost = cleanRegion.includes('email-smtp') 
          ? cleanRegion 
          : `email-smtp.${cleanRegion}.amazonaws.com`;
          
        this.smtpTransporter = nodemailer.createTransport({
          host: sesHost,
          port: 587,
          secure: false,
          auth: {
            user: SES_SMTP_USERNAME,
            pass: SES_SMTP_PASSWORD
          }
        });
        this.smtpConfigured = true;
        console.log('✅ SMTP configured successfully (Fallback)');
      } catch (error) {
        console.error('❌ Failed to configure SMTP:', error);
        this.smtpConfigured = false;
      }
    } else if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
      // Fallback: use AWS credentials for SMTP if SMTP credentials not provided
      try {
        const cleanRegion = AWS_REGION.trim();
        const sesHost = cleanRegion.includes('email-smtp') 
          ? cleanRegion 
          : `email-smtp.${cleanRegion}.amazonaws.com`;
          
        this.smtpTransporter = nodemailer.createTransport({
          host: sesHost,
          port: 587,
          secure: false,
          auth: {
            user: AWS_ACCESS_KEY_ID,
            pass: AWS_SECRET_ACCESS_KEY
          }
        });
        this.smtpConfigured = true;
        console.log('✅ SMTP configured with AWS credentials (Fallback)');
      } catch (error) {
        console.error('❌ Failed to configure SMTP with AWS credentials:', error);
        this.smtpConfigured = false;
      }
    }

    if (!this.sesConfigured && !this.smtpConfigured) {
      console.log('⚠️ No email service configured - running in development mode');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;
    const recipients = Array.isArray(to) ? to : [to];

    // Development mode - just log
    if (!this.sesConfigured && !this.smtpConfigured) {
      console.log('📧 [DEV MODE] Email would be sent:');
      console.log('From:', this.senderEmail);
      console.log('To:', recipients.join(', '));
      console.log('Subject:', subject);
      console.log('HTML:', html ? 'Present' : 'Not provided');
      console.log('Text:', text ? 'Present' : 'Not provided');
      return true;
    }

    // Try AWS SES SDK first (Primary)
    if (this.sesConfigured && this.sesClient) {
      try {
        const command = new SendEmailCommand({
          Source: this.senderEmail,
          Destination: {
            ToAddresses: recipients
          },
          Message: {
            Subject: {
              Data: subject,
              Charset: 'UTF-8'
            },
            Body: {
              Html: html ? {
                Data: html,
                Charset: 'UTF-8'
              } : undefined,
              Text: text ? {
                Data: text,
                Charset: 'UTF-8'
              } : undefined
            }
          }
        });

        const result = await this.sesClient.send(command);
        console.log('✅ Email sent via AWS SES SDK:', result.MessageId);
        return true;
      } catch (error) {
        console.error('❌ AWS SES SDK failed, trying SMTP fallback:', error);
      }
    }

    // Fallback to SMTP
    if (this.smtpConfigured && this.smtpTransporter) {
      try {
        const mailOptions = {
          from: this.senderEmail,
          to: recipients.join(', '),
          subject,
          html,
          text
        };

        const result = await this.smtpTransporter.sendMail(mailOptions);
        console.log('✅ Email sent via SMTP fallback:', result.messageId);
        return true;
      } catch (error) {
        console.error('❌ SMTP fallback also failed:', error);
        return false;
      }
    }

    console.error('❌ No email service available');
    return false;
  }

  // Predefined email templates
  async sendJobCardCompletionNotification(
    recipientEmail: string,
    jobCardData: {
      jobCardId: string;
      workOrderNumber: string;
      vehicleDetails: string;
      completedAt: Date;
      partnerName: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Card Completed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .status-badge { background: #10b981; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; }
          .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Job Card Completed</h1>
          </div>
          <div class="content">
            <p>Dear Customer,</p>
            <p>Your job card has been successfully completed and is ready for review.</p>
            
            <div class="details">
              <h3>Job Details:</h3>
              <p><strong>Job Card ID:</strong> ${jobCardData.jobCardId}</p>
              <p><strong>Work Order:</strong> ${jobCardData.workOrderNumber}</p>
              <p><strong>Vehicle:</strong> ${jobCardData.vehicleDetails}</p>
              <p><strong>Completed By:</strong> ${jobCardData.partnerName}</p>
              <p><strong>Completed At:</strong> ${jobCardData.completedAt.toLocaleString()}</p>
              <p><strong>Status:</strong> <span class="status-badge">COMPLETED</span></p>
            </div>
            
            <p>The work has been completed and is now pending approval. You will receive another notification once the work is approved.</p>
            
            <p>Thank you for choosing our services!</p>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Job Card Completed - ${jobCardData.workOrderNumber}`,
      html
    });
  }

  async sendJobCardApprovalNotification(
    recipientEmail: string,
    jobCardData: {
      jobCardId: string;
      workOrderNumber: string;
      vehicleDetails: string;
      approvedAt: Date;
      approvedBy: string;
      payoutAmount?: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Card Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .status-badge { background: #10b981; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; }
          .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .payout-info { background: #dcfce7; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Job Card Approved! 🎉</h1>
          </div>
          <div class="content">
            <p>Congratulations! Your job card has been approved.</p>
            
            <div class="details">
              <h3>Job Details:</h3>
              <p><strong>Job Card ID:</strong> ${jobCardData.jobCardId}</p>
              <p><strong>Work Order:</strong> ${jobCardData.workOrderNumber}</p>
              <p><strong>Vehicle:</strong> ${jobCardData.vehicleDetails}</p>
              <p><strong>Approved By:</strong> ${jobCardData.approvedBy}</p>
              <p><strong>Approved At:</strong> ${jobCardData.approvedAt.toLocaleString()}</p>
              <p><strong>Status:</strong> <span class="status-badge">APPROVED</span></p>
            </div>
            
            ${jobCardData.payoutAmount ? `
            <div class="payout-info">
              <h3>💰 Payout Information</h3>
              <p><strong>Payout Amount:</strong> ₹${jobCardData.payoutAmount}</p>
              <p>Your payout has been processed and will be credited to your account.</p>
            </div>
            ` : ''}
            
            <p>Thank you for your excellent work! Keep up the great service.</p>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Job Card Approved - ${jobCardData.workOrderNumber}`,
      html
    });
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    resetToken: string,
    userName: string
  ): Promise<boolean> {
    // Use REPLIT_DEV_DOMAIN for deployed URL, fallback to localhost for local dev
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : (process.env.FRONTEND_URL || 'http://localhost:5000');
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 30px; }
          .reset-button { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: bold; }
          .reset-link { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 15px 0; word-break: break-all; font-family: monospace; color: #475569; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 14px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; color: #92400e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔒 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            
            <p>We received a request to reset your password for your SetuPPF account. If you didn't make this request, you can safely ignore this email.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <a href="${resetUrl}" class="reset-button">Reset My Password</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <div class="reset-link">${resetUrl}</div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong> for security</li>
                <li>This link can only be used once</li>
                <li>If you didn't request this reset, please ignore this email</li>
              </ul>
            </div>
            
            <p>If you continue to have problems, please contact our support team.</p>
            
            <p>Thank you,<br>The SetuPPF Team</p>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services<br>
            This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: 'Password Reset Request - SetuPPF',
      html
    });
  }

  async sendOTPEmail(
    recipientEmail: string,
    otp: string,
    purpose: 'verification' | 'password_reset' = 'verification'
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your OTP Code</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 30px; text-align: center; }
          .otp-code { background: #f1f5f9; border: 2px dashed #3b82f6; padding: 20px; margin: 20px 0; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #3b82f6; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔐 Your OTP Code</h1>
          </div>
          <div class="content">
            <p>Use the following OTP code to ${purpose === 'verification' ? 'verify your account' : 'reset your password'}:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p><strong>Important:</strong> This OTP is valid for 10 minutes only. Do not share this code with anyone.</p>
            
            <p>If you didn't request this OTP, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services<br>
            This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Your OTP Code - ${purpose === 'verification' ? 'Account Verification' : 'Password Reset'}`,
      html
    });
  }

  // Work Order notification templates
  async sendWorkOrderCreatedNotification(
    recipientEmail: string,
    workOrderData: {
      workOrderId: string;
      workOrderNumber: string;
      vehicleDetails: string;
      serviceDetails: string;
      customerName?: string;
      estimatedPrice?: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📝 New Work Order Created</h1>
          </div>
          <div class="content">
            <p>A new work order has been created:</p>
            <div class="details">
              <p><strong>Work Order #:</strong> ${workOrderData.workOrderNumber}</p>
              <p><strong>Vehicle:</strong> ${workOrderData.vehicleDetails}</p>
              <p><strong>Service:</strong> ${workOrderData.serviceDetails}</p>
              ${workOrderData.customerName ? `<p><strong>Customer:</strong> ${workOrderData.customerName}</p>` : ''}
              ${workOrderData.estimatedPrice ? `<p><strong>Estimated Price:</strong> ₹${workOrderData.estimatedPrice}</p>` : ''}
            </div>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `New Work Order Created - ${workOrderData.workOrderNumber}`,
      html
    });
  }

  async sendWorkOrderUpdatedNotification(
    recipientEmail: string,
    workOrderData: {
      workOrderId: string;
      workOrderNumber: string;
      status: string;
      updateDetails: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔄 Work Order Updated</h1>
          </div>
          <div class="content">
            <p>Work Order ${workOrderData.workOrderNumber} has been updated:</p>
            <div class="details">
              <p><strong>Status:</strong> ${workOrderData.status}</p>
              <p><strong>Update:</strong> ${workOrderData.updateDetails}</p>
            </div>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Work Order Updated - ${workOrderData.workOrderNumber}`,
      html
    });
  }

  async sendWorkOrderCompletedNotification(
    recipientEmail: string,
    workOrderData: {
      workOrderId: string;
      workOrderNumber: string;
      vehicleDetails: string;
      completedAt: Date;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">✅ Work Order Completed</h1>
          </div>
          <div class="content">
            <p>Work Order has been successfully completed:</p>
            <div class="details">
              <p><strong>Work Order #:</strong> ${workOrderData.workOrderNumber}</p>
              <p><strong>Vehicle:</strong> ${workOrderData.vehicleDetails}</p>
              <p><strong>Completed At:</strong> ${workOrderData.completedAt.toLocaleString()}</p>
            </div>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Work Order Completed - ${workOrderData.workOrderNumber}`,
      html
    });
  }

  async sendJobCardCreatedNotification(
    recipientEmail: string,
    jobCardData: {
      jobCardId: string;
      workOrderNumber: string;
      vehicleDetails: string;
      assignedTo?: string;
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; }
          .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔧 New Job Card Created</h1>
          </div>
          <div class="content">
            <p>A new job card has been created:</p>
            <div class="details">
              <p><strong>Job Card ID:</strong> ${jobCardData.jobCardId}</p>
              <p><strong>Work Order:</strong> ${jobCardData.workOrderNumber}</p>
              <p><strong>Vehicle:</strong> ${jobCardData.vehicleDetails}</p>
              ${jobCardData.assignedTo ? `<p><strong>Assigned To:</strong> ${jobCardData.assignedTo}</p>` : ''}
            </div>
          </div>
          <div class="footer">
            <p>SetuPPF - Professional Paint Protection Film Services</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `New Job Card Created - ${jobCardData.workOrderNumber}`,
      html
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();