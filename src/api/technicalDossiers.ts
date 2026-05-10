import { API_BASE_URL, getAuthHeaders } from './client';

const sanitizeFileName = (value: string) =>
  value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_').slice(0, 80);

export const technicalDossiersApi = {
  getDownloadRequest: async (buildingId: string, label?: string) => {
    const headers = await getAuthHeaders();
    const fileName = `dossier_technique_${sanitizeFileName(label || buildingId)}.xlsx`;

    return {
      url: `${API_BASE_URL}/technical-dossiers/building/${encodeURIComponent(buildingId)}`,
      headers,
      fileName,
    };
  },
};
