const CACHE_VERSION_KEY = "edu.webllm.cacheVersion";
const WEBLLM_DB_HINTS = ["webllm", "mlc", "transformer", "cache"];
const MODEL_HOST_HINT = "models.gomdory.com";

const includesAny = (value: string, patterns: string[]) => {
  const lower = value.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
};

export type WebLLMCacheClearSummary = {
  cacheNamesScanned: number;
  cacheEntriesDeleted: number;
  cacheBucketsDeleted: number;
  indexedDbDeleted: number;
};

export async function safeClearWebLLMCache(): Promise<WebLLMCacheClearSummary> {
  const summary: WebLLMCacheClearSummary = {
    cacheNamesScanned: 0,
    cacheEntriesDeleted: 0,
    cacheBucketsDeleted: 0,
    indexedDbDeleted: 0,
  };

  if (typeof window === "undefined") return summary;

  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    summary.cacheNamesScanned = names.length;
    for (const name of names) {
      const shouldClearBucket = includesAny(name, ["webllm", "mlc", "gomdory", "models"]);
      try {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const request of requests) {
          const requestUrl = request.url ?? "";
          if (shouldClearBucket || requestUrl.includes(MODEL_HOST_HINT)) {
            const deleted = await cache.delete(request);
            if (deleted) {
              summary.cacheEntriesDeleted += 1;
            }
          }
        }
        if (shouldClearBucket) {
          const bucketDeleted = await caches.delete(name);
          if (bucketDeleted) {
            summary.cacheBucketsDeleted += 1;
          }
        }
      } catch {
        // best effort
      }
    }
  }

  if (typeof indexedDB !== "undefined" && "databases" in indexedDB) {
    try {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs
          .map((db) => db.name)
          .filter((name): name is string => typeof name === "string")
          .filter((name) => includesAny(name, WEBLLM_DB_HINTS))
          .map(
            (name) =>
              new Promise<void>((resolve) => {
                try {
                  const req = indexedDB.deleteDatabase(name);
                  req.onsuccess = () => {
                    summary.indexedDbDeleted += 1;
                    resolve();
                  };
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                } catch {
                  resolve();
                }
              }),
          ),
      );
    } catch {
      // best effort
    }
  }

  return summary;
}

export type WebLLMCacheVersion = {
  modelId: string;
  configEtag: string;
  checkedAt: number;
};

export const readWebLLMCacheVersion = (): WebLLMCacheVersion | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_VERSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebLLMCacheVersion>;
    if (!parsed.modelId || !parsed.configEtag || !parsed.checkedAt) return null;
    return {
      modelId: parsed.modelId,
      configEtag: parsed.configEtag,
      checkedAt: parsed.checkedAt,
    };
  } catch {
    return null;
  }
};

export const writeWebLLMCacheVersion = (value: WebLLMCacheVersion) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_VERSION_KEY, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

export const shouldInvalidateCacheVersion = (next: {
  modelId: string;
  configEtag: string;
}): boolean => {
  const previous = readWebLLMCacheVersion();
  if (!previous) return false;
  return previous.modelId !== next.modelId || previous.configEtag !== next.configEtag;
};

export const isModelHostAsset = (url: string) => {
  try {
    return new URL(url).hostname.includes(MODEL_HOST_HINT);
  } catch {
    return false;
  }
};
