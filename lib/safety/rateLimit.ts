import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type ApiRateLimitDb = {
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: number | null; error: { message: string } | null }>;
};

type ApiRateLimitDatabase = {
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          key: string;
          window_start: string;
          count: number;
          updated_at: string;
        };
        Insert: {
          key: string;
          window_start: string;
          count?: number;
          updated_at?: string;
        };
        Update: Partial<ApiRateLimitDatabase["public"]["Tables"]["api_rate_limits"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ApiRateLimitOptions = {
  key: string;
  windowSeconds: number;
  limit: number;
  now?: number;
};

function getWindowStart(nowMs: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  return { startMs, windowMs, startIso: new Date(startMs).toISOString() };
}

export async function checkRateLimit(
  db: ApiRateLimitDb | SupabaseClient<ApiRateLimitDatabase>,
  { key, windowSeconds, limit, now }: ApiRateLimitOptions,
): Promise<ApiRateLimitResult> {
  const nowMs = now ?? Date.now();
  const { startMs, windowMs, startIso } = getWindowStart(nowMs, windowSeconds);
  const client = db as ApiRateLimitDb;

  const { data, error } = await client.rpc("increment_api_rate_limit", {
    p_key: key,
    p_window_start: startIso,
  });

  if (error) {
    throw new Error(error.message);
  }

  const count = typeof data === "number" ? data : Number(data ?? 0);
  if (count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((startMs + windowMs - nowMs) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  return { ok: true };
}

export {
  enforceRateLimit,
  checkAndIncrement,
  MemoryRateLimitStore,
  SupabaseRateLimitStore,
  type RateLimitOptions,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/security/rateLimit";
