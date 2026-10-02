"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";
import { CARD_COLOR_OPTIONS, getCardColorClass } from "@/lib/ui/cardColors";
import { routes } from "@/lib/standards/routes";
import { safeErrorMessage } from "@/lib/ui/safeErrors";

import { FileUploader } from "@/app/dashboard/boards/[boardId]/walls/[wallId]/FileUploader";
import CardAttachments, { type CardAttachmentViewModel } from "@/app/_components/CardAttachments";
import EmptyState from "@/app/_components/EmptyState";
import InlineAlert from "@/app/_components/InlineAlert";
import SkeletonBlock from "@/app/_components/SkeletonBlock";
import { buildCardFocusSelector, pickFocusRestoreCardId } from "@/app/_components/cards/focusRestore";

export type CardDetailOverlayFile = {
  id: string;
  filename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  downloadUrl: string;
};

export type CardDetailOverlayCard = {
  id: string;
  text: string;
  authorName?: string | null;
  authorType?: "teacher" | "student" | null;
  createdAt: string;
  isHidden?: boolean;
  isPinned?: boolean;
  isFeatured?: boolean;
  cardColorToken?: CardColorToken | null;
  files?: CardDetailOverlayFile[];
  externalAttachments?: ExternalAttachment[];
};

type TeacherActions = {
  boardId: string;
  wallId: string;
  writeLocked: boolean;
};

export type CardDetailOverlayProps = {
  open: boolean;
  onClose: () => void;
  initialCardId?: string | null;
  cardsIndex: CardDetailOverlayCard[];
  fetchCard?: (cardId: string) => Promise<CardDetailOverlayCard | null>;
  readOnly?: boolean;
  teacherActions?: TeacherActions;
  onCardUpdated?: (card: CardDetailOverlayCard) => void;
};

type FocusSnapshot = { cardId: string | null; fallback: HTMLElement | null };

function formatFileSize(bytes?: number | null): string {
  if (!bytes || !Number.isFinite(bytes)) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function isImageType(type?: string | null): boolean {
  return Boolean(type && type.startsWith("image/"));
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length <= 1 ? "FILE" : parts.pop()?.toUpperCase() ?? "FILE";
}

function resolveFocusedCardId(node: Element | null): string | null {
  if (!node || !(node instanceof HTMLElement)) return null;
  const withId = node.closest<HTMLElement>("[data-card-id]");
  return withId?.dataset.cardId ?? null;
}

export function CardDetailOverlayWithQuery({
  cardsIndex,
  fetchCard,
  initialCardId,
  readOnly,
  teacherActions,
  onCardUpdated,
}: Omit<CardDetailOverlayProps, "open" | "onClose">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cardIdFromQuery = searchParams.get("card") ?? initialCardId ?? null;
  const open = Boolean(cardIdFromQuery);

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("card");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <CardDetailOverlay
      open={open}
      onClose={handleClose}
      initialCardId={cardIdFromQuery}
      cardsIndex={cardsIndex}
      fetchCard={fetchCard}
      readOnly={readOnly}
      teacherActions={teacherActions}
      onCardUpdated={onCardUpdated}
    />
  );
}

