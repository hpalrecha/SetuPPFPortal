// Meta WhatsApp Business API integration

export interface WhatsAppMessage {
  to: string; // Phone number with country code (e.g., +919876543210)
  type: 'template' | 'text' | 'image' | 'document';
  template?: {
    name: string;
    language: string;
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
      if (!this.isConfigured || !this.config) {
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
      const endpoint = `${this.baseUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(message.to),
        type: message.type,
        ...this.buildMessagePayload(message)
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
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

  // Job Card Lifecycle Templates (5 templates as per requirement)
  
  // 1. Job Card Created - Send to: Customer + Assigned Detailer/Partner
  // Template: "A new Job Card *{{1}}* has been created for vehicle *{{2}}*. Assigned to *{{3}}*."
  async sendJobCardCreated(
    phoneNumber: string,
    jobCardId: string,
    vehicleDetails: string,
    partnerName: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_created',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: jobCardId },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: partnerName }
            ]
          }
        ]
      }
    });
  }

  // 2. Job Card Scheduled - Send to: Detailer/Partner
  // Template: "Job Card *{{1}}* is scheduled on *{{2}}*. Assigned detailer: *{{3}}*."
  async sendJobCardScheduled(
    phoneNumber: string,
    jobCardId: string,
    scheduledDate: string,
    detailerName: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_scheduled',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: jobCardId },
              { type: 'text', text: scheduledDate },
              { type: 'text', text: detailerName }
            ]
          }
        ]
      }
    });
  }

  // 3. Job Card Started - Send to: Showroom POC + Admin
  // Template: "Job Card *{{1}}* has been started by *{{2}}*. Please monitor progress."
  async sendJobCardStarted(
    phoneNumber: string,
    jobCardId: string,
    partnerName: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_started',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: jobCardId },
              { type: 'text', text: partnerName }
            ]
          }
        ]
      }
    });
  }

  // 4. Job Card Completed - Send to: Showroom POC (request approval)
  // Template: "Job Card *{{1}}* has been completed. Please review and approve."
  async sendJobCardCompleted(
    phoneNumber: string,
    jobCardId: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_completed',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: jobCardId }
            ]
          }
        ]
      }
    });
  }

  // 5. Job Card Approved - Send to: Detailer/Partner (approval confirmation)
  // Template: "Job Card *{{1}}* has been approved by showroom/admin. Work successfully closed."
  async sendJobCardApproved(
    phoneNumber: string,
    jobCardId: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_approved',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: jobCardId }
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