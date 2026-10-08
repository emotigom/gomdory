"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import TurnstileWidget from "@/app/_components/TurnstileWidget";
import { uploadFileToCard } from "@/app/dashboard/boards/[boardId]/walls/[wallId]/uploadClient";
import type { StudentBoardModel } from "@/lib/student/boardModel";
import type {
  StudentRuntimeAuthority,
  StudentRuntimeClassState,
} from "@/lib/student/boardSyncContract";
import { getOrCreateStudentDeviceId } from "@/lib/student/deviceId";
import { isAllowedCardAttachmentContentType } from "@/lib/data/safeAttachmentTypes";
import { routes } from "@/lib/standards/routes";
import {
  validateCardAttachmentUploadPolicy,
  type CardAttachmentPolicyRejection,
} from "@/lib/uploads/cardAttachmentPolicy";
import { normalizeUploadContentType } from "@/lib/uploads/contentType";
import {
  dispatchStudentRuntimeAuthority,
  isStudentRuntimeAuthorityEventDetail,
  STUDENT_RUNTIME_AUTHORITY_EVENT,
  StudentSmartComposeContext,
} from "./StudentComposeContext";
import {
  composerFeedbackMessages,
  composerFeedbackSemantics,
  isTerminalComposerSuccess,
  makeComposerFeedback,
} from "@/lib/student/cardComposerFeedback.mjs";

const MAX_STUDENT_TEXT_LENGTH = 500;
const COMPOSER_WIDTH = 380;
const COMPOSER_HEIGHT = 620;
const COMPOSER_VIEWPORT_GAP = 12;
const COMPOSER_TOP_SAFE_GAP = 88;
const BACKGROUND_CLICK_MOVE_THRESHOLD_PX = 8;
const SMART_COMPOSE_OPEN_EVENT = "student-board:open-smart-compose";
const STUDENT_BOARD_SYNC_EVENT = "gom:student-board-sync-requested";
const WALL_CONTAINER_SELECTOR =
  '[data-scroll="wall-column"][data-wall-id], [data-wall-column-runtime="WallColumn-v3"][data-wall-id]';
const EMPTY_COMPOSE_ZONE_SELECTOR =
  '[data-section-empty-area="true"], [data-board-empty-area="true"], [data-cards-list]';
const STUDENT_UPLOAD_FAILURE_MESSAGE =
  "첨부 업로드에 실패했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.";

type StudentColumn = NonNullable<StudentBoardModel["columns"]>[number];

type ComposerState = {
  key: string;
  wallId: string;
  wallTitle: string;
  x: number;
  y: number;
  files: File[];
};

type ComposerFeedback =
  | { kind: "idle"; eventKey: null; message: null }
  | { kind: "pending" | "success" | "partial-success" | "retryable-error" | "terminal-error"; eventKey: string; message: string };

const IDLE_COMPOSER_FEEDBACK: ComposerFeedback = { kind: "idle", eventKey: null, message: null };

type DropTarget = {
  wallId: string;
  wallTitle: string;
  rect: DOMRect;
};

type BackgroundPointerStart = {
  pointerId: number;
  clientX: number;
  clientY: number;
  wallId: string;
  wallTitle: string;
};

