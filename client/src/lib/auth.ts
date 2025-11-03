import { apiRequest } from "./api";

export interface LoginCredentials {
  email: string;
  password: string;
  oemId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  oemId?: string;
  dealershipId?: string;
  showroomId?: string;
  partnerId?: string;
  name: string;
  allowedOemIds?: string[];
  profileCompleted?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  phone?: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export class AuthService {
  private static TOKEN_KEY = 'auth_token';
  private static USER_KEY = 'auth_user';

  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiRequest('POST', '/api/auth/login', credentials);
    const data = await response.json();
    
    // Store token and user info
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    
    return data;
  }

  static async logout(): Promise<void> {
    try {
      await apiRequest('POST', '/api/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await apiRequest('GET', '/api/auth/me');
      const data = await response.json();
      
      // Update stored user info
      localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
      return data.user;
    } catch (error) {
      // If token is invalid, clear storage
      this.logout();
      return null;
    }
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getStoredUser(): AuthUser | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
