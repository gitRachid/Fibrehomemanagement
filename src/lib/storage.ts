import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

const TOKEN_KEY = 'authToken';

const makeSecureStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getToken: async (): Promise<string | null> =>
        typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null,
      setToken: async (token: string): Promise<void> => {
        if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
      },
      clearToken: async (): Promise<void> => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
      },
    };
  }

  const SecureStore = require('expo-secure-store');
  return {
    getToken: () => SecureStore.getItemAsync(TOKEN_KEY) as Promise<string | null>,
    setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token) as Promise<void>,
    clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY) as Promise<void>,
  };
};

export const secureStorage = makeSecureStorage();
