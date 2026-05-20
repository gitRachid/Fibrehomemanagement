import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { techniciansApi, Technician } from '@/api';
import { apiDataField, apiListField } from '@/api/client';

const TECHNICIANS_KEY = 'technicians';

/** Stable id for lists (API may expose `id`, `_id`, or only email). */
export const normalizeTechnician = (raw: Technician): Technician => {
  const mongoId = raw._id != null ? String(raw._id) : '';
  const businessId = raw.id != null ? String(raw.id).trim() : '';
  return {
    ...raw,
    id: businessId || mongoId,
    _id: mongoId || businessId,
  };
};

const dedupeTechnicians = (list: Technician[]): Technician[] => {
  const byKey = new Map<string, Technician>();
  for (const item of list.map(normalizeTechnician)) {
    const key = String(item.id || item._id || item.email || '').trim();
    if (key) byKey.set(key, item);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'fr'),
  );
};

export const useTechnicians = (options?: { status?: string; role?: string }) => {
  return useQuery({
    queryKey: [TECHNICIANS_KEY, options?.status ?? 'all', options?.role ?? ''],
    queryFn: async () => {
      const response = await techniciansApi.getAll(options);
      return dedupeTechnicians(apiListField(response));
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
