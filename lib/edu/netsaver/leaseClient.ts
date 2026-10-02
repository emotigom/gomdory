export type LeaseAcquireResult = {
  ok: boolean;
  leaseId?: string;
  retryAfterMs?: number;
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const parseRetryAfter = (response: Response) => {
  const retryAfterHeader = response.headers.get("retry-after");
  if (!retryAfterHeader) return undefined;
  const seconds = Number(retryAfterHeader);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
};

export const acquireLease = async (code: string, timeoutMs = 1200): Promise<LeaseAcquireResult> => {
  try {
    const response = await fetchWithTimeout(
      "/__edu_p2p/lease/acquire",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
      timeoutMs,
    );
    if (!response.ok) {
      return { ok: false, retryAfterMs: parseRetryAfter(response) };
    }
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      leaseId?: string;
      retryAfterMs?: number;
    };
    return {
      ok: data.ok ?? true,
      leaseId: data.leaseId,
      retryAfterMs: data.retryAfterMs ?? parseRetryAfter(response),
    };
  } catch {
    return { ok: false };
  }
};

export const renewLease = async (code: string, leaseId: string, timeoutMs = 1200) => {
  try {
    const response = await fetchWithTimeout(
      "/__edu_p2p/lease/renew",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, leaseId }),
      },
      timeoutMs,
    );
    return response.ok;
  } catch {
    return false;
  }
};

export const releaseLease = async (code: string, leaseId: string, timeoutMs = 1200) => {
  try {
    const response = await fetchWithTimeout(
      "/__edu_p2p/lease/release",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, leaseId }),
      },
      timeoutMs,
    );
    return response.ok;
  } catch {
    return false;
  }
};
