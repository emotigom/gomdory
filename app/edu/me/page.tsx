"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { apiV1Path } from "@/lib/standards/pathTypes";
import { getEduProfile } from "@/lib/edu/storage";

type MeProject = {
  title: string;
  slug: string;
  lessonId?: number | null;
  thumbUrl: string;
  createdAt: string;
  expiresAt: string | null;
  boardId: string | null;
};

type ProjectsResponse =
  | { ok: true; projects: MeProject[] }
  | { ok: false; error?: { message?: string } };

const LESSON_LABELS: Record<number, string> = {
  1: "1교시",
  2: "2교시",
  3: "3교시",
  4: "4교시",
};

function parseLessonId(title: string | null | undefined): number | null {
  if (!title) return null;
  const match = title.match(/^(\d)교시/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function EduMePage() {
  const [projects, setProjects] = useState<MeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"recent" | "lesson">("recent");
  const [selectedLesson, setSelectedLesson] = useState<"all" | number>("all");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const profile = useMemo(() => getEduProfile(), []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(apiV1Path("edu/me/projects"));
        const payload = (await response.json().catch(() => null)) as ProjectsResponse | null;
        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && "error" in payload ? payload.error?.message ?? "불러오기 실패" : "불러오기 실패");
        }
        if (!active) return;
        const normalized = payload.projects.map((project) => ({
          ...project,
          lessonId: project.lessonId ?? parseLessonId(project.title),
        }));
        setProjects(normalized);
      } catch (fetchError) {
        if (!active) return;
        const message = fetchError instanceof Error ? fetchError.message : "작품을 불러오지 못했습니다.";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void fetchProjects();
    return () => {
      active = false;
    };
  }, []);

  const publicOrigin = process.env.NEXT_PUBLIC_EDUVIEW_ORIGIN ?? "https://eduview.gkrry.com";

  const lessonOptions = useMemo(() => {
    const lessonSet = new Set<number>();
    projects.forEach((project) => {
      if (project.lessonId) lessonSet.add(project.lessonId);
    });
    return Array.from(lessonSet).sort((a, b) => a - b);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (filterMode === "lesson" && selectedLesson !== "all") {
      return projects.filter((project) => project.lessonId === selectedLesson);
    }
    return projects;
  }, [filterMode, projects, selectedLesson]);

  const groupedProjects = useMemo(() => {
    if (filterMode !== "lesson") {
      return { all: filteredProjects };
    }
    const groups: Record<string, MeProject[]> = {};
    filteredProjects.forEach((project) => {
      const key = project.lessonId ? LESSON_LABELS[project.lessonId] ?? "기타" : "기타";
      groups[key] = [...(groups[key] ?? []), project];
    });
    return groups;
  }, [filterMode, filteredProjects]);

  const handleCopy = async (url: string, slug: string) => {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    window.setTimeout(() => setCopiedSlug((prev) => (prev === slug ? null : prev)), 1500);
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl bg-white/90 p-8 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-sky-600">내 작품 모음</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">나의 포트폴리오</h1>
        <p className="mt-2 text-base text-slate-600">
          게시한 작품을 모아서 보고, 다시 편집하거나 친구에게 공유할 수 있어요.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          {profile.name ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
              {profile.name} ({profile.code})
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
              저장된 프로필이 없어도 쿠키로 작품을 불러올 수 있어요.
            </span>
          )}
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterMode("recent")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filterMode === "recent"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            최근순
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("lesson")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filterMode === "lesson"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            교시별
          </button>
        </div>
        {filterMode === "lesson" ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">필터</span>
            <select
              value={selectedLesson}
              onChange={(event) =>
                setSelectedLesson(event.target.value === "all" ? "all" : Number(event.target.value))
              }
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="all">전체</option>
              {lessonOptions.map((lessonId) => (
                <option key={lessonId} value={lessonId}>
                  {LESSON_LABELS[lessonId] ?? `교시 ${lessonId}`}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      {loading ? <p className="text-sm text-slate-500">작품을 불러오는 중...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && !error && projects.length === 0 ? (
        <div className="rounded-3xl bg-white/90 p-8 text-center shadow-lg ring-1 ring-slate-200">
          <p className="text-base font-semibold text-slate-600">아직 게시한 작품이 없습니다.</p>
          <Link
            href="/edu/lesson"
            className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            교시로 이동하기
          </Link>
        </div>
      ) : null}

      <div className="space-y-6">
        {Object.entries(groupedProjects).map(([group, items]) => (
          <div key={group} className="space-y-4">
            {filterMode === "lesson" ? (
              <h2 className="text-sm font-semibold text-slate-500">{group}</h2>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((project) => {
                const viewUrl = `/edu/view/${project.slug}`;
                const viewFullUrl = origin ? `${origin}${viewUrl}` : viewUrl;
                const originUrl = `${publicOrigin}/v1/${project.slug}/`;
                const lessonLabel = project.lessonId ? LESSON_LABELS[project.lessonId] ?? `교시 ${project.lessonId}` : null;
                return (
                  <article
                    key={project.slug}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <Image
                        src={project.thumbUrl}
                        alt={`${project.title} 썸네일`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {lessonLabel ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              {lessonLabel}
                            </span>
                          ) : null}
                          <span className="text-xs text-slate-400">{formatDate(project.createdAt)}</span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900">{project.title}</h3>
                        <p className="text-xs text-slate-400">slug · {project.slug}</p>
                      </div>
                      <div className="mt-auto grid gap-2 text-xs font-semibold">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={viewUrl}
                            className="rounded-full bg-slate-900 px-3 py-2 text-white"
                          >
                            열기
                          </Link>
                          <a
                            href={viewFullUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 px-3 py-2 text-slate-600"
                          >
                            새 탭
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleCopy(viewFullUrl, project.slug)}
                            className="rounded-full border border-slate-200 px-3 py-2 text-slate-600"
                          >
                            {copiedSlug === project.slug ? "복사됨" : "복사"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={originUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 px-3 py-2 text-slate-600"
                          >
                            원본 열기
                          </a>
                          {project.lessonId ? (
                            <Link
                              href={`/edu/lesson/${project.lessonId}?load=${project.slug}`}
                              className="rounded-full border border-slate-900 bg-slate-900 px-3 py-2 text-white"
                            >
                              다시 편집하기
                            </Link>
                          ) : (
                            <span className="rounded-full border border-slate-200 px-3 py-2 text-slate-300">
                              다시 편집 불가
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
