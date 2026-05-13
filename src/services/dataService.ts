/**
 * Canonical offline path: persistent queue + `SyncService` replay against REST CRUD.
 * Use `syncApi` only for explicit legacy `/sync` tooling, not mixed with this queue.
 */
import { Assignment, assignmentsApi, Building, buildingsApi, Technician, techniciansApi } from '@/api';
import { apiListField } from '@/api/client';
import { QueueManager } from './queueManager';
import { SyncService } from './syncService';

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
  cachedAt: string;
};

const CACHE_TTL_MS = {
  buildings: 5 * 60 * 1_000,
  technicians: 10 * 60 * 1_000,
  assignments: 2 * 60 * 1_000,
};

let AsyncStorage: any = null;
let platformOS = 'web';

try {
  const Platform = require('react-native').Platform;
  platformOS = Platform.OS;
} catch {
  platformOS = 'web';
}

if (platformOS !== 'web') {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch {
    AsyncStorage = null;
  }
}

const isWeb = (): boolean => platformOS === 'web';

const Storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isWeb()) return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return AsyncStorage ? await AsyncStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isWeb()) {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        return;
      }
      if (AsyncStorage) await AsyncStorage.setItem(key, value);
    } catch {
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isWeb()) {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        return;
      }
      if (AsyncStorage) await AsyncStorage.removeItem(key);
    } catch {
    }
  },
};

class DataService {
  private initialized = false;
  private isOnline = true;
  private lastSyncAt: string | null = null;
  private deviceId = '';
  private readonly queueManager = new QueueManager(Storage);
  private readonly syncService = new SyncService({
    queueManager: this.queueManager,
    isOnline: () => this.isOnline,
    saveLastSyncAt: async (iso) => {
      this.lastSyncAt = iso;
      await Storage.setItem('last_sync_at', iso);
    },
    saveConflict: async (conflict) => {
      const previous = await this.loadFromStorage('sync_conflicts_v1');
      const next = Array.isArray(previous) ? [...previous, conflict] : [conflict];
      await this.saveToStorage('sync_conflicts_v1', next.slice(-200));
    },
  });

  constructor() {
    this.init().catch((error) => {
      console.error('DataService init failed', error);
    });
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.deviceId = await this.getOrCreateDeviceId();
    this.lastSyncAt = await Storage.getItem('last_sync_at');
    await this.queueManager.init();
    this.setupNetworkListener();
    this.initialized = true;
  }

