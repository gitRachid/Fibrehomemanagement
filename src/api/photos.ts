import { API_BASE_URL, getAuthHeaders } from './client';

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

export interface PhotosResponse {
  success: boolean;
  count: number;
  data: Photo[];
}

export const photosApi = {
  getByBuilding: async (buildingId: string) => {
    const auth = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/building/${buildingId}`, {
      headers: auth,
    });
    return response.json();
  },

  upload: async (buildingId: string, photo: Photo, fileBlob?: Blob) => {
    const auth = await getAuthHeaders();
    const formData = new FormData();
    formData.append('buildingId', buildingId);
    formData.append('id', photo.id);
    formData.append('name', photo.name);
    formData.append('type', photo.type);
    formData.append('timestamp', photo.timestamp.toISOString());

    if (fileBlob) {
      formData.append('photo', fileBlob, photo.name);
    }

    const response = await fetch(`${API_BASE_URL}/photos/upload`, {
      method: 'POST',
      headers: auth,
      body: formData,
    });

    return response.json();
  },

  uploadMobile: async (buildingId: string, photo: Photo) => {
    const auth = await getAuthHeaders();
    const formData = new FormData();
    formData.append('buildingId', buildingId);
    formData.append('id', photo.id);
    formData.append('name', photo.name);
    formData.append('type', photo.type);
    formData.append('timestamp', photo.timestamp.toISOString());

    if (photo.uri) {
      formData.append('photo', {
        uri: photo.uri,
        name: photo.name,
        type: photo.mimeType || 'image/jpeg',
      } as any);
    }

    const response = await fetch(`${API_BASE_URL}/photos/upload`, {
      method: 'POST',
      headers: auth,
      body: formData,
    });

    return response.json();
  },

  delete: async (id: string) => {
    const auth = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/${id}`, {
      method: 'DELETE',
      headers: auth,
    });
    return response.json();
  },

  getById: async (id: string) => {
    const auth = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/${id}`, {
      headers: auth,
    });
    return response.json();
  },
};
