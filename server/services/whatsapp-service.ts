// Meta WhatsApp Business API integration
import { db } from '../db';
import { brands } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

export interface BrandWABAConfig {
  brandId?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
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

  // Job Card Lifecycle Templates - Conversational with Action Buttons
  
  // 1. Job Card Created - Send to: Customer + Assigned Detailer/Partner
  // Template: "Hey *{{1}}*! A new job card has been assigned to you for *{{2}}* at *{{3}}*. Service: *{{4}}*. Please acknowledge and start the work."
  async sendJobCardCreated(
    phoneNumber: string,
    partnerName: string,
    vehicleDetails: string,
    showroomName: string,
    serviceName: string,
    jobCardId: string
  ): Promise<boolean> {
    const jobCardUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourapp.replit.app'}/job-cards/${jobCardId}`;
    
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
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: showroomName },
              { type: 'text', text: serviceName }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: jobCardId }
            ]
          }
        ]
      }
    });
  }

  // 2. Job Card Scheduled - Send to: Detailer/Partner
  // Template: "Hi *{{1}}*! Your job is scheduled for *{{2}}* - *{{3}}* at *{{4}}*. Please be ready and confirm your availability."
  async sendJobCardScheduled(
    phoneNumber: string,
    partnerName: string,
    scheduledDate: string,
    vehicleDetails: string,
    showroomName: string,
    jobCardId: string
  ): Promise<boolean> {
    const jobCardUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourapp.replit.app'}/job-cards/${jobCardId}`;
    
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_scheduled',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: partnerName },
              { type: 'text', text: scheduledDate },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: showroomName }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: jobCardId }
            ]
          }
        ]
      }
    });
  }

  // 3. Job Card Started - Send to: Showroom POC + Admin
  // Template: "Hello! *{{1}}* has started working on *{{2}}* at your showroom. Service: *{{3}}*. You can monitor the progress."
  async sendJobCardStarted(
    phoneNumber: string,
    partnerName: string,
    vehicleDetails: string,
    serviceName: string,
    jobCardId: string
  ): Promise<boolean> {
    const jobCardUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourapp.replit.app'}/job-cards/${jobCardId}`;
    
    return this.sendMessage({
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'job_card_started',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: partnerName },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: serviceName }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: jobCardId }
            ]
          }
        ]
      }
    });
  }

  // 4. Job Card Completed - Send to: Showroom POC (request approval)
  // Template: "Great news! *{{1}}* has completed the work on *{{2}}*. Service: *{{3}}*. Please review and approve to close the job."
  async sendJobCardCompleted(
    phoneNumber: string,
    partnerName: string,
    vehicleDetails: string,
    serviceName: string,
    jobCardId: string
  ): Promise<boolean> {
    const jobCardUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourapp.replit.app'}/job-cards/${jobCardId}`;
    
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
              { type: 'text', text: partnerName },
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: serviceName }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: jobCardId }
            ]
          }
        ]
      }
    });
  }

  // 5. Job Card Approved - Send to: Detailer/Partner (approval confirmation)
  // Template: "Congratulations *{{1}}*! Your work on *{{2}}* has been approved by *{{3}}*. Payment will be processed soon. Thank you!"
  async sendJobCardApproved(
    phoneNumber: string,
    partnerName: string,
    vehicleDetails: string,
    approvedBy: string,
    jobCardId: string
  ): Promise<boolean> {
    const jobCardUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourapp.replit.app'}/job-cards/${jobCardId}`;
    
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
              { type: 'text', text: vehicleDetails },
              { type: 'text', text: approvedBy }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
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