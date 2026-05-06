import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, Item } from '@/api';

const ITEMS_KEY = 'items';

export const useItems = (serviceId?: string, options?: { status?: string; search?: string }) => {
  return useQuery({
    queryKey: [ITEMS_KEY, serviceId, options],
    queryFn: async () => {
      if (serviceId) {
        const response = await itemsApi.getByService(serviceId, options?.status || 'active');
        console.log('[useItems] Response:', response);
        return (response.data as any)?.data || response.data || [];
      }
      const response = await itemsApi.getAll(options);
      return (response.data as any)?.data || response.data || [];
    },
    enabled: !!serviceId,
  });
};

export const useItem = (id: string) => {
  return useQuery({
    queryKey: [ITEMS_KEY, id],
    queryFn: async () => {
      const response = await itemsApi.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (item: Omit<Item, '_id'>) => itemsApi.create(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY] });
    },
  });
};

export const useUpdateItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Item> }) => 
      itemsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY] });
    },
  });
};

export const useArchiveItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => itemsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY] });
    },
  });
};
