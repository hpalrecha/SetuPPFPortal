import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  
  if (secret) {
    return secret;
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  WARNING: Using default JWT secret in development. Set JWT_SECRET env var for production!');
    return 'dev-secret-key-change-in-production';
  } else {
    console.error('FATAL ERROR: JWT_SECRET environment variable is required in production');
    console.error('');
    console.error('To fix this deployment issue:');
    console.error('1. Add JWT_SECRET to your production secrets/environment variables');
    console.error('2. Generate a secure secret using: openssl rand -base64 32');
    console.error('3. In Replit: Go to Secrets tab and add JWT_SECRET with the generated value');
    console.error('');
    console.error('Application cannot start securely without JWT_SECRET. Exiting...');
    process.exit(1);
  }
})();
const JWT_EXPIRES_IN = '7d';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role: string;
  oemId?: string;
  dealershipId?: string;
  showroomId?: string;
  partnerId?: string;
  name: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  profileCompleted: boolean;
  allowedOemIds?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  oemId?: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse | null> {
    // Try to find user by email first, then by username
    let user = await storage.getUserByEmail(credentials.email);
    if (!user) {
      user = await storage.getUserByUsername(credentials.email);
    }
    
    if (!user || !user.isActive) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // Check OEM access for tenant isolation
    let allowedOemIds: string[] | undefined;
    
    if (user.role === 'PARTNER_ADMIN' || user.role === 'PARTNER_STAFF') {
      // For partner users, get allowed OEMs from partner_oems mapping
      if (user.partnerId) {
        const partnerOems = await storage.getPartnerOems(user.partnerId);
        allowedOemIds = partnerOems;
        
        // If oemId is provided, check if partner has access to it
        if (credentials.oemId && !allowedOemIds?.includes(credentials.oemId)) {
          return null;
        }
      } else {
        return null; // Partner users must have partnerId
      }
    } else {
      // For non-partner users, use existing OEM check
      if (credentials.oemId && user.oemId !== credentials.oemId) {
        return null;
      }
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email || undefined,
      role: user.role,
      oemId: user.oemId || undefined,
      dealershipId: user.dealershipId || undefined,
      showroomId: user.showroomId || undefined,
      partnerId: user.partnerId || undefined,
      name: user.name,
      emailVerified: user.emailVerified || false,
      phoneVerified: user.phoneVerified || false,
      profileCompleted: user.profileCompleted || false,
      allowedOemIds
    };

    const token = jwt.sign(authUser, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      user: authUser,
      token
    };
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      return decoded;
    } catch {
      return null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async generateResetToken(): Promise<string> {
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await storage.getUserByEmail(email);
    if (!user || !user.isActive) {
      // Return true even if user doesn't exist to prevent email enumeration
      return true;
    }

    const resetToken = await this.generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await storage.updateUser(user.id, {
      resetToken,
      resetTokenExpiry
    });

    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await storage.getUserByResetToken(token);
    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      return false;
    }

    // Check if token has expired
    if (new Date() > user.resetTokenExpiry) {
      return false;
    }

    const hashedPassword = await this.hashPassword(newPassword);
    
    await storage.updateUser(user.id, {
      passwordHash: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    });

    return true;
  }

  async validateResetToken(token: string): Promise<boolean> {
    const user = await storage.getUserByResetToken(token);
    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      return false;
    }

    return new Date() <= user.resetTokenExpiry;
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    oemId?: string;
    dealershipId?: string;
    showroomId?: string;
    partnerId?: string;
  }): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);
    
    return storage.createUser({
      email: userData.email,
      passwordHash: hashedPassword,
      name: userData.name,
      role: userData.role as any,
      oemId: userData.oemId,
      dealershipId: userData.dealershipId,
      showroomId: userData.showroomId,
      partnerId: userData.partnerId,
      phone: null
    });
  }
}

export const authService = new AuthService();
