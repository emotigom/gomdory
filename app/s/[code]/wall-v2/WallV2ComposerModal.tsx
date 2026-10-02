"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { routes } from "@/lib/standards/routes";
import { WRITE_LOCK_COPY, type WriteLockReason } from "@/lib/student/writeLockReason";

export type WallV2CardContent = {
  type: "text";
  text: string;
  reasons?: string[];
};

export type WallV2Card = {
  id: string;
  sectionId: string;
  authorId: string | null;
  position: number;
  content: WallV2CardContent;
  createdAt: string;
  updatedAt: string;
};

type WallV2ComposerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  shareCode: string;
  sectionId: string | null;
  sectionTitle?: string | null;
  writeLocked: boolean;
  writeLockedReason?: WriteLockReason | null;
  onCreated: (card: WallV2Card) => void;
};

export default function WallV2ComposerModal({
  isOpen,
  onClose,
  shareCode,
  sectionId,
  sectionTitle,
  writeLocked,
  writeLockedReason = null,
  onCreated,
}: WallV2ComposerModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isReady = Boolean(text.trim()) && !pending && !writeLocked;

  const disabledReason = useMemo(() => {
    if (pending) return "카드 작성 중이에요.";
    if (writeLocked && writeLockedReason) return WRITE_LOCK_COPY[writeLockedReason].message;
    if (writeLocked) return "읽기 전용 · 선생님이 열어주면 작성 가능";
    if (!text.trim()) return "내용을 입력해주세요.";
    return null;
  }, [pending, text, writeLocked, writeLockedReason]);

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
    setPending(false);
  }, [isOpen]);

  if (!isOpen || !sectionId) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (writeLocked) {
      const fallbackMessage = "수업이 잠겨있어요. 선생님이 열어주시면 작성할 수 있어요.";
      setError(writeLockedReason ? WRITE_LOCK_COPY[writeLockedReason].message : fallbackMessage);
      return;
    }

    try {
      setPending(true);
      setError(null);

      const response = await fetch(routes.api.shareV2.wallSectionCards(shareCode, sectionId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; card?: WallV2Card; error?: { message?: string } }
        | null;

      if (!response.ok || !result?.ok || !result.card) {
        setError(result?.error?.message ?? "카드 작성에 실패했습니다.");
        return;
      }

      onCreated(result.card);
      setText("");
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">Wall v2</p>
            <h2 className="text-2xl font-semibold text-slate-900">카드 작성</h2>
            <p className="text-sm text-slate-500">
              {sectionTitle ? `${sectionTitle} 섹션에 작성할게요.` : "섹션에 카드를 추가할게요."}
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {disabledReason ? (
            <p className={cn("text-xs", writeLocked ? "text-slate-400" : "text-slate-500")}>{disabledReason}</p>
          ) : null}

          <button
            type="submit"
            disabled={!isReady}
            className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? "작성 중..." : "카드 작성하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
