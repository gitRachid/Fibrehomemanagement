import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildingStatusesApi, BuildingStatus } from '@/api';
import { apiDataField, apiListField } from '@/api/client';

const BUILDING_STATUSES_KEY = 'building-statuses';

export const useBuildingStatuses = () => {
  return useQuery({
    queryKey: [BUILDING_STATUSES_KEY],
    queryFn: async () => {
      const response = await buildingStatusesApi.getAll();
      return apiListField(response);
    },
  });
};

export const useCreateBuildingStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { label: string; value?: string; color?: string; managerOnly?: boolean; sortOrder?: number }) =>
      buildingStatusesApi.create(payload),
    onSuccess: (response) => {
      const created = apiDataField(response);
      queryClient.setQueryData([BUILDING_STATUSES_KEY], (old: BuildingStatus[] | undefined) =>
        created ? [...(old ?? []), created] : old,
      );
      queryClient.invalidateQueries({ queryKey: [BUILDING_STATUSES_KEY] });
    },
  });
};

export const useDeleteBuildingStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => buildingStatusesApi.delete(value),
    onSuccess: (_, value) => {
      queryClient.setQueryData([BUILDING_STATUSES_KEY], (old: BuildingStatus[] | undefined) =>
        old?.filter((status) => status.value !== value) ?? [],
      );
      queryClient.invalidateQueries({ queryKey: [BUILDING_STATUSES_KEY] });
    },
  });
};
