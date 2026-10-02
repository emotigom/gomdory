"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import CardTile from "@/app/_components/CardTile";
import InlineAlert from "@/app/_components/InlineAlert";
import type { SystemDiagResponse, SystemDiagSuccess } from "@/lib/system/diag/types";

type FetchState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "success"; payload: SystemDiagSuccess };

function StatusBadge({ ok }: { ok: boolean }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold";
  return ok ? (
    <span className={`${base} bg-emerald-50 text-emerald-700`}>✅ 정상</span>
  ) : (
    <span className={`${base} bg-rose-50 text-rose-700`}>❌ 점검 필요</span>
  );
}

function Latency({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) return <span className="text-xs text-gray-500">—</span>;
  return <span className="text-xs text-gray-700">{value.toLocaleString()} ms</span>;
}

function SectionRow({
  label,
  ok,
  hint,
  latencyMs,
}: {
  label: string;
  ok: boolean;
  hint?: string;
  latencyMs?: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          <StatusBadge ok={ok} />
        </div>
        {hint ? <p className="text-xs text-gray-600">{hint}</p> : null}
      </div>
      {typeof latencyMs === "number" || latencyMs === null ? <Latency value={latencyMs ?? null} /> : null}
    </div>
  );
}

function EnvGrid({ env }: { env: SystemDiagSuccess["checks"]["env"] }) {
  const items = useMemo(
    () => [
      { key: "hasSupabaseUrl", label: "Supabase URL" },
      { key: "hasSupabaseAnonKey", label: "Supabase anon key" },
      { key: "hasSupabaseServiceRoleKey", label: "Supabase service role" },
      { key: "hasR2AccessKeyId", label: "R2 access key" },
      { key: "hasR2SecretAccessKey", label: "R2 secret" },
      { key: "hasR2Bucket", label: "R2 bucket" },
      { key: "hasTurnstileSecretKey", label: "Turnstile secret" },
      { key: "hasImagesBinding", label: "Images binding" },
      { key: "hasAssetsBinding", label: "Assets binding" },
      { key: "hasRealtimeRoomBinding", label: "Realtime room binding" },
    ],
    [],
  );

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
        >
          <span className="text-xs font-medium text-gray-800">{item.label}</span>
          <StatusBadge ok={env[item.key as keyof typeof env]} />
        </div>
      ))}
    </div>
  );
}

export default function SystemDiagClient() {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const fetchDiag = useCallback(async () => {
    setState({ status: "loading" });
    setCopyState("idle");
    try {
      const response = await fetch(apiV1Path("system/diag"), { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = `/auth/login?returnTo=${encodeURIComponent("/dashboard/system")}`;
        return;
      }

      const payload = (await response.json()) as SystemDiagResponse;
      if (!payload || payload.ok !== true) {
        throw new Error(
          payload && "code" in payload && typeof payload.code === "string"
            ? payload.code
            : "system_diag_failed",
        );
      }

      setState({ status: "success", payload });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "시스템 진단 정보를 불러오지 못했습니다.",
      });
    }
  }, []);

  useEffect(() => {
    fetchDiag();
  }, [fetchDiag]);

  const handleCopy = useCallback(async () => {
    if (state.status !== "success") return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.payload, null, 2));
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  }, [state]);

  const successPayload = state.status === "success" ? state.payload : null;
  const checks = successPayload?.checks ?? null;

  return (
    <div className="space-y-4">
      <CardTile>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900">진단 결과</span>
            {state.status === "success" ? (
              <span className="text-xs text-gray-600">
                {successPayload?.now} • host: {successPayload?.host ?? "알 수 없음"}
              </span>
            ) : (
              <span className="text-xs text-gray-600">상태를 불러오는 중입니다…</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={state.status !== "success"}
              className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {copyState === "copied"
                ? "복사됨"
                : copyState === "error"
                  ? "복사 실패"
                  : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={fetchDiag}
              disabled={state.status === "loading"}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {state.status === "loading" ? "진단 중…" : "다시 불러오기"}
            </button>
          </div>
        </div>

        {state.status === "error" ? (
          <InlineAlert
            tone="error"
            title="진단 정보를 불러오지 못했습니다."
            description={state.message}
            action={
              <button
                type="button"
                onClick={fetchDiag}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50"
              >
                다시 시도
              </button>
            }
          />
        ) : null}
      </CardTile>

      {checks ? (
        <div className="space-y-4">
          <CardTile>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">인증 · Supabase</span>
              <StatusBadge ok={checks.auth.ok && checks.supabase.ok} />
            </div>
            <div className="space-y-2">
              <SectionRow label="Auth session" ok={checks.auth.ok} latencyMs={checks.supabase.latencyMs} />
              <SectionRow
                label="Supabase"
                ok={checks.supabase.ok}
                hint="세션 유무와 무관한 reachability 확인"
                latencyMs={checks.supabase.latencyMs}
              />
            </div>
          </CardTile>

          <CardTile>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">Cloudflare R2</span>
              <StatusBadge ok={checks.r2.ok && checks.r2.configured} />
            </div>
            <div className="space-y-2">
              <SectionRow
                label={checks.r2.configured ? "구성됨" : "구성 필요"}
                ok={checks.r2.configured}
                latencyMs={null}
              />
              <SectionRow label="Ping" ok={checks.r2.ok} latencyMs={checks.r2.latencyMs} />
            </div>
          </CardTile>

          <CardTile>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">Durable Object</span>
              <StatusBadge ok={checks.durableObject.ok && checks.durableObject.configured} />
            </div>
            <div className="space-y-2">
              <SectionRow
                label={checks.durableObject.configured ? "구성됨" : "구성 필요"}
                ok={checks.durableObject.configured}
                latencyMs={null}
              />
              <SectionRow
                label="Ping"
                ok={checks.durableObject.ok}
                hint="스토리지 기록 없이 ping"
                latencyMs={checks.durableObject.latencyMs}
              />
            </div>
          </CardTile>

          <CardTile>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">WebLLM / NetSaver 실효값</span>
              <StatusBadge ok={successPayload?.effective.webllm || successPayload?.effective.netsaver || false} />
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-700">
              <p>webllm feature: {String(successPayload?.effective.webllmFeatureEnabled ?? false)}</p>
              <p>webllm download: {String(successPayload?.effective.webllmDownloadAllowed ?? false)}</p>
              <p>webllm: {String(successPayload?.effective.webllm ?? false)}</p>
              <p>netsaver: {String(successPayload?.effective.netsaver ?? false)}</p>
              <p>netsaver mode: {successPayload?.effective.netsaverMode ?? "unknown"}</p>
              <p>netsaver tier: {successPayload?.effective.netsaverTier ?? "unknown"}</p>
            </div>
          </CardTile>

          <CardTile>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">환경 바인딩</span>
              <StatusBadge ok={Object.values(checks.env).every(Boolean)} />
            </div>
            <EnvGrid env={checks.env} />
          </CardTile>
        </div>
      ) : state.status === "loading" ? (
        <CardTile>
          <p className="text-sm text-gray-700">체크 목록을 준비하고 있습니다…</p>
        </CardTile>
      ) : null}
    </div>
  );
}
