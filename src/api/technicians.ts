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
  // Get all technicians
  getAll: async (params?: { status?: string; role?: string }) => {
    return apiClient.get<TechniciansResponse>('/technicians', params as Record<string, string>);
  },

  // Get single technician
  getById: async (id: string) => {
    return apiClient.get<Technician>(`/technicians/${id}`);
  },

  // Create technician
  create: async (technician: Omit<Technician, '_id'>) => {
    return apiClient.post<Technician>('/technicians', technician);
  },

  // Update technician
  update: async (id: string, technician: Partial<Technician>) => {
    return apiClient.put<Technician>(`/technicians/${id}`, technician);
  },

  // Delete/deactivate technician
  delete: async (id: string) => {
    return apiClient.delete<Technician>(`/technicians/${id}`);
  },
};