export default function CardDetailOverlay({
  open,
  onClose,
  initialCardId,
  cardsIndex,
  fetchCard,
  readOnly = false,
  teacherActions,
  onCardUpdated,
}: CardDetailOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const focusSnapshotRef = useRef<FocusSnapshot | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});
  const [fetchedCard, setFetchedCard] = useState<CardDetailOverlayCard | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saveState, setSaveState] = useState<{ pending: boolean; error: string | null }>({
    pending: false,
    error: null,
  });

  const activeCardId = searchParams.get("card") ?? initialCardId ?? null;

  const cardsById = useMemo(() => {
    const map = new Map<string, CardDetailOverlayCard>();
    cardsIndex.forEach((card) => {
      map.set(card.id, card);
    });
    return map;
  }, [cardsIndex]);

  const orderedIds = useMemo(() => cardsIndex.map((card) => card.id), [cardsIndex]);

  const currentCard = activeCardId ? cardsById.get(activeCardId) ?? null : null;

  const card = fetchedCard ?? currentCard;
  const attachmentItems = useMemo<CardAttachmentViewModel[]>(() => {
    if (!card) return [];
    const fileItems = (card.files ?? []).map((file) => ({
      id: file.id,
      type: "file" as const,
      label: file.filename,
      url: file.downloadUrl,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
    }));
    const externalItems = (card.externalAttachments ?? []).flatMap((file, index) => {
      if (!file.downloadPath) {
        return [];
      }
      return [{
        id: `external-${index}`,
        type: "url" as const,
        label: file.filename,
        url: file.downloadPath,
        contentType: file.contentType,
        sizeBytes: file.byteSize,
      }];
    });
    return [...fileItems, ...externalItems];
  }, [card]);
  const primaryUrl = useMemo(
    () => (card?.externalAttachments ?? []).find((attachment) => attachment.downloadPath)?.downloadPath ?? "",
    [card],
  );
  const createdAtLabel = card ? new Date(card.createdAt).toLocaleString("ko-KR") : "";
  const canEdit = Boolean(teacherActions) && !teacherActions?.writeLocked && !readOnly;
  const networkErrorMessage = "네트워크가 불안정해요. 잠시 후 다시 시도해주세요.";

  const updateCardParam = useCallback(
    (cardId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("card", cardId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadCard = useCallback(
    async (cardId: string) => {
      setIsFetching(true);
      setFetchError(null);
      try {
        const result = await fetchCard?.(cardId);
        if (!result) {
          setFetchedCard(null);
          setFetchError("삭제되었거나 접근할 수 없는 카드입니다.");
          return;
        }
        setFetchedCard(result);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.debug("Card detail fetch error:", error);
        }
        setFetchError(networkErrorMessage);
      } finally {
        setIsFetching(false);
      }
    },
    [fetchCard, networkErrorMessage],
  );


  const handleRequestClose = useCallback(() => {
    onClose();
    const restoreId = pickFocusRestoreCardId(
      [focusSnapshotRef.current?.cardId, activeCardId],
      orderedIds,
    );
    window.setTimeout(() => {
      if (restoreId) {
        const target = document.querySelector<HTMLElement>(buildCardFocusSelector(restoreId));
        target?.focus();
        return;
      }
      focusSnapshotRef.current?.fallback?.focus();
    }, 0);
  }, [activeCardId, onClose, orderedIds]);
  useEffect(() => {
    if (!open) {
      setFetchedCard(null);
      setFetchError(null);
      return;
    }

    if (!activeCardId) {
      return;
    }

    if (!fetchCard) {
      setFetchedCard(null);
      setFetchError(null);
      return;
    }

    void loadCard(activeCardId);
  }, [activeCardId, fetchCard, loadCard, open]);

  useEffect(() => {
    if (!open) return;
    focusSnapshotRef.current = {
      cardId: resolveFocusedCardId(document.activeElement),
      fallback: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleRequestClose();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && isEditing && canEdit) {
        event.preventDefault();
        void handleSaveRef.current();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (!activeCardId) return;
        const currentIndex = orderedIds.indexOf(activeCardId);
        if (currentIndex < 0) return;
        const nextIndex =
          event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
        const nextId = orderedIds[nextIndex];
        if (nextId) {
          updateCardParam(nextId);
        }
      }

      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "a[href], button, textarea, input, select, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((node) => !node.hasAttribute("disabled"));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeCardId, canEdit, handleRequestClose, isEditing, open, orderedIds, updateCardParam]);

  useEffect(() => {
    if (!open) return;

    if (!activeCardId || (!currentCard && !fetchedCard && !isFetching)) {
      setFetchError("카드를 찾을 수 없습니다.");
      const timeoutId = window.setTimeout(() => {
        handleRequestClose();
      }, 1500);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeCardId, currentCard, fetchedCard, handleRequestClose, isFetching, open]);

  useEffect(() => {
    if (card) {
      setEditText(card.text);
      setIsEditing(false);
      setSaveState({ pending: false, error: null });
    }
  }, [card]);

  const handleSave = useCallback(async () => {
    if (!card || !canEdit) return;
    if (!editText.trim()) {
      setSaveState({ pending: false, error: "내용을 입력해주세요." });
      return;
    }

    try {
      setSaveState({ pending: true, error: null });
      const response = await fetch(routes.api.v1("dashboard", "cards", card.id, "update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText.trim() }),
      });
      const result = (await response.json()) as { ok?: boolean; card?: CardDetailOverlayCard; error?: string };
      if (!response.ok || !result.ok || !result.card) {
        setSaveState({ pending: false, error: safeErrorMessage(result.error, { fallback: "저장에 실패했습니다." }) });
        return;
      }
      setFetchedCard(result.card);
      onCardUpdated?.(result.card);
      setIsEditing(false);
      setSaveState({ pending: false, error: null });
    } catch (error) {
      setSaveState({ pending: false, error: safeErrorMessage(error, { fallback: "저장에 실패했습니다." }) });
    }
  }, [canEdit, card, editText, onCardUpdated]);
  handleSaveRef.current = handleSave;


  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const panel = dialogRef.current;
      if (!panel) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(panel)) return;
      handleRequestClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [handleRequestClose, open]);

  if (!open || !activeCardId) {
    return null;
  }

  const canNavigate = orderedIds.length > 1;
  const currentIndex = orderedIds.indexOf(activeCardId);
  const previousId = currentIndex > 0 ? orderedIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < orderedIds.length - 1 ? orderedIds[currentIndex + 1] : null;

  const statusBadges = [
    card?.isHidden ? { label: "숨김", className: "bg-gray-200 text-gray-700" } : null,
    card?.isFeatured ? { label: "대표", className: "bg-purple-100 text-purple-700" } : null,
    card?.isPinned ? { label: "핀", className: "bg-amber-100 text-amber-700" } : null,
    readOnly ? { label: "읽기 전용", className: "bg-slate-100 text-slate-700" } : null,
  ].filter(Boolean) as Array<{ label: string; className: string }>;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-no-compose-open
        className={`pointer-events-auto relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl ${
          card?.cardColorToken ? getCardColorClass(card.cardColorToken) : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-white/90 p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">카드 상세</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {createdAtLabel ? <span>{createdAtLabel}</span> : null}
              {card?.authorName ? (
                <span className="text-gray-500">작성자: {card.authorName}</span>
              ) : null}
              {card?.authorType ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                  {card.authorType === "teacher" ? "교사" : "학생"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadges.map((badge) => (
              <span
                key={badge.label}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
            ))}
            <button
              type="button"
              ref={closeButtonRef}
              onClick={handleRequestClose}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
          {fetchError ? (
            <InlineAlert
              tone="error"
              title={fetchError}
              action={
                fetchCard && activeCardId ? (
                  <button
                    type="button"
                    onClick={() => loadCard(activeCardId)}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                    aria-label="카드 다시 불러오기"
                  >
                    다시 시도
                  </button>
                ) : null
              }
            />
          ) : null}
          {card ? (
            <>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      className="min-h-[140px] w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-900 shadow-inner focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-base text-gray-900">{card.text}</p>
                  )}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setIsEditing(false);
                          setEditText(card.text);
                          setSaveState({ pending: false, error: null });
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {isEditing ? "취소" : "편집"}
                    </button>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saveState.pending}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                      {saveState.pending ? "저장 중..." : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditText(card.text);
                        setSaveState({ pending: false, error: null });
                      }}
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      취소
                    </button>
                    {saveState.error ? (
                      <span className="text-xs text-red-600">{saveState.error}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {teacherActions ? (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-white/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">카드 상태</h3>
                    {teacherActions.writeLocked ? (
                      <span className="text-xs text-gray-500">
                        카드 상태 변경이 잠금 처리되었습니다.
                      </span>
                    ) : null}
                  </div>
                  <CardActionButtons card={card} disabled={teacherActions.writeLocked} />
                </div>
              ) : null}

              <div className="space-y-3 rounded-lg border border-gray-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">첨부파일</h3>
                  {teacherActions ? (
                    <FileUploader
                      cardId={card.id}
                      disabled={teacherActions.writeLocked}
                      inputId={`overlay-${card.id}-file-input`}
                    />
                  ) : null}
                </div>
                {primaryUrl ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
                    <input
                      value={primaryUrl}
                      readOnly
                      className="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                      aria-label="첨부 URL"
                    />
                    <a
                      href={primaryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                    >
                      입장
                    </a>
                  </div>
                ) : null}
                <CardAttachments
                  attachments={attachmentItems}
                  mode={teacherActions ? "teacher" : readOnly ? "share" : "student"}
                  disabledReason="이 화면에서는 첨부 제거를 지원하지 않아요."
                  emptyLabel="아직 자료가 없어요."
                  className="rounded-md border border-gray-200 bg-white p-3"
                  stopPropagation={false}
                />
                {card.files && card.files.length > 0 ? (
                  <ul className="space-y-3">
                    {card.files.map((file) => (
                      <li
                        key={file.id}
                        className="rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            {isImageType(file.contentType) ? (
                              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                IMG
                              </span>
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                {getFileExtension(file.filename)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {file.filename}
                              </p>
                              <p className="text-xs text-gray-500">
                                {file.sizeBytes ? formatFileSize(file.sizeBytes) : ""}
                                {file.contentType ? ` · ${file.contentType}` : ""}
                              </p>
                            </div>
                          </div>
                          <a
                            href={file.downloadUrl}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                            aria-label={`${file.filename} 다운로드`}
                          >
                            다운로드
                          </a>
                        </div>
                        {isImageType(file.contentType) ? (
                          <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
                            <Image
                              src={file.downloadUrl}
                              alt={file.filename}
                              width={1600}
                              height={900}
                              unoptimized
                              className="max-h-80 w-full object-contain"
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {card.externalAttachments && card.externalAttachments.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">외부 링크</p>
                    <ul className="space-y-2">
                      {card.externalAttachments.map((file, index) => (
                        <li
                          key={`${card.id}-external-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2"
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                {getFileExtension(file.filename)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">
                                  {file.filename}
                                </p>
                                {file.byteSize ? (
                                  <p className="text-xs text-gray-500">
                                    {formatFileSize(file.byteSize)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {file.downloadPath ? (
                              <a
                                href={file.downloadPath}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${file.filename} 열기`}
                              >
                                열기
                              </a>
                            ) : null}
                          </div>
                          {file.downloadPath && isImageType(file.contentType) ? (
                            <div className="mt-3 w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                              <Image
                                src={file.downloadPath}
                                alt={file.filename}
                                width={1600}
                                height={900}
                                unoptimized
                                className="max-h-80 w-full object-contain"
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!card.files?.length && !card.externalAttachments?.length ? (
                  <EmptyState
                    title="아직 자료가 없어요."
                    description="필요한 자료를 업로드해 학생들에게 공유해 보세요."
                    action={
                      teacherActions && !teacherActions.writeLocked ? (
                        <label
                          htmlFor={`overlay-${card.id}-file-input`}
                          className="inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                        >
                          파일 추가
                        </label>
                      ) : null
                    }
                  />
                ) : null}
              </div>
            </>
          ) : isFetching ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-24 w-full bg-gray-100" />
              <SkeletonBlock className="h-10 w-full bg-gray-100" />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-white/90 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => previousId && updateCardParam(previousId)}
              disabled={!canNavigate || !previousId}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              이전 카드
            </button>
            <button
              type="button"
              onClick={() => nextId && updateCardParam(nextId)}
              disabled={!canNavigate || !nextId}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              다음 카드
            </button>
          </div>
          {teacherActions ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span>배경색</span>
              <div className="flex flex-wrap items-center gap-1">
                {CARD_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.token}
                    type="button"
                    onClick={() =>
                      updateCardColor(
                        teacherActions,
                        card?.id ?? "",
                        option.token,
                        card?.cardColorToken ?? "default",
                        router,
                      )
                    }
                    disabled={teacherActions.writeLocked || !card}
                    className={`h-5 w-5 rounded-full border border-gray-200 ${
                      getCardColorClass(option.token)
                    } ${
                      card?.cardColorToken === option.token
                        ? "ring-2 ring-gray-400"
                        : ""
                    }`}
                    aria-label={`${option.label} 배경색 선택`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type CardActionButtonProps = {
  card: CardDetailOverlayCard;
  disabled?: boolean;
};

type ActionState = {
  pending: boolean;
  error: string | null;
};

function CardActionButtons({ card, disabled = false }: CardActionButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ pending: false, error: null });
  const actionErrorFallback = "요청을 처리하지 못했습니다.";

  const runAction = async (action: () => Promise<Response>) => {
    if (disabled) return;

    try {
      setState({ pending: true, error: null });
      const response = await action();
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setState({
          pending: false,
          error: safeErrorMessage(typeof result.error === "string" ? new Error(result.error) : result.error, {
            fallback: actionErrorFallback,
          }),
        });
        return;
      }

      router.refresh();
    } catch (error) {
      setState({
        pending: false,
        error: safeErrorMessage(error, { fallback: actionErrorFallback }),
      });
      return;
    }

    setState({ pending: false, error: null });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(routes.api.v1("dashboard", "cards", card.id, "visibility"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hidden: !card.isHidden }),
              }),
            )
          }
          disabled={disabled || state.pending}
          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {card.isHidden ? "복구" : "숨김"}
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(routes.api.v1("dashboard", "cards", card.id, "pin"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinned: !card.isPinned }),
              }),
            )
          }
          disabled={disabled || state.pending}
          className="rounded-md border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-amber-300"
        >
          {card.isPinned ? "핀 해제" : "핀"}
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(routes.api.v1("dashboard", "cards", card.id, "feature"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featured: !card.isFeatured }),
              }),
            )
          }
          disabled={disabled || state.pending}
          className="rounded-md border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-purple-300"
        >
          {card.isFeatured ? "대표 해제" : "대표"}
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(() =>
              fetch(routes.api.v1("dashboard", "cards", card.id), {
                method: "DELETE",
              }),
            )
          }
          disabled={disabled || state.pending}
          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
        >
          삭제
        </button>
      </div>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </div>
  );
}

async function updateCardColor(
  teacherActions: TeacherActions,
  cardId: string,
  token: CardColorToken,
  currentToken: CardColorToken,
  router: ReturnType<typeof useRouter>,
) {
  if (!cardId || teacherActions.writeLocked || token === currentToken) {
    return;
  }

  const response = await fetch(routes.api.v1("dashboard", "cards", cardId, "color"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, boardId: teacherActions.boardId, wallId: teacherActions.wallId }),
  });
  if (!response.ok) {
    return;
  }
  router.refresh();
}
