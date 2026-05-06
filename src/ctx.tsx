import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { registerTokenGetter } from '@/api/client';
import { secureStorage } from '@/lib/storage';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const getStoredToken = () => secureStorage.getToken();
  const saveToken = (newToken: string) => secureStorage.setToken(newToken);
  const removeToken = () => secureStorage.clearToken();

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const storedToken = await getStoredToken();
      if (storedToken) {
        try {
          // Validate token format before decoding
          if (!storedToken.includes('.') || storedToken.split('.').length !== 3) {
            await removeToken();
          } else {
            const decoded: any = jwtDecode(storedToken);
            const currentTime = Date.now() / 1000;
            if (decoded.exp && decoded.exp > currentTime) {
              setToken(storedToken);
              setIsAuthenticated(true);
            } else if (!decoded.exp) {
              // Token without expiry - accept it
              setToken(storedToken);
              setIsAuthenticated(true);
            } else {
              await removeToken();
            }
          }
        } catch (decodeError) {
          await removeToken();
        }
      }
    } catch (error) {
      console.error('[AUTH] Error checking token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string) => {
    try {
      await saveToken(newToken);
      setToken(newToken);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('[AUTH] Error storing token:', error);
    }
  };

  const logout = async () => {
    try {
      await removeToken();
      setToken(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('[AUTH] Error removing token:', error);
    }
  };

  useEffect(() => {
    registerTokenGetter(getStoredToken);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, isLoading, token, login, logout }),
    [isAuthenticated, isLoading, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};