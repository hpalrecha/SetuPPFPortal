class MessageBirdService {
  private apiKey: string;
  private originator: string;

  constructor() {
    this.apiKey = process.env.MESSAGEBIRD_API_KEY || '';
    this.originator = process.env.MESSAGEBIRD_ORIGINATOR || 'PulseVAS';
    
    if (!this.apiKey) {
      console.warn('⚠️  MessageBird API key not configured. SMS functionality will not work.');
    } else {
      console.log('✅ MessageBird SMS service configured successfully');
    }
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.apiKey) {
      console.error('MessageBird API key not configured');
      return false;
    }

    try {
      const response = await fetch('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originator: this.originator,
          recipients: [phoneNumber],
          body: message
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('MessageBird SMS send error:', errorData);
        return false;
      }

      const data = await response.json();
      console.log(`✅ SMS sent successfully to ${phoneNumber}:`, data.id);
      return true;
    } catch (error) {
      console.error('Error sending SMS via MessageBird:', error);
      return false;
    }
  }

  async sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
    const message = `Your Pulse VAS verification code is: ${otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.`;
    return this.sendSMS(phoneNumber, message);
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export default new MessageBirdService();
