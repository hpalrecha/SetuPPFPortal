import { Twilio } from 'twilio';

export interface WhatsAppMessage {
  to: string; // Phone number with country code (e.g., +919876543210)
  template?: string; // WhatsApp template name
  templateParams?: string[]; // Template parameters
  body?: string; // For non-template messages (sandbox mode)
  mediaUrl?: string; // Optional media attachment
}

export interface WhatsAppTemplate {
  name: string;
  params: string[];
}

export class WhatsAppService {
  private client: Twilio | null = null;
  private isConfigured = false;
  private fromNumber: string;

  constructor() {
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default
    this.initialize();
  }

  private initialize() {
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_FROM
    } = process.env;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        this.client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        this.isConfigured = true;
        console.log('✅ Twilio WhatsApp service configured successfully');
        console.log(`📱 WhatsApp messages will be sent from: ${this.fromNumber}`);
      } catch (error) {
        console.error('❌ Failed to configure Twilio WhatsApp service:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('⚠️ Twilio WhatsApp credentials not found - running in development mode');
      this.isConfigured = false;
    }
  }

  async sendMessage(message: WhatsAppMessage): Promise<boolean> {
    try {
      const { to, template, templateParams, body, mediaUrl } = message;

      if (!this.isConfigured || !this.client) {
        // Development mode - log message content
        console.log('📱 [DEV MODE] WhatsApp message would be sent:');
        console.log('From:', this.fromNumber);
        console.log('To:', to);
        if (template) {
          console.log('Template:', template);
          console.log('Parameters:', templateParams);
        } else {
          console.log('Body:', body);
        }
        if (mediaUrl) {
          console.log('Media URL:', mediaUrl);
        }
        console.log('--- WhatsApp Message Content ---');
        console.log(this.formatMessageForLog(message));
        console.log('--- End WhatsApp Message ---');
        return true;
      }

      // Ensure the 'to' number has WhatsApp prefix
      const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      // Production mode - send actual WhatsApp message
      let messageBody: string;
      
      if (template && templateParams) {
        // Use WhatsApp template (for approved templates)
        messageBody = this.buildTemplateMessage(template, templateParams);
      } else if (body) {
        // Use plain text (for sandbox mode or freeform messages)
        messageBody = body;
      } else {
        throw new Error('Either template or body must be provided');
      }

      const messageOptions: any = {
        from: this.fromNumber,
        to: whatsappTo,
        body: messageBody
      };

      if (mediaUrl) {
        messageOptions.mediaUrl = [mediaUrl];
      }

      const result = await this.client.messages.create(messageOptions);
      
      console.log(`✅ WhatsApp message sent successfully. SID: ${result.sid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send WhatsApp message:', error);
      return false;
    }
  }

  private buildTemplateMessage(templateName: string, params: string[]): string {
    // For approved templates, Twilio handles the template formatting
    // For development, we'll simulate the template rendering
    const templates: Record<string, string> = {
      'job_card_assigned': `🔧 *New Job Assignment*\n\nJob Card: {{1}}\nCustomer: {{2}}\nVehicle: {{3}}\nService: {{4}}\n\nPlease acknowledge within 2 hours.\n\n_SetuPPF Team_`,
      'job_card_completed': `✅ *Job Completed*\n\nJob Card: {{1}}\nCompleted by: {{2}}\nStatus: {{3}}\n\nThank you for your service!\n\n_SetuPPF Team_`
    };

    let template = templates[templateName] || '{{1}}';
    
    // Replace placeholders with actual parameters
    params.forEach((param, index) => {
      template = template.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
    });

    return template;
  }

  private formatMessageForLog(message: WhatsAppMessage): string {
    if (message.template && message.templateParams) {
      return this.buildTemplateMessage(message.template, message.templateParams);
    }
    return message.body || 'No message body';
  }

  // Predefined WhatsApp templates for SetuPPF
  async sendJobCardAssigned(
    phoneNumber: string,
    jobCardId: string,
    customerName: string,
    vehicleModel: string,
    serviceName: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      template: 'job_card_assigned',
      templateParams: [jobCardId, customerName, vehicleModel, serviceName]
    });
  }

  async sendJobCardCompleted(
    phoneNumber: string,
    jobCardId: string,
    detailerName: string,
    status: string
  ): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      template: 'job_card_completed',
      templateParams: [jobCardId, detailerName, status]
    });
  }

  async sendCustomMessage(phoneNumber: string, message: string): Promise<boolean> {
    return this.sendMessage({
      to: phoneNumber,
      body: message
    });
  }

  // Utility method to validate phone number format
  formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91)
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    
    // Add + if not present
    if (cleaned.length > 10 && !phone.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return phone.startsWith('+') ? phone : `+${phone}`;
  }

  // Check if WhatsApp service is available
  isAvailable(): boolean {
    return this.isConfigured;
  }

  // Get configuration status
  getStatus(): { configured: boolean; fromNumber: string } {
    return {
      configured: this.isConfigured,
      fromNumber: this.fromNumber
    };
  }
}

export const whatsappService = new WhatsAppService();