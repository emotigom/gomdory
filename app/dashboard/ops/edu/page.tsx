export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";

import OpsAccessDenied from "../OpsAccessDenied";
import OpsWebllmMitigationPanel from "./OpsWebllmMitigationPanel";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import {
  getEduWebLLMEnableFlag,
  getEduWebLLMHardDisableFlag,
  getEduWebLLMPrefetchFlag,
  getWebLLMLabsFlag,
} from "@/lib/edu/llm/webllmFeatureFlags";
import { routes } from "@/lib/standards/routes";
import { readEnvString } from "@/lib/server/runtimeEnv";

type StageCounts = {
  edu_join: number;
  edu_progress: number;
  edu_ai_remote: number;
  edu_ai_blocked: number;
  edu_publish_prepare: number;
  edu_publish_commit: number;
  edu_publish_blocked: number;
  edu_cleanup: number;
  edu_rate_limited: number;
};

type EduSummaryResponse = {
  ok: boolean;
  windowHours: number;
  generatedAt: string;
  stageCounts: StageCounts;
  publishResults: {
    success: number;
    failed: number;
    blocked: number;
  };
  topShareCodes: Array<{ masked: string; hash: string; count: number }>;
  recentErrors: Array<{
    id: string;
    ts: string;
    level: string;
    stage: string | null;
    route: string | null;
    status: number | null;
    requestId: string | null;
    shareCode: string | null;
    lessonId: number | null;
    slug: string | null;
    action: string | null;
    reason: string | null;
    result: string | null;
  }>;
};

type SummaryState =
  | { ok: true; data: EduSummaryResponse }
  | { ok: false; status: number; message: string };

async function fetchEduSummary(): Promise<SummaryState> {
  const cookieStore = cookies();
  const response = await fetch(routes.api.ops.eduSummary(), {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: `요약 데이터를 불러오지 못했어요. (${response.status})`,
    };
  }

  const data = (await response.json().catch(() => null)) as EduSummaryResponse | null;
  if (!data?.ok) {
    return { ok: false, status: response.status, message: "요약 응답이 비정상입니다." };
  }

  return { ok: true, data };
}

const formatCount = (value: number) => new Intl.NumberFormat("en-US").format(value);

const WEBLLM_ENV_KEYS = [
  "EDU_WEBLLM_HARD_DISABLE",
  "NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE",
  "NEXT_PUBLIC_EDU_WEBLLM_ENABLE",
  "NEXT_PUBLIC_EDU_WEBLLM_LABS",
  "NEXT_PUBLIC_EDU_WEBLLM_PREFETCH",
  "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
  "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID",
  "NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE",
  "NEXT_PUBLIC_EDU_WEBLLM_MODEL_SUBDIR",
  "NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE",
  "NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_PRIMARY",
  "NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_FALLBACK",
  "NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID",
  "NEXT_PUBLIC_EDU_WEBLLM_COACH_WASM_FILENAME",
] as const;

const buildWebllmEnvRows = () =>
  WEBLLM_ENV_KEYS.map((key) => ({
    key,
    present: Boolean(readEnvString(key)),
  }));

export default async function OpsEduDashboardPage() {
  const { user } = await requireUser("/dashboard/ops/edu");
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath="/dashboard/ops/edu" />;
  }

  const summaryState = await fetchEduSummary();
  const envRows = buildWebllmEnvRows();
  const effective = {
    hardDisable: getEduWebLLMHardDisableFlag(),
    enabled: getEduWebLLMEnableFlag(),
    labs: getWebLLMLabsFlag(),
    prefetch: getEduWebLLMPrefetchFlag(),
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8" data-page-marker="ops-edu">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">운영 · EDU</p>
          <h1 className="text-2xl font-semibold">EDU 운영 요약</h1>
          <p className="text-sm text-slate-500">최근 24시간 교육 트래픽 요약과 오류 샘플을 확인합니다.</p>
        </div>
        <Link
          href={routes.page.dashboard.ops()}
          className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          Ops 대시보드
        </Link>
      </header>

      {summaryState.ok ? (
        <section className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>집계 기준: 최근 {summaryState.data.windowHours}시간</p>
            <p className="text-xs text-slate-400">생성 시각 {new Date(summaryState.data.generatedAt).toLocaleString()}</p>
          </div>
        </section>
      ) : (
        <section className="dashboard-ops-card rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {summaryState.message}
        </section>
      )}

      <OpsWebllmMitigationPanel
        envRows={envRows}
        effective={effective}
        runtimeCanMutate={false}
      />

      {summaryState.ok ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">게시 성공/실패</p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{formatCount(summaryState.data.publishResults.success)}</p>
                <p className="text-xs text-slate-500">성공</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-rose-600">
                  {formatCount(summaryState.data.publishResults.failed + summaryState.data.publishResults.blocked)}
                </p>
                <p className="text-xs text-slate-500">실패/차단</p>
              </div>
            </div>
          </div>

          <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">원격 AI 호출 수</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCount(summaryState.data.stageCounts.edu_ai_remote)}
            </p>
            <p className="text-xs text-slate-500">success/failed 합산</p>
          </div>

          <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">차단된 프롬프트</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCount(summaryState.data.stageCounts.edu_ai_blocked)}
            </p>
          </div>

          <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">레이트리밋</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {formatCount(summaryState.data.stageCounts.edu_rate_limited)}
            </p>
            <p className="text-xs text-slate-500">join/progress/AI/publish 합산</p>
          </div>
        </section>
      ) : null}

      {summaryState.ok ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">최근 오류 샘플</h2>
            <p className="text-sm text-slate-500">최근 24시간 내 warn/error 최대 20건</p>
            <div className="mt-3 space-y-2">
              {summaryState.data.recentErrors.length === 0 ? (
                <p className="text-sm text-slate-500">오류 샘플이 없습니다.</p>
              ) : (
                summaryState.data.recentErrors.map((row) => (
                  <div key={row.id} className="dashboard-ops-row rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">{new Date(row.ts).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{row.level.toUpperCase()}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{row.stage ?? "—"}</span>
                      {row.action ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{row.action}</span>
                      ) : null}
                      {row.result ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{row.result}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 break-words text-xs text-slate-700">
                      {row.route ?? "unknown route"} · {row.status ?? "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {row.shareCode ? <span className="break-all">share: {row.shareCode}</span> : null}
                      {row.slug ? <span className="break-all">slug: {row.slug}</span> : null}
                      {row.lessonId ? <span>lesson: {row.lessonId}</span> : null}
                      {row.reason ? <span className="break-words">reason: {row.reason}</span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Top shareCodes</h2>
              <p className="text-sm text-slate-500">마스킹 + 해시로 표시</p>
              <div className="mt-3 space-y-2">
                {summaryState.data.topShareCodes.length === 0 ? (
                  <p className="text-sm text-slate-500">데이터가 없습니다.</p>
                ) : (
                  summaryState.data.topShareCodes.map((row) => (
                    <div key={`${row.hash}-${row.count}`} className="dashboard-ops-row flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1 text-sm">
                      <div className="min-w-0">
                        <p className="font-mono text-slate-800">{row.masked}</p>
                        <p className="truncate text-xs text-slate-500">hash: {row.hash}</p>
                      </div>
                      <p className="font-semibold text-slate-900">{formatCount(row.count)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-ops-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">단계별 발생 수</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {Object.entries(summaryState.data.stageCounts).map(([stage, count]) => (
                  <div key={stage} className="dashboard-ops-row flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1">
                    <span className="min-w-0 truncate font-mono text-xs text-slate-600">{stage}</span>
                    <span className="font-semibold text-slate-900">{formatCount(count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