type StudentGuestBoardSmartLayerProps = {
  model: StudentBoardModel;
  shareCode: string;
  viewerName?: string | null;
  shareWriteEnabled: boolean;
  classState: StudentRuntimeClassState;
  fixtureCardCreationEnabled?: boolean;
  children: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getComposerViewportPosition(x: number, y: number) {
  if (typeof window === "undefined") return { left: x, top: y };
  const maxLeft = Math.max(COMPOSER_VIEWPORT_GAP, window.innerWidth - COMPOSER_WIDTH - COMPOSER_VIEWPORT_GAP);
  const maxTop = Math.max(COMPOSER_VIEWPORT_GAP, window.innerHeight - COMPOSER_HEIGHT - COMPOSER_VIEWPORT_GAP);
  const minTop = Math.min(COMPOSER_TOP_SAFE_GAP, maxTop);
  return {
    left: clamp(x, COMPOSER_VIEWPORT_GAP, maxLeft),
    top: clamp(y, minTop, maxTop),
  };
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function hasSelectedText() {
  if (typeof window === "undefined") return false;
  return Boolean(window.getSelection()?.toString().trim());
}

function isPrimaryPointer(event: PointerEvent) {
  if (!event.isPrimary) return false;
  if (event.pointerType === "mouse" && event.button !== 0) return false;
  return true;
}

function getPointerMoveDistance(start: Pick<BackgroundPointerStart, "clientX" | "clientY">, event: PointerEvent) {
  return Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
}

function isBlockedComposeTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;
  return Boolean(
    target.closest(
      [
        "[data-card-id]",
        "[data-card]",
        "[data-interactive='true']",
        "[data-no-compose-open]",
        "[data-smart-student-composer='true']",
        "[data-floating='minimap']",
        "[data-testid='board-minimap-shell']",
        "[data-testid='student-topbar-root']",
        "[role='button']",
        "[role='menu']",
        "[role='menuitem']",
        "[role='dialog']",
        "a",
        "button",
        "input",
        "label",
        "textarea",
        "select",
        "[contenteditable='true']",
        ".card",
        ".gallery-card",
        ".featured-link",
        ".link-placeholder",
      ].join(","),
    ),
  );
}

function getEmptyComposeZone(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;
  if (isBlockedComposeTarget(target)) return null;
  return target.closest<HTMLElement>(EMPTY_COMPOSE_ZONE_SELECTOR);
}

function getEmptyBoardWallFromTarget(target: EventTarget | null, columnsById: Map<string, StudentColumn>) {
  if (!(target instanceof HTMLElement)) return null;
  if (!target.closest('[data-public-guest-board="modern-hud"]')) return null;
  const emptyZone = getEmptyComposeZone(target);
  if (!emptyZone) return null;

  const wallElement = emptyZone.closest<HTMLElement>(WALL_CONTAINER_SELECTOR) ?? target.closest<HTMLElement>(WALL_CONTAINER_SELECTOR);
  const wallId = wallElement?.dataset.wallId ?? null;
  if (!wallId) return null;
  const column = columnsById.get(wallId);
  if (!column || column.studentWriteEnabled === false) return null;
  return {
    wallId,
    wallTitle: column.title,
  };
}

function isFilesDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function getFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer?.files?.length) return [];
  return Array.from(dataTransfer.files);
}

function isAllowedComposerFile(file: File) {
  return isAllowedCardAttachmentContentType(
    normalizeUploadContentType({ contentType: file.type, filename: file.name }),
  );
}

function getAttachmentOnlyCardText(files: File[]) {
  const hasImage = files.some((file) =>
    normalizeUploadContentType({ contentType: file.type, filename: file.name }).startsWith("image/"),
  );
  return hasImage ? "사진을 올렸어요!" : "자료를 올렸어요.";
}

function validateComposerFiles(files: File[]) {
  const accepted: File[] = [];
  const rejected: Array<{ file: File; reason: CardAttachmentPolicyRejection }> = [];

  for (const file of files) {
    const reason = validateCardAttachmentUploadPolicy({
      filename: file.name,
      contentType: normalizeUploadContentType({ contentType: file.type, filename: file.name }),
      sizeBytes: file.size,
    });
    if (reason) {
      rejected.push({ file, reason });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}

function getPreflightRejectionMessage(rejected: Array<{ reason: CardAttachmentPolicyRejection }>) {
  const firstReason = rejected[0]?.reason;
  if (!firstReason) return null;
  if (rejected.length === 1) return firstReason.message;
  return `${rejected.length}개 파일을 첨부할 수 없어요. ${firstReason.message}`;
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 20);
}

async function writeJsonIgnoreFailure(
  url: string,
  method: "DELETE" | "PATCH",
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return true;
    console.warn("[student.quick-card] cleanup_failed", { method, status: response.status });
  } catch (error) {
    console.warn("[student.quick-card] cleanup_failed", {
      method,
      message: error instanceof Error ? error.message : "cleanup_failed",
    });
  }
  return false;
}

