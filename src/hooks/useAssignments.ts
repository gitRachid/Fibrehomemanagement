import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi, Assignment } from '@/api';
import { apiListField } from '@/api/client';

const ASSIGNMENTS_KEY = 'assignments';

export const useAssignments = (options?: { technicianId?: string; status?: string }) => {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, options],
    queryFn: async () => {
      const response = await assignmentsApi.getAll(options);
      return apiListField(response);
    },
  });
};

export const useBuildingAssignments = (buildingId: string) => {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, 'building', buildingId],
    queryFn: async () => {
      const response = await assignmentsApi.getByBuilding(buildingId);
      return apiListField(response);
    },
    enabled: !!buildingId,
  });
};

export const useTechnicianAssignments = (technicianId: string) => {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, 'technician', technicianId],
    queryFn: async () => {
      const response = await assignmentsApi.getByTechnician(technicianId);
      return apiListField(response);
    },
    enabled: !!technicianId,
  });
};

export const useCreateAssignment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assignment: Omit<Assignment, '_id'>) => assignmentsApi.create(assignment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
};

export const useBulkCreateAssignments = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assignments: Omit<Assignment, '_id'>[]) => assignmentsApi.bulkCreate(assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
};

export const useCancelAssignment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => assignmentsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] });
    },
  });
};
