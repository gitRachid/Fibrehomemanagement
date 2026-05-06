import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { techniciansApi, Technician } from '@/api';

const TECHNICIANS_KEY = 'technicians';

export const useTechnicians = (options?: { status?: string; role?: string }) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, options],
    queryFn: async () => {
      const response = await techniciansApi.getAll(options);
      return response.data?.data || [];
    },
  });
};

export const useTechnician = (id: string) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, id],
    queryFn: async () => {
      const response = await techniciansApi.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (technician: Omit<Technician, '_id'>) => techniciansApi.create(technician),
    onSuccess: (response) => {
      const newTechnician = response.data;
      // Immediately add to cache for instant UI update
      queryClient.setQueryData([TECHNICIANS_KEY], (old: Technician[] | undefined) => {
        return old ? [...old, newTechnician] : [newTechnician];
      });
      // Then refetch to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: [TECHNICIANS_KEY] });
    },
  });
};

export const useUpdateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Technician> }) =>
      techniciansApi.update(id, data),
    onSuccess: (response, variables) => {
      const updatedTechnician = response.data;
      // Immediately update cache for instant UI update
      queryClient.setQueryData([TECHNICIANS_KEY], (old: Technician[] | undefined) => {
        if (!old) return [updatedTechnician];
        return old.map((tech) =>
          tech._id === variables.id || tech.id === variables.id ? updatedTechnician : tech
        );
      });
      // Then refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: [TECHNICIANS_KEY] });
      // Also invalidate specific technician query
      queryClient.invalidateQueries({ queryKey: [TECHNICIANS_KEY, variables.id] });
    },
  });
};
