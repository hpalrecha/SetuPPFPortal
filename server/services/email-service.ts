import nodemailer from 'nodemailer';

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
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION = 'ap-south-1',
      EMAIL_SENDER = 'noreply@setupppf.com'
    } = process.env;

    // Check if AWS credentials are available
    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
      try {
        this.transporter = nodemailer.createTransport({
          host: `email-smtp.${AWS_REGION}.amazonaws.com`,
          port: 587,
          secure: false, // Use STARTTLS
          auth: {
            user: AWS_ACCESS_KEY_ID,
            pass: AWS_SECRET_ACCESS_KEY
          }
        });
        this.isConfigured = true;
        console.log('✅ AWS SES email service configured successfully');
      } catch (error) {
        console.error('❌ Failed to configure AWS SES:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('⚠️ AWS SES credentials not found - running in development mode');
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const { to, subject, html, text, attachments } = options;
      const sender = process.env.EMAIL_SENDER || 'noreply@setupppf.com';

      if (!this.isConfigured || !this.transporter) {
        // Development mode - log email content
        console.log('📧 [DEV MODE] Email would be sent:');
        console.log('From:', sender);
        console.log('To:', Array.isArray(to) ? to.join(', ') : to);
        console.log('Subject:', subject);
        console.log('HTML:', html ? 'Present' : 'Not provided');
        console.log('Text:', text ? 'Present' : 'Not provided');
        console.log('Attachments:', attachments?.length || 0);
        if (html) {
          console.log('--- HTML CONTENT ---');
          console.log(html);
          console.log('--- END HTML CONTENT ---');
        }
        return true;
      }

      // Production mode - send actual email
      const mailOptions = {
        from: sender,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
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
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
    
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
}

// Export singleton instance
export const emailService = new EmailService();