import { apiClient } from './client';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      role: string;
    };
  };
}

export const authApi = {
  login: async (email: string, password: string) => {
    return apiClient.post<LoginResponse>('/auth/login', { email, password });
  },
};
