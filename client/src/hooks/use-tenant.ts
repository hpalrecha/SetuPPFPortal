import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './use-auth';

interface TenantContextType {
  oemId: string | null;
  oemName: string | null;
  dealershipId: string | null;
  showroomId: string | null;
  setTenant: (oemId: string, oemName?: string) => void;
  clearTenant: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [oemId, setOemId] = useState<string | null>(null);
  const [oemName, setOemName] = useState<string | null>(null);
  const [dealershipId, setDealershipId] = useState<string | null>(null);
  const [showroomId, setShowroomId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setOemId(user.oemId || null);
      setDealershipId(user.dealershipId || null);
      setShowroomId(user.showroomId || null);
    } else {
      clearTenant();
    }
  }, [user]);

  const setTenant = (newOemId: string, newOemName?: string) => {
    setOemId(newOemId);
    setOemName(newOemName || null);
  };

  const clearTenant = () => {
    setOemId(null);
    setOemName(null);
    setDealershipId(null);
    setShowroomId(null);
  };

  const value: TenantContextType = {
    oemId,
    oemName,
    dealershipId,
    showroomId,
    setTenant,
    clearTenant
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

export function useOemHeader(): Record<string, string> {
  const { oemId } = useTenant();
  
  if (oemId) {
    return { 'X-OEM-ID': oemId };
  }
  
  return {};
}
