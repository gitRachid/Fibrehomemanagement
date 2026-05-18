import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildingsApi, Building } from '@/api';
import { apiDataField, apiListField } from '@/api/client';

const BUILDINGS_KEY = 'buildings';

export const useBuildings = (
  serviceId?: string,
  options?: { status?: string; search?: string; page?: number; limit?: number },
) => {
  return useQuery({
    queryKey: [BUILDINGS_KEY, serviceId, options],
    queryFn: async () => {
      if (serviceId) {
        const response = await buildingsApi.getByService(serviceId, options?.status ?? 'active');
        return apiListField(response);
      }
      const response = await buildingsApi.getAll(options);
      return apiListField(response);
    },
  });
};

export const useBuilding = (id: string) => {
  return useQuery({
    queryKey: [BUILDINGS_KEY, id],
    queryFn: async () => {
      const response = await buildingsApi.getById(id);
      return apiDataField(response);
    },
    enabled: !!id,
  });
};

export const useCreateBuilding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (building: Omit<Building, '_id'>) => buildingsApi.create(building),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY] });
    },
  });
};

export const useUpdateBuilding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Building> }) => 
      buildingsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY] });
    },
  });
};

export const usePatchSyndicInstallationAuth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body:
        | { syndicInstallationAuthSignature: string; syndicInstallationAuthSignedAt?: string }
        | { clear: true };
    }) => buildingsApi.patchSyndicInstallationAuth(id, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY] });
    },
  });
};

export const useArchiveBuilding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => buildingsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY] });
    },
  });
};

export const useBulkUpdateBuildings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (buildings: Building[]) => buildingsApi.bulkUpdate(buildings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUILDINGS_KEY] });
    },
  });
};
