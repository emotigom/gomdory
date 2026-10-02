"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { apiV1Path } from "@/lib/standards/pathTypes";

type StudentProject = {
  title: string;
  slug: string;
  lessonId?: number | null;
  thumbUrl: string;
  createdAt: string;
  expiresAt: string | null;
  boardId: string | null;
};

type ProjectsResponse =
  | { ok: true; projects: StudentProject[] }
  | { ok: false; error?: { message?: string } };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function EduTeacherStudentPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const boardId = searchParams.get("boardId")?.trim() ?? "";
  const anon = searchParams.get("anon")?.trim() ?? "";

  const requestUrl = useMemo(() => {
    if (!boardId || !anon) return "";
    const params = new URLSearchParams({ boardId, anon });
    return apiV1Path(`edu/teacher/student/projects?${params.toString()}`);
  }, [anon, boardId]);

  useEffect(() => {
    if (!requestUrl) {
      setLoading(false);
      return;
    }

    let active = true;
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(requestUrl);
        const payload = (await response.json().catch(() => null)) as ProjectsResponse | null;
        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && "error" in payload ? payload.error?.message ?? "불러오기 실패" : "불러오기 실패");
        }
        if (!active) return;
        setProjects(payload.projects ?? []);
      } catch (fetchError) {
        if (!active) return;
        const message = fetchError instanceof Error ? fetchError.message : "작품을 불러오지 못했습니다.";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProjects();
    return () => {
      active = false;
    };
  }, [requestUrl]);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-sky-600">학생 포트폴리오</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">학생 작품 모아보기</h1>
        <p className="mt-2 text-sm text-slate-600">
          roster에서 전달받은 학생 작품을 빠르게 확인할 수 있어요.
        </p>
      </header>

      {!boardId || !anon ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          올바른 학생 정보가 없습니다. roster에서 다시 열어주세요.
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">작품을 불러오는 중...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && !error && projects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          아직 게시된 작품이 없습니다.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
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
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="text-base font-semibold text-slate-900">{project.title}</h3>
              <p className="text-xs text-slate-400">{formatDate(project.createdAt)}</p>
              <div className="mt-auto flex flex-wrap gap-2 text-xs font-semibold">
                <Link href={`/edu/view/${project.slug}`} className="rounded-full bg-slate-900 px-3 py-2 text-white">
                  열기
                </Link>
                <a
                  href={`/edu/view/${project.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 px-3 py-2 text-slate-600"
                >
                  새 탭
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
