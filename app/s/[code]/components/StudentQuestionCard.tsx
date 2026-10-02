"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const BODY_LIMIT = 200;
const STORAGE_PREFIX = "student-question-outbox";

type PublicQuestion = {
  id: string;
  body: string;
  author: string | null;
  status: string;
  pinned: boolean;
  createdAt: string;
};

type PendingQuestion = {
  author: string;
  body: string;
  createdAt: string;
};

type StudentQuestionCardProps = {
  shareCode: string;
  writeLocked: boolean;
  toolsEnabled?: string[] | null;
};

function getStorageKey(shareCode: string) {
  return `${STORAGE_PREFIX}:${shareCode}`;
}

function loadPending(shareCode: string) {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getStorageKey(shareCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingQuestion;
  } catch {
    return null;
  }
}

function savePending(shareCode: string, pending: PendingQuestion | null) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(shareCode);
  if (!pending) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(pending));
}

export default function StudentQuestionCard({ shareCode, writeLocked, toolsEnabled }: StudentQuestionCardProps) {
  const canQuestions = hasToolEnabled(toolsEnabled, "questions");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [approved, setApproved] = useState<PublicQuestion[]>([]);
  const [pinned, setPinned] = useState<PublicQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const retryTimeoutRef = useRef<number | null>(null);
  const [now, setNow] = useState(0);
  const { data: liveSnapshot } = useLiveSync({
    mode: "viewer",
    shareCode,
    enableLiveSync: canQuestions,
  });

  const remaining = BODY_LIMIT - body.length;
  const qnaEndsAt = liveSnapshot?.qnaEndsAt ?? null;
  const qnaOpen = liveSnapshot?.qnaOpen === true && (!qnaEndsAt || qnaEndsAt > now);
  const qnaPrompt = liveSnapshot?.qnaPrompt ?? null;
  const canSubmit = !writeLocked && qnaOpen && body.trim().length > 0 && body.length <= BODY_LIMIT;

  const refreshQuestions = useCallback(async () => {
    if (!canQuestions) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(apiV1Path(`s/${shareCode}/questions`), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { pinned: PublicQuestion | null; approved: PublicQuestion[] } }
        | { ok: false }
        | null;
      if (!response.ok || !payload || payload.ok !== true) {
        return;
      }
      setPinned(payload.data.pinned);
      setApproved(payload.data.approved ?? []);
    } finally {
      setLoading(false);
    }
  }, [canQuestions, shareCode]);

  const sendQuestion = useCallback(
    async (payload: PendingQuestion) => {
      if (!canQuestions) return;
      if (sending) return;
      setSending(true);
      setError(null);

      try {
        const response = await fetch(apiV1Path(`s/${shareCode}/questions`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author: payload.author || null,
            body: payload.body,
            timezoneOffset: new Date().getTimezoneOffset(),
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { ok: true }
          | { ok?: false; error?: { message?: string; code?: string } }
          | null;

        if (!response.ok || !data || data.ok !== true) {
          const code = data && data.ok === false ? data.error?.code : undefined;
          const message =
            code === "RATE_LIMIT"
              ? "잠깐만요! 8초 뒤 다시…"
              : code === "DUPLICATE"
                ? "같은 내용이 방금 전송됐어요"
                : code === "INVALID_BODY"
                  ? "한 문장으로 짧게 적어주세요"
                  : code === "QNA_CLOSED"
                    ? "지금은 질문 받는 시간이 아니에요"
                    : data && data.ok === false
                      ? data.error?.message
                      : "전송에 실패했습니다. 다시 시도해주세요.";
          setError({ message: message ?? "전송에 실패했습니다.", code });
          setPending(null);
          savePending(shareCode, null);
          return;
        }

        setFeedback("전송됨");
        setBody("");
        setPending(null);
        savePending(shareCode, null);
        void refreshQuestions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "전송에 실패했습니다.";
        setError({ message });
        setPending(payload);
        savePending(shareCode, payload);
      } finally {
        setSending(false);
      }
    },
    [canQuestions, refreshQuestions, sending, shareCode],
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit || sending) return;
    const payload: PendingQuestion = {
      author: author.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    void sendQuestion(payload);
  }, [author, body, canSubmit, sendQuestion, sending]);

  const handleRetry = useCallback(() => {
    if (!pending) return;
    void sendQuestion(pending);
  }, [pending, sendQuestion]);

  useEffect(() => {
    if (!canQuestions) {
      setLoading(false);
      return;
    }
    const saved = loadPending(shareCode);
    if (saved) {
      setPending(saved);
      void sendQuestion(saved);
    }
    void refreshQuestions();
  }, [canQuestions, refreshQuestions, sendQuestion, shareCode]);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!canQuestions) return;
    if (!pending) return;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    retryTimeoutRef.current = window.setTimeout(() => {
      void sendQuestion(pending);
    }, 8_000);

    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [canQuestions, pending, sendQuestion]);

  useEffect(() => {
    const handleOnline = () => {
      if (pending) {
        void sendQuestion(pending);
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [pending, sendQuestion]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = window.setTimeout(() => setFeedback(null), 2_000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const approvedPreview = useMemo(() => approved.slice(0, 3), [approved]);

  if (!canQuestions) {
    return null;
  }

  return (
    <section
      id="student-qna-card"
      className="rounded-3xl border border-indigo-100 bg-white/90 p-6 shadow-sm"
      data-dismiss-ignore="true"
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
          질문/도움요청
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
          수업 중 궁금한 점을 바로 남겨주세요.
        </h2>
        <p className="text-sm text-gray-600">질문은 선생님 확인 후 발표 화면에 공유됩니다.</p>
        {!qnaOpen ? (
          <p className="text-sm font-semibold text-rose-500">
            지금은 질문 받는 시간이 아니에요.
          </p>
        ) : qnaPrompt ? (
          <p className="text-sm font-semibold text-indigo-500">{qnaPrompt}</p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        <input
          type="text"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="이름 (선택)"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          maxLength={20}
          disabled={writeLocked || sending || !qnaOpen}
        />
        <div className="relative">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              writeLocked || !qnaOpen
                ? "지금은 질문 받는 시간이 아니에요."
                : "질문을 200자 이내로 입력하세요."
            }
            className="min-h-[140px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            maxLength={BODY_LIMIT}
            disabled={writeLocked || sending || !qnaOpen}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
          <span className={cn("absolute bottom-3 right-4 text-xs", remaining < 0 ? "text-rose-500" : "text-slate-400")}>
            {remaining}자 남음
          </span>
        </div>
        <button
          type="button"
          className={cn(
            buttonTone("primary", { size: "lg", tone: "indigo" }),
            "min-h-[56px] text-base",
            !canSubmit ? "cursor-not-allowed opacity-60" : "",
          )}
          onClick={handleSubmit}
          disabled={!canSubmit || sending}
        >
          {sending ? "전송 중…" : "질문 보내기"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {feedback ? (
          <InlineAlert tone="success" title={feedback} description="선생님이 확인 중입니다." />
        ) : null}
        {error ? (
          <InlineAlert
            tone="warning"
            title="전송에 실패했습니다"
            description={error.message}
            action={
              pending ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  className={cn(buttonTone("secondary", { size: "sm" }))}
                >
                  다시 보내기
                </button>
              ) : null
            }
          />
        ) : null}
        {pending && !error ? (
          <InlineAlert
            tone="info"
            title="전송 대기 중"
            description="네트워크가 안정되면 자동으로 다시 전송합니다."
          />
        ) : null}
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
        <p className="text-sm font-semibold text-slate-900">교사가 확인 중</p>
        {loading ? <p className="text-xs text-slate-500">질문을 불러오는 중…</p> : null}
        {!loading && approvedPreview.length === 0 ? (
          <p className="text-xs text-slate-500">아직 승인된 질문이 없습니다.</p>
        ) : null}
        {approvedPreview.length > 0 ? (
          <ul className="space-y-2 text-sm text-slate-700">
            {approvedPreview.map((item) => (
              <li key={item.id} className="rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
                <p className="font-medium text-slate-900">{item.body}</p>
                {item.author ? <p className="text-xs text-slate-500">- {item.author}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {pinned ? (
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            지금 고정된 질문
          </p>
          <p className="mt-2 text-base font-semibold text-indigo-900">“{pinned.body}”</p>
          {pinned.author ? <p className="mt-1 text-xs text-indigo-600">- {pinned.author}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
