/**
 * API Status Context
 * Provides global API connection status throughout the application
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface ApiStatusContextType {
  isOnline: boolean;
  isChecking: boolean;
  lastError: string | null;
  checkStatus: () => Promise<void>;
}

const ApiStatusContext = createContext<ApiStatusContextType | undefined>(undefined);

export const ApiStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      await apiService.getHealth();
      setIsOnline(true);
      setLastError(null);
    } catch (err) {
      setIsOnline(false);
      const errorMessage = err instanceof Error ? err.message : 'Unable to connect to API';
      setLastError(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkStatus();

    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ApiStatusContext.Provider value={{ isOnline, isChecking, lastError, checkStatus }}>
      {children}
    </ApiStatusContext.Provider>
  );
};

export const useApiStatus = (): ApiStatusContextType => {
  const context = useContext(ApiStatusContext);
  if (!context) {
    throw new Error('useApiStatus must be used within ApiStatusProvider');
  }
  return context;
};


