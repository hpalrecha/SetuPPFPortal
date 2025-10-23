// Meta WhatsApp Business API integration
// Uses single WABA configuration for all messages (no brand-specific configs)

export interface WhatsAppMessage {
  to: string; // Phone number with country code (e.g., +919876543210)
  type: 'template' | 'text' | 'image' | 'document';
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
  text?: {
    body: string;
  };
  image?: {
    link: string;
    caption?: string;
  };
}

export interface MetaWABAConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion?: string;
}

export class WhatsAppService {
  private config: MetaWABAConfig | null = null;
  private isConfigured = false;
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://graph.facebook.com';
    this.initialize();
  }

  private initialize() {
    const {
      META_WABA_ACCESS_TOKEN,
      META_WABA_PHONE_NUMBER_ID,
      META_WABA_BUSINESS_ACCOUNT_ID,
      META_WABA_API_VERSION = 'v18.0'
    } = process.env;

    if (META_WABA_ACCESS_TOKEN && META_WABA_PHONE_NUMBER_ID && META_WABA_BUSINESS_ACCOUNT_ID) {
      try {
        this.config = {
          accessToken: META_WABA_ACCESS_TOKEN,
          phoneNumberId: META_WABA_PHONE_NUMBER_ID,
          businessAccountId: META_WABA_BUSINESS_ACCOUNT_ID,
          apiVersion: META_WABA_API_VERSION
        };
        this.isConfigured = true;
        console.log('✅ Meta WhatsApp Business API configured successfully');
        console.log(`📱 WhatsApp messages will be sent from Phone Number ID: ${META_WABA_PHONE_NUMBER_ID}`);
      } catch (error) {
        console.error('❌ Failed to configure Meta WhatsApp Business API:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('⚠️ Meta WABA credentials not found - running in development mode');
      this.isConfigured = false;
    }
  }

  async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    try {
      // Use default WABA config
      const wabaConfig = this.config;

      if (!wabaConfig) {
        // Development mode - log message content
        console.log('📱 [DEV MODE] WhatsApp message would be sent:');
        console.log('To:', message.to);
        console.log('Type:', message.type);
        if (message.template) {
          console.log('Template:', message.template.name);
          console.log('Language:', message.template.language);
        } else if (message.text) {
          console.log('Text:', message.text.body);
        }
        console.log('--- WhatsApp Message Content ---');
        console.log(this.formatMessageForLog(message));
        console.log('--- End WhatsApp Message ---');
        return true;
      }

      // Production mode - send actual WhatsApp message via Meta API
      const endpoint = `${this.baseUrl}/${wabaConfig.apiVersion}/${wabaConfig.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(message.to),
        type: message.type,
        ...this.buildMessagePayload(message)
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wabaConfig.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meta WABA API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ WhatsApp message sent successfully. Message ID: ${result.messages?.[0]?.id}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send WhatsApp message:', error);
      return false;
    }
  }

  private buildMessagePayload(message: WhatsAppMessage): any {
    switch (message.type) {
      case 'template':
        return {
          template: message.template
        };
      case 'text':
        return {
          text: message.text
        };
      case 'image':
        return {
          image: message.image
        };
      default:
        throw new Error(`Unsupported message type: ${message.type}`);
    }
  }

  private formatMessageForLog(message: WhatsAppMessage): string {
    if (message.template) {
      return `Template: ${message.template.name} (${message.template.language})`;
    } else if (message.text) {
      return message.text.body;
    } else if (message.image) {
      return `Image: ${message.image.link} ${message.image.caption ? '- ' + message.image.caption : ''}`;
    }
    return 'Unknown message format';
  }

  // Send message using database template (simplified - no brand dependency)
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode: string,
    parameters: { [key: string]: string },
    buttonUrl?: string
  ): Promise<boolean> {
    try {
      // Build template components
      const components: any[] = [];
      
      // Add body parameters if any
      const parameterValues = Object.values(parameters);
      if (parameterValues.length > 0) {
        const bodyParams = parameterValues.map(value => ({
          type: 'text',
          text: value
        }));
        
        components.push({
          type: 'body',
          parameters: bodyParams
        });
      }
      
      // Add button URL parameter if provided
      if (buttonUrl) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: buttonUrl }]
        });
      }

      // Send message using default WABA configuration
      return await this.sendMessage({
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components
        }
      });
    } catch (error) {
      console.error(`❌ Failed to send template message:`, error);
      return false;
    }
  }

  // Job Card Lifecycle Templates - Aligned with Meta Approved Templates
  
  // 1. Job Card Created - Send to: Assigned Partner
  // Template: job_card_created (English IND)
  // Variables: {{1}} Partner Name, {{2}} Job Card ID, {{3}} Vehicle, {{4}} Location, {{5}} Service, {{6}} Link
  async sendJobCardCreated(
    phoneNumber: string,
    partnerName: string,
    jobCardId: string,
    vehicleDetails: string,
    showroomName: string,
    serviceName: string,
    jobCardLink: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_created',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: partnerName },
              { type: 'text', text: jobCardId },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: showroomName },
              { type: 'text', text: serviceName },
              { type: 'text', text: jobCardLink }
            ]
          }
        ]
      }
    });
  }

  // 2. Job Card Pending Approval - Send to: Order Placer
  // Template: job_card_pending_approval (English IND)
  // Variables: {{1}} User Name, {{2}} Job Card ID, {{3}} Vehicle, {{4}} Partner, {{5}} Link
  async sendJobCardPendingApproval(
    phoneNumber: string,
    userName: string,
    jobCardId: string,
    vehicleDetails: string,
    partnerName: string,
    jobCardLink: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_pending_approval',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: userName },
              { type: 'text', text: jobCardId },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: partnerName },
              { type: 'text', text: jobCardLink }
            ]
          }
        ]
      }
    });
  }

  // 3. Job Card Approved - Send to: Assigned Partner
  // Template: job_card_approved (English)
  // Variables: {{1}} Partner Name, {{2}} Job Card ID, {{3}} Vehicle, {{4}} Payout Amount, {{5}} Link
  async sendJobCardApproved(
    phoneNumber: string,
    partnerName: string,
    jobCardId: string,
    vehicleDetails: string,
    payoutAmount: string,
    jobCardLink: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_approved',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: partnerName },
              { type: 'text', text: jobCardId },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: payoutAmount },
              { type: 'text', text: jobCardLink }
            ]
          }
        ]
      }
    });
  }

  // 4. Job Card Rejected - Send to: Assigned Partner
  // Template: job_card_rejected (English)
  // Variables: {{1}} Partner Name, {{2}} Job Card ID, {{3}} Vehicle, {{4}} Rejection Reason, {{5}} Link
  async sendJobCardRejected(
    phoneNumber: string,
    partnerName: string,
    jobCardId: string,
    vehicleDetails: string,
    rejectionReason: string,
    jobCardLink: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_rejected',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: partnerName },
              { type: 'text', text: jobCardId },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: rejectionReason },
              { type: 'text', text: jobCardLink }
            ]
          }
        ]
      }
    });
  }

  // 5. Job Card Completed - Send to: Order Placer
  // Template: job_card_completed (English)
  // Variables: {{1}} User Name, {{2}} Job Card ID, {{3}} Vehicle, {{4}} Partner, {{5}} Link
  async sendJobCardCompleted(
    phoneNumber: string,
    userName: string,
    jobCardId: string,
    vehicleDetails: string,
    partnerName: string,
    jobCardLink: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_completed',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: userName },
              { type: 'text', text: jobCardId },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: partnerName },
              { type: 'text', text: jobCardLink }
            ]
          }
        ]
      }
    });
  }

  async sendCustomMessage(phoneNumber: string, message: string): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'text',
      text: {
        body: message
      }
    });
  }

  // Utility method to validate phone number format
  formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Add country code if not present (assuming India +91)
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      return `91${cleaned}`;
    }
    
    // Remove + for Meta API (it expects numbers without +)
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1);
    }
    
    return cleaned;
  }

  // Check if WhatsApp service is available
  isAvailable(): boolean {
    return this.isConfigured;
  }

  // Get configuration status
  getStatus(): { configured: boolean; phoneNumberId?: string; businessAccountId?: string } {
    return {
      configured: this.isConfigured,
      phoneNumberId: this.config?.phoneNumberId,
      businessAccountId: this.config?.businessAccountId
    };
  }

  // Verify webhook signature (for receiving webhook events)
  verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
  }
}

export const whatsappService = new WhatsAppService();