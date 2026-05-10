import { apiClient, postFormData } from './client';

export interface Photo {
  _id?: string;
  id: string;
  uri: string;
  name: string;
  type: string;
  timestamp: Date;
  buildingId?: string;
  idImmeuble?: string;
  gpsLatitude?: string;
  gpsLongitude?: string;
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
    return apiClient.get<PhotosResponse>(`/photos/building/${buildingId}`);
  },

  // Upload single photo
  upload: async (buildingId: string, photo: Photo, fileBlob?: Blob) => {
    const formData = new FormData();
    formData.append('buildingId', buildingId);
    formData.append('id', photo.id);
    formData.append('name', photo.name);
    formData.append('type', photo.type);
    formData.append('timestamp', photo.timestamp.toISOString());
    if (photo.idImmeuble) formData.append('idImmeuble', photo.idImmeuble);
    if (photo.gpsLatitude) formData.append('gpsLatitude', photo.gpsLatitude);
    if (photo.gpsLongitude) formData.append('gpsLongitude', photo.gpsLongitude);

    if (fileBlob) {
      formData.append('photo', fileBlob, photo.name);
    }

    return postFormData<PhotosResponse & { message?: string }>('/photos/upload', formData);
  },

  // Upload photo from React Native
  uploadMobile: async (buildingId: string, photo: Photo) => {
    const formData = new FormData();
    formData.append('buildingId', buildingId);
    formData.append('id', photo.id);
    formData.append('name', photo.name);
    formData.append('type', photo.type);
    formData.append('timestamp', photo.timestamp.toISOString());
    if (photo.idImmeuble) formData.append('idImmeuble', photo.idImmeuble);
    if (photo.gpsLatitude) formData.append('gpsLatitude', photo.gpsLatitude);
    if (photo.gpsLongitude) formData.append('gpsLongitude', photo.gpsLongitude);

    if (photo.uri) {
      formData.append('photo', {
        uri: photo.uri,
        name: photo.name,
        type: photo.mimeType || 'image/jpeg',
      } as any);
    }

    return postFormData<PhotosResponse & { message?: string }>('/photos/upload', formData);
  },

  // Delete photo
  delete: async (id: string) => {
    return apiClient.delete<{ success: boolean; message?: string }>(`/photos/${id}`);
  },

  // Get single photo
  getById: async (id: string) => {
    return apiClient.get<{ success: boolean; data?: Photo }>(`/photos/${id}`);
  },
};
