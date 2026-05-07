import { apiClient } from './client';

export interface Assignment {
  _id?: string;
  itemId: string;
  technicianIds: string[];
  assignedBy: string;
  assignedAt: Date;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  completedAt?: Date;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignmentsResponse {
  success: boolean;
  count: number;
  data: Assignment[];
}

export const assignmentsApi = {
  getAll: async (params?: { technicianId?: string; status?: string }) => {
    return apiClient.get<Assignment[]>('/assignments', params as Record<string, string>);
  },

  getByBuilding: async (buildingId: string) => {
    return apiClient.get<Assignment[]>(`/assignments/building/${buildingId}`);
  },

  getByTechnician: async (technicianId: string) => {
    return apiClient.get<string[]>(`/assignments/technician/${technicianId}`);
  },

  create: async (assignment: Omit<Assignment, '_id'>) => {
    return apiClient.post<Assignment>('/assignments', assignment);
  },

  bulkCreate: async (assignments: Omit<Assignment, '_id'>[]) => {
    return apiClient.post<Assignment[]>('/assignments/bulk', { assignments });
  },

  cancel: async (id: string) => {
    return apiClient.put<Assignment>(`/assignments/${id}/cancel`, {});
  },
};
