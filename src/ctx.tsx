import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useQueryClient } from '@tanstack/react-query';
import { registerTokenGetter } from '@/api/client';
import { secureStorage, storage } from '@/lib/storage';
import { dataService } from '@/services/dataService';

type UserRole = 'technician' | 'supervisor' | 'manager';

export interface AuthUser {
  id?: string;
  sub?: string;
  name?: string;
  email?: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
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

const decodeUser = (rawToken: string): AuthUser | null => {
  try {
    const decoded = jwtDecode<AuthUser & { exp?: number }>(rawToken);
    return {
      id: decoded.id || decoded.sub,
      sub: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role || 'technician',
    };
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

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
              setUser(decodeUser(storedToken));
              setIsAuthenticated(true);
            } else if (!decoded.exp) {
              // Token without expiry - accept it
              setToken(storedToken);
              setUser(decodeUser(storedToken));
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
      setUser(decodeUser(newToken));
      setIsAuthenticated(true);
    } catch (error) {
      console.error('[AUTH] Error storing token:', error);
    }
  };

  const logout = async () => {
    try {
      await dataService.clearSessionData();
      await storage.clear();
      await removeToken();
      queryClient.clear();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('[AUTH] Error removing token:', error);
    }
  };

  useEffect(() => {
    registerTokenGetter(getStoredToken);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, isLoading, token, user, login, logout }),
    [isAuthenticated, isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};