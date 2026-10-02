"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";
import { formatBytes } from "@/lib/format/bytes";
import { useStorageUsage } from "../useStorageUsage";
import CouponRedeemPanel from "./CouponRedeemPanel";

const GB = 1024 ** 3;

function parseLimitGb(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function StorageUsagePageClient() {
  const { data, loading, error, refresh } = useStorageUsage();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const usage = data?.usage;
  const latest = usage?.latest;
  const trend = usage?.trend ?? [];
  const summary = data?.summary;
  const savings = data?.savings;

  const usedBytes = (latest?.r2Bytes ?? 0) + (latest?.dbBytes ?? 0);
  const fileCount = latest?.filesCount ?? 0;
  const recentChangeBytes =
    trend.length > 1
      ? Math.max(0, (trend[trend.length - 1]?.r2Bytes ?? 0) - (trend[0]?.r2Bytes ?? 0))
      : 0;
  const boardTop = summary?.byBoard ?? [];

  const softLimitGb = parseLimitGb(process.env.NEXT_PUBLIC_STORAGE_SOFT_LIMIT_GB);
  const hardLimitGb = parseLimitGb(process.env.NEXT_PUBLIC_STORAGE_HARD_LIMIT_GB);
  const softLimitBytes = softLimitGb ? softLimitGb * GB : null;
  const hardLimitBytes = hardLimitGb ? hardLimitGb * GB : null;

  const statusBadge = useMemo(() => {
    if (hardLimitBytes && usedBytes >= hardLimitBytes) {
      return { label: "임계치 초과", tone: "danger" } as const;
    }
    if (softLimitBytes && usedBytes >= softLimitBytes) {
      return { label: "정리 필요", tone: "warn" } as const;
    }
    return { label: "정상", tone: "ok" } as const;
  }, [hardLimitBytes, softLimitBytes, usedBytes]);

  const statusToneClass =
    statusBadge.tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : statusBadge.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div data-dashboard-storage-scope className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Storage</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">저장소 현황</h1>
            <p className="text-sm text-slate-500">교실 자료 사용량과 절감 성과를 한눈에 확인하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className={cn(buttonTone("secondary", { size: "sm" }), "dashboard-storage-control min-h-[40px]")}
            >
              새로고침
            </button>
            <Link
              href="/dashboard?clean=1"
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "dashboard-storage-control min-h-[40px]")}
            >
              새 보드 만들기
            </Link>
            <Link
              href="/dashboard/pro"
              className={cn(buttonTone("secondary", { size: "sm" }), "dashboard-storage-control min-h-[40px]")}
            >
              Pro 안내
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            저장소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        ) : null}

        <CouponRedeemPanel />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="dashboard-storage-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">내 저장소</h2>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusToneClass)}>
                {statusBadge.label}
              </span>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">총 용량</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {loading ? "-" : formatBytes(usedBytes)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">파일 수</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {loading ? "-" : fileCount.toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">최근 7일 증가</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {loading ? "-" : `+${formatBytes(recentChangeBytes)}`}
                  </p>
                </div>
              </div>
              {hardLimitBytes || softLimitBytes ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {hardLimitBytes ? (
                    <p>하드 임계치 {formatBytes(hardLimitBytes)} 기준으로 관리 중입니다.</p>
                  ) : null}
                  {softLimitBytes ? (
                    <p>소프트 임계치 {formatBytes(softLimitBytes)} 이상이면 정리를 추천합니다.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="dashboard-storage-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">절감 성과</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                실측
              </span>
            </div>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">총 절감</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {loading ? "-" : formatBytes(savings?.totalSavedBytes ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">이번 달 절감</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {loading ? "-" : formatBytes(savings?.savedThisMonthBytes ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">현재 사용량</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {loading ? "-" : formatBytes(usedBytes)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p>파일 {loading ? "-" : fileCount.toLocaleString("ko-KR")}개 기준입니다.</p>
                    <p>최근 사용량 변화는 7일 추이를 참고합니다.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                용량 최적화 + 파일 매니저 + 중복 제거(예정)를 Pro에서 제공합니다.
              </div>
            </div>
          </div>

          <div className="dashboard-storage-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">정리 추천</h2>
              <Link
                href="/dashboard/files"
                className={cn(buttonTone("secondary", { size: "sm" }), "dashboard-storage-control min-h-[36px]")}
              >
                파일 관리
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">
                용량이 높아지는 보드를 먼저 정리하면 효과가 큽니다. 상위 보드에서 필요 없는 파일을 정리해 주세요.
              </p>
              <div className="space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={`skeleton-${index}`} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : boardTop.length > 0 ? (
                  boardTop.map((board) => (
                    <div
                      key={board.boardId}
                      className="dashboard-storage-row flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{board.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(board.bytes)} · 파일 {board.fileCount.toLocaleString("ko-KR")}개
                        </p>
                      </div>
                      {!board.boardId ? (
                        <span className="text-xs font-semibold text-slate-400">보드 없음</span>
                      ) : (
                        <Link
                          href={boardHubHref(board.boardId)}
                          className={cn(buttonTone("secondary", { size: "sm" }), "dashboard-storage-control min-h-[36px]")}
                        >
                          보드 열기
                        </Link>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="dashboard-storage-empty-state rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    아직 저장된 파일이 없습니다. 파일을 업로드하면 보드별 사용량이 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
