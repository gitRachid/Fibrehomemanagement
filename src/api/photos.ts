import { API_BASE_URL } from './client';

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
  // Get photos for a building
  getByBuilding: async (buildingId: string) => {
    const response = await fetch(`${API_BASE_URL}/photos/building/${buildingId}`);
    return response.json();
  },

  // Upload single photo
  upload: async (buildingId: string, photo: Photo, fileBlob?: Blob) => {
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
      body: formData,
    });

    return response.json();
  },

  // Upload photo from React Native
  uploadMobile: async (buildingId: string, photo: Photo) => {
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
      body: formData,
    });

    return response.json();
  },

  // Delete photo
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/photos/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Get single photo
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/photos/${id}`);
    return response.json();
  },
};
