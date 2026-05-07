import { apiClient } from './client';
import { techniciansApi } from './technicians';

interface LoginPayload {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const authApi = {
  login: async (email: string, password: string) => {
    return apiClient.post<LoginPayload>('/auth/login', { email, password });
  },
  register: async (payload: { name: string; email: string; password: string; phone?: string }) => {
    return techniciansApi.create({
      id: `tech_${Date.now()}`,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || '',
      role: 'technician',
      status: 'active',
      password: payload.password,
    });
  },
};
