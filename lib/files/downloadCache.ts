const DEFAULT_DOWNLOAD_CACHE_TTL_MS = 30_000;

type CacheRecord = {
  resolvedUrl: string;
  expiresAt: number;
};

type PendingRecord = {
  promise: Promise<string>;
};

const resolvedCache = new Map<string, CacheRecord>();
const pendingCache = new Map<string, PendingRecord>();

type ResolveDownloadUrlOptions = {
  fileId: string;
  downloadPath: string;
  ttlMs?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
};

function resolveRedirectLocation(response: Response): string {
  const fromLocationHeader = response.headers.get("location");
  if (fromLocationHeader) {
    return fromLocationHeader;
  }
  return response.url;
}

export async function resolveDownloadUrlWithCache({
  fileId,
  downloadPath,
  ttlMs = DEFAULT_DOWNLOAD_CACHE_TTL_MS,
  now = Date.now,
  fetchImpl = fetch,
}: ResolveDownloadUrlOptions): Promise<string> {
  const currentTime = now();
  const cached = resolvedCache.get(fileId);
  if (cached && cached.expiresAt > currentTime) {
    return cached.resolvedUrl;
  }

  const pending = pendingCache.get(fileId);
  if (pending) {
    return pending.promise;
  }

  const resolver = (async () => {
    const response = await fetchImpl(downloadPath, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
    });

    if (response.type === "opaqueredirect") {
      resolvedCache.set(fileId, {
        resolvedUrl: downloadPath,
        expiresAt: now() + ttlMs,
      });
      return downloadPath;
    }

    if (!(response.status >= 300 && response.status < 400) && !response.ok) {
      throw new Error(`Failed to resolve download url: ${response.status}`);
    }

    const resolvedRaw = resolveRedirectLocation(response);
    const resolvedUrl = resolvedRaw.startsWith("http") ? resolvedRaw : new URL(resolvedRaw, window.location.origin).toString();

    resolvedCache.set(fileId, {
      resolvedUrl,
      expiresAt: now() + ttlMs,
    });

    return resolvedUrl;
  })();

  pendingCache.set(fileId, { promise: resolver });

  try {
    return await resolver;
  } finally {
    pendingCache.delete(fileId);
  }
}

export function isSafeDownloadAttributeHref(url: string): boolean {
  if (url.startsWith("/")) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function __resetDownloadCacheForTests() {
  resolvedCache.clear();
  pendingCache.clear();
}

