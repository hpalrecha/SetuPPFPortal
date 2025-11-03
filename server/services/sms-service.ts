class ComBirdsSMSService {
  private apiKey: string;
  private senderId: string;
  private otpTemplateId: string;

  constructor() {
    this.apiKey = process.env.COMBIRDS_OTP_API_KEY || '';
    this.senderId = process.env.COMBIRDS_HEADER || 'EDUMRC';
    this.otpTemplateId = '1707168926925165526'; // OTP Template ID from ComBirds
    
    if (!this.apiKey) {
      console.warn('⚠️  COMBIRDS_OTP_API_KEY not configured. SMS functionality will not work.');
    } else {
      console.log('✅ COMBIRDS SMS service configured successfully');
      console.log(`   Sender ID: ${this.senderId}`);
    }
  }

  async sendSMS(phoneNumber: string, message: string, templateId?: string): Promise<boolean> {
    if (!this.apiKey) {
      console.error('COMBIRDS API key not configured');
      return false;
    }

    try {
      // ComBirds API endpoint
      const response = await fetch('https://smsapi.edumarcsms.com/api/v1/sendsms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify({
          number: [phoneNumber],
          message: message,
          senderId: this.senderId,
          templateId: templateId || this.otpTemplateId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('COMBIRDS SMS send error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return false;
      }

      const data = await response.json();
      console.log(`✅ SMS sent successfully to ${phoneNumber} via COMBIRDS:`, data);
      return true;
    } catch (error) {
      console.error('Error sending SMS via COMBIRDS:', error);
      return false;
    }
  }

  async sendOTP(phoneNumber: string, otp: string): Promise<boolean> {
    // ComBirds OTP Template: "Your {#var#} OTP for verification is: {#var#}. OTP is confidential, refrain from sharing it with anyone. By Edumarc Technologies"
    // We need to replace {#var#} placeholders with actual values
    const message = `Your Pulse VAS OTP for verification is: ${otp}. OTP is confidential, refrain from sharing it with anyone. By Edumarc Technologies`;
    
    // Use the OTP template ID
    return this.sendSMS(phoneNumber, message, this.otpTemplateId);
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export default new ComBirdsSMSService();
