"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { LinkCopyButton } from "./LinkCopyButton";

type ParticipantProgress = {
  completedLessons?: number[];
  lastLesson?: number;
};

type RosterParticipant = {
  name: string | null;
  anonId: string;
  lastSeenAt: string;
  progress: ParticipantProgress;
  publishedSlugs: string[];
};

type RosterProject = {
  authorName: string;
  slug: string;
  url: string;
  createdAt: string;
  title: string | null;
};

type RosterResponse =
  | {
      ok: true;
      participants: RosterParticipant[];
      projects: RosterProject[];
    }
  | { ok: false; error?: { message?: string } };

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return "-";
  }

  const now = Date.now();
  const diffMs = target.getTime() - now;
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const formatter = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 48) {
    return formatter.format(diffHours, "hour");
  }
  return formatter.format(diffDays, "day");
}

function formatCompletedLessons(progress: ParticipantProgress) {
  const completed = progress.completedLessons ?? [];
  if (completed.length === 0) {
    return "-";
  }
  return completed.join(", ");
}

type EduRosterPanelProps = {
  boardId: string;
};

export default function EduRosterPanel({ boardId }: EduRosterPanelProps) {
  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [projects, setProjects] = useState<RosterProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rosterUrl = useMemo(() => apiV1Path(`edu/class/roster?boardId=${boardId}`), [boardId]);
  const csvUrl = useMemo(() => apiV1Path(`edu/class/roster.csv?boardId=${boardId}`), [boardId]);
  const linksCsvUrl = useMemo(() => apiV1Path(`edu/class/export/links.csv?boardId=${boardId}`), [boardId]);

  const fetchRoster = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(rosterUrl, { method: "GET" });
      const payload = (await response.json().catch(() => null)) as RosterResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        setError(payload && "error" in payload ? payload.error?.message ?? "진행 현황을 불러오지 못했습니다." : "진행 현황을 불러오지 못했습니다.");
        return;
      }

      setParticipants(payload.participants ?? []);
      setProjects(payload.projects ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "진행 현황을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId, rosterUrl]);

  useEffect(() => {
    void fetchRoster();
  }, [fetchRoster]);

  return (
    <div className="space-y-4 border border-slate-200 p-3 text-xs text-slate-600">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-800">EDU 진행 현황</p>
          <p className="text-[11px] text-slate-500">참여 학생과 게시 작품을 확인하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRoster}
            className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            새로고침
          </button>
          <a
            href={csvUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white"
          >
            참여자 CSV
          </a>
          <a
            href={linksCsvUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            프로젝트 링크 CSV
          </a>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-500">참가자 목록</p>
          <span className="text-[11px] text-slate-400">{participants.length}명</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">닉네임</th>
                <th className="px-3 py-2 font-semibold">최근 활동</th>
                <th className="px-3 py-2 font-semibold">완료 교시</th>
                <th className="px-3 py-2 font-semibold">학생 ID</th>
                <th className="px-3 py-2 font-semibold">포트폴리오</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                    아직 참여 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                participants.map((participant) => (
                  <tr key={`${participant.anonId}-${participant.lastSeenAt}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {participant.name ?? "이름 없음"}
                    </td>
                    <td
                      className="px-3 py-2 text-slate-500"
                      title={new Date(participant.lastSeenAt).toLocaleString("ko-KR")}
                    >
                      {formatRelativeTime(participant.lastSeenAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {formatCompletedLessons(participant.progress)}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400">{participant.anonId}</td>
                    <td className="px-3 py-2">
                      <a
                        href={`/edu/teacher/student?boardId=${boardId}&anon=${participant.anonId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-300"
                      >
                        열기
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-500">게시한 작품</p>
          <span className="text-[11px] text-slate-400">{projects.length}건</span>
        </div>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          {projects.length === 0 ? (
            <p className="text-[11px] text-slate-400">아직 게시된 작품이 없습니다.</p>
          ) : (
            projects.map((project) => (
              <div key={project.slug} className="space-y-2 rounded-md border border-slate-100 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{project.authorName}</p>
                    <p className="text-[11px] text-slate-400">{project.title ?? "제목 없음"}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(project.createdAt).toLocaleString("ko-KR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-600">{project.slug}</span>
                  <a href={project.url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                    {project.url}
                  </a>
                  <LinkCopyButton value={project.url} label="복사" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {loading ? <p className="text-[11px] text-slate-400">데이터를 불러오는 중...</p> : null}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
