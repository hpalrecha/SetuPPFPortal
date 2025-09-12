import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './use-auth';

interface OemContextType {
  selectedOemId: string | null;
  setSelectedOemId: (oemId: string | null) => void;
  availableOems: string[];
  isPartnerUser: boolean;
  needsOemSelection: boolean;
}

const OemContext = createContext<OemContextType | undefined>(undefined);

const OEM_SELECTION_KEY = 'selected_oem_id';

export function OemProvider({ children }: { children: ReactNode }) {
  const [selectedOemId, setSelectedOemIdState] = useState<string | null>(null);
  
  // Get user from auth context
  const { user } = useAuth();
  
  // Check if user is a partner user
  const isPartnerUser = user?.role === 'PARTNER_ADMIN' || user?.role === 'PARTNER_STAFF';
  
  // Get available OEMs for partner users
  const availableOems = user?.allowedOemIds || [];
  
  // Partner users need OEM selection if they have multiple OEMs or no OEM selected
  const needsOemSelection = isPartnerUser && (!selectedOemId || availableOems.length > 1);

  // Load selected OEM from localStorage on mount
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`${OEM_SELECTION_KEY}_${user.id}`);
      
      if (isPartnerUser) {
        // For partner users, check if stored OEM is still valid
        if (stored && availableOems.includes(stored)) {
          setSelectedOemIdState(stored);
        } else if (availableOems.length === 1) {
          // Auto-select if only one OEM available
          setSelectedOemIdState(availableOems[0]);
          localStorage.setItem(`${OEM_SELECTION_KEY}_${user.id}`, availableOems[0]);
        }
      } else {
        // For non-partner users, use their oemId
        setSelectedOemIdState(user.oemId || null);
      }
    }
  }, [user, isPartnerUser, availableOems]);

  const setSelectedOemId = (oemId: string | null) => {
    setSelectedOemIdState(oemId);
    
    if (user && oemId) {
      localStorage.setItem(`${OEM_SELECTION_KEY}_${user.id}`, oemId);
    } else if (user) {
      localStorage.removeItem(`${OEM_SELECTION_KEY}_${user.id}`);
    }
  };

  const value: OemContextType = {
    selectedOemId,
    setSelectedOemId,
    availableOems,
    isPartnerUser,
    needsOemSelection
  };

  return (
    <OemContext.Provider value={value}>
      {children}
    </OemContext.Provider>
  );
}

export function useOemContext(): OemContextType {
  const context = useContext(OemContext);
  if (context === undefined) {
    throw new Error('useOemContext must be used within an OemProvider');
  }
  return context;
}