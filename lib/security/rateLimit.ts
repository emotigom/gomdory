import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitDatabase = {
  public: {
    Tables: {
      rate_limits: {
        Row: {
          key: string;
          window_start: string;
          count: number | null;
          updated_at: string;
        };
        Insert: Partial<RateLimitDatabase["public"]["Tables"]["rate_limits"]["Row"]> & {
          key: string;
          window_start: string;
        };
        Update: Partial<RateLimitDatabase["public"]["Tables"]["rate_limits"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
};

type RateLimitRow = RateLimitDatabase["public"]["Tables"]["rate_limits"]["Row"];
type RateLimitInsert = RateLimitDatabase["public"]["Tables"]["rate_limits"]["Insert"];
type RateLimitUpdate = RateLimitDatabase["public"]["Tables"]["rate_limits"]["Update"];

type RateLimitTableBuilder = {
  select(columns: string): RateLimitTableBuilder;
  eq(column: string, value: string): RateLimitTableBuilder;
  maybeSingle(): Promise<{ data: Pick<RateLimitRow, "count" | "window_start"> | null; error: unknown | null }>;
  upsert(values: RateLimitInsert, options: { onConflict: string }): RateLimitTableBuilder;
  update(values: RateLimitUpdate): RateLimitTableBuilder;
  single(): Promise<{ data: Pick<RateLimitRow, "count" | "window_start">; error: unknown | null }>;
};

export interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
  burstMs?: number;
  burstMax?: number;
  now?: number;
  store: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, windowMs, max, burstMax, burstMs, store } = options;
  const now = options.now ?? Date.now();

  const primary = await store.increment(key, windowMs, now);
  if (primary.count > max) {
    return { allowed: false, retryAfterSec: Math.ceil((primary.resetAt - now) / 1000) };
  }

  if (burstMs && burstMax) {
    const burstKey = `${key}:burst`;
    const burst = await store.increment(burstKey, burstMs, now);
    if (burst.count > burstMax) {
      return { allowed: false, retryAfterSec: Math.ceil((burst.resetAt - now) / 1000) };
    }
  }

  return { allowed: true };
}

export async function checkAndIncrement({
  key,
  limit,
  windowSec,
  store,
  now,
}: {
  key: string;
  limit: number;
  windowSec: number;
  store: RateLimitStore;
  now?: number;
}): Promise<RateLimitResult> {
  return enforceRateLimit({
    key,
    max: limit,
    windowMs: windowSec * 1000,
    store,
    now,
  });
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number, now: number) {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      const next = { count: 1, resetAt };
      this.buckets.set(key, next);
      return next;
    }

    bucket.count += 1;
    return { ...bucket };
  }
}

export class SupabaseRateLimitStore<TDatabase extends RateLimitDatabase = RateLimitDatabase>
  implements RateLimitStore {
  constructor(private readonly supabase: SupabaseClient<TDatabase>) {}

  async increment(key: string, windowMs: number, now: number) {
    const supabase = this.supabase as unknown as SupabaseClient<RateLimitDatabase>;
    const table = () => supabase.from("rate_limits") as unknown as RateLimitTableBuilder;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowStartIso = new Date(windowStart).toISOString();
    const resetAt = windowStart + windowMs;

    const { data: existing, error: selectError } = await table()
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();
    const existingRow = existing as { count: number | null; window_start: string } | null;

    if (selectError) {
      throw selectError;
    }

    if (!existingRow || new Date(existingRow.window_start).getTime() !== windowStart) {
      const { data, error } = await table()
        .upsert({ key, count: 1, window_start: windowStartIso, updated_at: new Date(now).toISOString() }, { onConflict: "key" })
        .select("count, window_start")
        .single();

      if (error) {
        throw error;
      }

      const row = data as { count: number | null; window_start: string };
      return { count: row.count ?? 1, resetAt };
    }

    const nextCount = (existingRow.count ?? 0) + 1;
    const { data, error } = await table()
      .update({ count: nextCount, window_start: windowStartIso, updated_at: new Date(now).toISOString() })
      .eq("key", key)
      .select("count, window_start")
      .single();

    if (error) {
      throw error;
    }

    const row = data as { count: number | null; window_start: string };
    return { count: row.count ?? nextCount, resetAt };
  }
}
