import { apiClient } from './client';

export interface Technician {
  _id?: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'technician' | 'supervisor' | 'manager';
  status: 'active' | 'inactive' | 'on_leave';
  assignedBuildings?: string[];
  createdAt?: string;
  lastLogin?: string;
  password?: string;
}

export interface TechniciansResponse {
  success: boolean;
  count: number;
  data: Technician[];
}

export const techniciansApi = {
  getAll: async (params?: { status?: string; role?: string }) => {
    return apiClient.get<Technician[]>('/technicians', params as Record<string, string>);
  },

  getById: async (id: string) => {
    return apiClient.get<Technician>(`/technicians/${id}`);
  },

  create: async (technician: Omit<Technician, '_id'>) => {
    return apiClient.post<Technician>('/technicians', technician);
  },

  update: async (id: string, technician: Partial<Technician>) => {
    return apiClient.put<Technician>(`/technicians/${id}`, technician);
  },

  delete: async (id: string) => {
    return apiClient.delete<Technician>(`/technicians/${id}`);
  },
};
