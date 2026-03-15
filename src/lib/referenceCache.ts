type CacheEntry<T> = {
  data: T[];
  timestamp: number;
};

const CACHE_TTL_MS = 1000 * 60 * 10; // 10 min cache for reference data

const globalKey = '__referenceCache';
const referenceCache = (globalThis as unknown as Record<string, unknown>)[globalKey] as Map<string, CacheEntry<unknown>> | undefined;
const referenceCacheStore = referenceCache || new Map<string, CacheEntry<unknown>>();
if (!referenceCache) {
  (globalThis as unknown as Record<string, unknown>)[globalKey] = referenceCacheStore;
}

export async function getReferenceData<T>(
  cacheKey: string,
  fetcher: () => Promise<T[]>,
  ttlMs: number = CACHE_TTL_MS,
  forceRefresh = false
): Promise<T[]> {
  const existing = referenceCacheStore.get(cacheKey) as CacheEntry<T> | undefined;
  if (!forceRefresh && existing && Date.now() - existing.timestamp < ttlMs) {
    return existing.data;
  }

  const data = await fetcher();
  referenceCacheStore.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export function setReferenceData<T>(cacheKey: string, data: T[]) {
  referenceCacheStore.set(cacheKey, { data, timestamp: Date.now() });
}

export function invalidateReferenceData(prefix?: string) {
  if (!prefix) {
    referenceCacheStore.clear();
    return;
  }

  for (const key of Array.from(referenceCacheStore.keys())) {
    if (key.startsWith(prefix)) {
      referenceCacheStore.delete(key);
    }
  }
}
