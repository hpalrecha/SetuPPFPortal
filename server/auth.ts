import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  oemId?: string;
  dealershipId?: string;
  showroomId?: string;
  partnerId?: string;
  name: string;
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
    const user = await storage.getUserByEmail(credentials.email);
    
    if (!user || !user.isActive) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // Check OEM access for tenant isolation
    if (credentials.oemId && user.oemId !== credentials.oemId) {
      return null;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      oemId: user.oemId || undefined,
      dealershipId: user.dealershipId || undefined,
      showroomId: user.showroomId || undefined,
      partnerId: user.partnerId || undefined,
      name: user.name
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
