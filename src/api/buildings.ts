import { apiClient } from './client';

export interface Building {
  _id?: string;
  idImmeuble: string;
  idImmeubleSysteme: string;
  ville: string;
  zone?: string;
  codePostal: string;
  longitude: string;
  latitude: string;
  rueNomNom: string;
  numeroNomImmeuble: string;
  utilisationImmeuble: string;
  nbreEtages: string;
  /** JSON { "0": "n", ... } : appartements par niveau (0 = RDC) */
  nbreAppartementsParEtage?: string;
  sousSol: string;
  sousSolCommun: string;
  solutionRaccordement: string;
  nbrB2B: string;
  nbrB2C: string;
  totalClients: string;
  cheminFibrePBO1: string;
  /** Emplacement / réf. BPO1 (saisie libre). */
  bpo1?: string;
  floorPBO1: string;
  typePBO1: string;
  PBO2: string;
  floorPBO2: string;
  typePBO2: string;
  syndic: string;
  numSyndic: string;
  /** data:image/png;base64,... */
  syndicInstallationAuthSignature?: string;
  /** ISO 8601 */
  syndicInstallationAuthSignedAt?: string;
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
  // Get all buildings with filters
  getAll: async (params?: {
    serviceId?: string;
    status?: string;
    zone?: string;
    ville?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get<BuildingsResponse>('/buildings', params as Record<string, string>);
    return response;
  },

  // Get single building
  getById: async (id: string) => {
    return apiClient.get<{ success: boolean; data: Building }>(`/buildings/${id}`);
  },

  // Get buildings by service
  getByService: async (serviceId: string, status: string = 'active') => {
    return apiClient.get<BuildingsResponse>(`/buildings/service/${serviceId}`, { status });
  },

  // Create new building
  create: async (building: Omit<Building, '_id'>) => {
    return apiClient.post<Building>('/buildings', building);
  },

  // Update building
  update: async (id: string, building: Partial<Building>) => {
    return apiClient.put<Building>(`/buildings/${id}`, building);
  },

  /** Dedicated PATCH: signature + date, or `{ clear: true }` to remove (server sets lastModified). */
  patchSyndicInstallationAuth: async (
    id: string,
    body:
      | { syndicInstallationAuthSignature: string; syndicInstallationAuthSignedAt?: string }
      | { clear: true },
  ) => {
    return apiClient.patch<{ success: boolean; data: Building }>(`/buildings/${id}/syndic-installation-auth`, body);
  },

  // Archive building
  archive: async (id: string) => {
    return apiClient.delete<Building>(`/buildings/${id}`);
  },

  // Bulk upsert (import Excel — max 300 par requête)
  bulkUpdate: async (buildings: Omit<Building, '_id'>[]) => {
    return apiClient.post<{
      success: boolean;
      modifiedCount: number;
      upsertedCount: number;
      skipped?: number;
      failed?: number;
      writeErrors?: { index: number; message: string }[];
      message?: string;
    }>('/buildings/bulk-update', { buildings });
  },

  /** Manager only — archive every non-archived building in the zone (same zone keys as the Zones screen). */
  archiveByZone: async (zone: string) => {
    return apiClient.post<{ success: boolean; matchedCount: number; modifiedCount: number }>(
      '/buildings/archive-by-zone',
      { zone },
    );
  },
};
