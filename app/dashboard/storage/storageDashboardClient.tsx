"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { describePotentialSavings, type StorageSummary } from "@/lib/data/storageSummary";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";

type StorageDashboardClientProps = {
  initialSummary: StorageSummary;
  isProUser: boolean;
  proEnabled: boolean;
  userName: string;
};

type CleanupRow = {
  name: string;
  bytes: number;
  boardId?: string | null;
  classId?: string | null;
  createdAt?: string | null;
  lastAccessedAt?: string | null;
};

const numberFormatter = new Intl.NumberFormat("ko-KR");

export function StorageDashboardClient({ initialSummary, isProUser, proEnabled, userName }: StorageDashboardClientProps) {
  const [summary, setSummary] = useState<StorageSummary | null>(initialSummary);
  const [loading, setLoading] = useState(!initialSummary);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(false);
    void refreshFromApi();
  }, []);

  async function refreshFromApi() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(apiV1Path("storage/summary"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("요약을 불러오지 못했습니다.");
      }
      const payload = (await response.json()) as { summary?: StorageSummary };
      if (payload.summary) {
        setSummary(payload.summary);
      }
    } catch (cause) {
      console.error(cause);
      setError("대시보드를 새로고침하는 중 문제가 발생했습니다.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  const savings = useMemo(() => (summary ? describePotentialSavings(summary) : { label: "예상 절감", percent: 0 }), [summary]);
  const cleanupHint = useMemo(() => buildCleanupHint(summary), [summary]);
  const actualSaved = summary?.actualSavings.totalBytesSaved ?? 0;
  const savedPercent = summary && summary.actualSavings.originalBytes > 0
    ? Math.min(99, Math.round((summary.actualSavings.totalBytesSaved / summary.actualSavings.originalBytes) * 100))
    : 0;
  const savedThisMonth = summary?.actualSavings.savedThisMonthBytes ?? 0;

  const locked = proEnabled && !isProUser;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Storage Dashboard v1</p>
          <h1 className="text-3xl font-extrabold text-slate-900">{userName}님의 저장소</h1>
          <p className="text-sm text-slate-600">내 자료가 얼마나 쌓였는지, 어디서 공간을 아낄 수 있는지 한눈에 확인하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshFromApi}
            data-interactive
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {refreshing ? "새로고침 중" : "새로고침"}
          </button>
          {proEnabled ? (
            <Link
              href="/dashboard/pro"
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              data-interactive
            >
              Pro 안내 보기
            </Link>
          ) : null}
        </div>
      </header>

      {error ? <Banner tone="warning" message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card tone="indigo" title="총 사용량" value={formatBytes(summary?.totalBytes ?? 0)} loading={loading} />
        <LockedBlock locked={locked} helper="이번 달 업로드는 Pro에서 자세히 제공됩니다.">
          <Card tone="slate" title="이번 달 업로드" value={formatBytes(summary?.uploadedThisMonthBytes ?? 0)} loading={loading} />
        </LockedBlock>
        <Card
          tone="emerald"
          title="실측 절감량"
          value={loading ? "-" : `${formatBytes(actualSaved)}${savedPercent > 0 ? ` (${savedPercent}%)` : ""}`}
          loading={loading}
          caption={`이번 달 ${formatBytes(savedThisMonth)} 절감 (최적화·중복 방지)`}
        />
        <LockedBlock locked={locked} helper="예상 절감치는 Pro에서 활성화됩니다.">
          <Card
            tone="slate"
            title={`${savings.label} (추정)`}
            value={summary ? `${savings.percent}%` : "-"}
            loading={loading}
            caption="이미지 다운스케일/중복 제거 예상치"
          />
        </LockedBlock>
      </section>

      <LockedBlock locked={locked} helper="보드/클래스별 분석은 Pro에서 제공됩니다." overlayTitle="보드/클래스별 분석">
        <section className="grid gap-4 lg:grid-cols-2">
          <UsageList
            title="보드별 사용량 상위 10"
            items={summary?.byBoard ?? []}
            loading={loading}
            emptyLabel="업로드된 파일이 없습니다."
            itemLabel={(item) => item.title || "보드"}
          />
          <UsageList
            title="클래스별 사용량"
            items={summary?.byClass ?? []}
            loading={loading}
            emptyLabel="클래스 연결된 파일이 없습니다."
            itemLabel={(item) => item.title || "클래스"}
          />
        </section>
      </LockedBlock>

      <LockedBlock locked={locked} helper="큰 파일 목록은 Pro에서 열립니다." overlayTitle="큰 파일/정리 추천">
        <section className="grid gap-4 lg:grid-cols-3">
          <TopFilesPanel files={summary?.topLargest ?? []} loading={loading} />
          <CleanupPanel
            stale={summary?.stale ?? []}
            largest={summary?.topLargest ?? []}
            loading={loading}
            onDownload={() => downloadCleanupCsv(summary)}
            recommendation={cleanupHint}
            defaultBoardId={summary?.byBoard?.[0]?.boardId ?? undefined}
          />
          <SavingsPanel summary={summary} loading={loading} />
        </section>
      </LockedBlock>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

function Card({
  title,
  value,
  loading,
  caption,
  tone = "slate",
}: {
  title: string;
  value: string;
  caption?: string;
  loading?: boolean;
  tone?: "slate" | "indigo" | "emerald";
}) {
  const toneClass =
    tone === "indigo"
      ? "from-indigo-500/10 to-indigo-600/5 border-indigo-100"
      : tone === "emerald"
        ? "from-emerald-500/10 to-emerald-600/5 border-emerald-100"
        : "from-slate-500/10 to-slate-600/5 border-slate-100";

  return (
    <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {loading ? <Skeleton className="h-8 w-32" /> : value}
          </p>
          {caption ? <p className="mt-2 text-xs text-slate-600">{caption}</p> : null}
        </div>
      </div>
    </div>
  );
}

function UsageList<T extends { bytes: number; fileCount: number } & Record<string, unknown>>({
  title,
  items,
  loading,
  emptyLabel,
  itemLabel,
}: {
  title: string;
  items: T[];
  loading?: boolean;
  emptyLabel: string;
  itemLabel: (item: T) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top 10</span>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        ) : (
          items.map((item, index) => (
            <div key={index} className="flex items-center justify-between rounded-2xl bg-slate-50/80 p-3">
              <div>
                <p className="font-semibold text-slate-900">{itemLabel(item)}</p>
                <p className="text-xs text-slate-600">파일 {numberFormatter.format(item.fileCount)}개</p>
              </div>
              <p className="text-sm font-bold text-slate-800">{formatBytes(item.bytes)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TopFilesPanel({ files, loading }: { files: StorageSummary["topLargest"]; loading?: boolean }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">큰 파일 Top 10</h3>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">정렬: 크기</span>
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : files.length === 0 ? (
          <p className="py-4 text-sm text-slate-600">아직 업로드된 파일이 없습니다.</p>
        ) : (
          files.map((file, index) => (
            <div key={index} className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-600">{formatDate(file.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">{formatBytes(file.bytes)}</p>
                {file.boardId ? (
                  <Link
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                    href={boardHubHref(file.boardId)}
                    data-interactive
                  >
                    보드로 이동
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CleanupPanel({
  stale,
  largest,
  loading,
  onDownload,
  recommendation,
  defaultBoardId,
}: {
  stale: StorageSummary["stale"];
  largest: StorageSummary["topLargest"];
  loading?: boolean;
  onDownload: () => void;
  recommendation: string;
  defaultBoardId?: string | null;
}) {
  const cleanupRows: CleanupRow[] = useMemo(
    () => [...stale, ...largest].map((row) => ({ ...row, boardId: (row as { boardId?: string | null }).boardId })),
    [largest, stale],
  );

  const ctaBoardId = defaultBoardId ?? cleanupRows.find((row) => row.boardId)?.boardId;

  return (
    <div className="flex h-full flex-col justify-between rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-amber-900">
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase">정리 추천</span>
          <p className="text-sm font-semibold text-amber-800">안전하게 미리보기 후 정리하세요</p>
        </div>
        <p className="text-lg font-bold text-amber-900">{recommendation}</p>
        {loading ? (
          <Skeleton className="h-4 w-full" />
        ) : cleanupRows.length === 0 ? (
          <p className="text-sm text-amber-800">정리 대상이 보이지 않습니다. 조금 더 사용 후 확인해 보세요.</p>
        ) : (
          <ul className="space-y-2 text-sm text-amber-900">
            {cleanupRows.slice(0, 4).map((row, idx) => (
              <li key={idx} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
                <span className="truncate pr-3 font-semibold">{row.name}</span>
                <span className="text-xs font-bold">{formatBytes(row.bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onDownload}
          data-interactive
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700"
        >
          정리 후보 목록 다운로드 (CSV)
        </button>
        {ctaBoardId ? (
          <Link
            href={boardHubHref(ctaBoardId)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            data-interactive
          >
            해당 보드의 파일 관리 열기
          </Link>
        ) : (
          <p className="text-center text-xs font-semibold text-amber-800">
            연결된 보드를 찾을 수 없습니다. 보드에서 파일을 열어 확인하세요.
          </p>
        )}
      </div>
    </div>
  );
}

function SavingsPanel({ summary, loading }: { summary: StorageSummary | null; loading?: boolean }) {
  const total = summary?.totalBytes ?? 0;
  const dedup = summary?.estSavings.ifDedup ?? 0;
  const downscale = summary?.estSavings.ifDownscaleImages ?? 0;
  const highlight = Math.max(dedup, downscale);
  const highlightLabel = highlight === dedup ? "중복 가능성" : "이미지 다운스케일";
  const measured = summary?.actualSavings;
  const measuredPercent = measured && measured.originalBytes > 0
    ? Math.min(99, Math.round((measured.totalBytesSaved / measured.originalBytes) * 100))
    : 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">예상 절감 요약</h3>
      <p className="mt-1 text-sm text-slate-600">실제 삭제 없이도 줄일 수 있는 여유 용량을 미리 보여줍니다.</p>
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">실측 절감</p>
          <p className="text-xl font-bold text-emerald-900">
            {loading ? <Skeleton className="h-6 w-24" /> : `${formatBytes(measured?.totalBytesSaved ?? 0)}${measuredPercent > 0 ? ` (${measuredPercent}%)` : ""}`}
          </p>
          <p className="text-xs text-emerald-700">업로드 최적화 + 중복 방지 누적 절감</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">중복 가능성</p>
          <p className="text-xl font-bold text-slate-900">{loading ? <Skeleton className="h-6 w-24" /> : formatBytes(dedup)}</p>
          <p className="text-xs text-slate-600">파일명·크기가 같은 항목 기준 추정치</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">이미지 다운스케일(예상)</p>
          <p className="text-xl font-bold text-slate-900">{loading ? <Skeleton className="h-6 w-24" /> : formatBytes(downscale)}</p>
          <p className="text-xs text-slate-600">TV/프로젝터 표시용 1920px 기준</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
        {loading ? (
          <Skeleton className="h-5 w-40" />
        ) : total > 0 ? (
          <p>
            {formatBytes(highlight)} 절감 예상 (<span className="font-semibold">{highlightLabel}</span>) — 실제 절감은 파일
            검토 후 적용됩니다.
          </p>
        ) : (
          <p>업로드된 파일이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function LockedBlock({ children, locked, helper, overlayTitle }: { children: ReactNode; locked: boolean; helper: string; overlayTitle?: string }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-50">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border border-amber-200 bg-white/85 p-4 text-center shadow-sm">
        {overlayTitle ? <p className="text-sm font-bold text-amber-800">{overlayTitle}</p> : null}
        <p className="text-sm text-amber-800">{helper}</p>
        <Link
          href="/dashboard/pro"
          className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600"
          data-interactive
        >
          업그레이드 알아보기
        </Link>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-slate-200 ${className ?? "h-4 w-full"}`} />;
}

function Banner({ tone, message }: { tone: "warning"; message: string }) {
  const bg = tone === "warning" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-50";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${bg}`}>{message}</div>
  );
}

function buildCleanupHint(summary: StorageSummary | null): string {
  if (!summary) return "정리 후보를 불러오는 중입니다.";
  const topBoard = summary.byBoard[0];
  const topFiles = summary.topLargest.slice(0, 3).reduce((sum, file) => sum + file.bytes, 0);
  if (topBoard && topFiles > 0) {
    return `${topBoard.title} 보드에서 큰 파일 3개만 줄이면 약 ${formatBytes(topFiles)} 절감`;
  }
  if (summary.estSavings.ifDownscaleImages > 0) {
    return `이미지 리사이즈 적용 시 최대 ${formatBytes(summary.estSavings.ifDownscaleImages)} 절감 예상`;
  }
  return "오래된 파일부터 정리하면 여유 공간을 확보할 수 있어요.";
}

function downloadCleanupCsv(summary: StorageSummary | null) {
  if (!summary || typeof window === "undefined") return;
  const rows: CleanupRow[] = [
    ...summary.stale.map((row) => ({ ...row, boardId: null, classId: null })),
    ...summary.topLargest.map((row) => ({ ...row })),
  ];
  if (rows.length === 0) return;

  const header = ["name", "bytes", "boardId", "classId", "createdAt", "lastAccessedAt"];
  const lines = [header.join(",")];
  for (const row of rows) {
    const values = [row.name, row.bytes, row.boardId ?? "", row.classId ?? "", row.createdAt ?? "", row.lastAccessedAt ?? ""];
    lines.push(values.map((value) => String(value).replace(/"/g, '""')).join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "storage-cleanup.csv";
  link.click();
  URL.revokeObjectURL(url);
}
