"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { EDU_TEMPLATE_OPTIONS } from "@/lib/edu/lessons";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { LinkCopyButton } from "./LinkCopyButton";

type AssignmentItem = {
  id: string;
  title: string;
  lessonId: number;
  templateKey: string;
  allowNetwork: boolean;
  dueAt: string | null;
  createdAt: string;
  isClosed: boolean;
  startUrl: string;
};

type AssignmentListResponse =
  | { ok: true; assignments: AssignmentItem[] }
  | { ok: false; message?: string };

type CreateAssignmentResponse =
  | { ok: true; assignmentId: string; startUrl: string }
  | { ok: false; message?: string };

type SubmissionsResponse =
  | {
      ok: true;
      assignment: { id: string; title: string };
      submissions: Array<{ studentName: string | null; slug: string; url: string; createdAt: string }>;
    }
  | { ok: false; message?: string };

type FeedbackResponse =
  | {
      ok: true;
      feedback: { stamp: string | null; comment: string | null; updatedAt: string | null } | null;
    }
  | { ok: false; message?: string };

type WallsResponse =
  | { ok: true; walls: Array<{ id: string; title: string; position: number }> }
  | { ok: false; error?: string };

type EduAssignmentsPanelProps = {
  boardId: string;
};

type TemplateKey = (typeof EDU_TEMPLATE_OPTIONS)[number]["key"];

const LESSON_OPTIONS = [
  { value: 1, label: "1교시" },
  { value: 2, label: "2교시" },
  { value: 3, label: "3교시" },
  { value: 4, label: "4교시" },
];

const FEEDBACK_STAMPS = ["👍", "⭐", "🏅"] as const;

