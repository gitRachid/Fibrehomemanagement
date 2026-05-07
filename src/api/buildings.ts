import { apiClient } from './client';

export interface Building {
  _id?: string;
  idImmeuble: string;
  idImmeubleSysteme: string;
  ville: string;
  codePostal: string;
  longitude: string;
  latitude: string;
  rueNomNom: string;
  numeroNomImmeuble: string;
  utilisationImmeuble: string;
  nbreEtages: string;
  sousSol: string;
  sousSolCommun: string;
  solutionRaccordement: string;
  nbrB2B: string;
  nbrB2C: string;
  totalClients: string;
  cheminFibrePBO1: string;
  floorPBO1: string;
  typePBO1: string;
  PBO2: string;
  floorPBO2: string;
  typePBO2: string;
  syndic: string;
  numSyndic: string;
  remarques: string;
  typologieHabitat: string;
  verticalite: string;
  csp: string;
  serviceId: string;
  status?: string;
  photos?: Photo[];
  lastModified?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Photo {
  _id?: string;
  id: string;
  uri: string;
  name: string;
  type: string;
  timestamp: Date;
  buildingId?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface BuildingsResponse {
  success: boolean;
  count: number;
  totalPages: number;
  currentPage: number;
  data: Building[];
}

export const buildingsApi = {
  getAll: async (params?: {
    serviceId?: string;
    status?: string;
    ville?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    return apiClient.get<Building[]>('/buildings', params as Record<string, string>);
  },

  getById: async (id: string) => {
    return apiClient.get<Building>(`/buildings/${id}`);
  },

  getByService: async (serviceId: string, status: string = 'active') => {
    return apiClient.get<Building[]>(`/buildings/service/${serviceId}`, { status });
  },

  create: async (building: Omit<Building, '_id'>) => {
    return apiClient.post<Building>('/buildings', building);
  },

  update: async (id: string, building: Partial<Building>) => {
    return apiClient.put<Building>(`/buildings/${id}`, building);
  },

  archive: async (id: string) => {
    return apiClient.delete<Building>(`/buildings/${id}`);
  },

  bulkUpdate: async (buildings: Building[]) => {
    return apiClient.post<{ modifiedCount: number; upsertedCount: number }>('/buildings/bulk-update', { buildings });
  },
};
