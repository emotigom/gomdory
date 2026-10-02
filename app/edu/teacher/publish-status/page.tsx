"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { apiV1Path } from "@/lib/standards/pathTypes";

type PublishStatusProject = {
  authorName: string | null;
  anonId: string | null;
  title: string | null;
  slug: string;
  publishState: string;
  publishStateReason: string | null;
  lastValidatedAt: string | null;
  lastPublishedAt: string | null;
  publicUrl: string | null;
  classroomUrl: string | null;
  lastRequestId: string | null;
};

type PublishStatusResponse =
  | { ok: true; projects: PublishStatusProject[] }
  | { ok: false; error?: { message?: string } };

type RetryResponse =
  | { ok: true; project: PublishStatusProject }
  | { ok: false; error?: { message?: string } };

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function formatStudentLabel(project: PublishStatusProject) {
  if (project.authorName) return project.authorName;
  if (project.anonId) return `익명 ${project.anonId.slice(0, 6)}`;
  return "-";
}

export default function EduTeacherPublishStatusPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<PublishStatusProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingSlug, setRetryingSlug] = useState<string | null>(null);

  const shareCode = searchParams.get("shareCode")?.trim() ?? "";

  const requestUrl = useMemo(() => {
    if (!shareCode) return "";
    const params = new URLSearchParams({ shareCode });
    return apiV1Path(`edu/teacher/publish-status?${params.toString()}`);
  }, [shareCode]);

  const refresh = async () => {
    if (!requestUrl) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(requestUrl);
      const payload = (await response.json().catch(() => null)) as PublishStatusResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && "error" in payload ? payload.error?.message ?? "불러오기 실패" : "불러오기 실패");
      }
      setProjects(payload.projects ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "상태를 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestUrl]);

  const handleRetry = async (slug: string) => {
    if (!slug) return;
    setRetryingSlug(slug);
    setError(null);
    try {
      const response = await fetch(apiV1Path("edu/publish/retry"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = (await response.json().catch(() => null)) as RetryResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && "error" in payload ? payload.error?.message ?? "재시도 실패" : "재시도 실패");
      }
      setProjects((prev) => prev.map((item) => (item.slug === slug ? payload.project : item)));
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : "재시도를 완료하지 못했습니다.";
      setError(message);
    } finally {
      setRetryingSlug(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-sky-600">교사 진단</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">게시 상태 점검</h1>
        <p className="mt-2 text-sm text-slate-600">
          수업 코드를 기준으로 학생들의 최신 게시 상태를 확인하고 실패한 작업을 재시도할 수 있어요.
        </p>
      </header>

      {!shareCode ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          shareCode가 없습니다. roster 또는 링크에서 다시 열어주세요.
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">게시 상태를 불러오는 중...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && !error && projects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          아직 게시 기록이 없습니다.
        </div>
      ) : null}

      {!loading && projects.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">학생</th>
                  <th className="px-4 py-3">작품</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">사유 / 요청 ID</th>
                  <th className="px-4 py-3">검증 / 게시</th>
                  <th className="px-4 py-3">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {projects.map((project) => {
                  const retrying = retryingSlug === project.slug;
                  const canRetry = project.publishState === "FAILED";
                  return (
                    <tr key={project.slug} className="text-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900">{formatStudentLabel(project)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900">{project.title ?? project.slug}</div>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            {project.publicUrl ? (
                              <Link href={project.publicUrl} target="_blank" className="underline">
                                공개 보기
                              </Link>
                            ) : null}
                            {project.classroomUrl ? (
                              <Link href={project.classroomUrl} target="_blank" className="underline">
                                교실 보기
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{project.publishState}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{project.publishStateReason ?? "-"}</div>
                        <div className="font-mono">{project.lastRequestId ?? "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>검증: {formatDate(project.lastValidatedAt)}</div>
                        <div>게시: {formatDate(project.lastPublishedAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRetry(project.slug)}
                          disabled={!canRetry || retrying}
                          className={`rounded-full px-3 py-2 text-xs font-semibold ${
                            canRetry
                              ? "bg-slate-900 text-white hover:bg-slate-800"
                              : "cursor-not-allowed bg-slate-200 text-slate-500"
                          }`}
                        >
                          {retrying ? "재시도 중..." : "재시도"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
