"use client";

import MoreMenu from "@/app/_components/MoreMenu";
import { isFinalArtwork } from "@/lib/board/finalArtwork";
import type { Card } from "@/lib/data/cards";
import { routes } from "@/lib/standards/routes";
import { CARD_COLOR_OPTIONS, getCardColorClass } from "@/lib/ui/cardColors";
import { useTouchLike } from "@/lib/ui/isTouchLike";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteCardAction,
  setCardColorTokenAction,
  setCardFeaturedAction,
  setCardHiddenAction,
  setCardPinnedAction,
} from "./cardActions";

const copyCardText = async (value: string) => {
  if (!value) return;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("clipboard_unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("clipboard_exec_failed");
};

type CardMoreMenuProps = {
  boardId: string;
  wallId: string;
  card: Pick<Card, "id" | "is_hidden" | "is_pinned" | "is_featured" | "card_color_token" | "text"> &
    Partial<Pick<Card, "author_type" | "tags">>;
  disableStatus?: boolean;
  pendingStatusMessage?: string;
  disableDelete?: boolean;
  deleteDisabledReason?: string;
  detailHref?: string;
  onMoveSelected?: () => void;
  showMoveSelected?: boolean;
  title?: string | null;
};

export default function CardMoreMenu({
  boardId,
  wallId,
  card,
  disableStatus = false,
  pendingStatusMessage,
  disableDelete = false,
  deleteDisabledReason,
  detailHref,
  onMoveSelected,
  showMoveSelected = false,
  title,
}: CardMoreMenuProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [finalArtworkPending, setFinalArtworkPending] = useState(false);
  const [finalArtworkError, setFinalArtworkError] = useState<string | null>(null);
  const router = useRouter();
  const { compact, touchLike } = useTouchLike();
  const isCompactUi = compact || touchLike;

  const statusLabel = (label: string) =>
    disableStatus && pendingStatusMessage ? `${label} (${pendingStatusMessage})` : label;

  const baseButtonClass =
    `flex w-full items-center justify-between rounded-md px-3 text-left text-sm text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:text-gray-400 ${isCompactUi ? "min-h-10 py-2.5" : "min-h-9 py-2"}`;

  const copyPayload = [title?.trim(), card.text?.trim()].filter(Boolean).join("\n\n");
  const finalArtwork = isFinalArtwork(card.tags);

  const toggleFinalArtwork = async () => {
    setFinalArtworkPending(true);
    setFinalArtworkError(null);
    try {
      const response = await fetch(routes.api.v1("dashboard", "cards", card.id, "final-artwork"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ final: !finalArtwork }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setFinalArtworkError(payload?.error ?? "최종 작품 상태를 저장하지 못했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setFinalArtworkError("최종 작품 상태를 저장하지 못했습니다.");
    } finally {
      setFinalArtworkPending(false);
    }
  };

  return (
    <MoreMenu label="카드 더보기">
      {detailHref ? (
        <>
          <a href={detailHref} className={baseButtonClass}>
            자세히 보기
          </a>
          <div className="my-1 border-t border-gray-100" />
        </>
      ) : null}
      {showMoveSelected ? (
        <>
          <button type="button" className={baseButtonClass} onClick={() => onMoveSelected?.()}>
            선택 이동
          </button>
          <div className="my-1 border-t border-gray-100" />
        </>
      ) : null}
      <button
        type="button"
        className={baseButtonClass}
        disabled={!copyPayload}
        onClick={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!copyPayload) return;
          try {
            await copyCardText(copyPayload);
            setCopyStatus("success");
            window.setTimeout(() => setCopyStatus("idle"), 1500);
          } catch {
            setCopyStatus("error");
            window.setTimeout(() => setCopyStatus("idle"), 2000);
          }
        }}
      >
        <span>복사</span>
        {copyStatus === "success" ? <span className="text-xs text-emerald-600">복사됨</span> : null}
        {copyStatus === "error" ? <span className="text-xs text-rose-500">실패</span> : null}
      </button>
      <div className="my-1 border-t border-gray-100" />
      {card.author_type === "student" ? (
        <>
          <button
            type="button"
            className={baseButtonClass}
            disabled={disableStatus || finalArtworkPending}
            onClick={() => void toggleFinalArtwork()}
          >
            {finalArtwork ? "최종 작품 해제" : "최종 작품으로 표시"}
          </button>
          {finalArtworkError ? (
            <p role="alert" className="px-3 py-1 text-xs text-rose-600">{finalArtworkError}</p>
          ) : null}
          <div className="my-1 border-t border-gray-100" />
        </>
      ) : null}
      <form action={setCardHiddenAction}>
        <input type="hidden" name="boardId" value={boardId} />
        <input type="hidden" name="wallId" value={wallId} />
        <input type="hidden" name="cardId" value={card.id} />
        <input type="hidden" name="hidden" value={card.is_hidden ? "false" : "true"} />
        <button type="submit" className={baseButtonClass} disabled={disableStatus}>
          {statusLabel(card.is_hidden ? "복구" : "숨김")}
        </button>
      </form>
      <form action={setCardPinnedAction}>
        <input type="hidden" name="boardId" value={boardId} />
        <input type="hidden" name="wallId" value={wallId} />
        <input type="hidden" name="cardId" value={card.id} />
        <input type="hidden" name="pinned" value={card.is_pinned ? "false" : "true"} />
        <button type="submit" className={baseButtonClass} disabled={disableStatus}>
          {statusLabel(card.is_pinned ? "핀 해제" : "핀")}
        </button>
      </form>
      <form action={setCardFeaturedAction}>
        <input type="hidden" name="boardId" value={boardId} />
        <input type="hidden" name="wallId" value={wallId} />
        <input type="hidden" name="cardId" value={card.id} />
        <input
          type="hidden"
          name="featured"
          value={card.is_featured ? "false" : "true"}
        />
        <button type="submit" className={baseButtonClass} disabled={disableStatus}>
          {statusLabel(card.is_featured ? "대표 해제" : "대표")}
        </button>
      </form>
      <div className="my-1 border-t border-gray-100" />
      <div className="px-3 py-1 text-xs font-semibold text-gray-500">배경색</div>
      <div className="space-y-1">
        {CARD_COLOR_OPTIONS.map((option) => {
          const isActive = card.card_color_token
            ? card.card_color_token === option.token
            : option.token === "default";
          const swatchClass = `${getCardColorClass(option.token)} h-3 w-3 rounded-full border border-gray-200`;

          return (
            <form key={option.token} action={setCardColorTokenAction}>
              <input type="hidden" name="boardId" value={boardId} />
              <input type="hidden" name="wallId" value={wallId} />
              <input type="hidden" name="cardId" value={card.id} />
              <input type="hidden" name="token" value={option.token} />
              <button
                type="submit"
                className={`${baseButtonClass} ${isActive ? "font-semibold text-gray-900" : ""}`}
                disabled={disableStatus}
              >
                <span className="flex items-center gap-2">
                  <span className={swatchClass} />
                  {statusLabel(option.label)}
                </span>
                {isActive ? <span className="text-xs text-gray-400">선택됨</span> : null}
              </button>
            </form>
          );
        })}
      </div>
      <div className="my-1 border-t border-gray-100" />
      <form action={deleteCardAction}>
        <input type="hidden" name="boardId" value={boardId} />
        <input type="hidden" name="wallId" value={wallId} />
        <input type="hidden" name="cardId" value={card.id} />
        <button
          type="submit"
          disabled={disableDelete}
          className={`flex w-full items-center justify-between rounded-md px-3 text-left text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${isCompactUi ? "min-h-10 py-2.5" : "min-h-9 py-2"}`}
        >
          {disableDelete ? deleteDisabledReason ?? "삭제 불가" : "휴지통으로 이동"}
        </button>
      </form>
    </MoreMenu>
  );
}
