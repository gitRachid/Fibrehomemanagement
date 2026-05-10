/**
 * Legacy batch sync (`POST /sync`). Prefer `dataService` + queue replay (`syncService`)
 * for offline/outbox flows until a single protocol is finalized.
 */
import { apiClient } from './client';
import { Building } from './buildings';
import { Assignment } from './assignments';

export interface PendingChange {
  type: string;
  data?: any;
  buildingId?: string;
  technicianIds?: string[];
  assignedBy?: string;
}

export interface SyncResults {
  buildings: {
    updated: number;
    created: number;
    errors: { type: string; error: string }[];
  };
  assignments: {
    updated: number;
    created: number;
    errors: { type: string; error: string }[];
  };
  photos: {
    uploaded: number;
    errors: { type: string; error: string }[];
  };
}

export interface SyncResponse {
  success: boolean;
  results: SyncResults;
  syncTimestamp: string;
  data: {
    buildings: Building[];
    assignments: Assignment[];
  };
}

export interface SyncStatusResponse {
  success: boolean;
  hasPendingChanges: boolean;
  pendingBuildings: number;
  pendingAssignments: number;
  serverTimestamp: string;
}

export const syncApi = {
  // Sync offline data
  sync: async (pendingChanges: PendingChange[], deviceId: string, lastSync?: string) => {
    return apiClient.post<SyncResponse>('/sync', {
      pendingChanges,
      deviceId,
      lastSync: lastSync || new Date(0).toISOString()
    });
  },

  // Get sync status
  getStatus: async (lastSync?: string) => {
    return apiClient.get<SyncStatusResponse>('/sync/status', lastSync ? { lastSync } : undefined);
  },

  // Resolve conflicts
  resolveConflicts: async (conflicts: {
    buildingId: string;
    serverVersion: Building;
    clientVersion: Building;
    resolution: 'server' | 'client' | 'merge';
  }[]) => {
    return apiClient.post<{ resolved: { buildingId: string; data: Building }[] }>('/sync/resolve', { conflicts });
  },
};
