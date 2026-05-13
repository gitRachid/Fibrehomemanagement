type QueueAction = 'create' | 'update' | 'delete';
type QueueEntity = 'building' | 'assignment' | 'technician' | 'item' | 'photo';
type QueueStatus = 'pending' | 'processing' | 'failed';

export interface QueueItem {
  id: string;
  entity: QueueEntity;
  action: QueueAction;
  payload: unknown;
  entityId?: string;
  localUpdatedAt: string;
  baseVersion?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  status: QueueStatus;
  lastError?: string;
}

interface StorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1_000;

const createId = (): string => `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const computeBackoffDelay = (attempt: number): number => {
  const exp = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 500);
  return exp + jitter;
};

export class QueueManager {
  private readonly storageKey: string;
  private readonly storage: StorageDriver;
  private queue: QueueItem[] = [];
  private initialized = false;

  constructor(storage: StorageDriver, storageKey = 'sync_queue_v1') {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const raw = await this.storage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as QueueItem[];
        this.queue = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.queue = [];
      }
    }
    this.initialized = true;
  }

  async enqueue(input: Omit<QueueItem, 'id' | 'attempts' | 'maxAttempts' | 'nextRetryAt' | 'status'>): Promise<QueueItem> {
    await this.init();
    const item: QueueItem = {
      ...input,
      id: createId(),
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: Date.now(),
      status: 'pending',
    };
    this.queue.push(item);
    await this.persist();
    return item;
  }

  async getAll(): Promise<QueueItem[]> {
    await this.init();
    return [...this.queue];
  }

  async getReadyItems(now = Date.now()): Promise<QueueItem[]> {
    await this.init();
    return this.queue.filter((item) => item.nextRetryAt <= now && item.attempts < item.maxAttempts);
  }

  async markProcessing(id: string): Promise<void> {
    await this.patch(id, (item) => {
      item.status = 'processing';
    });
  }

  async markSuccess(id: string): Promise<void> {
    await this.init();
    this.queue = this.queue.filter((item) => item.id !== id);
    await this.persist();
  }

  async markRetry(id: string, error: unknown): Promise<void> {
    await this.patch(id, (item) => {
      item.attempts += 1;
      item.status = 'failed';
      item.lastError = error instanceof Error ? error.message : String(error);
      item.nextRetryAt = Date.now() + computeBackoffDelay(item.attempts);
    });
  }

  async replace(itemId: string, replacement: Partial<QueueItem>): Promise<void> {
    await this.patch(itemId, (item) => {
      Object.assign(item, replacement);
    });
  }

  async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
  }

  private async patch(id: string, updater: (item: QueueItem) => void): Promise<void> {
    await this.init();
    const index = this.queue.findIndex((item) => item.id === id);
    if (index === -1) return;
    updater(this.queue[index]);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
  }
}