  private async ensureReady(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  private setupNetworkListener(): void {
    if (isWeb() && typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncData();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
      return;
    }

    try {
      const NetInfo = require('@react-native-community/netinfo').default;
      NetInfo.addEventListener((state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
        const previous = this.isOnline;
        this.isOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
        if (!previous && this.isOnline) {
          this.syncData();
        }
      });
    } catch {
      this.isOnline = true;
    }
  }

  private async getOrCreateDeviceId(): Promise<string> {
    const saved = await Storage.getItem('device_id');
    if (saved) return saved;
    const id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await Storage.setItem('device_id', id);
    return id;
  }

  private getCacheKey(namespace: string, segment = 'all'): string {
    return `cache_${namespace}_${segment}`;
  }

  private async setCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const envelope: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
      cachedAt: new Date().toISOString(),
    };
    await Storage.setItem(key, JSON.stringify(envelope));
  }

  private async getCache<T>(key: string): Promise<{ value: T | null; isExpired: boolean }> {
    const raw = await Storage.getItem(key);
    if (!raw) return { value: null, isExpired: true };

    try {
      const envelope = JSON.parse(raw) as CacheEnvelope<T>;
      const isExpired = Date.now() > envelope.expiresAt;
      return { value: envelope.value ?? null, isExpired };
    } catch {
      return { value: null, isExpired: true };
    }
  }

  private async queueChange(params: {
    entity: 'building' | 'assignment' | 'technician' | 'item' | 'photo';
    action: 'create' | 'update' | 'delete';
    payload: unknown;
    entityId?: string;
    baseVersion?: string;
  }): Promise<void> {
    await this.queueManager.enqueue({
      ...params,
      localUpdatedAt: new Date().toISOString(),
    });
  }

  async getBuildings(serviceId?: string, options?: { status?: string; search?: string }): Promise<Building[]> {
    await this.ensureReady();
    const cacheKey = this.getCacheKey('buildings', serviceId || 'all');
    const cached = await this.getCache<Building[]>(cacheKey);

    if (!this.isOnline && cached.value) return cached.value;
    if (!this.isOnline) return [];

    try {
      const response = serviceId
        ? await buildingsApi.getByService(serviceId, options?.status || 'active')
        : await buildingsApi.getAll(options);
      const data = apiListField(response);
      await this.setCache(cacheKey, data, CACHE_TTL_MS.buildings);
      return data;
    } catch {
      return cached.value ?? [];
    }
  }

  async saveBuilding(building: Building): Promise<boolean> {
    await this.ensureReady();
    const action = building._id ? 'update' : 'create';
    const entityId = building._id;

    if (this.isOnline) {
      try {
        if (action === 'update' && entityId) {
          await buildingsApi.update(entityId, { ...building, lastModified: new Date().toISOString() });
        } else {
          await buildingsApi.create({ ...building, lastModified: new Date().toISOString() });
        }
        return true;
      } catch {
      }
    }

    await this.queueChange({
      entity: 'building',
      action,
      payload: { ...building, lastModified: new Date().toISOString() },
      entityId,
      baseVersion: building.updatedAt,
    });
    return true;
  }

  async getTechnicians(options?: { status?: string }): Promise<Technician[]> {
    await this.ensureReady();
    const cacheKey = this.getCacheKey('technicians', options?.status || 'all');
    const cached = await this.getCache<Technician[]>(cacheKey);

    if (!this.isOnline && cached.value) return cached.value;
    if (!this.isOnline) return [];

    try {
      const response = await techniciansApi.getAll(options);
      const data = apiListField(response);
      await this.setCache(cacheKey, data, CACHE_TTL_MS.technicians);
      return data;
    } catch {
      return cached.value ?? [];
    }
  }

  async getAssignments(buildingId?: string): Promise<Assignment[]> {
    await this.ensureReady();
    const cacheKey = this.getCacheKey('assignments', buildingId || 'all');
    const cached = await this.getCache<Assignment[]>(cacheKey);

    if (!buildingId) return cached.value ?? [];
    if (!this.isOnline && cached.value) return cached.value;
    if (!this.isOnline) return [];

    try {
      const response = await assignmentsApi.getByBuilding(buildingId);
      const data = apiListField(response);
      await this.setCache(cacheKey, data, CACHE_TTL_MS.assignments);
      return data;
    } catch {
      return cached.value ?? [];
    }
  }

  async createAssignment(assignment: Omit<Assignment, '_id'>): Promise<boolean> {
    await this.ensureReady();
    if (this.isOnline) {
      try {
        await assignmentsApi.create(assignment);
        return true;
      } catch {
      }
    }

    await this.queueChange({
      entity: 'assignment',
      action: 'create',
      payload: assignment,
    });
    return true;
  }

  async syncData(): Promise<{ success: boolean; message: string }> {
    await this.ensureReady();
    if (!this.isOnline) return { success: false, message: 'Offline: sync postponed' };

    try {
      const result = await this.syncService.syncPendingChanges();
      const remaining = await this.getPendingChangesCount();
      return {
        success: true,
        message: `Sync done: ${result.synced} synced, ${result.retried} retried, ${remaining} pending`,
      };
    } catch (error) {
      console.error('Sync failed', error);
      return { success: false, message: 'Sync failed due to network/server instability' };
    }
  }

  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  async getPendingChangesCount(): Promise<number> {
    await this.ensureReady();
    const all = await this.queueManager.getAll();
    return all.length;
  }

  async getLastSyncAt(): Promise<string | null> {
    await this.ensureReady();
    return this.lastSyncAt;
  }

  async clearSessionData(): Promise<void> {
    await this.queueManager.clear();
    this.lastSyncAt = null;
  }

  async saveToStorage(key: string, data: unknown): Promise<void> {
    await Storage.setItem(key, JSON.stringify(data));
  }

  async loadFromStorage<T = unknown>(key: string): Promise<T | null> {
    const raw = await Storage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async loadAssignments(): Promise<unknown[]> {
    const data = await this.loadFromStorage<unknown[]>('buildingAssignments');
    return data ?? [];
  }

  async saveAssignments(assignments: unknown[]): Promise<void> {
    await this.saveToStorage('buildingAssignments', assignments);
  }
}

export const dataService = new DataService();
export default dataService;