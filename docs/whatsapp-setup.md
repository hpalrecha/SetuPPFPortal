# WhatsApp Business API Integration

## Overview

SetuPPF now supports Meta WhatsApp Business API notifications for job card events. This integration sends real-time WhatsApp messages to detailers when job cards are assigned and to showroom managers when jobs are completed.

## Required Environment Variables

Add these environment variables to your production deployment:

```bash
# Meta WhatsApp Business API Configuration
META_WABA_ACCESS_TOKEN=your_access_token_here
META_WABA_PHONE_NUMBER_ID=your_phone_number_id_here
META_WABA_BUSINESS_ACCOUNT_ID=your_business_account_id_here
META_WABA_API_VERSION=v18.0  # Optional, defaults to v18.0
```

## Development Mode

In development mode (when Meta WABA credentials are not provided), the system will log WhatsApp messages to the console instead of sending them. This allows for testing without requiring WhatsApp API access.

## Production Setup

### 1. Meta WhatsApp Business API Setup

1. **Apply for WhatsApp Business API** at https://business.facebook.com/
2. **Get approved for WhatsApp Business API** access through Meta
3. **Create WhatsApp Business Account** and get your credentials:
   - Access Token
   - Phone Number ID  
   - Business Account ID
4. **Get approved WhatsApp templates** for:
   - Job card assignment notifications
   - Job completion notifications

### 2. WhatsApp Message Templates

The system uses two pre-defined templates:

#### Job Card Assignment Template (`job_card_assigned`)
```
🔧 *New Job Assignment*

Job Card: {{1}}
Customer: {{2}}
Vehicle: {{3}}
Service: {{4}}

Please acknowledge within 2 hours.

_SetuPPF Team_
```

#### Job Completion Template (`job_card_completed`)
```
✅ *Job Completed*

Job Card: {{1}}
Completed by: {{2}}
Status: {{3}}

Thank you for your service!

_SetuPPF Team_
```

### 3. Template Approval Process

**Important**: WhatsApp Business API requires template approval before sending live notifications.

1. Submit your templates to WhatsApp for approval through Twilio Console
2. Wait for approval (typically 24-48 hours)
3. Once approved, update the template names in the code if they differ from `job_card_assigned` and `job_card_completed`

## How It Works

### Job Card Creation Flow
1. When a job card is created and assigned to a detailer
2. System sends WhatsApp message to the assigned detailer's phone number
3. Message includes job card ID, customer name, vehicle model, and service details
4. Fallback push notification is also sent

### Job Completion Flow  
1. When a job card status changes to "COMPLETED"
2. System sends WhatsApp messages to all showroom managers
3. Message includes job card ID, detailer name, and completion status
4. Fallback push notifications are also sent

## Phone Number Format

The system automatically formats phone numbers:
- Adds +91 country code for 10-digit Indian numbers
- Accepts international numbers with + prefix
- Validates and formats before sending

Example formats:
- `9876543210` → `+919876543210`
- `+919876543210` → `+919876543210` (no change)
- `+14155238886` → `+14155238886` (international)

## Monitoring and Debugging

### Development Logs
```
📱 [DEV MODE] WhatsApp message would be sent:
From: whatsapp:+14155238886
To: +919876543210
Template: job_card_assigned
Parameters: ["JC123456", "John Doe", "Hyundai Creta", "PPF Installation"]
--- WhatsApp Message Content ---
🔧 *New Job Assignment*

Job Card: JC123456
Customer: John Doe
Vehicle: Hyundai Creta
Service: PPF Installation

Please acknowledge within 2 hours.

_SetuPPF Team_
--- End WhatsApp Message ---
```

### Production Logs
```
✅ WhatsApp message sent successfully. Message ID: wamid.ABC123def456
📱 WhatsApp notification sent to detailer John Smith for job card JC123456
```

### Error Handling
```
❌ Failed to send WhatsApp notification for job card creation: Error message
⚠️ Cannot send WhatsApp to user 123: No phone number found
```

## Benefits

- **Instant notifications** to detailers and showroom staff
- **High visibility** - WhatsApp messages are more likely to be seen than app notifications
- **Professional communication** with branded templates
- **Automatic fallback** to push notifications if WhatsApp fails
- **Development-friendly** with console logging when API is not configured
- **Direct Meta integration** - no third-party service fees

## Troubleshooting

### Common Issues

1. **No WhatsApp messages in production**
   - Verify META_WABA_ACCESS_TOKEN and other credentials are set
   - Check Meta Business Manager for API errors
   - Ensure templates are approved by WhatsApp

2. **Template not found errors**
   - Verify template names match approved templates in Meta Business Manager
   - Check template approval status in WhatsApp Business API dashboard

3. **Phone number formatting issues**
   - Ensure users have valid phone numbers in their profiles
   - Check phone number format in user records (numbers should not include + for Meta API)

4. **Rate limiting**
   - WhatsApp has message limits - monitor usage in Meta Business Manager
   - Consider implementing retry logic for failed messages

5. **Authentication errors**
   - Verify Access Token is valid and has necessary permissions
   - Check if Phone Number ID belongs to your Business Account

### Support

For Meta WhatsApp Business API support:
- Meta WhatsApp Business API Documentation: https://developers.facebook.com/docs/whatsapp
- Meta Business Help Center: https://business.facebook.com/help