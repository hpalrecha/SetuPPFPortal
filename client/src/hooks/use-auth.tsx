import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, type AuthUser, type LoginCredentials } from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, oemId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      // First try to get stored user
      const storedUser = AuthService.getStoredUser();
      if (storedUser && AuthService.isAuthenticated()) {
        setUser(storedUser);
        
        // Then validate with server
        try {
          const currentUser = await AuthService.getCurrentUser();
          setUser(currentUser);
        } catch (error) {
          // If validation fails, clear stored user
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email: string, password: string, oemId?: string) => {
    setIsLoading(true);
    try {
      const credentials: LoginCredentials = { email, password };
      if (oemId) credentials.oemId = oemId;
      
      const { user: loggedInUser } = await AuthService.login(credentials);
      setUser(loggedInUser);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear user state even if logout API fails
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await loadUser();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    refetch
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
