import { apiClient } from './client';

export interface Item {
  _id?: string;
  id: string;
  name: string;
  description: string;
  serviceId: string;
  status?: string;
  lastModified?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemsResponse {
  success: boolean;
  count: number;
  data: Item[];
}

export const itemsApi = {
  getAll: async (params?: {
    serviceId?: string;
    status?: string;
    search?: string;
  }) => {
    return apiClient.get<Item[]>('/items', params as Record<string, string>);
  },

  getByService: async (serviceId: string, status: string = 'active') => {
    return apiClient.get<Item[]>(`/items/service/${serviceId}`, { status });
  },

  getById: async (id: string) => {
    return apiClient.get<Item>(`/items/${id}`);
  },

  create: async (item: Omit<Item, '_id'>) => {
    return apiClient.post<Item>('/items', item);
  },

  update: async (id: string, item: Partial<Item>) => {
    return apiClient.put<Item>(`/items/${id}`, item);
  },

  archive: async (id: string) => {
    return apiClient.delete<Item>(`/items/${id}`);
  },
};
