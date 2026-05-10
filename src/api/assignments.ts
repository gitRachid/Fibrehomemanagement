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
  // Get all assignments
  getAll: async (params?: { technicianId?: string; status?: string }) => {
    return apiClient.get<AssignmentsResponse>('/assignments', params as Record<string, string>);
  },

  // Get assignments for a building
  getByBuilding: async (buildingId: string) => {
    return apiClient.get<AssignmentsResponse>(`/assignments/building/${buildingId}`);
  },

  // Get assignments for a technician
  getByTechnician: async (technicianId: string) => {
    return apiClient.get<{ success: boolean; count: number; data: string[] }>(
      `/assignments/technician/${technicianId}`,
    );
  },

  // Create assignment
  create: async (assignment: Omit<Assignment, '_id'>) => {
    return apiClient.post<Assignment>('/assignments', assignment);
  },

  // Bulk create assignments
  bulkCreate: async (assignments: Omit<Assignment, '_id'>[]) => {
    return apiClient.post<{ count: number; data: Assignment[] }>('/assignments/bulk', { assignments });
  },

  // Cancel assignment
  cancel: async (id: string) => {
    return apiClient.put<Assignment>(`/assignments/${id}/cancel`, {});
  },
};