export default function EduAssignmentsPanel({ boardId }: EduAssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [lessonId, setLessonId] = useState(1);
  const [templateKey, setTemplateKey] = useState<TemplateKey>(EDU_TEMPLATE_OPTIONS[0]?.key ?? "intro_basic");
  const [allowNetwork, setAllowNetwork] = useState(false);
  const [dueAtLocal, setDueAtLocal] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<{
    assignmentId: string;
    startUrl: string;
    title: string;
  } | null>(null);
  const [cardStatus, setCardStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionsResponse | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<{ slug: string; studentName: string | null } | null>(null);
  const [feedbackStamp, setFeedbackStamp] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const submissionsCsvUrl = useMemo(
    () => apiV1Path(`edu/class/export/submissions.csv?boardId=${encodeURIComponent(boardId)}`),
    [boardId],
  );

  const templateOptions = useMemo(
    () => EDU_TEMPLATE_OPTIONS.filter((option) => option.lessonId === lessonId),
    [lessonId],
  );

  useEffect(() => {
    if (templateOptions.length > 0) {
      setTemplateKey(templateOptions[0].key);
    }
  }, [templateOptions]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`edu/assignment/list?boardId=${encodeURIComponent(boardId)}`));
      const data = (await response.json()) as AssignmentListResponse;
      if (!response.ok || !data.ok) {
        setError((data as { message?: string }).message ?? "과제 목록을 불러오지 못했습니다.");
        return;
      }
      setAssignments(data.assignments);
      if (data.assignments.length > 0) {
        setSelectedAssignmentId((prev) => prev || data.assignments[0]?.id || "");
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "과제 목록을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const closeFeedbackModal = useCallback(() => {
    setFeedbackModalOpen(false);
    setFeedbackTarget(null);
    setFeedbackStamp(null);
    setFeedbackComment("");
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setFeedbackLoading(false);
    setFeedbackSaving(false);
  }, []);

  const openFeedbackModal = useCallback(
    async (submission: { slug: string; studentName: string | null }) => {
      setFeedbackModalOpen(true);
      setFeedbackTarget(submission);
      setFeedbackStamp(null);
      setFeedbackComment("");
      setFeedbackError(null);
      setFeedbackSuccess(null);
      setFeedbackLoading(true);
      try {
        const response = await apiFetch(
          apiV1Path(`edu/projects/feedback?slug=${encodeURIComponent(submission.slug)}`),
        );
        const data = (await response.json()) as FeedbackResponse;
        if (!response.ok || !data.ok) {
          setFeedbackError((data as { message?: string }).message ?? "피드백을 불러오지 못했습니다.");
          return;
        }
        if (data.feedback) {
          setFeedbackStamp(data.feedback.stamp ?? null);
          setFeedbackComment(data.feedback.comment ?? "");
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "피드백을 불러오지 못했습니다.";
        setFeedbackError(message);
      } finally {
        setFeedbackLoading(false);
      }
    },
    [],
  );

  const handleSaveFeedback = useCallback(async () => {
    if (feedbackSaving || !feedbackTarget) return;
    setFeedbackSaving(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    const trimmedComment = feedbackComment.trim();
    try {
      const response = await apiFetch(apiV1Path("edu/projects/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          slug: feedbackTarget.slug,
          stamp: feedbackStamp ?? undefined,
          comment: trimmedComment || undefined,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setFeedbackError(data.message ?? "피드백 저장에 실패했습니다.");
        return;
      }
      setFeedbackSuccess("피드백이 저장되었습니다.");
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "피드백 저장에 실패했습니다.";
      setFeedbackError(message);
    } finally {
      setFeedbackSaving(false);
    }
  }, [boardId, feedbackComment, feedbackSaving, feedbackStamp, feedbackTarget]);

  const handleCreateAssignment = async () => {
    if (createLoading) return;
    setCreateLoading(true);
    setCreateError(null);
    setCardStatus(null);
    setCreateResult(null);

    try {
      const dueAt = dueAtLocal ? new Date(dueAtLocal).toISOString() : null;
      const response = await apiFetch(apiV1Path("edu/assignment/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          title,
          lessonId,
          templateKey,
          allowNetwork,
          dueAt,
        }),
      });
      const data = (await response.json()) as CreateAssignmentResponse;
      if (!response.ok || !data.ok) {
        setCreateError((data as { message?: string }).message ?? "과제 생성에 실패했습니다.");
        return;
      }
      setCreateResult({ assignmentId: data.assignmentId, startUrl: data.startUrl, title });
      setTitle("");
      setDueAtLocal("");
      setAllowNetwork(false);
      await loadAssignments();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "과제 생성에 실패했습니다.";
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const resolveTargetWall = async () => {
    const response = await apiFetch(apiV1Path(`dashboard/boards/${boardId}/walls`));
    const data = (await response.json()) as WallsResponse;
    if (!response.ok || !data.ok) {
      throw new Error(
        data && "error" in data
          ? data.error ?? "담벼락을 불러오지 못했습니다."
          : "담벼락을 불러오지 못했습니다.",
      );
    }

    const submitWall =
      data.walls.find((wall) => wall.title.includes("제출")) ??
      data.walls.find((wall) => wall.title.toLowerCase().includes("submit"));
    return submitWall ?? data.walls[0];
  };

  const handleCreateCard = async (assignment: AssignmentItem | null) => {
    if (!assignment) return;
    setCardStatus(null);
    try {
      const targetWall = await resolveTargetWall();
      if (!targetWall) {
        setCardStatus({ type: "error", message: "담벼락이 없습니다." });
        return;
      }
      const text = `${assignment.title} 과제 링크: ${assignment.startUrl}`;
      const response = await apiFetch(apiV1Path(`dashboard/walls/${targetWall.id}/cards`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, text }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setCardStatus({ type: "error", message: payload?.error ?? "카드 생성에 실패했습니다." });
        return;
      }
      setCardStatus({ type: "success", message: "보드에 과제 링크 카드를 생성했어요." });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "카드 생성에 실패했습니다.";
      setCardStatus({ type: "error", message });
    }
  };

  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId) ?? null;

  useEffect(() => {
    if (!selectedAssignmentId) {
      setSubmissions(null);
      return;
    }

    let active = true;
    const loadSubmissions = async () => {
      setSubmissionsLoading(true);
      setSubmissionsError(null);
      try {
        const response = await apiFetch(
          apiV1Path(`edu/assignment/submissions?assignmentId=${encodeURIComponent(selectedAssignmentId)}`),
        );
        const data = (await response.json()) as SubmissionsResponse;
        if (!response.ok || !data.ok) {
          setSubmissionsError((data as { message?: string }).message ?? "제출 목록을 불러오지 못했습니다.");
          return;
        }
        if (active) {
          setSubmissions(data);
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "제출 목록을 불러오지 못했습니다.";
        setSubmissionsError(message);
      } finally {
        setSubmissionsLoading(false);
      }
    };

    void loadSubmissions();

    return () => {
      active = false;
    };
  }, [selectedAssignmentId]);

  return (
    <div className="space-y-3 border border-slate-200 p-3 text-xs text-slate-600">
      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">새 과제 만들기</p>
          <p className="text-[11px] text-slate-500">과제를 만들면 학생 시작 링크가 생성됩니다.</p>
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-slate-700" htmlFor="assignment-title">
            과제 제목
          </label>
          <input
            id="assignment-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
            placeholder="예: 2교시 팬페이지 과제"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-[11px] font-semibold text-slate-700">교시</span>
            <select
              value={lessonId}
              onChange={(event) => setLessonId(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
            >
              {LESSON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-semibold text-slate-700">템플릿</span>
            <select
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value as TemplateKey)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
            >
              {templateOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-slate-700" htmlFor="assignment-due">
            마감 일시 (선택)
          </label>
          <input
            id="assignment-due"
            type="datetime-local"
            value={dueAtLocal}
            onChange={(event) => setDueAtLocal(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={allowNetwork}
            onChange={(event) => setAllowNetwork(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          네트워크 사용 허용
        </label>
        <button
          type="button"
          onClick={handleCreateAssignment}
          disabled={createLoading || !title.trim()}
          className="w-full rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
        >
          {createLoading ? "생성 중..." : "과제 생성하기"}
        </button>
        {createError ? <p className="text-[11px] text-rose-600">{createError}</p> : null}
      </div>

      {createResult ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-700">학생 시작 링크</span>
            <div className="flex items-center gap-2">
              <span className="max-w-[160px] truncate font-mono text-[11px] text-slate-600">
                {createResult.startUrl}
              </span>
              <LinkCopyButton value={createResult.startUrl} label="복사" />
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              handleCreateCard({
                id: createResult.assignmentId,
                title: createResult.title,
                lessonId,
                templateKey,
                allowNetwork,
                dueAt: dueAtLocal || null,
                createdAt: new Date().toISOString(),
                isClosed: false,
                startUrl: createResult.startUrl,
              })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            보드에 과제 링크 카드 생성
          </button>
        </div>
      ) : null}

      {cardStatus ? (
        <p
          className={`text-[11px] ${cardStatus.type === "success" ? "text-emerald-600" : "text-rose-600"}`}
        >
          {cardStatus.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">과제 목록</p>
          <button
            type="button"
            onClick={loadAssignments}
            className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
        {loading ? <p className="text-[11px] text-slate-400">불러오는 중...</p> : null}
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
        {assignments.length === 0 && !loading ? (
          <p className="text-[11px] text-slate-400">아직 생성된 과제가 없습니다.</p>
        ) : null}
        {assignments.length > 0 ? (
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-700" htmlFor="assignment-select">
              과제 선택
            </label>
            <select
              id="assignment-select"
              value={selectedAssignmentId}
              onChange={(event) => setSelectedAssignmentId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
            >
              {assignments.map((assignmentItem) => (
                <option key={assignmentItem.id} value={assignmentItem.id}>
                  {assignmentItem.title}
                </option>
              ))}
            </select>
            {selectedAssignment ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>템플릿: {selectedAssignment.templateKey}</span>
                <button
                  type="button"
                  onClick={() => handleCreateCard(selectedAssignment)}
                  className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  링크 카드 생성
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">제출 목록</p>
          <a
            href={submissionsCsvUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            제출 CSV
          </a>
        </div>
        {submissionsLoading ? <p className="text-[11px] text-slate-400">제출 목록 로딩 중...</p> : null}
        {submissionsError ? <p className="text-[11px] text-rose-600">{submissionsError}</p> : null}
        {submissions && submissions.ok && submissions.submissions.length === 0 ? (
          <p className="text-[11px] text-slate-400">아직 제출된 과제가 없습니다.</p>
        ) : null}
        {submissions && submissions.ok && submissions.submissions.length > 0 ? (
          <div className="space-y-2">
            {submissions.submissions.map((submission) => (
              <div key={`${submission.slug}-${submission.createdAt}`} className="rounded border border-slate-200 bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700">
                      {submission.studentName ?? "익명"} · {submission.slug}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(submission.createdAt).toLocaleString("ko-KR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openFeedbackModal(submission)}
                      className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100"
                    >
                      피드백
                    </button>
                    <a
                      href={submission.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      열기
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {feedbackModalOpen && feedbackTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-indigo-500">피드백</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {feedbackTarget.studentName ?? "익명"} · {feedbackTarget.slug}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFeedbackModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-600">스탬프</p>
                <div className="mt-2 flex items-center gap-2">
                  {FEEDBACK_STAMPS.map((stamp) => (
                    <button
                      key={stamp}
                      type="button"
                      onClick={() => setFeedbackStamp(stamp)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
                        feedbackStamp === stamp
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      {stamp}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFeedbackStamp(null)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    스탬프 제거
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600" htmlFor="feedback-comment">
                  짧은 피드백
                </label>
                <textarea
                  id="feedback-comment"
                  value={feedbackComment}
                  onChange={(event) => setFeedbackComment(event.target.value)}
                  placeholder="학생에게 전할 짧은 피드백을 입력해주세요."
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-700"
                  rows={3}
                />
              </div>
              {feedbackLoading ? <p className="text-[11px] text-slate-400">피드백 불러오는 중...</p> : null}
              {feedbackError ? <p className="text-[11px] text-rose-600">{feedbackError}</p> : null}
              {feedbackSuccess ? <p className="text-[11px] text-emerald-600">{feedbackSuccess}</p> : null}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeFeedbackModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSaveFeedback()}
                disabled={feedbackSaving}
                className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {feedbackSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
