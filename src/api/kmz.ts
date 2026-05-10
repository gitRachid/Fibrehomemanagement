import { apiClient, postFormData } from './client';

export interface KmzImportResult {
  importId: string;
  zone: string;
  fileName: string;
  fileSize: number;
  importedAt: string;
}

export interface KmzImportFile {
  _id: string;
  zone: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  importedAt?: string;
}

export interface KmzCoordinate {
  latitude: number;
  longitude: number;
}

export interface KmzFeature {
  id: string;
  type: 'point' | 'line' | 'polygon';
  name: string;
  description?: string;
  coordinates: KmzCoordinate[];
}

export interface KmzFeaturesResponse {
  success: boolean;
  count: number;
  data: KmzFeature[];
  file: null | {
    id: string;
    zone: string;
    fileName: string;
    importedAt?: string;
  };
}

export const kmzApi = {
  importMobile: async (zone: string, file: { uri: string; name: string; mimeType?: string }) => {
    const formData = new FormData();
    formData.append('zone', zone);
    formData.append('kmz', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/vnd.google-earth.kmz',
    } as any);

    return postFormData<{ success: boolean; message?: string; data: KmzImportResult }>(
      '/kmz/import',
      formData,
    );
  },

  getByZone: async (zone: string) => {
    return apiClient.get<{ success: boolean; count: number; data: KmzImportFile[] }>(
      `/kmz/zone/${encodeURIComponent(zone)}`,
    );
  },

  getFeaturesByZone: async (zone: string) => {
    return apiClient.get<KmzFeaturesResponse>(
      `/kmz/zone/${encodeURIComponent(zone)}/features`,
    );
  },
};
