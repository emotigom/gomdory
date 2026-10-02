import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateSupabaseEnv } from "@/lib/server/env";
import type { StatusLevel } from "./statusTypes";

export const HEALTH_PROBE_TIMEOUT_MS = 1_500;

type ProbeStatus = "ok" | "error";

export type HealthProbeResult = {
  id: "auth" | "db" | "app";
  status: ProbeStatus;
  level: StatusLevel;
  message: string;
  checkedAt: string;
  latencyMs: number;
};

type TimedProbeOptions = {
  id: HealthProbeResult["id"];
  okMessage: string;
  errorMessage: string;
  timeoutMs?: number;
};

function toLatency(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = HEALTH_PROBE_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function runProbe(options: TimedProbeOptions, operation: (signal: AbortSignal) => Promise<boolean>): Promise<HealthProbeResult> {
  const startedAt = performance.now();

  try {
    const ok = await withTimeout(operation, options.timeoutMs);
    return {
      id: options.id,
      status: ok ? "ok" : "error",
      level: ok ? "operational" : "degraded",
      message: ok ? options.okMessage : options.errorMessage,
      checkedAt: new Date().toISOString(),
      latencyMs: toLatency(startedAt),
    };
  } catch {
    return {
      id: options.id,
      status: "error",
      level: "degraded",
      message: options.errorMessage,
      checkedAt: new Date().toISOString(),
      latencyMs: toLatency(startedAt),
    };
  }
}

export async function probeAuthAvailability(): Promise<HealthProbeResult> {
  return runProbe(
    {
      id: "auth",
      okMessage: "인증 엔드포인트 응답 정상",
      errorMessage: "인증 엔드포인트 응답 지연 또는 실패",
    },
    async (signal) => {
      const validation = validateSupabaseEnv();
      if (!validation.ok) return false;

      const healthUrl = new URL("/auth/v1/health", validation.supabaseUrl);
      const response = await fetch(healthUrl, {
        cache: "no-store",
        headers: { apikey: validation.supabaseAnonKey! },
        signal,
      });

      return response.ok;
    },
  );
}

export async function probeDatabaseReachability(): Promise<HealthProbeResult> {
  return runProbe(
    {
      id: "db",
      okMessage: "데이터베이스 연결 정상",
      errorMessage: "데이터베이스 연결 지연 또는 실패",
    },
    async (signal) => {
      const supabase = createSupabaseAdminClient();
      const query = supabase.from("boards").select("id", { head: true, count: "exact" }).limit(1).abortSignal(signal);
      const { error } = await query;
      return !error;
    },
  );
}

export async function probeAppResponsiveness(): Promise<HealthProbeResult> {
  return runProbe(
    {
      id: "app",
      okMessage: "내부 API 응답 정상",
      errorMessage: "내부 API 응답 지연 또는 실패",
    },
    async () => true,
  );
}
