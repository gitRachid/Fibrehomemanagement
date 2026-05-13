import { API_BASE_URL, apiClient, getAuthHeaders, postFormData } from './client';

export interface ZoneDocumentImportResult {
  documentId: string;
  zone: string;
  kind: 'planTirageFusionPdf';
  fileName: string;
  fileSize: number;
  importedAt: string;
}

export interface ZoneDocument {
  _id: string;
  zone: string;
  kind: 'planTirageFusionPdf';
  fileName: string;
  mimeType: string;
  fileSize: number;
  importedAt: string;
}

export const zoneDocumentsApi = {
  importPlanTirageFusionPdf: async (zone: string, file: { uri: string; name: string; mimeType?: string }) => {
    const formData = new FormData();
    formData.append('zone', zone);
    formData.append('pdf', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/pdf',
    } as any);

    return postFormData<{ success: boolean; message?: string; data: ZoneDocumentImportResult }>(
      '/zone-documents/import-pdf',
      formData,
    );
  },

  getByZone: async (zone: string) => {
    return apiClient.get<{ success: boolean; count: number; data: ZoneDocument[] }>(
      `/zone-documents/zone/${encodeURIComponent(zone)}`,
    );
  },

  getLatestPlanTirageFusionPdfDownloadRequest: async (zone: string, fileName = 'plan-tirage-fusion.pdf') => ({
    url: `${API_BASE_URL}/zone-documents/zone/${encodeURIComponent(zone)}/latest-download`,
    fileName,
    headers: await getAuthHeaders(),
  }),

  getDownloadRequest: async (documentId: string, fileName = 'plan-tirage-fusion.pdf') => ({
    url: `${API_BASE_URL}/zone-documents/${encodeURIComponent(documentId)}/download`,
    fileName,
    headers: await getAuthHeaders(),
  }),

  delete: async (documentId: string) => {
    return apiClient.delete<{ success: boolean; message?: string }>(
      `/zone-documents/${encodeURIComponent(documentId)}`,
    );
  },
};
