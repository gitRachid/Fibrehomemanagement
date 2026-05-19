import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { techniciansApi, Technician } from '@/api';
import { apiDataField, apiListField } from '@/api/client';

const TECHNICIANS_KEY = 'technicians';

export const useTechnicians = (options?: { status?: string; role?: string }) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, options],
    queryFn: async () => {
      const response = await techniciansApi.getAll(options);
      return apiListField(response);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

export const useTechnician = (id: string) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, id],
    queryFn: async () => {
      const response = await techniciansApi.getById(id);
      return apiDataField(response);
    },
    enabled: !!id,
  });
};

export const useCreateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (technician: Omit<Technician, '_id'>) => techniciansApi.create(technician),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [TECHNICIANS_KEY],
        refetchType: 'all',
      });
    },
  });
};

export const useUpdateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Technician> }) =>
      techniciansApi.update(id, data),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({
        queryKey: [TECHNICIANS_KEY],
        refetchType: 'all',
      });
      await queryClient.invalidateQueries({ queryKey: [TECHNICIANS_KEY, variables.id] });
    },
  });
};
