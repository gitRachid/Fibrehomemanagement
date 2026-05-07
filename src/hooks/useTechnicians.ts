import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { techniciansApi, Technician, unwrapList, unwrapData } from '@/api';

const TECHNICIANS_KEY = 'technicians';

export const useTechnicians = (options?: { status?: string; role?: string }) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, options],
    queryFn: async () => {
      const response = await techniciansApi.getAll(options);
      return unwrapList<Technician>(response);
    },
  });
};

export const useTechnician = (id: string) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, id],
    queryFn: async () => {
      const response = await techniciansApi.getById(id);
      return unwrapData<Technician>(response);
    },
    enabled: !!id,
  });
};

export const useCreateTechnician = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (technician: Omit<Technician, '_id'>) => techniciansApi.create(technician),
    onSuccess: (response) => {
      const newTechnician = unwrapData<Technician>(response);
      queryClient.setQueryData([TECHNICIANS_KEY], (old: Technician[] | undefined) => {
        return old ? [...old, newTechnician] : [newTechnician];
      });
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
      const updatedTechnician = unwrapData<Technician>(response);
      queryClient.setQueryData([TECHNICIANS_KEY], (old: Technician[] | undefined) => {
        if (!old) return [updatedTechnician];
        return old.map((tech) =>
          tech._id === variables.id || tech.id === variables.id ? updatedTechnician : tech
        );
      });
      queryClient.invalidateQueries({ queryKey: [TECHNICIANS_KEY] });
      queryClient.invalidateQueries({ queryKey: [TECHNICIANS_KEY, variables.id] });
    },
  });
};
