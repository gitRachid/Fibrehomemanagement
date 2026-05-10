import { apiClient, postFormData } from './client';

export interface RouteOptiqueImportResult {
  importId: string;
  zone: string;
  fileName: string;
  sheets: string[];
  rows: number;
  inserted: number;
  updated: number;
  stored: number;
  zoneTotal: number;
  fiberColorMap?: Record<string, { hex: string; label: string }>;
}

export interface RouteOptiqueRow {
  _id?: string;
  zone: string;
  sheetName: string;
  rowNumber: number;
  tiroirOdf: string;
  pm?: string;
  destinationPbo?: string;
  longPboSro?: string;
  fields?: Array<{
    header: string;
    value: unknown;
    colorIndex?: number;
    colorHex?: string;
    colorLabel?: string;
  }>;
}

export const routeOptiqueApi = {
  importMobile: async (zone: string, file: { uri: string; name: string; mimeType?: string }) => {
    const formData = new FormData();
    formData.append('zone', zone);
    formData.append('routeOptique', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as any);

    return postFormData<{ success: boolean; message?: string; data: RouteOptiqueImportResult }>(
      '/route-optique/import',
      formData,
    );
  },

  getByZone: async (zone: string) => {
    return apiClient.get<{ success: boolean; count: number; data: RouteOptiqueRow[] }>(
      `/route-optique/zone/${encodeURIComponent(zone)}`,
    );
  },
};
