import { assignmentsApi, buildingsApi, itemsApi, photosApi, techniciansApi } from '@/api';
import { QueueItem, QueueManager } from './queueManager';

type ConflictResolution = 'client_wins' | 'server_wins' | 'manual_merge';

interface ConflictRecord {
  queueItemId: string;
  entity: QueueItem['entity'];
  entityId?: string;
  localPayload: unknown;
  serverPayload?: unknown;
  strategy: ConflictResolution;
  resolvedAt: string;
}

interface SyncDependencies {
  queueManager: QueueManager;
  isOnline: () => boolean;
  saveLastSyncAt: (iso: string) => Promise<void>;
  saveConflict: (conflict: ConflictRecord) => Promise<void>;
}

const isConflictError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /409|conflict/i.test(message);
};

const isTransientError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /network|timeout|5\d\d|failed to fetch/i.test(message);
};

export class SyncService {
  private readonly deps: SyncDependencies;
  private isRunning = false;

  constructor(deps: SyncDependencies) {
    this.deps = deps;
  }

  async syncPendingChanges(): Promise<{ synced: number; retried: number; skipped: number }> {
    if (this.isRunning || !this.deps.isOnline()) {
      return { synced: 0, retried: 0, skipped: 0 };
    }

    this.isRunning = true;
    let synced = 0;
    let retried = 0;
    let skipped = 0;

    try {
      const readyItems = await this.deps.queueManager.getReadyItems();
      for (const item of readyItems) {
        if (!this.deps.isOnline()) break;
        await this.deps.queueManager.markProcessing(item.id);

        try {
          await this.execute(item);
          await this.deps.queueManager.markSuccess(item.id);
          synced += 1;
        } catch (error) {
          if (isConflictError(error)) {
            await this.resolveConflict(item, error);
            synced += 1;
            continue;
          }

          if (isTransientError(error)) {
            await this.deps.queueManager.markRetry(item.id, error);
            retried += 1;
          } else {
            await this.deps.queueManager.replace(item.id, {
              status: 'failed',
              lastError: error instanceof Error ? error.message : String(error),
              nextRetryAt: Date.now() + 60_000,
            });
            skipped += 1;
          }
        }
      }

      if (synced > 0) {
        await this.deps.saveLastSyncAt(new Date().toISOString());
      }
      return { synced, retried, skipped };
    } finally {
      this.isRunning = false;
    }
  }

  private async execute(item: QueueItem): Promise<void> {
    switch (item.entity) {
      case 'building':
        await this.syncBuilding(item);
        return;
      case 'assignment':
        await this.syncAssignment(item);
        return;
      case 'technician':
        await this.syncTechnician(item);
        return;
      case 'item':
        await this.syncItem(item);
        return;
      case 'photo':
        await this.syncPhoto(item);
        return;
      default:
        throw new Error(`Unsupported sync entity: ${String(item.entity)}`);
    }
  }

  private async syncBuilding(item: QueueItem): Promise<void> {
    const payload = item.payload as Record<string, unknown>;
    if (item.action === 'create') await buildingsApi.create(payload as any);
    if (item.action === 'update' && item.entityId) await buildingsApi.update(item.entityId, payload as any);
    if (item.action === 'delete' && item.entityId) await buildingsApi.archive(item.entityId);
  }

  private async syncAssignment(item: QueueItem): Promise<void> {
    const payload = item.payload as Record<string, unknown>;
    if (item.action === 'create') await assignmentsApi.create(payload as any);
    if (item.action === 'update' && item.entityId) await assignmentsApi.cancel(item.entityId);
    if (item.action === 'delete' && item.entityId) await assignmentsApi.cancel(item.entityId);
  }

  private async syncTechnician(item: QueueItem): Promise<void> {
    const payload = item.payload as Record<string, unknown>;
    if (item.action === 'create') await techniciansApi.create(payload as any);
    if (item.action === 'update' && item.entityId) await techniciansApi.update(item.entityId, payload as any);
    if (item.action === 'delete' && item.entityId) await techniciansApi.delete(item.entityId);
  }

  private async syncItem(item: QueueItem): Promise<void> {
    const payload = item.payload as Record<string, unknown>;
    if (item.action === 'create') await itemsApi.create(payload as any);
    if (item.action === 'update' && item.entityId) await itemsApi.update(item.entityId, payload as any);
    if (item.action === 'delete' && item.entityId) await itemsApi.archive(item.entityId);
  }

  private async syncPhoto(item: QueueItem): Promise<void> {
    const payload = item.payload as {
      buildingId: string;
      photo: Parameters<typeof photosApi.uploadMobile>[1];
    };

    if (item.action === 'create') {
      await photosApi.uploadMobile(payload.buildingId, payload.photo);
    }
    if (item.action === 'delete' && item.entityId) {
      await photosApi.delete(item.entityId);
    }
  }

  private async resolveConflict(item: QueueItem, error: unknown): Promise<void> {
    // Default strategy: client wins for mutable field data.
    // We still record conflict details for observability and audits.
    await this.deps.saveConflict({
      queueItemId: item.id,
      entity: item.entity,
      entityId: item.entityId,
      localPayload: item.payload,
      strategy: 'client_wins',
      resolvedAt: new Date().toISOString(),
    });

    try {
      // Retry once immediately to apply local state over server state.
      await this.execute({
        ...item,
        attempts: item.attempts + 1,
      });
      await this.deps.queueManager.markSuccess(item.id);
    } catch (secondError) {
      await this.deps.queueManager.markRetry(item.id, secondError ?? error);
    }
  }
}
