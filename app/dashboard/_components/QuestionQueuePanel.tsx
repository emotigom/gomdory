"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { appendSessionEvent } from "@/app/_components/sessionEvents";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const STATUS_TABS = [
  { id: "queued", label: "대기" },
  { id: "approved", label: "승인" },
  { id: "pinned", label: "고정" },
  { id: "archived", label: "보관" },
] as const;

type QuestionStatus = (typeof STATUS_TABS)[number]["id"] | "deleted";

type QuestionRow = {
  id: string;
  body: string;
  author: string | null;
  status: QuestionStatus;
  pinned: boolean;
  createdAt: string;
};

type QuestionQueuePanelProps = {
  boardId: string | null;
  toolsEnabled?: string[] | null;
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function QuestionQueuePanel({ boardId, toolsEnabled }: QuestionQueuePanelProps) {
  const canQuestions = hasToolEnabled(toolsEnabled, "questions");
  const [activeTab, setActiveTab] = useState<QuestionStatus>("queued");
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [promptDraft, setPromptDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { data: liveSnapshot, publish, activeSessionId } = useLiveSync({
    mode: "teacher",
    boardId: boardId ?? undefined,
    enableLiveSync: canQuestions,
  });

  const canFetch = Boolean(boardId) && canQuestions;

  const fetchQuestions = useCallback(async () => {
    if (!boardId || !canQuestions) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        apiV1Path(`boards/${boardId}/questions?status=${activeTab}&limit=20`),
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { items: QuestionRow[] } }
        | { ok: false; error?: { message?: string } }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const message =
          payload && payload.ok === false ? payload.error?.message : "질문을 불러오지 못했습니다.";
        throw new Error(message ?? "질문을 불러오지 못했습니다.");
      }

      setItems(payload.data.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "질문을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, boardId, canQuestions]);

  useEffect(() => {
    if (!canFetch) return;
    void fetchQuestions();
  }, [canFetch, fetchQuestions]);

  useEffect(() => {
    setSelectedIds([]);
    setPendingDeleteId(null);
    setPendingCardId(null);
  }, [activeTab]);

  useEffect(() => {
    setPromptDraft(liveSnapshot?.qnaPrompt ?? "");
  }, [liveSnapshot?.qnaPrompt]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handlePatch = useCallback(
    async (id: string, patch: { status?: QuestionStatus; pinned?: boolean }) => {
      if (!boardId) return;
      setError(null);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/questions`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true }
          | { ok?: false; error?: { message?: string } }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          const message =
            payload && payload.ok === false ? payload.error?.message : "업데이트에 실패했습니다.";
          throw new Error(message ?? "업데이트에 실패했습니다.");
        }

        setPendingDeleteId(null);
        if (patch.pinned === true && activeSessionId) {
          await appendSessionEvent({
            boardId,
            sessionId: activeSessionId,
            type: "question_pinned",
            payload: { questionId: id },
          });
        }
        void fetchQuestions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "업데이트에 실패했습니다.";
        setError(message);
      }
    },
    [activeSessionId, boardId, fetchQuestions],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!boardId) return;
      setError(null);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/questions`), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true }
          | { ok?: false; error?: { message?: string } }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          const message =
            payload && payload.ok === false ? payload.error?.message : "삭제에 실패했습니다.";
          throw new Error(message ?? "삭제에 실패했습니다.");
        }

        setPendingDeleteId(null);
        void fetchQuestions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "삭제에 실패했습니다.";
        setError(message);
      }
    },
    [boardId, fetchQuestions],
  );

  const handleToCard = useCallback(
    async (id: string) => {
      if (!boardId) return;
      setError(null);
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/questions`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "to_card", questionId: id, target: "board" }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true }
          | { ok?: false; error?: { message?: string } }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          const message =
            payload && payload.ok === false ? payload.error?.message : "카드로 저장하지 못했습니다.";
          throw new Error(message ?? "카드로 저장하지 못했습니다.");
        }

        setPendingCardId(null);
        setSelectedIds([]);
        void fetchQuestions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "카드로 저장하지 못했습니다.";
        setError(message);
      }
    },
    [boardId, fetchQuestions],
  );

  const handleBulkToCard = useCallback(async () => {
    if (!boardId || selectedIds.length === 0) return;
    setError(null);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const response = await fetch(apiV1Path(`boards/${boardId}/questions`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "to_card", questionId: id, target: "board" }),
          });
          if (!response.ok) {
            throw new Error("카드로 저장하지 못했습니다.");
          }
        }),
      );
      setSelectedIds([]);
      void fetchQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "카드로 저장하지 못했습니다.";
      setError(message);
    }
  }, [boardId, fetchQuestions, selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleQnaPublish = useCallback(
    async (patch: { qnaOpen?: boolean; qnaEndsAt?: number | null; qnaPrompt?: string | null }) => {
      if (!publish) return;
      await publish({ ...patch, ts: Date.now() });
    },
    [publish],
  );

  const handleQnaTimer = useCallback(
    async (durationMs: number | null) => {
      const endsAt = durationMs ? Date.now() + durationMs : null;
      await handleQnaPublish({ qnaOpen: true, qnaEndsAt: endsAt });
    },
    [handleQnaPublish],
  );

  const handleQnaClose = useCallback(async () => {
    await handleQnaPublish({ qnaOpen: false, qnaEndsAt: null });
  }, [handleQnaPublish]);

  const handlePromptSave = useCallback(async () => {
    await handleQnaPublish({ qnaPrompt: promptDraft.trim() || null });
  }, [handleQnaPublish, promptDraft]);

  const emptyLabel = useMemo(() => {
    if (!boardId) return "보드를 선택하세요.";
    if (loading) return "질문을 불러오는 중...";
    if (items.length === 0) return "질문이 없습니다.";
    return null;
  }, [boardId, items.length, loading]);

  const qnaEndsAt = liveSnapshot?.qnaEndsAt ?? null;
  const qnaOpen = liveSnapshot?.qnaOpen === true && (!qnaEndsAt || qnaEndsAt > now);
  const qnaStatus = qnaOpen
    ? qnaEndsAt
      ? `열림 ${formatRemaining(qnaEndsAt - now)} 남음`
      : "열림"
    : "닫힘";

  if (!canQuestions) {
    return null;
  }

  return (
    <CardTile variant="dense" subdued className="border-indigo-100">
      <div className="space-y-4">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
                Q&amp;A Window
              </p>
              <p className="text-xs text-indigo-700">현재 상태: {qnaStatus}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleQnaTimer(60_000)}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
              >
                질문 받기 60초
              </button>
              <button
                type="button"
                onClick={() => void handleQnaTimer(120_000)}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
              >
                120초
              </button>
              <button
                type="button"
                onClick={() => void handleQnaTimer(null)}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
              >
                열어두기
              </button>
              <button
                type="button"
                onClick={() => void handleQnaClose()}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
              >
                닫기
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              placeholder="예: 질문은 1문장으로!"
              className="h-10 flex-1 rounded-xl border border-indigo-100 bg-white px-3 text-xs text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              maxLength={60}
            />
            <button
              type="button"
              onClick={() => void handlePromptSave()}
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[40px]")}
            >
              프롬프트 저장
            </button>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">질문 큐</p>
          <p className="text-xs text-gray-600">학생 질문을 승인하거나 고정하세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <button
            type="button"
            onClick={() => {
              setSelectionMode((prev) => !prev);
              setSelectedIds([]);
            }}
            className={cn(
              "rounded-full border px-3 py-1 font-semibold",
              selectionMode ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600",
            )}
          >
            선택 모드 {selectionMode ? "해제" : "켬"}
          </button>
          {selectionMode && selectedIds.length > 0 ? (
            <span>{selectedIds.length}개 선택됨</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "min-h-[44px] rounded-full px-4 text-xs font-semibold",
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {selectionMode && activeTab === "queued" && selectedIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleBulkToCard()}
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[44px]")}
            >
              카드로 저장(선택)
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
            >
              선택 해제
            </button>
          </div>
        ) : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {emptyLabel ? <p className="text-xs text-slate-500">{emptyLabel}</p> : null}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              {selectionMode ? (
                <label className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelection(item.id)}
                  />
                  선택
                </label>
              ) : null}
              <p className="text-sm font-semibold text-slate-900">{item.body}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{item.author ? `- ${item.author}` : "익명"}</span>
                <span>
                  {new Date(item.createdAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeTab === "queued" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { status: "approved" })}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { pinned: true })}
                      className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[44px]")}
                    >
                      고정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { status: "archived" })}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      보관
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pendingCardId === item.id ? void handleToCard(item.id) : setPendingCardId(item.id)
                      }
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      {pendingCardId === item.id ? "카드 저장 확인" : "카드로 저장"}
                    </button>
                  </>
                ) : null}
                {activeTab === "approved" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { pinned: true })}
                      className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[44px]")}
                    >
                      고정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { status: "archived" })}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      보관
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pendingCardId === item.id ? void handleToCard(item.id) : setPendingCardId(item.id)
                      }
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      {pendingCardId === item.id ? "카드 저장 확인" : "카드로 저장"}
                    </button>
                  </>
                ) : null}
                {activeTab === "pinned" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { pinned: false })}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      해제
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { status: "archived" })}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      보관
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pendingCardId === item.id ? void handleToCard(item.id) : setPendingCardId(item.id)
                      }
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      {pendingCardId === item.id ? "카드 저장 확인" : "카드로 저장"}
                    </button>
                  </>
                ) : null}
                {activeTab === "archived" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handlePatch(item.id, { status: "approved" })}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      복원
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pendingCardId === item.id ? void handleToCard(item.id) : setPendingCardId(item.id)
                      }
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
                    >
                      {pendingCardId === item.id ? "카드 저장 확인" : "카드로 저장"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    pendingDeleteId === item.id
                      ? void handleDelete(item.id)
                      : setPendingDeleteId(item.id)
                  }
                  className={cn(
                    buttonTone("secondary", { size: "sm" }),
                    "min-h-[44px]",
                    pendingDeleteId === item.id ? "border-rose-300 text-rose-600" : "",
                  )}
                >
                  {pendingDeleteId === item.id ? "삭제 확인" : "삭제"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardTile>
  );
}
