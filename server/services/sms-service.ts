class ComBirdsSMSService {
  private apiKey: string;
  private userId: string;
  private password: string;
  private header: string;

  constructor() {
    this.apiKey = process.env.COMBIRDS_OTP_API_KEY || '';
    this.userId = process.env.COMBIRDS_USER_ID || '';
    this.password = process.env.COMBIRDS_PASSWORD || '';
    this.header = process.env.COMBIRDS_HEADER || '';
    
    if (!this.apiKey || !this.userId || !this.password) {
      console.warn('⚠️  COMBIRDS credentials not fully configured. SMS functionality will not work.');
      console.warn('   Required: COMBIRDS_OTP_API_KEY, COMBIRDS_USER_ID, COMBIRDS_PASSWORD');
    } else {
      console.log('✅ COMBIRDS SMS service configured successfully');
      console.log(`   User ID: ${this.userId}`);
    }
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.apiKey || !this.userId || !this.password) {
      console.error('COMBIRDS credentials not configured');
      return false;
    }

    try {
      // ComBirds OTP API endpoint (adjust based on actual API documentation)
      const response = await fetch('https://api.combirds.com/v1/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.header || `Bearer ${this.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({
          userId: this.userId,
          password: this.password,
          apiKey: this.apiKey,
          to: phoneNumber,
          message: message,
          senderId: 'PULVAS'
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
    const message = `Your Pulse VAS verification code is: ${otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.`;
    return this.sendSMS(phoneNumber, message);
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.userId && this.password);
  }
}

export default new ComBirdsSMSService();
