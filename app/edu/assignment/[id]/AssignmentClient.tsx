"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { getLessonPreset } from "@/lib/edu/lessons";
import { getEduProfile } from "@/lib/edu/storage";
import { apiV1Path } from "@/lib/standards/pathTypes";

type AssignmentInfo = {
  id: string;
  title: string;
  lessonId: number;
  templateKey: string;
  allowNetwork: boolean;
  dueAt: string | null;
  isClosed: boolean;
  shareCode: string;
  startUrl: string;
};

type AssignmentClientProps = {
  assignmentId: string;
};

export default function AssignmentClient({ assignmentId }: AssignmentClientProps) {
  const searchParams = useSearchParams();
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const shareCode = useMemo(() => {
    const codeParam = searchParams.get("code")?.trim() ?? "";
    if (codeParam) {
      return codeParam;
    }
    return getEduProfile().code;
  }, [searchParams]);

  useEffect(() => {
    if (!assignmentId) {
      setAssignment(null);
      setStatus("error");
      setError("과제 정보를 찾을 수 없습니다.");
      return;
    }

    if (!shareCode) {
      setAssignment(null);
      setStatus("error");
      setError("공유코드를 확인해 주세요.");
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadAssignment = async () => {
      setStatus("loading");
      setError(null);

      const response = await fetch(
        apiV1Path(`edu/assignment/get?id=${encodeURIComponent(assignmentId)}&code=${encodeURIComponent(shareCode)}`),
        { signal: controller.signal },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; assignment: AssignmentInfo }
        | { ok: false; message?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && "message" in payload ? payload.message ?? "과제를 불러오지 못했습니다." : "과제를 불러오지 못했습니다.");
      }

      if (!active) return;
      setAssignment(payload.assignment);
      setStatus("ready");
    };

    loadAssignment().catch((loadError) => {
      if (!active) return;
      const message = loadError instanceof Error ? loadError.message : "과제를 불러오지 못했습니다.";
      setAssignment(null);
      setStatus("error");
      setError(message);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [assignmentId, shareCode]);

  const lesson = assignment ? getLessonPreset(assignment.lessonId) : null;
  const startHref = assignment
    ? `/edu/lesson/${assignment.lessonId}?assignment=${assignment.id}&code=${encodeURIComponent(shareCode)}`
    : "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl bg-white/90 p-8 shadow-xl ring-1 ring-slate-200">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">EDU 과제</p>
        <h1 className="text-3xl font-bold text-slate-900">{assignment?.title ?? "과제 정보"}</h1>
        <p className="text-sm text-slate-600">
          {lesson?.description ?? "선생님이 공유한 과제 정보를 확인하고 시작해 주세요."}
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-500">교시</p>
          <p className="mt-1 text-base font-semibold text-slate-800">
            {lesson?.title ?? "교시 정보를 불러오는 중"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">마감</p>
          <p className="mt-1 text-base font-semibold text-slate-800">
            {assignment?.dueAt
              ? new Date(assignment.dueAt).toLocaleString("ko-KR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "마감 없음"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">템플릿</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {assignment?.templateKey ?? "템플릿 확인 중"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">네트워크</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              assignment?.allowNetwork ? "text-emerald-600" : "text-rose-500"
            }`}
          >
            {assignment?.allowNetwork ? "허용됨" : "차단됨"}
          </p>
        </div>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-slate-500">과제 정보를 불러오는 중...</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      {assignment?.isClosed ? (
        <p className="text-sm font-semibold text-rose-600">이 과제는 마감되었습니다.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={startHref}
          aria-disabled={!assignment || assignment.isClosed}
          className={`rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg transition ${
            assignment && !assignment.isClosed
              ? "bg-slate-900 text-white hover:-translate-y-0.5"
              : "pointer-events-none bg-slate-200 text-slate-400"
          }`}
        >
          시작하기
        </Link>
        <Link
          href="/edu/lesson"
          className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
        >
          교시 목록으로
        </Link>
      </div>
    </div>
  );
}
