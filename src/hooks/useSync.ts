import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi, PendingChange } from '@/api';

const SYNC_KEY = 'sync';

export const useSyncStatus = (lastSync?: string) => {
  return useQuery({
    queryKey: [SYNC_KEY, 'status', lastSync],
    queryFn: async () => {
      const response = await syncApi.getStatus(lastSync);
      return response.data;
    },
  });
};

export const useSync = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      pendingChanges, 
      deviceId, 
      lastSync 
    }: { 
      pendingChanges: PendingChange[]; 
      deviceId: string; 
      lastSync?: string;
    }) => {
      const response = await syncApi.sync(pendingChanges, deviceId, lastSync);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all data queries to refresh with synced data
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
};

export const useResolveConflicts = () => {
  return useMutation({
    mutationFn: syncApi.resolveConflicts,
  });
};
