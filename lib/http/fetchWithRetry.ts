const RETRYABLE_STATUSES = new Set([429, 502, 503, 504, 520, 521, 522, 524]);

type FetchWithRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(response: Response) {
  return RETRYABLE_STATUSES.has(response.status);
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    return fetch(input, init);
  }

  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 300;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!isRetryable(response) || attempt === retries) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
    }

    const delay = baseDelayMs * 2 ** attempt;
    await sleep(delay);
  }

  throw lastError ?? new Error("Failed to fetch.");
}
