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
  // Get all items with filters
  getAll: async (params?: {
    serviceId?: string;
    status?: string;
    search?: string;
  }) => {
    return apiClient.get<ItemsResponse>('/items', params as Record<string, string>);
  },

  // Get items by service
  getByService: async (serviceId: string, status: string = 'active') => {
    return apiClient.get<ItemsResponse>(`/items/service/${serviceId}`, { status });
  },

  // Get single item
  getById: async (id: string) => {
    return apiClient.get<{ success: boolean; data: Item }>(`/items/${id}`);
  },

  // Create new item
  create: async (item: Omit<Item, '_id'>) => {
    return apiClient.post<{ success: boolean; data: Item }>('/items', item);
  },

  // Update item
  update: async (id: string, item: Partial<Item>) => {
    return apiClient.put<{ success: boolean; data: Item }>(`/items/${id}`, item);
  },

  // Archive item
  archive: async (id: string) => {
    return apiClient.delete<Item>(`/items/${id}`);
  },
};
