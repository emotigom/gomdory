"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { cn } from "@/app/_components/uiTokens";
import { WRITE_LOCK_COPY, type WriteLockReason } from "@/lib/student/writeLockReason";

type StudentCardComposerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  shareCode: string;
  wallId: string | null;
  wallTitle?: string | null;
  writeLocked: boolean;
  writeLockedReason?: WriteLockReason | null;
};

export default function StudentCardComposerModal({
  isOpen,
  onClose,
  shareCode,
  wallId,
  wallTitle,
  writeLocked,
  writeLockedReason = null,
}: StudentCardComposerModalProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);

  const isReady = Boolean(text.trim()) && Boolean(turnstileToken) && !pending;

  const disabledReason = useMemo(() => {
    if (pending) return "카드 작성 중이에요.";
    if (writeLocked && writeLockedReason) return WRITE_LOCK_COPY[writeLockedReason].message;
    if (writeLocked) return "읽기 전용 · 선생님이 열어주면 작성 가능";
    if (!text.trim()) return "내용을 입력해주세요.";
    if (!turnstileToken) return WRITE_LOCK_COPY.turnstile_required.message;
    return null;
  }, [pending, text, turnstileToken, writeLocked, writeLockedReason]);

  useEffect(() => {
    if (!isOpen) return;

    const storedName = window.localStorage.getItem("student-card-author-name");
    if (storedName) {
      setAuthorName(storedName);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    requestAnimationFrame(() => textareaRef.current?.focus());

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setError(null);
    setText("");
    setTurnstileToken(null);
    setWidgetKey((prev) => prev + 1);
  }, [isOpen]);

  if (!isOpen || !wallId) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (writeLocked) {
      const fallbackMessage = "수업이 잠겨있어요. 선생님이 열어주시면 작성할 수 있어요.";
      setError(writeLockedReason ? WRITE_LOCK_COPY[writeLockedReason].message : fallbackMessage);
      return;
    }

    if (!turnstileToken) {
      setError(WRITE_LOCK_COPY.turnstile_required.message);
      return;
    }

    try {
      setPending(true);
      setError(null);

      const trimmedAuthorName = authorName.trim();
      const response = await fetch(apiV1Path(`share/${shareCode}/walls/${wallId}/cards`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          authorName: trimmedAuthorName || undefined,
          turnstileToken,
        }),
      });

      const result: { ok?: boolean; error?: { code?: string; message?: string } | string } =
        await response.json();

      if (response.status === 429 || result.error === "too_fast") {
        setError("잠시만요! 10초 후에 다시 작성할 수 있어요.");
        setWidgetKey((prev) => prev + 1);
        setTurnstileToken(null);
        return;
      }

      if (
        response.status === 403 &&
        (result.error === "class_ended" ||
          (typeof result.error === "object" && result.error?.code === "CLASS_ENDED"))
      ) {
        setError(WRITE_LOCK_COPY.class_ended.message);
        setWidgetKey((prev) => prev + 1);
        setTurnstileToken(null);
        return;
      }

      if (!response.ok || !result.ok) {
        const errorCode = typeof result.error === "object" ? result.error?.code : null;
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error?.message ?? "카드 작성에 실패했습니다.";
        const finalMessage =
          errorCode === "TURNSTILE_FAILED"
            ? WRITE_LOCK_COPY.turnstile_required.message
            : message;
        setError(finalMessage);
        setWidgetKey((prev) => prev + 1);
        setTurnstileToken(null);
        return;
      }

      if (trimmedAuthorName) {
        window.localStorage.setItem("student-card-author-name", trimmedAuthorName);
      }

      setText("");
      setTurnstileToken(null);
      setWidgetKey((prev) => prev + 1);
      router.refresh();
      onClose();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : "카드 작성 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="카드 작성"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-[28px] border border-slate-100/80 bg-white/98 p-6 shadow-[0_36px_160px_-110px_rgba(15,23,42,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Student Share</p>
            <h2 className="text-2xl font-semibold text-slate-900">카드 작성</h2>
            <p className="text-sm text-slate-500">
              {wallTitle ? `${wallTitle} 컬럼에 작성할게요.` : "컬럼에 카드를 추가할게요."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="composer-author-name">
              닉네임 (선택)
            </label>
            <input
              id="composer-author-name"
              name="composer-author-name"
              type="text"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={authorName}
              maxLength={20}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="예: 즐거운 학생"
              disabled={writeLocked || pending}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="composer-card-text">
              내용
            </label>
            <textarea
              id="composer-card-text"
              name="composer-card-text"
              ref={textareaRef}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={5}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={500}
              placeholder="생각을 적어주세요 (최대 500자)"
              required
              disabled={writeLocked}
              aria-describedby={writeLocked ? "composer-locked-message" : undefined}
            />
            {writeLocked ? (
              <p id="composer-locked-message" className="text-xs text-slate-400">
                {writeLockedReason ? WRITE_LOCK_COPY[writeLockedReason].message : "지금은 읽기 전용이에요. 선생님이 열어주시면 작성할 수 있어요."}
              </p>
            ) : null}
          </div>

          {!writeLocked ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">스팸 방지 인증</p>
              <TurnstileWidget key={widgetKey} onToken={setTurnstileToken} />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {disabledReason ? (
            <p className={cn("text-xs", writeLocked ? "text-slate-400" : "text-slate-500")}>{disabledReason}</p>
          ) : null}

          <button
            type="submit"
            disabled={writeLocked || !isReady}
            className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? "작성 중..." : "카드 작성하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
