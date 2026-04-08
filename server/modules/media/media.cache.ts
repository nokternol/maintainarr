interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export class MediaCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs = 60_000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, fetchedAt: Date.now() });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}
