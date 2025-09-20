# SetuPPF Setup Guide

## Prerequisites

- **Node.js**: Version 18.0 or higher
- **PostgreSQL**: Version 15.0 or higher  
- **Redis**: Version 7.0 or higher
- **Git**: For cloning the repository

## Required Production Secrets

The following environment variables are required for production deployment:

### Core Authentication
- **JWT_SECRET**: A secure random string used for signing JWT tokens. Generate using `openssl rand -base64 32` or similar. **Critical for production - application will not start without this.**

### Database Configuration
- **DATABASE_URL**: PostgreSQL connection string (automatically provided by Replit database integration)

### Optional Services
The following secrets are optional but required for full functionality:

#### Email Service (AWS SES)
- **AWS_ACCESS_KEY_ID**: AWS access key for SES email service
- **AWS_SECRET_ACCESS_KEY**: AWS secret key for SES email service  
- **AWS_REGION**: AWS region for SES (default: ap-south-1)
- **EMAIL_SENDER**: Sender email address (default: noreply@setupppf.com)

#### Webhook System
- **WEBHOOK_SECRET**: Secret for webhook signature verification (defaults to 'default-webhook-secret' in development)

### Development vs Production Behavior
- **Development**: Missing secrets use default values with warnings
- **Production**: Missing critical secrets (JWT_SECRET) will prevent application startup

## Quick Start with Docker

The fastest way to get SetuPPF running is with Docker Compose:

### 1. Clone the Repository
```bash
git clone <repository-url>
cd setuppf