function SmartComposer({
  state,
  initialName,
  turnstileToken,
  setTurnstileToken,
  submitting,
  feedback,
  writeLockedMessage,
  fixtureCardCreationEnabled,
  onClose,
  onSubmit,
}: {
  state: ComposerState;
  initialName: string;
  turnstileToken: string | null;
  setTurnstileToken: (token: string | null) => void;
  submitting: boolean;
  feedback: ComposerFeedback;
  writeLockedMessage: string | null;
  fixtureCardCreationEnabled: boolean;
  onClose: () => void;
  onSubmit: (input: { text: string; authorName: string; files: File[] }) => void;
}) {
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState(initialName);
  const [files, setFiles] = useState(state.files);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const feedbackSemantics = composerFeedbackSemantics(feedback.kind);

  useEffect(() => {
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [state.key]);

  useEffect(() => {
    setFiles(state.files);
  }, [state.files, state.key]);

  useEffect(() => {
    if ((feedback.kind === "retryable-error" || feedback.kind === "terminal-error") && !submitting) {
      const frame = requestAnimationFrame(() => textareaRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [feedback.kind, submitting]);

  const addFiles = (nextFiles: File[]) => {
    const allowed = nextFiles.filter(isAllowedComposerFile);
    if (!allowed.length) return;
    setFiles((prev) => [...prev, ...allowed]);
  };

  return (
    <div
      data-testid="student-card-composer"
      data-smart-student-composer="true"
      className="fixed z-[70] flex max-h-[calc(100dvh-2rem)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-4 text-slate-100 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      style={{
        left: state.x,
        top: state.y,
        maxHeight: `calc(100dvh - ${state.y}px - max(12px, env(safe-area-inset-bottom)))`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        addFiles(getFiles(event.dataTransfer));
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">빠른 카드 작성</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{state.wallTitle}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-cyan-300/20 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-cyan-300/10"
          disabled={submitting}
        >
          닫기
        </button>
      </header>

      <div
        data-smart-student-composer-body="true"
        className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]"
      >
        {writeLockedMessage ? (
          <p className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            {writeLockedMessage}
          </p>
        ) : null}

        <div className={`${writeLockedMessage ? "mt-3 " : ""}space-y-3`}>
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          className="h-10 w-full rounded-xl border border-cyan-300/20 bg-slate-900 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-200"
          placeholder="닉네임 선택"
          maxLength={20}
          disabled={submitting || Boolean(writeLockedMessage)}
        />
        <textarea
          ref={textareaRef}
          data-testid="student-card-composer-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-24 w-full resize-y rounded-xl border border-cyan-300/20 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-200"
          placeholder={files.length ? "파일 설명을 덧붙일 수 있어요" : "내용을 입력하거나 파일을 끌어다 놓으세요"}
          maxLength={MAX_STUDENT_TEXT_LENGTH}
          disabled={submitting || Boolean(writeLockedMessage)}
          aria-invalid={feedback.kind === "retryable-error" || feedback.kind === "terminal-error" ? true : undefined}
          aria-describedby={feedbackSemantics?.role === "alert" ? "student-card-composer-error" : undefined}
        />
        <div className="rounded-xl border border-dashed border-cyan-300/25 bg-cyan-300/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-cyan-100">첨부</p>
            <label className="cursor-pointer rounded-lg border border-cyan-300/25 px-2.5 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
              파일 선택
              <input
                type="file"
                multiple
                className="hidden"
                disabled={submitting || Boolean(writeLockedMessage)}
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          {files.length ? (
            <div className="mt-2 space-y-1">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300">
                  <span className="min-w-0 truncate">{file.name} · {formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    className="shrink-0 font-semibold text-slate-400 hover:text-white"
                    disabled={submitting}
                  >
                    제거
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">PC 파일을 이 카드 위에 놓아도 됩니다.</p>
          )}
        </div>

        <div className="rounded-xl border border-cyan-300/15 bg-slate-900/70 px-3 py-2">
          <p className="mb-2 text-xs font-semibold text-slate-300">스팸 방지 인증</p>
          {fixtureCardCreationEnabled ? <p data-testid="q2-fixture-turnstile-completion">인증 완료</p> : <TurnstileWidget onToken={setTurnstileToken} showErrorText={false} action="share_card_create" cData="share-card-create" />}
          <p className="mt-1 text-[11px] text-slate-500">
            {turnstileToken ? "인증 완료" : "인증이 완료되면 제출할 수 있어요."}
          </p>
        </div>

        <p
          id="student-card-composer-status"
          data-testid="student-card-composer-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-cyan-100"
        >
          {feedbackSemantics?.role === "status" ? feedback.message : ""}
        </p>
        {feedbackSemantics?.role === "alert" ? (
          <p
            id="student-card-composer-error"
            data-testid="student-card-composer-error"
            role="alert"
            aria-atomic="true"
            className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
          >
            {feedback.message}
          </p>
        ) : null}
        </div>
      </div>

      <footer
        data-smart-student-composer-footer="true"
        className="-mx-4 -mb-4 mt-3 shrink-0 border-t border-cyan-300/15 bg-slate-950/95 p-4"
      >
        <button
          type="button"
          data-testid="student-card-composer-submit"
          onClick={() => onSubmit({ text, authorName, files })}
          disabled={submitting || Boolean(writeLockedMessage) || !turnstileToken || (!text.trim() && files.length === 0)}
          className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {submitting ? "올리는 중..." : files.length ? "파일 카드 올리기" : "카드 작성"}
        </button>
      </footer>
    </div>
  );
}

export default function StudentGuestBoardSmartLayer({
  model,
  shareCode,
  viewerName,
  shareWriteEnabled,
  classState,
  fixtureCardCreationEnabled = false,
  children,
}: StudentGuestBoardSmartLayerProps) {
  const clientId = useMemo(() => getOrCreateStudentDeviceId(), []);
  const columns = useMemo(() => model.columns ?? [], [model.columns]);
  const [runtimeAuthority, setRuntimeAuthority] = useState<StudentRuntimeAuthority>(() => ({
    shareWriteEnabled,
    classState,
  }));
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  useEffect(() => { if (fixtureCardCreationEnabled) setTurnstileToken("q2-fixture"); }, [fixtureCardCreationEnabled]);
  const [submitting, setSubmitting] = useState(false);
  const [composeHandlerReady, setComposeHandlerReady] = useState(false);
  const [feedback, setFeedback] = useState<ComposerFeedback>(IDLE_COMPOSER_FEEDBACK);
  const submitGuardRef = useRef(false);
  const operationRef = useRef(0);
  const openComposerFromBoardRef = useRef<(wallId: string) => void>(() => {});
  const backgroundPointerStartRef = useRef<BackgroundPointerStart | null>(null);

  useEffect(() => {
    setRuntimeAuthority({ shareWriteEnabled, classState });
  }, [classState, shareWriteEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRuntimeAuthority = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isStudentRuntimeAuthorityEventDetail(detail) || detail.shareCode !== shareCode) return;
      setRuntimeAuthority({
        shareWriteEnabled: detail.shareWriteEnabled,
        classState: detail.classState,
      });
    };
    window.addEventListener(STUDENT_RUNTIME_AUTHORITY_EVENT, handleRuntimeAuthority);
    return () => window.removeEventListener(STUDENT_RUNTIME_AUTHORITY_EVENT, handleRuntimeAuthority);
  }, [shareCode]);

  const writeLockedMessage = runtimeAuthority.classState === "ended"
    ? "오늘 수업은 종료되었어요. 다음에 다시 만나요!"
    : !runtimeAuthority.shareWriteEnabled
      ? "지금은 글쓰기가 잠겨있습니다."
      : null;

  const initialName = useMemo(() => {
    if (typeof window === "undefined") return normalizeName(viewerName);
    return normalizeName(window.localStorage.getItem("student-card-author-name")) || normalizeName(viewerName);
  }, [viewerName]);

  const columnsById = useMemo(() => {
    const map = new Map<string, StudentColumn>();
    columns.forEach((column) => map.set(column.key, column));
    return map;
  }, [columns]);

  const findWallAtPoint = useCallback((x: number, y: number) => {
    if (typeof document === "undefined") return null;
    const element = document.elementFromPoint(x, y);
    const wallElement = element instanceof HTMLElement
      ? element.closest<HTMLElement>('[data-wall-id]')
      : null;
    if (!wallElement) return null;
    const wallId = wallElement.dataset.wallId ?? null;
    if (!wallId) return null;
    const column = columnsById.get(wallId);
    if (!column) return null;
    return {
      wallId,
      wallTitle: column.title,
      rect: wallElement.getBoundingClientRect(),
      studentWriteEnabled: column.studentWriteEnabled ?? true,
    };
  }, [columnsById]);

  const openComposer = useCallback((input: {
    wallId: string;
    wallTitle: string;
    x: number;
    y: number;
    files?: File[];
  }) => {
    if (writeLockedMessage) return;
    setFeedback(IDLE_COMPOSER_FEEDBACK);
    setTurnstileToken(fixtureCardCreationEnabled ? "q2-fixture" : null);
    const position = getComposerViewportPosition(input.x, input.y);
    setComposer({
      key: `${input.wallId}:${Date.now()}`,
      wallId: input.wallId,
      wallTitle: input.wallTitle,
      x: position.left,
      y: position.top,
      files: input.files ?? [],
    });
  }, [fixtureCardCreationEnabled, writeLockedMessage]);

  const closeComposer = useCallback(() => {
    if (submitting) return;
    setComposer(null);
    setTurnstileToken(null);
    setFeedback(IDLE_COMPOSER_FEEDBACK);
  }, [submitting]);

  const openComposerFromBoard = useCallback((wallId: string) => {
    if (writeLockedMessage) return;
    const column = columnsById.get(wallId);
    if (!column || column.studentWriteEnabled === false) return;
    const wallElement = document.querySelector<HTMLElement>(
      `[data-scroll="wall-column"][data-wall-id="${wallId}"], [data-wall-column-runtime="WallColumn-v3"][data-wall-id="${wallId}"]`,
    );
    const rect = wallElement?.getBoundingClientRect();
    openComposer({
      wallId,
      wallTitle: column.title,
      x: rect ? rect.left + 24 : 96,
      y: rect ? rect.top + 72 : 140,
    });
  }, [columnsById, openComposer, writeLockedMessage]);

  // Keep the provider value stable across reset/reload renders while always
  // forwarding to the current model-aware callback. This prevents a mounted
  // board CTA from retaining a callback from an earlier SmartLayer lifecycle.
  openComposerFromBoardRef.current = openComposerFromBoard;
  const openStudentComposer = useCallback((wallId: string) => {
    openComposerFromBoardRef.current(wallId);
  }, []);

  useEffect(() => {
    const resetPointerStart = () => {
      backgroundPointerStartRef.current = null;
    };

    const handlePointerDownCapture = (event: PointerEvent) => {
      resetPointerStart();
      if (writeLockedMessage) return;
      if (composer) return;
      if (event.defaultPrevented) return;
      if (!isPrimaryPointer(event)) return;
      const wall = getEmptyBoardWallFromTarget(event.target, columnsById);
      if (!wall) return;

      backgroundPointerStartRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        wallId: wall.wallId,
        wallTitle: wall.wallTitle,
      };
    };

    const handlePointerUpCapture = (event: PointerEvent) => {
      const start = backgroundPointerStartRef.current;
      resetPointerStart();
      if (!start) return;
      if (writeLockedMessage) return;
      if (composer) return;
      if (event.defaultPrevented) return;
      if (!isPrimaryPointer(event)) return;
      if (event.pointerId !== start.pointerId) return;
      if (getPointerMoveDistance(start, event) > BACKGROUND_CLICK_MOVE_THRESHOLD_PX) return;
      if (hasSelectedText()) return;

      const wall = getEmptyBoardWallFromTarget(event.target, columnsById);
      if (!wall || wall.wallId !== start.wallId) return;

      event.preventDefault();
      event.stopPropagation();
      openComposer({
        wallId: start.wallId,
        wallTitle: start.wallTitle,
        x: event.clientX + 12,
        y: event.clientY + 12,
      });
    };

    document.addEventListener("pointerdown", handlePointerDownCapture, true);
    document.addEventListener("pointerup", handlePointerUpCapture, true);
    document.addEventListener("pointercancel", resetPointerStart, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownCapture, true);
      document.removeEventListener("pointerup", handlePointerUpCapture, true);
      document.removeEventListener("pointercancel", resetPointerStart, true);
    };
  }, [columnsById, composer, openComposer, writeLockedMessage]);

  useLayoutEffect(() => {
    const handleSmartComposeOpen = (event: Event) => {
      if (writeLockedMessage) return;
      const detail = (event as CustomEvent<{
        wallId?: unknown;
        clientX?: unknown;
        clientY?: unknown;
      }>).detail;
      const wallId = typeof detail?.wallId === "string" ? detail.wallId : "";
      if (!wallId) return;
      const column = columnsById.get(wallId);
      if (!column || column.studentWriteEnabled === false) return;
      const escapedWallId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(wallId)
        : wallId.replace(/"/g, '\\"');
      const wallElement = typeof document === "undefined"
        ? null
        : document.querySelector<HTMLElement>(
            `[data-scroll="wall-column"][data-wall-id="${escapedWallId}"], [data-wall-column-runtime="WallColumn-v3"][data-wall-id="${escapedWallId}"]`,
          );
      const rect = wallElement?.getBoundingClientRect();
      const x = typeof detail?.clientX === "number"
        ? detail.clientX + 12
        : rect
          ? rect.left + 24
          : 96;
      const y = typeof detail?.clientY === "number"
        ? detail.clientY + 12
        : rect
          ? rect.top + 72
          : 140;

      openComposer({
        wallId,
        wallTitle: column.title,
        x,
        y,
      });
    };

    window.addEventListener(SMART_COMPOSE_OPEN_EVENT, handleSmartComposeOpen);
    return () => window.removeEventListener(SMART_COMPOSE_OPEN_EVENT, handleSmartComposeOpen);
  }, [columnsById, openComposer, writeLockedMessage]);

  useLayoutEffect(() => {
    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (writeLockedMessage) return;
      if (isEditableTarget(event.target)) return;
      if (event.key.toLowerCase() !== "n") return;
      const firstWritable = columns.find((column) => column.studentWriteEnabled !== false);
      if (!firstWritable) return;
      event.preventDefault();
      event.stopPropagation();
      openComposer({
        wallId: firstWritable.key,
        wallTitle: firstWritable.title,
        x: 96,
        y: 140,
      });
    };

    document.addEventListener("keydown", handleKeyDownCapture, true);
    setComposeHandlerReady(true);
    return () => {
      setComposeHandlerReady(false);
      document.removeEventListener("keydown", handleKeyDownCapture, true);
    };
  }, [columns, openComposer, writeLockedMessage]);

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (writeLockedMessage || !isFilesDrag(event)) return;
      const wall = findWallAtPoint(event.clientX, event.clientY);
      if (!wall || wall.studentWriteEnabled === false) {
        setDropTarget(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setDropTarget({ wallId: wall.wallId, wallTitle: wall.wallTitle, rect: wall.rect });
    };

    const handleDragLeave = (event: DragEvent) => {
      if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
        setDropTarget(null);
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (writeLockedMessage || !isFilesDrag(event)) return;
      const files = getFiles(event.dataTransfer).filter(isAllowedComposerFile);
      const wall = findWallAtPoint(event.clientX, event.clientY) ?? dropTarget;
      setDropTarget(null);
      if (!wall || files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      openComposer({
        wallId: wall.wallId,
        wallTitle: wall.wallTitle,
        x: wall.rect.left + 24,
        y: wall.rect.top + 72,
        files,
      });
    };

    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("dragleave", handleDragLeave, true);
    document.addEventListener("drop", handleDrop, true);
    return () => {
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("dragleave", handleDragLeave, true);
      document.removeEventListener("drop", handleDrop, true);
    };
  }, [dropTarget, findWallAtPoint, openComposer, writeLockedMessage]);

  const submitComposer = useCallback(async (input?: { text: string; authorName: string; files: File[] }) => {
    if (!composer || submitting || submitGuardRef.current || writeLockedMessage) return;
    const operation = ++operationRef.current;
    const setOperationFeedback = (kind: Exclude<ComposerFeedback["kind"], "idle">, message: string) => {
      setFeedback(makeComposerFeedback(kind, operation, message));
    };
    if (!turnstileToken) {
      setOperationFeedback("retryable-error", "스팸 방지 인증을 완료해주세요.");
      return;
    }

    const text = (input?.text ?? "").trim();
    const authorName = normalizeName(input?.authorName ?? initialName);
    const selectedFiles = input?.files ?? composer.files;
    if (!text && selectedFiles.length === 0) {
      setOperationFeedback("retryable-error", "내용 또는 첨부 파일이 필요합니다.");
      return;
    }
    if (text.length > MAX_STUDENT_TEXT_LENGTH) {
      setOperationFeedback("retryable-error", `카드 내용은 ${MAX_STUDENT_TEXT_LENGTH}자 이내로 입력해주세요.`);
      return;
    }

    const preflight = validateComposerFiles(selectedFiles);
    const files = preflight.accepted;
    const preflightMessage = getPreflightRejectionMessage(preflight.rejected);
    if (selectedFiles.length > 0 && files.length === 0) {
      setOperationFeedback("retryable-error", preflightMessage ?? "첨부할 수 있는 파일이 없습니다.");
      return;
    }

    submitGuardRef.current = true;
    setSubmitting(true);
    setOperationFeedback("pending", composerFeedbackMessages.creating);

    try {
      const response = await fetch(routes.api.v1("share", shareCode, "walls", composer.wallId, "cards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || getAttachmentOnlyCardText(files),
          authorName: authorName || undefined,
          turnstileToken,
          clientId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string | { code?: string; message?: string };
        cardId?: string;
      } | null;
      const errorMessage = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
      const errorCode = typeof payload?.error === "string" ? payload.error : payload?.error?.code;

      if (response.status === 429 || errorMessage === "too_fast" || errorCode === "RATE_LIMITED") {
        throw new Error("잠시만요! 10초 후에 다시 작성할 수 있어요.");
      }
      if (!response.ok || !payload?.cardId) {
        if (
          response.status === 403 &&
          (errorCode === "CLASS_ENDED" || errorMessage === "class_ended")
        ) {
          dispatchStudentRuntimeAuthority({
            shareCode,
            shareWriteEnabled: runtimeAuthority.shareWriteEnabled,
            classState: "ended",
          });
          throw new Error("오늘 수업은 종료되었어요. 다음에 다시 만나요!");
        }
        throw new Error(errorMessage ?? "카드 작성에 실패했습니다.");
      }

      let attachmentPartial = preflight.rejected.length > 0;
      let finalizedAttachmentCount = 0;
      if (files.length > 0) {
        setOperationFeedback("pending", composerFeedbackMessages.uploading);
        const uploadedAttachments: Array<{
          id: string;
          type: "file";
          label: string;
          url: string;
          contentType: string;
        }> = [];
        const uploadFailures: string[] = [];
        for (const file of files) {
          const uploadResult = await uploadFileToCard(payload.cardId, file, {
            initiateUrl: routes.api.v1("share", shareCode, "cards", payload.cardId, "files", "initiate"),
            finalizeUrl: (fileId) => routes.api.v1("share", shareCode, "files", fileId, "finalize"),
            deleteUrl: (fileId) => routes.api.v1("share", shareCode, "files", fileId, "delete"),
            initiateBodyExtras: { clientId },
            finalizeBody: { clientId },
            deleteBody: { clientId },
          });
          if (!uploadResult.ok) {
            uploadFailures.push(uploadResult.error || STUDENT_UPLOAD_FAILURE_MESSAGE);
            continue;
          }
          uploadedAttachments.push({
            id: uploadResult.fileId,
            type: "file",
            label: file.name,
            url: routes.api.v1("share", shareCode, "files", uploadResult.fileId, "download"),
            contentType: normalizeUploadContentType({ contentType: file.type, filename: file.name }),
          });
        }
        if (uploadedAttachments.length > 0) {
          window.dispatchEvent(new CustomEvent("gom:student-card-attachments-finalized", {
            detail: {
              cardId: payload.cardId,
              wallId: composer.wallId,
              attachments: uploadedAttachments,
            },
          }));
        }
        finalizedAttachmentCount = uploadedAttachments.length;

        if (uploadFailures.length === files.length) {
          if (!text) {
            const cardUrl = routes.api.v1("share", shareCode, "cards", payload.cardId);
            const rolledBack = await writeJsonIgnoreFailure(cardUrl, "DELETE", { clientId });
            if (!rolledBack) {
              await writeJsonIgnoreFailure(cardUrl, "PATCH", {
                clientId,
                text: "첨부 업로드에 실패했어요. 다시 시도해 주세요.",
              });
            }
            window.dispatchEvent(new Event(STUDENT_BOARD_SYNC_EVENT));
            setOperationFeedback(
              rolledBack ? "retryable-error" : "terminal-error",
              rolledBack ? uploadFailures[0] || STUDENT_UPLOAD_FAILURE_MESSAGE : composerFeedbackMessages.terminal,
            );
            return;
          }
          attachmentPartial = true;
        } else if (uploadFailures.length > 0) {
          attachmentPartial = true;
        }
      }

      if (authorName) {
        window.localStorage.setItem("student-card-author-name", authorName);
      }
      const terminalFeedbackKind = attachmentPartial
        ? "partial-success"
        : isTerminalComposerSuccess({
        cardId: payload.cardId,
        hasFiles: files.length > 0,
        finalizedAttachments: finalizedAttachmentCount,
        selectedAttachments: files.length,
      })
          ? "success"
          : "partial-success";
      if (terminalFeedbackKind === "success") {
        setOperationFeedback("success", files.length ? composerFeedbackMessages.fileSuccess : composerFeedbackMessages.success);
      } else {
        setOperationFeedback("partial-success", composerFeedbackMessages.partial);
      }
      setComposer(null);
      setTurnstileToken(null);
      window.dispatchEvent(new Event(STUDENT_BOARD_SYNC_EVENT));
    } catch (submitError) {
      setOperationFeedback("retryable-error", submitError instanceof Error ? submitError.message : composerFeedbackMessages.retryable);
    } finally {
      setSubmitting(false);
      submitGuardRef.current = false;
    }
  }, [
    clientId,
    composer,
    initialName,
    runtimeAuthority.shareWriteEnabled,
    shareCode,
    submitting,
    turnstileToken,
    writeLockedMessage,
  ]);

  return (
    <>
      <div
        data-testid="student-smart-layer"
        data-compose-handler-ready={composeHandlerReady ? "true" : "false"}
        className="contents"
      >
        {fixtureCardCreationEnabled ? <span data-testid="q2-fixture-turnstile" hidden>fixture turnstile complete</span> : null}
        <StudentSmartComposeContext.Provider value={openStudentComposer}>
          {children}
        </StudentSmartComposeContext.Provider>
      </div>
      {!composer && composerFeedbackSemantics(feedback.kind)?.role === "status" ? (
        <div
          data-testid="student-card-compose-result"
          data-feedback-event-key={feedback.eventKey}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-[80] flex w-fit max-w-[calc(100vw-24px)] -translate-x-1/2 items-start gap-3 rounded-xl border border-cyan-300/30 bg-slate-950/95 px-4 py-3 text-sm text-cyan-50 shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-sm sm:translate-x-0"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-cyan-100 underline underline-offset-2"
            onClick={() => setFeedback(IDLE_COMPOSER_FEEDBACK)}
          >
            닫기
          </button>
        </div>
      ) : null}
      {dropTarget ? (
        <div
          className="pointer-events-none fixed z-[65] rounded-3xl border-2 border-dashed border-cyan-200 bg-cyan-300/12 p-4 text-cyan-50 shadow-[0_0_42px_rgba(34,211,238,0.24)] backdrop-blur-sm"
          style={{
            left: dropTarget.rect.left + 8,
            top: dropTarget.rect.top + 8,
            width: Math.max(240, dropTarget.rect.width - 16),
            height: Math.max(160, dropTarget.rect.height - 16),
          }}
        >
          <div className="flex h-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-slate-950/50 px-6 text-center">
            <div>
              <p className="text-lg font-semibold">{dropTarget.wallTitle}에 파일 카드 만들기</p>
              <p className="mt-2 text-sm text-cyan-100/85">마우스를 놓으면 이 섹션에 카드가 생성됩니다.</p>
            </div>
          </div>
        </div>
      ) : null}
      {composer ? (
        <SmartComposer
          state={composer}
          initialName={initialName}
          turnstileToken={turnstileToken}
          setTurnstileToken={setTurnstileToken}
          submitting={submitting}
          feedback={feedback}
          writeLockedMessage={writeLockedMessage}
          fixtureCardCreationEnabled={fixtureCardCreationEnabled}
          onClose={closeComposer}
          onSubmit={submitComposer}
        />
      ) : null}
    </>
  );
}
