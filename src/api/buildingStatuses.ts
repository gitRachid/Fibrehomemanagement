import { apiClient } from './client';

export interface BuildingStatus {
  _id?: string;
  value: string;
  label: string;
  color: string;
  managerOnly?: boolean;
  sortOrder?: number;
}

export interface BuildingStatusesResponse {
  success: boolean;
  count: number;
  data: BuildingStatus[];
}

export const buildingStatusesApi = {
  getAll: async () => {
    return apiClient.get<BuildingStatusesResponse>('/building-statuses');
  },
  create: async (payload: { label: string; value?: string; color?: string; managerOnly?: boolean; sortOrder?: number }) => {
    return apiClient.post<{ success: boolean; data: BuildingStatus }>('/building-statuses', payload);
  },
  delete: async (value: string) => {
    return apiClient.delete<{ success: boolean; message: string }>(`/building-statuses/${value}`);
  },
};
