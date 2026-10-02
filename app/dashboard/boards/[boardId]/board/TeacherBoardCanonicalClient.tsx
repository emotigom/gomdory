"use client";

import type { CSSProperties, ChangeEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import LinkifiedText from "@/app/_components/LinkifiedText";
import MoreMenu from "@/app/_components/MoreMenu";
import ShareGuideModal from "@/app/dashboard/_components/ShareGuideModal";
import LessonActivityLauncher from "@/components/lesson-activities/LessonActivityLauncher";
import ThemeSelector from "@/components/theme/ThemeSelector";
import AiBingoTeacherSummary from "@/components/lesson-activities/AiBingoTeacherSummary";
import AiJudgmentSortTeacherSummary from "@/components/lesson-activities/AiJudgmentSortTeacherSummary";
import WebCodingLiteTeacherSummary from "@/components/lesson-activities/WebCodingLiteTeacherSummary";
import PythonStudioLiteTeacherSummary from "@/components/lesson-activities/PythonStudioLiteTeacherSummary";
import type { ActiveLessonSession } from "@/lib/lesson-activities/types";
import type { AiBingoTeacherSummary as AiBingoTeacherSummaryType, AiJudgmentSortTeacherSummary as AiJudgmentSortTeacherSummaryType, PythonStudioLiteTeacherSummary as PythonStudioLiteTeacherSummaryType, WebCodingLiteTeacherSummary as WebCodingLiteTeacherSummaryType } from "@/lib/lesson-activities/types";
import { buildStudentUrl } from "@/lib/http/publicLinks";
import { classifyVibeSubmission, type VibeSubmissionMode } from "@/lib/edu/vibe-coding/vibe-submission-classifier";
import { isVibeCodingLessonTemplateId } from "@/lib/edu/vibe-coding/lesson-03-04-ids";

import { uploadFileToCard } from "@/app/dashboard/boards/[boardId]/walls/[wallId]/uploadClient";
import { useSetDashboardChrome } from "@/app/dashboard/_components/DashboardChromeContext";
import { teacherAiCourseNewHref } from "@/lib/edu/teacherCourseRoutes";
import LessonKitLauncherPanel from "@/app/dashboard/boards/[boardId]/board/_components/LessonKitLauncherPanel";
import StudentAppSourceInspector from "@/app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector";
import GoogleDriveImportPanel from "@/app/dashboard/boards/[boardId]/board/_components/GoogleDriveImportPanel";
import { routes } from "@/lib/standards/routes";
import { scrollToCard } from "@/lib/board/scrollToCard";
import {
  TEACHER_CARD_DRAG_ACTIVATION_DELAY_MS,
  TEACHER_CARD_DRAG_MOVE_TOLERANCE_PX,
  calculateTeacherCardAutoScrollDelta,
  calculateTeacherCardDropPosition,
  isCardDragBlockedTarget,
  isTeacherCardDragPointerCandidate,
  type TeacherCardDragWallRect,
} from "@/lib/board/teacherCardDrag";
import {
  applyTeacherCardMoveOptimistic,
  isNoopTeacherCardMove,
} from "@/lib/board/teacherCardMoveOptimistic";
import { removeOptimisticAttachmentById } from "@/lib/cards/optimisticAttachments";
import { summarizeStudentSubmissions } from "@/lib/board/studentSubmissionSummary";
import { isFinalArtwork } from "@/lib/board/finalArtwork";
import {
  confirmTeacherBoardMutation,
  createTeacherBoardOperation,
  failTeacherBoardMutation,
  idleTeacherBoardMutationState,
  isStaleTeacherBoardVersion,
  reconcileTeacherBoardMutation,
  type TeacherBoardMutationKind,
  type TeacherBoardMutationState,
} from "@/lib/board/teacherBoardMutationState";
import {
  createTeacherCardMenuAnnouncement,
  type TeacherCardMenuAnnouncement,
} from "@/lib/board/teacherCardMenuAnnouncement";
import type { CardColorToken } from "@/lib/types/cards";
import StudentSubmissionStatusPanel from "./_components/StudentSubmissionStatusPanel";
import BoardBackupPanel from "./_components/BoardBackupPanel";
import {
  CARD_COLOR_OPTIONS,
  getCardColorToneClasses,
  normalizeCardColorTone,
} from "@/lib/ui/cardColors";
import {
  BOARD_THEME_PRESETS,
  DEFAULT_BOARD_THEME,
  resolveBoardThemeVars,
  type BoardThemeTokens,
  type BoardThemeVars,
} from "@/lib/ui/boardTheme";
import styles from "./TeacherBoardCanonicalClient.module.css";

type BoardAttachment = {
  id: string;
  attachmentId?: string | null;
  fileId?: string | null;
  boardFileId?: string | null;
  kind: "image" | "file" | "url" | "audio" | "video" | "document";
  label: string;
  url: string;
  contentType?: string | null;
  size?: number | null;
};

type AttachmentPreviewKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "url"
  | "file";

type WallCard = {
  id: string;
  owner_id?: string | null;
  author_nickname?: string | null;
  author_name?: string | null;
  author_type?: "teacher" | "student" | null;
  created_at?: string | null;
  position?: number | null;
  is_hidden?: boolean | null;
  hidden_at?: string | null;
  deleted_at?: string | null;
  text: string;
  card_color_token?: CardColorToken | null;
  attachments?: BoardAttachment[];
  tags?: { id: string; name: string; color: string | null }[];
};
type WallWithCards = {
  wall: { id: string; title: string; description: string | null };
  cards: WallCard[];
};
type UploadStatus = { uploading: boolean; error: string | null };
type AttachmentDeleteStatus = { deleting: boolean; error: string | null };
type TeacherCardDragSnapshot = {
  text: string;
  attachmentCount: number;
  colorToken?: CardColorToken | null;
};
type TeacherCardDragBaseState = {
  draggingCardId: string;
  sourceWallId: string;
  sourcePosition: number;
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  cardRect: { width: number; height: number; left: number; top: number };
  snapshot: TeacherCardDragSnapshot;
};
type TeacherCardDragState =
  | { phase: "idle" }
  | ({ phase: "pending" } & TeacherCardDragBaseState)
  | ({
      phase: "dragging";
      targetWallId: string;
      targetPosition: number;
    } & TeacherCardDragBaseState);
type Props = {
  boardId: string;
  boardTitle: string;
  boardDescription: string | null;
  walls: WallWithCards[];
  boardAccessCode: string | null;
  initialBoardTheme: BoardThemeTokens;
  initialBoardThemeVars: BoardThemeVars;
  collaborationSummary: { ownerLabel: string; memberCount: number | null };
  currentUserId: string;
  canDeleteCards: boolean;
  canOperateCards?: boolean;
  fixtureDataVersion?: number;
  fixtureMode?: "q2-b7" | "q2-b8" | "q2-b10" | null;
  initialActiveLessonSession: ActiveLessonSession | null;
  initialAiBingoSummary: AiBingoTeacherSummaryType | null;
  initialAiJudgmentSortSummary: AiJudgmentSortTeacherSummaryType | null;
  initialPythonStudioLiteSummary: PythonStudioLiteTeacherSummaryType | null;
  initialWebCodingLiteSummary: WebCodingLiteTeacherSummaryType | null;
};

const previewKindFromAttachment = (
  attachment: BoardAttachment,
): AttachmentPreviewKind => {
  if (attachment.kind === "url") return "url";
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  if (attachment.kind === "image" || contentType.startsWith("image/"))
    return "image";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("video/")) return "video";
  if (
    attachment.kind === "document" ||
    contentType.includes("pdf") ||
    contentType.startsWith("text/") ||
    contentType.includes("word") ||
    contentType.includes("spreadsheet") ||
    contentType.includes("presentation")
  ) {
    return "document";
  }
  return "file";
};

const cardColorTone = (token?: CardColorToken | null) =>
  normalizeCardColorTone(token);

const cardColorClass = (token?: CardColorToken | null) =>
  getCardColorToneClasses(token);

const cardMenuItemClass =
  "teacher-board-menu-item flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-100 transition hover:bg-cyan-300/10 focus:bg-cyan-300/10 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent";

const cardMenuDangerItemClass =
  "teacher-board-menu-danger flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 focus:bg-rose-500/10 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent";

const formatBytes = (size?: number | null) => {
  if (!size || size <= 0) return null;
  if (size < 1024) return `${size}B`;
  if (size < 1048576) return `${Math.round(size / 102.4) / 10}KB`;
  return `${Math.round(size / 104857.6) / 10}MB`;
};

type FocusTargetRef = { readonly current: HTMLElement | null };

const dialogFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

const dialogFocusableElements = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector)).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      !element.closest('[inert], [aria-hidden="true"]'),
  );

function AccessibleDialog({
  ariaLabelledBy,
  children,
  className,
  initialFocusRef,
  onClose,
  openerRef,
  testId,
}: {
  ariaLabelledBy: string;
  children: ReactNode;
  className: string;
  initialFocusRef?: FocusTargetRef;
  onClose: () => void;
  openerRef?: FocusTargetRef;
  testId?: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (restoreFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFocusFrameRef.current);
      restoreFocusFrameRef.current = null;
    }
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const openerAtMount = openerRef?.current ?? activeElement;
    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const initialTarget =
        initialFocusRef?.current ?? dialogFocusableElements(dialog)[0] ?? dialog;
      initialTarget.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      const opener = openerAtMount;
      restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
        restoreFocusFrameRef.current = null;
        if (
          !opener?.isConnected ||
          opener.closest('[inert], [aria-hidden="true"]')
        ) {
          return;
        }
        opener.focus();
      });
    };
  }, [initialFocusRef, openerRef]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
      tabIndex={-1}
      className={className}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function AttachmentViewer({
  attachment,
  onClose,
  openerRef,
}: {
  attachment: BoardAttachment;
  onClose: () => void;
  openerRef?: FocusTargetRef;
}) {
  const kind = previewKindFromAttachment(attachment);
  const stop = (event: MouseEvent) => event.stopPropagation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <AccessibleDialog
      ariaLabelledBy="attachment-viewer-title"
      className="fixed inset-0 z-[10040] bg-slate-950/60 p-4 sm:p-6"
      initialFocusRef={closeButtonRef}
      onClose={onClose}
      openerRef={openerRef}
    >
      <div
        className={`${styles.modalSheet} mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-2xl sm:flex-row`}
        onClick={stop}
      >
        <h2 id="attachment-viewer-title" className="sr-only">
          첨부 파일 보기: {attachment.label}
        </h2>
        <div className="flex min-h-[14rem] min-w-0 flex-1 items-center justify-center bg-[var(--theme-panel-strong)] p-4 sm:min-h-0 sm:p-6">
          {kind === "image" ? (
            <Image
              src={attachment.url}
              alt={attachment.label}
              width={1600}
              height={1000}
              className="max-h-full w-auto rounded-xl object-contain"
              unoptimized
            />
          ) : null}
          {kind === "audio" ? (
            <audio controls src={attachment.url} className="w-full max-w-3xl" />
          ) : null}
          {kind === "video" ? (
            <video
              controls
              src={attachment.url}
              className="max-h-full w-full rounded-xl bg-black"
            />
          ) : null}
          {kind === "document" ? (
            <div className="w-full max-w-2xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8 text-center shadow-sm">
              <p className="text-sm text-[var(--theme-text-muted)]">
                문서 미리보기는 안전한 새 창 열기를 사용하세요.
              </p>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-indigo-700 underline"
              >
                문서 열기
              </a>
            </div>
          ) : null}
          {kind === "url" ? (
            <div className="w-full max-w-3xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8 shadow-sm">
              <p className="text-sm text-[var(--theme-text-muted)]">
                링크 미리보기
              </p>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-base font-medium text-indigo-700 underline"
              >
                {attachment.url}
              </a>
            </div>
          ) : null}
          {kind === "file" ? (
            <div className="w-full max-w-2xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8 text-center shadow-sm">
              <p className="text-[1.05rem] font-semibold text-[var(--theme-text)]">
                미리보기를 지원하지 않는 파일입니다.
              </p>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-indigo-700 underline"
              >
                파일 열기
              </a>
            </div>
          ) : null}
        </div>
        <aside className="w-full shrink-0 border-t border-[var(--theme-border)] bg-[var(--theme-surface-muted)]/50 p-5 sm:w-[290px] sm:border-l sm:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-text-muted)]">
            파일 정보
          </p>
          <h3 className="mt-2 break-words text-sm font-semibold text-[var(--theme-text)]">
            {attachment.label}
          </h3>
          <dl className="mt-4 space-y-2 text-xs text-[var(--theme-text-muted)]">
            <div>
              <dt className="font-medium text-[var(--theme-text-muted)]">
                타입
              </dt>
              <dd className="mt-0.5 break-all">
                {attachment.contentType ?? attachment.kind}
              </dd>
            </div>
            {formatBytes(attachment.size) ? (
              <div>
                <dt className="font-medium text-[var(--theme-text-muted)]">
                  크기
                </dt>
                <dd className="mt-0.5">{formatBytes(attachment.size)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-5 space-y-2">
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-center text-xs font-medium text-[var(--theme-action-text)]"
            >
              열기/다운로드
            </a>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-xs font-medium text-[var(--theme-text)]"
            >
              닫기
            </button>
          </div>
        </aside>
      </div>
    </AccessibleDialog>
  );
}

function AttachmentItem({
  attachment,
  onOpen,
  onDelete,
  deleting,
  deleteError,
}: {
  attachment: BoardAttachment;
  onOpen: (attachment: BoardAttachment, opener: HTMLButtonElement) => void;
  onDelete?: (attachment: BoardAttachment) => void;
  deleting?: boolean;
  deleteError?: string | null;
}) {
  const kind = previewKindFromAttachment(attachment);
  const readableSize = formatBytes(attachment.size);
  const canDelete = kind !== "url" && Boolean(onDelete);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpen(attachment, event.currentTarget);
  };
  const managementActions = (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-interactive="true" data-no-card-drag>
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex min-h-8 items-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
        aria-label={`${attachment.label} 다운로드`}
      >
        다운로드
      </a>
      {canDelete ? (
        <button
          type="button"
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(attachment);
          }}
          className="inline-flex min-h-8 items-center rounded-md border border-rose-300/60 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`${attachment.label} 삭제`}
        >
          {deleting ? "삭제 중" : "삭제"}
        </button>
      ) : null}
      {deleteError ? (
        <p className="basis-full text-xs font-medium text-rose-600">{deleteError}</p>
      ) : null}
    </div>
  );

  if (kind === "image") {
    return (
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2">
        <button
          type="button"
          onClick={handleClick}
          className="group block w-full overflow-hidden rounded-lg bg-[var(--theme-panel-strong)]"
        >
          <Image
            src={attachment.url}
            alt={attachment.label}
            width={480}
            height={320}
            className="h-44 w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
            unoptimized
          />
        </button>
        <p className="mt-2 truncate text-sm font-medium text-[var(--theme-text)]">
          {attachment.label}
        </p>
        <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
          {attachment.contentType ?? "image"}
          {readableSize ? ` · ${readableSize}` : ""}
        </p>
        {managementActions}
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-3 text-left">
        <p className="mb-2 text-xs font-medium text-[var(--theme-text-muted)]">
          오디오 파일
        </p>
        <audio controls src={attachment.url} className="w-full" />
        {managementActions}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-2">
        <button
          type="button"
          onClick={handleClick}
          className="block w-full overflow-hidden rounded-lg bg-[var(--theme-panel-strong)]"
        >
          <video
            src={attachment.url}
            className="h-44 w-full object-cover"
            muted
          />
        </button>
        {managementActions}
      </div>
    );
  }

  if (kind === "document") {
    return (
      <div className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-3 text-left">
        <button type="button" onClick={handleClick} className="block w-full text-left">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--theme-text-muted)]">
            문서
          </p>
          <p className="mt-1 truncate text-sm font-medium text-[var(--theme-text)]">
            {attachment.label}
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
            {attachment.contentType ?? "document"}
            {readableSize ? ` · ${readableSize}` : ""}
          </p>
        </button>
        {managementActions}
      </div>
    );
  }

  if (kind === "url") {
    return (
      <Link
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-indigo-100 bg-[var(--theme-surface-muted)] px-2.5 py-1.5 text-xs text-[var(--theme-text)]"
      >
        <span>🔗</span>
        <span className="max-w-[210px] truncate">{attachment.label}</span>
      </Link>
    );
  }

  return (
    <div className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-3 text-left">
      <button type="button" onClick={handleClick} className="block w-full text-left">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--theme-text-muted)]">
          파일
        </p>
        <p className="mt-1 truncate text-sm font-medium text-[var(--theme-text)]">
          {attachment.label}
        </p>
        <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
          {attachment.contentType ?? "파일"}
          {readableSize ? ` · ${readableSize}` : ""}
        </p>
      </button>
      {managementActions}
    </div>
  );
}

function BoardQuickActions({ boardId }: { boardId: string }) {
  const pathname = usePathname();
  const links = [
    { href: `/dashboard/boards/${boardId}/board`, label: "보드" },
    { href: `/dashboard/boards/${boardId}/files`, label: "파일" },
    { href: `/dashboard/boards/${boardId}/edit`, label: "설정" },
  ];

  return (
    <div className="space-y-2">
      {links.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block min-h-10 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition ${active ? "border-slate-900 bg-[var(--theme-accent)] text-[var(--theme-action-text)]" : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

const BOARD_THEME_PRESET_LABELS: Record<string, string> = {
  [DEFAULT_BOARD_THEME.id]: "기본",
  calm: "차분함",
  bright: "밝게",
  contrast: "선명",
  "high-contrast": "고대비",
};

function ThemePresetPanel({
  savedTheme,
  selectedTheme,
  status,
  error,
  onPreview,
  onResetPreview,
  onSave,
}: {
  savedTheme: BoardThemeTokens;
  selectedTheme: BoardThemeTokens;
  status: "idle" | "saving";
  error: string | null;
  onPreview: (theme: BoardThemeTokens) => void;
  onResetPreview: () => void;
  onSave: (theme: BoardThemeTokens) => void;
}) {
  const hasPreviewChanges = selectedTheme.id !== savedTheme.id;

  return (
    <section className="space-y-3 text-sm text-[var(--theme-text)]" aria-label="보드 테마 설정" data-testid="board-theme-settings-panel">
      <div>
        <p className="text-xs font-semibold text-[var(--theme-text-muted)]">보드 테마</p>
        <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">프리셋을 누르면 저장 전 미리보기가 적용됩니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {BOARD_THEME_PRESETS.map((preset) => {
          const active = selectedTheme.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`board-theme-preset-${preset.id}`}
              onClick={() => onPreview(preset)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)] ${active ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-[var(--theme-action-text)]" : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]"}`}
            >
              <span className="block text-sm font-semibold">{BOARD_THEME_PRESET_LABELS[preset.id] ?? preset.label}</span>
              <span className={`mt-2 flex gap-1 ${active ? "opacity-95" : "opacity-80"}`} aria-hidden="true">
                <span className="h-3 w-7 rounded-full border border-white/35" style={{ background: preset.vars["--theme-bg"] }} />
                <span className="h-3 w-7 rounded-full border border-white/35" style={{ background: preset.vars["--theme-card"] }} />
                <span className="h-3 w-7 rounded-full border border-white/35" style={{ background: preset.vars["--theme-accent"] }} />
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="board-theme-save"
          onClick={() => onSave(selectedTheme)}
          disabled={!hasPreviewChanges || status === "saving"}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-xs font-semibold text-[var(--theme-action-text)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {status === "saving" ? "저장 중" : "저장"}
        </button>
        <button
          type="button"
          data-testid="board-theme-cancel"
          onClick={onResetPreview}
          disabled={!hasPreviewChanges || status === "saving"}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-xs font-semibold text-[var(--theme-text)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          취소
        </button>
      </div>
      <button
        type="button"
        data-testid="board-theme-restore-default"
        onClick={() => onSave(DEFAULT_BOARD_THEME)}
        disabled={status === "saving"}
        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:cursor-not-allowed disabled:opacity-55"
      >
        기본 테마로 되돌리기
      </button>
    </section>
  );
}

type RightRailTab = "board" | "files" | "settings" | "collab";
type VibePanelFilter = "all" | VibeSubmissionMode | "has_link" | "has_attachment";

const RIGHT_RAIL_TABS: Array<{ id: RightRailTab; label: string }> = [
  { id: "board", label: "수업" },
  { id: "files", label: "파일" },
  { id: "settings", label: "설정" },
  { id: "collab", label: "공유" },
];

export default function TeacherBoardCanonicalClient({
  boardId,
  boardTitle,
  boardDescription,
  walls,
  boardAccessCode,
  initialBoardTheme,
  initialBoardThemeVars,
  collaborationSummary,
  currentUserId,
  canDeleteCards,
  canOperateCards = true,
  fixtureDataVersion,
  fixtureMode = null,
  initialActiveLessonSession,
  initialAiBingoSummary,
  initialAiJudgmentSortSummary,
  initialPythonStudioLiteSummary,
  initialWebCodingLiteSummary,
}: Props) {
  const router = useRouter();
  const setDashboardChrome = useSetDashboardChrome();
  const [selectedAttachment, setSelectedAttachment] =
    useState<BoardAttachment | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});
  const [sectionUploadStatus, setSectionUploadStatus] = useState<
    Record<string, UploadStatus>
  >({});
  const [cardUploadStatus, setCardUploadStatus] = useState<
    Record<string, UploadStatus>
  >({});
  const [attachmentDeleteStatus, setAttachmentDeleteStatus] = useState<
    Record<string, AttachmentDeleteStatus>
  >({});
  const [cardMoveError, setCardMoveError] = useState<string | null>(null);
  const [sectionMoveError, setSectionMoveError] = useState<string | null>(null);
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>("board");
  const [rightRailOpen, setRightRailOpen] = useState(false);
  const [rightRailClientReady, setRightRailClientReady] = useState(false);
  const [savedBoardTheme, setSavedBoardTheme] = useState(initialBoardTheme);
  const [previewBoardTheme, setPreviewBoardTheme] = useState(initialBoardTheme);
  const [themeSaveStatus, setThemeSaveStatus] = useState<"idle" | "saving">("idle");
  const [themeSaveError, setThemeSaveError] = useState<string | null>(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const rightRailCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const rightRailPanelRef = useRef<HTMLDivElement | null>(null);
  const rightRailFirstTabRef = useRef<HTMLButtonElement | null>(null);
  const rightRailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileLessonButtonRef = useRef<HTMLButtonElement | null>(null);
  const headerLessonButtonRef = useRef<HTMLButtonElement | null>(null);
  const headerActionsToggleRef = useRef<HTMLButtonElement | null>(null);
  const attachmentDialogOpenerRef = useRef<HTMLElement | null>(null);
  const viewCardDialogOpenerRef = useRef<HTMLElement | null>(null);
  const editCardDialogOpenerRef = useRef<HTMLElement | null>(null);
  const themeDialogOpenerRef = useRef<HTMLElement | null>(null);
  const renameDialogOpenerRef = useRef<HTMLElement | null>(null);
  const cardMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sectionMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const viewCardCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const editCardTextRef = useRef<HTMLTextAreaElement | null>(null);
  const themeCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const rightRailOpenSourceRef = useRef<"mobile" | "header" | "rail" | null>(null);
  const boardRootRef = useRef<HTMLElement | null>(null);
  const teacherCardDragActivationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const teacherCardDragCapturedElement = useRef<HTMLElement | null>(null);
  const teacherCardDragStateRef = useRef<TeacherCardDragState>({ phase: "idle" });
  const teacherCardAutoScrollRafRef = useRef<number | null>(null);
  const teacherCardAutoScrollPointerRef = useRef<{ x: number; y: number } | null>(null);
  const teacherCardMoveInFlight = useRef(false);
  const sectionFileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const cardFileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setRightRailClientReady(true);
  }, []);

  const refreshBoard = useMemo(() => () => router.refresh(), [router]);
  const closeCardMenu = () => {
    window.dispatchEvent(new CustomEvent("gomdory:more-menu-close"));
  };
  const runCardMenuAction = (action: () => void) => {
    action();
    closeCardMenu();
  };
  const [copiedPrivateUrl, setCopiedPrivateUrl] = useState(false);
  const [privateUrlCopyMessage, setPrivateUrlCopyMessage] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [editingCard, setEditingCard] = useState<WallCard | null>(null);
  const [editCardText, setEditCardText] = useState("");
  const [viewingCard, setViewingCard] = useState<WallCard | null>(null);
  const [cardActionError, setCardActionError] = useState<string | null>(null);
  const [teacherCardMenuAnnouncement, setTeacherCardMenuAnnouncement] = useState<TeacherCardMenuAnnouncement | null>(null);
  const announcedTeacherCardMenuEventKeysRef = useRef(new Set<string>());
  const [boardWalls, setBoardWalls] = useState(walls);
  const latestAppliedDataVersionRef = useRef<number | null>(
    typeof fixtureDataVersion === "number" ? fixtureDataVersion : null,
  );
  const [visibilityCardIds, setVisibilityCardIds] = useState<Record<string, boolean>>({});
  const teacherBoardMutationSequenceRef = useRef(0);
  const activeTeacherBoardMutationsRef = useRef(new Map<string, string>());
  const [teacherBoardMutationStates, setTeacherBoardMutationStates] = useState<Record<string, TeacherBoardMutationState>>({});
  const [teacherCardDragState, setTeacherCardDragState] =
    useState<TeacherCardDragState>({ phase: "idle" });
  const [movingTeacherCardId, setMovingTeacherCardId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [vibeFilter, setVibeFilter] = useState<VibePanelFilter>("all");
  const activeLessonTemplateId = initialActiveLessonSession?.templateId ?? null;
  const shouldShowVibePanel = isVibeCodingLessonTemplateId(activeLessonTemplateId);
  const teacherCardDragEnabled = canDeleteCards && !movingTeacherCardId;

  const rememberDialogOpener = (
    targetRef: { current: HTMLElement | null },
    opener?: HTMLElement | null,
  ) => {
    const activeElement =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    targetRef.current = opener ?? activeElement;
  };
  const rememberMenuTrigger = (
    triggerRefs: { current: Record<string, HTMLButtonElement | null> },
    key: string,
    container: HTMLElement,
  ) => {
    const trigger = container.querySelector<HTMLButtonElement>("button");
    if (trigger) triggerRefs.current[key] = trigger;
  };
  const openAttachmentViewer = (
    attachment: BoardAttachment,
    opener?: HTMLElement | null,
  ) => {
    rememberDialogOpener(attachmentDialogOpenerRef, opener);
    setSelectedAttachment(attachment);
  };
  const closeAttachmentViewer = () => setSelectedAttachment(null);
  const openCardViewer = (card: WallCard, opener?: HTMLElement | null) => {
    rememberDialogOpener(viewCardDialogOpenerRef, opener);
    setViewingCard(card);
  };
  const closeCardViewer = () => setViewingCard(null);
  const closeCardEditor = () => setEditingCard(null);
  const openRenameDialog = (
    target: { id: string; title: string },
    opener?: HTMLElement | null,
  ) => {
    rememberDialogOpener(renameDialogOpenerRef, opener);
    setRenameTarget(target);
    setRenameInput(target.title);
    setRenameError(null);
  };
  const closeRenameDialog = () => {
    setRenameTarget(null);
    setRenameError(null);
  };

  const createTeacherCardMoveMutationId = (cardId: string) => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${cardId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  };

  const startTeacherBoardOperation = (kind: TeacherBoardMutationKind, cardId: string) => {
    const key = `${kind}:${cardId}`;
    if (activeTeacherBoardMutationsRef.current.has(key)) return null;
    const operation = createTeacherBoardOperation(
      kind,
      cardId,
      latestAppliedDataVersionRef.current,
      ++teacherBoardMutationSequenceRef.current,
    );
    activeTeacherBoardMutationsRef.current.set(key, operation.id);
    setTeacherBoardMutationStates((current) => ({
      ...current,
      [key]: { ...idleTeacherBoardMutationState(), phase: "pending", operation },
    }));
    return { key, operation };
  };

  const announceTeacherCardMenuResult = (announcement: TeacherCardMenuAnnouncement | null) => {
    if (!announcement || announcedTeacherCardMenuEventKeysRef.current.has(announcement.eventKey)) return;
    announcedTeacherCardMenuEventKeysRef.current.add(announcement.eventKey);
    setTeacherCardMenuAnnouncement(announcement);
  };

  const finishTeacherBoardOperation = (
    key: string,
    operationId: string,
    transition: (state: TeacherBoardMutationState) => TeacherBoardMutationState,
    terminal = true,
  ) => {
    if (activeTeacherBoardMutationsRef.current.get(key) !== operationId) return false;
    if (terminal) activeTeacherBoardMutationsRef.current.delete(key);
    setTeacherBoardMutationStates((current) => ({
      ...current,
      [key]: transition(current[key] ?? idleTeacherBoardMutationState()),
    }));
    return true;
  };

  const setTeacherCardDragStateSynced = (
    next:
      | TeacherCardDragState
      | ((current: TeacherCardDragState) => TeacherCardDragState),
  ) => {
    setTeacherCardDragState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      teacherCardDragStateRef.current = resolved;
      return resolved;
    });
  };

  const clearTeacherCardDragActivationTimer = () => {
    if (teacherCardDragActivationTimer.current) {
      clearTimeout(teacherCardDragActivationTimer.current);
      teacherCardDragActivationTimer.current = null;
    }
  };

  const cancelTeacherCardAutoScrollLoop = () => {
    if (teacherCardAutoScrollRafRef.current !== null) {
      cancelAnimationFrame(teacherCardAutoScrollRafRef.current);
      teacherCardAutoScrollRafRef.current = null;
    }
    teacherCardAutoScrollPointerRef.current = null;
  };

  const releaseTeacherCardDragPointerCapture = (pointerId?: number) => {
    const capturedElement = teacherCardDragCapturedElement.current;
    if (capturedElement && pointerId != null && capturedElement.hasPointerCapture(pointerId)) {
      capturedElement.releasePointerCapture(pointerId);
    }
    teacherCardDragCapturedElement.current = null;
  };

  const cancelTeacherCardDrag = () => {
    clearTeacherCardDragActivationTimer();
    cancelTeacherCardAutoScrollLoop();
    setTeacherCardDragStateSynced((current) => {
      releaseTeacherCardDragPointerCapture(
        current.phase === "idle" ? undefined : current.pointerId,
      );
      return { phase: "idle" };
    });
  };

  const collectTeacherCardDragWallRects = (): TeacherCardDragWallRect[] => {
    const root = boardRootRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>('[data-teacher-wall-dropzone="true"]'),
    ).map((wallElement) => {
      const wallRect = wallElement.getBoundingClientRect();
      return {
        wallId: wallElement.dataset.teacherWallId ?? "",
        rect: {
          left: wallRect.left,
          right: wallRect.right,
          top: wallRect.top,
          bottom: wallRect.bottom,
        },
        cards: Array.from(
          wallElement.querySelectorAll<HTMLElement>(
            '[data-teacher-card-draggable="true"][data-card-id]',
          ),
        ).map((cardElement) => {
          const cardRect = cardElement.getBoundingClientRect();
          return {
            cardId: cardElement.dataset.cardId ?? "",
            rect: {
              left: cardRect.left,
              right: cardRect.right,
              top: cardRect.top,
              bottom: cardRect.bottom,
            },
          };
        }),
      };
    }).filter((wall) => wall.wallId);
  };

  const getTeacherCardHorizontalScroller = () =>
    boardRootRef.current?.querySelector<HTMLElement>(
      '[data-board-scroll="horizontal"]',
    ) ?? null;

  const getTeacherCardWallScrollContainer = (wallId: string) => {
    const root = boardRootRef.current;
    if (!root) return null;
    const wallElement = Array.from(
      root.querySelectorAll<HTMLElement>('[data-teacher-wall-dropzone="true"]'),
    ).find((element) => element.dataset.teacherWallId === wallId);
    return (
      wallElement?.querySelector<HTMLElement>(
        '[data-teacher-wall-scroll-container="true"]',
      ) ?? null
    );
  };

  const updateTeacherCardDropTargetFromPointer = (
    pointer: { x: number; y: number },
  ) => {
    const dragState = teacherCardDragStateRef.current;
    if (dragState.phase !== "dragging") return;
    const dropPosition = calculateTeacherCardDropPosition({
      pointer,
      walls: collectTeacherCardDragWallRects(),
      draggingCardId: dragState.draggingCardId,
      currentWallId: dragState.sourceWallId,
      currentPosition: dragState.sourcePosition,
    });
    setTeacherCardDragStateSynced((current) =>
      current.phase === "dragging"
        ? {
            ...current,
            currentX: pointer.x,
            currentY: pointer.y,
            targetWallId: dropPosition.wallId,
            targetPosition: dropPosition.position,
          }
        : current,
    );
  };

  const scheduleTeacherCardAutoScrollLoop = () => {
    if (teacherCardAutoScrollRafRef.current !== null) return;

    const tick = () => {
      teacherCardAutoScrollRafRef.current = null;
      const dragState = teacherCardDragStateRef.current;
      const pointer = teacherCardAutoScrollPointerRef.current;
      if (
        dragState.phase !== "dragging" ||
        teacherCardMoveInFlight.current ||
        !pointer
      ) {
        cancelTeacherCardAutoScrollLoop();
        return;
      }

      const boardScroller = getTeacherCardHorizontalScroller();
      const columnScroller = getTeacherCardWallScrollContainer(dragState.targetWallId);
      const boardRect = boardScroller?.getBoundingClientRect() ?? null;
      const columnRect = columnScroller?.getBoundingClientRect() ?? null;
      const delta = calculateTeacherCardAutoScrollDelta({
        pointer,
        boardRect,
        columnRect,
      });

      let movedX = false;
      let movedY = false;
      if (boardScroller && Math.abs(delta.x) > 0.01) {
        const previous = boardScroller.scrollLeft;
        const maxScrollLeft = boardScroller.scrollWidth - boardScroller.clientWidth;
        boardScroller.scrollLeft = Math.min(
          Math.max(previous + delta.x, 0),
          Math.max(0, maxScrollLeft),
        );
        movedX = boardScroller.scrollLeft !== previous;
      }
      if (columnScroller && Math.abs(delta.y) > 0.01) {
        const previous = columnScroller.scrollTop;
        const maxScrollTop = columnScroller.scrollHeight - columnScroller.clientHeight;
        columnScroller.scrollTop = Math.min(
          Math.max(previous + delta.y, 0),
          Math.max(0, maxScrollTop),
        );
        movedY = columnScroller.scrollTop !== previous;
      }

      if (movedX || movedY) {
        updateTeacherCardDropTargetFromPointer(pointer);
      }

      if (
        (movedX && Math.abs(delta.x) > 0.01) ||
        (movedY && Math.abs(delta.y) > 0.01)
      ) {
        teacherCardAutoScrollRafRef.current = requestAnimationFrame(tick);
      }
    };

    teacherCardAutoScrollRafRef.current = requestAnimationFrame(tick);
  };

  const startTeacherCardDragging = (pending: Extract<TeacherCardDragState, { phase: "pending" }>) => {
    const dropPosition = calculateTeacherCardDropPosition({
      pointer: { x: pending.currentX, y: pending.currentY },
      walls: collectTeacherCardDragWallRects(),
      draggingCardId: pending.draggingCardId,
      currentWallId: pending.sourceWallId,
      currentPosition: pending.sourcePosition,
    });
    const draggingState: Extract<TeacherCardDragState, { phase: "dragging" }> = {
      ...pending,
      phase: "dragging",
      targetWallId: dropPosition.wallId,
      targetPosition: dropPosition.position,
    };
    teacherCardAutoScrollPointerRef.current = {
      x: draggingState.currentX,
      y: draggingState.currentY,
    };
    setTeacherCardDragStateSynced(draggingState);
    scheduleTeacherCardAutoScrollLoop();
  };

  const getTeacherCardDropIndicatorCandidateCount = (
    wallId: string,
    cards: WallCard[],
  ) => {
    if (
      teacherCardDragState.phase !== "dragging" ||
      teacherCardDragState.targetWallId !== wallId
    ) {
      return null;
    }
    return cards.filter((card) => card.id !== teacherCardDragState.draggingCardId).length;
  };

  const shouldRenderTeacherCardDropIndicatorBefore = (
    wallId: string,
    cards: WallCard[],
    cardId: string,
  ) => {
    if (
      teacherCardDragState.phase !== "dragging" ||
      teacherCardDragState.targetWallId !== wallId ||
      teacherCardDragState.draggingCardId === cardId
    ) {
      return false;
    }
    const candidateIndex = cards
      .filter((card) => card.id !== teacherCardDragState.draggingCardId)
      .findIndex((card) => card.id === cardId);
    return candidateIndex === teacherCardDragState.targetPosition;
  };

  const handleTeacherCardPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    wallId: string,
    card: WallCard,
    cardIndex: number,
  ) => {
    if (!teacherCardDragEnabled) return;
    if (teacherCardMoveInFlight.current) return;
    if (!isTeacherCardDragPointerCandidate(event.nativeEvent)) return;
    if (isCardDragBlockedTarget(event.target)) return;
    const cardElement = event.currentTarget;
    const cardRect = cardElement.getBoundingClientRect();
    const pendingState: Extract<TeacherCardDragState, { phase: "pending" }> = {
      phase: "pending",
      draggingCardId: card.id,
      sourceWallId: wallId,
      sourcePosition: cardIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      cardRect: {
        left: cardRect.left,
        top: cardRect.top,
        width: cardRect.width,
        height: cardRect.height,
      },
      snapshot: {
        text: card.text,
        attachmentCount: card.attachments?.length ?? 0,
        colorToken: card.card_color_token,
      },
    };
    clearTeacherCardDragActivationTimer();
    teacherCardDragCapturedElement.current = cardElement;
    cardElement.setPointerCapture(event.pointerId);
    setTeacherCardDragStateSynced(pendingState);
    teacherCardDragActivationTimer.current = setTimeout(() => {
      teacherCardDragActivationTimer.current = null;
      const current = teacherCardDragStateRef.current;
      startTeacherCardDragging(
        current.phase === "pending" &&
          current.draggingCardId === pendingState.draggingCardId
          ? current
          : pendingState,
      );
    }, TEACHER_CARD_DRAG_ACTIVATION_DELAY_MS);
  };

  const handleTeacherCardPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (teacherCardDragState.phase === "pending") {
      const distance = Math.hypot(
        event.clientX - teacherCardDragState.startX,
        event.clientY - teacherCardDragState.startY,
      );
      if (distance > TEACHER_CARD_DRAG_MOVE_TOLERANCE_PX) {
        cancelTeacherCardDrag();
      }
      setTeacherCardDragStateSynced((current) =>
        current.phase === "pending"
          ? { ...current, currentX: event.clientX, currentY: event.clientY }
          : current,
      );
      return;
    }
    if (teacherCardDragState.phase !== "dragging") return;
    event.preventDefault();
    const pointer = { x: event.clientX, y: event.clientY };
    teacherCardAutoScrollPointerRef.current = pointer;
    updateTeacherCardDropTargetFromPointer(pointer);
    scheduleTeacherCardAutoScrollLoop();
  };

  const persistTeacherCardDragMove = async (
    moveState: Extract<TeacherCardDragState, { phase: "dragging" }>,
  ) => {
    const {
      draggingCardId,
      sourceWallId,
      sourcePosition,
      targetWallId,
      targetPosition,
    } = moveState;

    if (!targetWallId || targetPosition == null) return;
    if (
      isNoopTeacherCardMove({
        sourceWallId,
        sourcePosition,
        targetWallId,
        targetPosition,
      })
    ) {
      return;
    }
    if (teacherCardMoveInFlight.current) return;

    const previousWalls = boardWalls;
    const optimisticMove = applyTeacherCardMoveOptimistic({
      entries: previousWalls,
      cardId: draggingCardId,
      targetWallId,
      targetPosition,
    });
    if (!optimisticMove.changed) return;

    teacherCardMoveInFlight.current = true;
    setMovingTeacherCardId(draggingCardId);
    setCardMoveError(null);
    setBoardWalls(optimisticMove.entries);

    try {
      const response = await fetch(
        routes.api.v1("dashboard", "cards", draggingCardId, "move"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            boardId,
            wallId: targetWallId,
            position: targetPosition,
            clientMutationId: createTeacherCardMoveMutationId(draggingCardId),
          }),
        },
      );
      if (!response.ok) {
        throw new Error("card_move_failed");
      }
    } catch {
      setBoardWalls(previousWalls);
      setCardMoveError("카드 이동을 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      teacherCardMoveInFlight.current = false;
      setMovingTeacherCardId(null);
    }
  };

  const handleTeacherCardPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const moveState =
      teacherCardDragState.phase === "dragging" ? teacherCardDragState : null;
    clearTeacherCardDragActivationTimer();
    releaseTeacherCardDragPointerCapture(
      teacherCardDragState.phase === "idle" ? event.pointerId : teacherCardDragState.pointerId,
    );
    cancelTeacherCardAutoScrollLoop();
    setTeacherCardDragStateSynced({ phase: "idle" });
    if (moveState) {
      void persistTeacherCardDragMove(moveState);
    }
  };

  const handleTeacherCardPointerCancel = () => {
    cancelTeacherCardDrag();
  };

  const clearRightRailCloseTimer = () => {
    if (rightRailCloseTimer.current) {
      clearTimeout(rightRailCloseTimer.current);
      rightRailCloseTimer.current = null;
    }
  };

  const openRightRail = () => {
    clearRightRailCloseTimer();
    setRightRailOpen(true);
  };

  const openLessonTools = (source: "mobile" | "header" = "header") => {
    clearRightRailCloseTimer();
    rightRailOpenSourceRef.current = source;
    setRightRailTab("board");
    setRightRailOpen(true);
    window.requestAnimationFrame(() => rightRailFirstTabRef.current?.focus());
  };

  const getRightRailReturnFocusTarget = () => {
    const source = rightRailOpenSourceRef.current;
    if (source === "mobile") return mobileLessonButtonRef.current;
    if (source === "header") return headerActionsToggleRef.current;
    return rightRailTriggerRef.current ?? headerActionsToggleRef.current;
  };

  const closeRightRail = (restoreFocus = true) => {
    clearRightRailCloseTimer();
    setRightRailOpen(false);
    if (!restoreFocus) return;
    const returnFocusTarget = getRightRailReturnFocusTarget();
    window.requestAnimationFrame(() => {
      returnFocusTarget?.focus();
    });
  };

  const handleRightRailKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRightRail();
      return;
    }
    if (event.key !== "Tab" || !rightRailPanelRef.current) return;
    const focusable = rightRailPanelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };

  const handleRightRailTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const lastIndex = RIGHT_RAIL_TABS.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;
    const nextTab = RIGHT_RAIL_TABS[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    setRightRailTab(nextTab.id);
    rightRailPanelRef.current
      ?.querySelector<HTMLButtonElement>(`#canonical-right-rail-tab-${nextTab.id}`)
      ?.focus();
  };

  const closeRightRailSoon = () => {
    clearRightRailCloseTimer();
    rightRailCloseTimer.current = setTimeout(() => {
      setRightRailOpen(false);
      rightRailCloseTimer.current = null;
    }, 350);
  };

  const normalizedBoardCode = boardAccessCode?.toLowerCase() ?? null;
  const resolvedBoardCode = (normalizedBoardCode ?? "------").toUpperCase();
  const shareEntryPath = `/s/${normalizedBoardCode ?? boardId}`;
  const shareEntryUrl = useMemo(
    () => buildStudentUrl(shareEntryPath),
    [shareEntryPath],
  );

  useEffect(() => {
    if ((fixtureMode !== "q2-b7" && fixtureMode !== "q2-b10") || typeof fixtureDataVersion !== "number") {
      latestAppliedDataVersionRef.current = null;
      setBoardWalls(walls);
      return;
    }
    if (
      latestAppliedDataVersionRef.current === null ||
      fixtureDataVersion >= latestAppliedDataVersionRef.current
    ) {
      latestAppliedDataVersionRef.current = fixtureDataVersion;
      setBoardWalls(walls);
    }
  }, [fixtureDataVersion, fixtureMode, walls]);

  useEffect(() => {
    setSavedBoardTheme(initialBoardTheme);
    setPreviewBoardTheme(initialBoardTheme);
    setThemeSaveError(null);
  }, [initialBoardTheme]);

  const previewBoardThemeVars = useMemo(
    () => (previewBoardTheme.id === initialBoardTheme.id ? initialBoardThemeVars : resolveBoardThemeVars(previewBoardTheme, "teacher")),
    [initialBoardTheme.id, initialBoardThemeVars, previewBoardTheme],
  );
  const boardRuntimeStyle = previewBoardThemeVars as CSSProperties;
  const resetThemePreview = () => {
    setPreviewBoardTheme(savedBoardTheme);
    setThemeSaveError(null);
  };
  const openThemeDialog = (opener?: HTMLElement | null) => {
    rememberDialogOpener(themeDialogOpenerRef, opener);
    setThemeModalOpen(true);
  };
  const closeThemeDialog = () => {
    resetThemePreview();
    setThemeModalOpen(false);
  };
  const previewTheme = (theme: BoardThemeTokens) => {
    setPreviewBoardTheme(theme);
    setThemeSaveError(null);
  };
  const saveTheme = async (theme: BoardThemeTokens) => {
    setThemeSaveStatus("saving");
    setThemeSaveError(null);
    setPreviewBoardTheme(theme);
    try {
      const response = await fetch(routes.api.v1("boards", boardId, "settings"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patch: { uiThemeConfig: theme } }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string }; board?: { ui_theme_config?: BoardThemeTokens | null } } | null;
      if (!response.ok) {
        const serverMessage = payload?.error?.message;
        throw new Error(serverMessage && /[가-힣]/.test(serverMessage) ? serverMessage : "테마를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
      const savedTheme = payload?.board?.ui_theme_config ?? theme;
      setSavedBoardTheme(savedTheme);
      setPreviewBoardTheme(savedTheme);
      setThemeModalOpen(false);
      refreshBoard();
    } catch (error) {
      setPreviewBoardTheme(savedBoardTheme);
      setThemeSaveError(error instanceof Error ? error.message : "테마를 저장하지 못했습니다.");
    } finally {
      setThemeSaveStatus("idle");
    }
  };

  const boardSummary = useMemo(() => {
    const sectionCount = boardWalls.length;
    const cardCount = boardWalls.reduce(
      (count, entry) => count + entry.cards.length,
      0,
    );
    const attachments = boardWalls.flatMap((entry) =>
      entry.cards.flatMap((card) =>
        (card.attachments ?? []).map((attachment) => ({
          attachment,
          wallTitle: entry.wall.title,
          cardText: card.text,
        })),
      ),
    );
    return {
      sectionCount,
      cardCount,
      attachmentCount: attachments.length,
      recentAttachments: attachments.slice(0, 24),
    };
  }, [boardWalls]);
  const studentSubmissionSummary = useMemo(
    () => summarizeStudentSubmissions(boardWalls),
    [boardWalls],
  );
  const showStudentSubmission = (cardId: string) => {
    const selectedCard = boardWalls
      .flatMap((entry) => entry.cards)
      .find((card) => card.id === cardId);
    const result = scrollToCard(cardId, { block: "center", inline: "center" });
    if (!result.ok && selectedCard) openCardViewer(selectedCard);
  };
  const vibeSubmissions = useMemo(() => {
    return boardWalls.flatMap((entry) =>
      entry.cards
        .filter((card) => (card.is_hidden == null ? true : !card.is_hidden) && (card.deleted_at == null))
        .map((card) => {
          const classification = classifyVibeSubmission(card);
          return { wallTitle: entry.wall.title, card, classification };
        })
        .filter((item) => item.classification.isVibeLikely),
    );
  }, [boardWalls]);
  const vibeSummary = useMemo(() => ({
    total: vibeSubmissions.length,
    idea: vibeSubmissions.filter((v) => v.classification.submissionMode === "idea").length,
    prompt: vibeSubmissions.filter((v) => v.classification.submissionMode === "prompt").length,
    workLink: vibeSubmissions.filter((v) => v.classification.submissionMode === "work_link").length,
    canvaMockup: vibeSubmissions.filter((v) => v.classification.submissionMode === "canva_mockup").length,
    rescue: vibeSubmissions.filter((v) => v.classification.submissionMode === "rescue").length,
    peerFeedback: vibeSubmissions.filter((v) => v.classification.submissionMode === "peer_feedback").length,
    hasLink: vibeSubmissions.filter((v) => v.classification.hasLink).length,
    hasAttachment: vibeSubmissions.filter((v) => v.classification.hasAttachment).length,
  }), [vibeSubmissions]);
  const filteredVibeSubmissions = useMemo(() => vibeSubmissions.filter((item) => {
    if (vibeFilter === "all") return true;
    if (vibeFilter === "has_link") return item.classification.hasLink;
    if (vibeFilter === "has_attachment") return item.classification.hasAttachment;
    return item.classification.submissionMode === vibeFilter;
  }), [vibeFilter, vibeSubmissions]);

  useEffect(() => {
    setDashboardChrome({
      mode: "board",
      boardTitle,
      boardControls: (
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]"
          >
            대시보드
          </Link>
          <BoardQuickActions boardId={boardId} />
        </div>
      ),
    });
    return () => setDashboardChrome({ mode: "default" });
  }, [boardId, boardTitle, setDashboardChrome]);

  useEffect(() => {
    return () => {
      if (rightRailCloseTimer.current) {
        clearTimeout(rightRailCloseTimer.current);
        rightRailCloseTimer.current = null;
      }
      clearTeacherCardDragActivationTimer();
      cancelTeacherCardAutoScrollLoop();
      releaseTeacherCardDragPointerCapture();
    };
  }, []);

  useEffect(() => {
    if (teacherCardDragState.phase !== "dragging") return;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [teacherCardDragState.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelTeacherCardDrag();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function submitSection() {
    const title = sectionTitle.trim();
    if (!title) return;
    const response = await fetch(
      routes.api.v1("dashboard", "boards", boardId, "walls"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      },
    );
    if (response.ok) {
      setSectionTitle("");
      setAddingSection(false);
      refreshBoard();
    }
  }
  async function uploadToCard(cardId: string, file: File) {
    const uploadResult = await uploadFileToCard(cardId, file);
    if (!uploadResult.ok)
      throw new Error(uploadResult.error || "첨부 업로드에 실패했습니다.");
  }
  async function createAttachmentOnlyCard(wallId: string) {
    const response = await fetch(
      routes.api.v1("dashboard", "walls", wallId, "cards"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, text: "" }),
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      cardId?: string;
      error?: string;
    } | null;
    if (!response.ok || !payload?.cardId)
      throw new Error(payload?.error ?? "첨부 카드 생성 실패");
    return payload.cardId;
  }
  async function importGoogleDriveFile(input: { wallId: string; file: File }) {
    const cardId = await createAttachmentOnlyCard(input.wallId);
    await uploadToCard(cardId, input.file);
    refreshBoard();
  }
  async function onSectionFileSelected(
    wallId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSectionUploadStatus((prev) => ({
      ...prev,
      [wallId]: { uploading: true, error: null },
    }));
    try {
      const cardId = await createAttachmentOnlyCard(wallId);
      await uploadToCard(cardId, file);
      setSectionUploadStatus((prev) => ({
        ...prev,
        [wallId]: { uploading: false, error: null },
      }));
      refreshBoard();
    } catch {
      setSectionUploadStatus((prev) => ({
        ...prev,
        [wallId]: {
          uploading: false,
          error: `업로드에 실패했습니다. 잠시 후 다시 시도해주세요.`,
        },
      }));
    }
  }
  async function onCardFileSelected(
    cardId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCardUploadStatus((prev) => ({
      ...prev,
      [cardId]: { uploading: true, error: null },
    }));
    try {
      await uploadToCard(cardId, file);
      setCardUploadStatus((prev) => ({
        ...prev,
        [cardId]: { uploading: false, error: null },
      }));
      refreshBoard();
    } catch {
      setCardUploadStatus((prev) => ({
        ...prev,
        [cardId]: {
          uploading: false,
          error: `업로드에 실패했습니다. 잠시 후 다시 시도해주세요.`,
        },
      }));
    }
  }
  async function deleteAttachment(attachment: BoardAttachment) {
    const attachmentId = attachment.id;
    const deleteFileId = attachment.fileId ?? attachment.boardFileId ?? attachment.attachmentId ?? attachment.id;
    const previousWalls = boardWalls;
    setAttachmentDeleteStatus((prev) => ({
      ...prev,
      [attachmentId]: { deleting: true, error: null },
    }));
    setBoardWalls((currentWalls) =>
      currentWalls.map((entry) => ({
        ...entry,
        cards: entry.cards.map((card) => {
          const result = removeOptimisticAttachmentById(
            card.attachments ?? [],
            attachmentId,
          );
          return result.removed ? { ...card, attachments: result.next } : card;
        }),
      })),
    );
    setSelectedAttachment((current) =>
      current?.id === attachmentId ? null : current,
    );
    setViewingCard((current) =>
      current
        ? {
            ...current,
            attachments: removeOptimisticAttachmentById(
              current.attachments ?? [],
              attachmentId,
            ).next,
          }
        : current,
    );

    let response: Response;
    try {
      response = await fetch(routes.api.v1("files", deleteFileId, "delete"), {
        method: "POST",
      });
    } catch {
      setBoardWalls(previousWalls);
      setAttachmentDeleteStatus((prev) => ({
        ...prev,
        [attachmentId]: {
          deleting: false,
          error: "첨부파일을 삭제하지 못했습니다.",
        },
      }));
      return;
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string | { message?: string };
      } | null;
      setBoardWalls(previousWalls);
      setAttachmentDeleteStatus((prev) => ({
        ...prev,
        [attachmentId]: {
          deleting: false,
          error:
            payload?.message ??
            (typeof payload?.error === "string" ? payload.error : payload?.error?.message) ??
            "첨부파일을 삭제하지 못했습니다.",
        },
      }));
      return;
    }
    setAttachmentDeleteStatus((prev) => {
      const next = { ...prev };
      delete next[attachmentId];
      return next;
    });
  }
  async function submitCard(wallId: string) {
    const text = (cardDrafts[wallId] ?? "").trim();
    if (!text) return;
    const response = await fetch(
      routes.api.v1("dashboard", "walls", wallId, "cards"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, text }),
      },
    );
    if (response.ok) {
      setCardDrafts((prev) => ({ ...prev, [wallId]: "" }));
      refreshBoard();
    }
  }
  async function moveCardInSection(
    wallId: string,
    cardId: string,
    direction: -1 | 1,
  ) {
    if (teacherCardMoveInFlight.current) return;
    const previousWalls = boardWalls;
    const section = boardWalls.find((entry) => entry.wall.id === wallId);
    if (!section) return;
    const index = section.cards.findIndex((item) => item.id === cardId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= section.cards.length)
      return;
    setCardMoveError(null);
    const optimisticMove = applyTeacherCardMoveOptimistic({
      entries: previousWalls,
      cardId,
      targetWallId: wallId,
      targetPosition: targetIndex,
    });
    if (!optimisticMove.changed) return;
    teacherCardMoveInFlight.current = true;
    setMovingTeacherCardId(cardId);
    setBoardWalls(optimisticMove.entries);
    try {
      const response = await fetch(
        routes.api.v1("dashboard", "cards", cardId, "move"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wallId,
            boardId,
            clientMutationId: createTeacherCardMoveMutationId(cardId),
            position: targetIndex,
          }),
        },
      );
      if (!response.ok) throw new Error("card_move_failed");
    } catch {
      setBoardWalls(previousWalls);
      setCardMoveError(
        "카드를 이동하지 못했습니다. 새로고침 후 다시 시도해주세요.",
      );
      return;
    } finally {
      teacherCardMoveInFlight.current = false;
      setMovingTeacherCardId(null);
    }
    refreshBoard();
  }
  async function moveCardToWall(cardId: string, targetWallId: string) {
    if (!canOperateCards || teacherCardMoveInFlight.current) return;
    const source = boardWalls.find((entry) => entry.cards.some((card) => card.id === cardId));
    if (!source || source.wall.id === targetWallId) return;
    const previousWalls = boardWalls;
    const optimisticMove = applyTeacherCardMoveOptimistic({ entries: previousWalls, cardId, targetWallId, targetPosition: 0 });
    if (!optimisticMove.changed) return;
    teacherCardMoveInFlight.current = true; setMovingTeacherCardId(cardId); setBoardWalls(optimisticMove.entries);
    try {
      const response = await fetch(routes.api.v1("dashboard", "cards", cardId, "move"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallId: targetWallId, boardId, clientMutationId: createTeacherCardMoveMutationId(cardId), position: 0 }) });
      if (!response.ok) throw new Error("card_move_failed");
      const payload = (await response.json().catch(() => null)) as { card?: { id?: string; wallId?: string }; fixtureDataVersion?: number } | null;
      if (fixtureMode === "q2-b7") {
        if (payload?.card?.id !== cardId || payload.card.wallId !== targetWallId || typeof payload.fixtureDataVersion !== "number") throw new Error("card_move_invalid_response");
        latestAppliedDataVersionRef.current = payload.fixtureDataVersion;
      }
    } catch { setBoardWalls(previousWalls); setCardMoveError("카드를 다른 섹션으로 이동하지 못했습니다. 다시 시도해주세요."); }
    finally { teacherCardMoveInFlight.current = false; setMovingTeacherCardId(null); }
    refreshBoard();
  }
  function openCardEditor(card: WallCard, opener?: HTMLElement | null) {
    rememberDialogOpener(editCardDialogOpenerRef, opener);
    setCardActionError(null);
    setEditingCard(card);
    setEditCardText(card.text);
  }

  async function saveCardEdit() {
    if (!editingCard) return;
    const text = editCardText.trim();
    if (!text) {
      setCardActionError("카드 내용을 입력해주세요.");
      return;
    }
    setCardActionError(null);
    const response = await fetch(
      routes.api.v1("dashboard", "cards", editingCard.id, "update"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setCardActionError(payload?.error ?? "카드를 수정하지 못했습니다.");
      return;
    }
    setEditingCard(null);
    setEditCardText("");
    refreshBoard();
  }

  async function updateCardColor(cardId: string, token: CardColorToken) {
    setCardActionError(null);
    const previousWalls = boardWalls;
    setBoardWalls((currentWalls) =>
      currentWalls.map((entry) => ({
        ...entry,
        cards: entry.cards.map((card) =>
          card.id === cardId ? { ...card, card_color_token: token } : card,
        ),
      })),
    );
    const response = await fetch(
      routes.api.v1("dashboard", "cards", cardId, "color"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
    if (!response.ok) {
      setBoardWalls(previousWalls);
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setCardActionError(payload?.error ?? "색상 변경에 실패했어요");
      return;
    }
    refreshBoard();
  }

  async function updateCardVisibility(cardId: string, hidden: boolean) {
    const active = startTeacherBoardOperation("visibility", cardId);
    if (!active) return;
    setCardActionError(null);
    setTeacherCardMenuAnnouncement(null);
    const previousWalls = boardWalls;
    const optimisticHiddenAt = hidden ? new Date().toISOString() : null;

    setVisibilityCardIds((current) => ({ ...current, [cardId]: true }));
    setBoardWalls((currentWalls) =>
      currentWalls.map((entry) => ({
        ...entry,
        cards: entry.cards.map((card) =>
          card.id === cardId
            ? { ...card, is_hidden: hidden, hidden_at: optimisticHiddenAt }
            : card,
        ),
      })),
    );

    try {
      const response = await fetch(
        routes.api.v1("dashboard", "cards", cardId, "visibility"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden }),
        },
      );
      if (!response.ok) throw new Error(response.status >= 500 ? "card_visibility_retryable" : "card_visibility_terminal");
      const payload = (await response.json().catch(() => null)) as {
        card?: { id?: string; wallId?: string; position?: number; isHidden?: boolean; hiddenAt?: string | null };
        fixtureDataVersion?: number;
      } | null;
      if (
        payload?.card?.id !== cardId ||
        typeof payload.card.isHidden !== "boolean" ||
        payload.card.isHidden !== hidden ||
        typeof payload.card.position !== "number" ||
        typeof payload.card.wallId !== "string"
      ) throw new Error("card_visibility_invalid_response");
      if ((fixtureMode === "q2-b7" || fixtureMode === "q2-b10") && typeof payload.fixtureDataVersion === "number" && !isStaleTeacherBoardVersion(payload.fixtureDataVersion, latestAppliedDataVersionRef.current)) {
        latestAppliedDataVersionRef.current = payload.fixtureDataVersion;
      }
      if (!finishTeacherBoardOperation(active.key, active.operation.id, (state) => reconcileTeacherBoardMutation(state, active.operation.id), false)) return;
      setBoardWalls((currentWalls) => currentWalls.map((entry) => ({
        ...entry,
        cards: entry.cards.map((card) => card.id === cardId ? {
          ...card,
          is_hidden: payload.card!.isHidden,
          hidden_at: payload.card!.hiddenAt ?? null,
          position: payload.card!.position,
        } : card),
      })));
      finishTeacherBoardOperation(active.key, active.operation.id, (state) => confirmTeacherBoardMutation(state, active.operation.id));
      announceTeacherCardMenuResult(
        createTeacherCardMenuAnnouncement(
          active.operation,
          hidden ? "hide" : "restore",
          "confirmed",
        ),
      );
      refreshBoard();
    } catch (error) {
      const terminal = error instanceof Error && error.message === "card_visibility_terminal";
      if (!finishTeacherBoardOperation(active.key, active.operation.id, (state) => failTeacherBoardMutation(state, active.operation.id, terminal))) return;
      setBoardWalls(previousWalls);
      setCardActionError(
        terminal ? "카드 공개 상태를 바꿀 수 없습니다." : "카드 공개 상태를 바꾸지 못했어요. 다시 시도해주세요.",
      );
      announceTeacherCardMenuResult(
        createTeacherCardMenuAnnouncement(
          active.operation,
          hidden ? "hide" : "restore",
          terminal ? "terminal-error" : "retryable-error",
        ),
      );
    } finally {
      setVisibilityCardIds((current) => {
        const next = { ...current };
        delete next[cardId];
        return next;
      });
    }
  }

  async function updateFinalArtwork(cardId: string, final: boolean) {
    setCardActionError(null);
    const previousWalls = boardWalls;
    const response = await fetch(
      routes.api.v1("dashboard", "cards", cardId, "final-artwork"),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ final }),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setCardActionError(payload?.error ?? "최종 작품 상태를 저장하지 못했습니다.");
      return;
    }
    const payload = (await response.json().catch(() => null)) as {
      card?: { id?: string; isFinalArtwork?: boolean };
      fixtureDataVersion?: number;
    } | null;
    if (fixtureMode === "q2-b7" && (payload?.card?.id !== cardId || typeof payload.card.isFinalArtwork !== "boolean")) {
      setBoardWalls(previousWalls);
      setCardActionError("최종 작품 상태를 확인하지 못했습니다.");
      return;
    }
    if (fixtureMode === "q2-b7") {
      if (typeof payload?.fixtureDataVersion === "number") latestAppliedDataVersionRef.current = payload.fixtureDataVersion;
      setBoardWalls((current) => current.map((entry) => ({ ...entry, cards: entry.cards.map((card) => card.id === cardId ? { ...card, tags: payload!.card!.isFinalArtwork ? [{ id: `fixture-final-${cardId}`, name: "최종 작품", color: null }] : [] } : card) })));
    }
    refreshBoard();
  }

  async function deleteCard(cardId: string) {
    if (!canDeleteCards) return;
    const confirmed = window.confirm(
      "이 카드를 삭제하시겠습니까? 삭제된 카드는 휴지통으로 이동합니다.",
    );
    if (!confirmed) return;
    setCardActionError(null);
    const response = await fetch(routes.api.v1("dashboard", "cards", cardId), {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setCardActionError(payload?.error ?? "카드를 삭제하지 못했습니다.");
      return;
    }
    refreshBoard();
  }

  async function moveSection(wallId: string, direction: -1 | 1) {
    const index = boardWalls.findIndex((entry) => entry.wall.id === wallId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= boardWalls.length) return;
    const nextIds = boardWalls.map((entry) => entry.wall.id);
    [nextIds[index], nextIds[targetIndex]] = [
      nextIds[targetIndex],
      nextIds[index],
    ];
    setSectionMoveError(null);
    const response = await fetch(
      routes.api.v1("dashboard", "boards", boardId, "walls", "reorder"),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallIds: nextIds }),
      },
    );
    if (!response.ok) {
      setSectionMoveError(
        "섹션을 이동하지 못했습니다. 새로고침 후 다시 시도해주세요.",
      );
      return;
    }
    refreshBoard();
  }

  async function renameSection() {
    if (!renameTarget) return;
    const title = renameInput.trim();
    if (!title) {
      setRenameError("섹션 이름을 입력해주세요.");
      return;
    }
    const prev = boardWalls;
    setRenameError(null);
    setBoardWalls((current) => current.map((entry) => entry.wall.id === renameTarget.id ? { ...entry, wall: { ...entry.wall, title } } : entry));
    const response = await fetch(routes.api.v1("dashboard", "walls", renameTarget.id), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ boardId, title }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setBoardWalls(prev);
      setRenameError(payload?.error ?? "섹션 이름을 변경하지 못했습니다.");
      return;
    }
    setRenameTarget(null);
    setRenameInput("");
  }

  async function deleteSection(wallId: string, cardCount: number) {
    const confirmed = window.confirm(cardCount > 0 ? `이 섹션에는 ${cardCount}개의 카드가 있습니다. 카드가 있는 섹션은 먼저 카드를 이동하거나 삭제해야 합니다.` : "이 섹션을 삭제하시겠습니까?");
    if (!confirmed) return;
    const prev = boardWalls;
    if (cardCount === 0) setBoardWalls((current) => {
      const next: typeof current = [];
      for (const entry of current) {
        if (entry.wall.id !== wallId) next.push(entry);
      }
      return next;
    });
    const response = await fetch(routes.api.v1("dashboard", "walls", wallId), { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ boardId }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setBoardWalls(prev);
      setSectionMoveError(payload?.error ?? "섹션을 삭제하지 못했습니다.");
    }
  }
  return (
    <main
      ref={boardRootRef}
      data-board-runtime="teacher-board-canonical"
      data-teacher-workshop="paper-board"
      data-hud-theme-surface="dashboard-board"
      data-moving-card-id={movingTeacherCardId ?? undefined}
      style={boardRuntimeStyle}
      onPointerMove={handleTeacherCardPointerMove}
      onPointerUp={handleTeacherCardPointerUp}
      onPointerCancel={handleTeacherCardPointerCancel}
      className={`${styles.workspace} hud-board-shell relative flex min-h-[calc(100vh-32px)] max-w-full flex-col gap-3 overflow-x-clip bg-[var(--theme-bg)] px-4 pb-4 pt-3 text-[var(--theme-text)] antialiased xl:px-5 xl:pb-5 ${teacherCardDragState.phase === "dragging" ? "cursor-grabbing select-none" : ""}`}
    >
      <header
        data-testid="canonical-board-hud"
        data-expanded={headerExpanded ? "true" : "false"}
        className={`${styles.boardHeader} group hud-top-chrome sticky top-2 z-40 overflow-visible rounded-2xl border border-cyan-300/20 bg-slate-950/90 px-5 py-4 shadow-[0_8px_38px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:px-6`}
        onMouseEnter={() => setHeaderExpanded(true)}
        onMouseLeave={() => setHeaderExpanded(false)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (!nextTarget || !event.currentTarget.contains(nextTarget))
            setHeaderExpanded(false);
        }}
      >
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className={`${styles.headerKicker} text-[10px] font-black tracking-[0.16em] text-slate-200`}>
              교사 수업 작업대
            </p>
            <h1 className={`${styles.headerTitle} mt-1 truncate text-[1.78rem] font-semibold tracking-[0.01em] text-slate-50 [text-rendering:geometricPrecision] sm:text-[1.96rem]`}>
              {boardTitle}
            </h1>
          </div>
          <div className={`${styles.headerSummary} flex items-end justify-between gap-4 sm:justify-end`}>
            <dl data-teacher-board-summary="true" className="hidden grid-cols-2 gap-4 text-right text-xs sm:grid">
              <div>
                <dt className="font-bold text-[var(--theme-text-muted)]">활동 칸</dt>
                <dd className="mt-0.5 text-lg font-black tabular-nums text-[var(--theme-text)]">{boardSummary.sectionCount}</dd>
              </div>
              <div>
                <dt className="font-bold text-[var(--theme-text-muted)]">카드</dt>
                <dd className="mt-0.5 text-lg font-black tabular-nums text-[var(--theme-text)]">{boardSummary.cardCount}</dd>
              </div>
            </dl>
            <button
              ref={mobileLessonButtonRef}
              type="button"
              data-testid="mobile-lesson-tools-open"
              onClick={() => openLessonTools("mobile")}
              aria-controls="canonical-right-rail-panel"
              aria-expanded={rightRailOpen}
              className={`${styles.mobileLessonButton} inline-flex min-h-11 items-center gap-3 px-3 text-sm font-black lg:hidden`}
            >
              수업 도구
              <span aria-hidden>→</span>
            </button>
            <button
              ref={headerActionsToggleRef}
              type="button"
              data-testid="mobile-board-actions-toggle"
              onClick={() => setHeaderExpanded((expanded) => !expanded)}
              aria-controls="canonical-board-hud-panel"
              aria-expanded={headerExpanded}
              className={`${styles.headerAction} inline-flex min-h-11 items-center gap-2 px-3 text-sm font-black`}
            >
              공유·설정
              <span aria-hidden>{headerExpanded ? "↑" : "↓"}</span>
            </button>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-full z-[79] h-3"
        />
        <div
          id="canonical-board-hud-panel"
          data-testid="canonical-board-hud-panel"
          aria-hidden={!headerExpanded}
          inert={!headerExpanded}
          className={`${styles.boardHeaderPanel} absolute left-0 right-0 top-[calc(100%-2px)] z-[80] origin-top rounded-b-2xl border border-t-0 border-cyan-300/25 bg-slate-950/[0.98] px-5 pb-4 pt-3 shadow-[0_18px_48px_rgba(15,23,42,0.70)] backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out ${headerExpanded ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"} group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:px-6`}
        >
          {boardDescription ? (
            <p className="mt-1 text-sm leading-[1.45] text-slate-200 sm:text-[15px]">
              {boardDescription}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-[1.45] text-slate-300 sm:text-[15px]">
              QR이나 입장 코드로 참여자를 초대하세요.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className={`${styles.headerAction} inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-cyan-300/50 bg-cyan-300/10 px-4 text-sm font-semibold tracking-[0.01em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200`}
              >
                QR 열기
              </button>
              <button
                ref={headerLessonButtonRef}
                type="button"
                onClick={() => openLessonTools("header")}
                className={`${styles.headerAction} ${styles.headerActionPrimary} inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-cyan-300/50 bg-cyan-300/10 px-4 text-sm font-semibold tracking-[0.01em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200`}
              >
                수업 활동 열기
              </button>
              <button
                type="button"
                data-testid="board-theme-mobile-open"
                onClick={(event) => openThemeDialog(headerActionsToggleRef.current ?? event.currentTarget)}
                className={`${styles.headerAction} inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-cyan-300/50 bg-cyan-300/10 px-4 text-sm font-semibold tracking-[0.01em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 xl:hidden`}
              >
                테마 설정
              </button>
              <Link
                href={teacherAiCourseNewHref({ boardId })}
                className={`${styles.courseAction} inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-slate-600 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200`}
              >
                수업 코스 만들기
              </Link>
            </div>
            <div
              className={`${styles.entryTicket} rounded-xl border border-cyan-300/30 bg-slate-900/85 px-4 py-3 text-slate-100 shadow-inner shadow-cyan-950/30`}
              aria-label="6자리 보드 입장 코드"
            >
              <p className={`${styles.entryTicketLabel} text-[11px] font-semibold tracking-[0.18em] text-cyan-200`}>
                입장 코드
              </p>
              <p className={`${styles.entryTicketCode} mt-1 font-mono text-3xl font-bold leading-none tracking-[0.26em] text-cyan-100 sm:text-4xl`}>
                {resolvedBoardCode}
              </p>
              <p className="mt-2 text-xs font-medium leading-5 text-slate-300">
                gkrry.com → 코드 입력 → 바로 참여
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className={styles.submissionStrip}>
        <StudentSubmissionStatusPanel
          boardId={boardId}
          summary={studentSubmissionSummary}
          onSelectCard={showStudentSubmission}
        />
      </div>
      <div className="flex flex-1 min-h-0 min-w-0 gap-2">
        <section
          data-testid="canonical-board-content"
          data-board-scroll="horizontal"
          className={`${styles.wallScroller} flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden pl-1 pr-0 scroll-pl-1`}
        >
          <div className={`${styles.wallTrack} flex min-h-0 min-w-full w-max items-start gap-3 pb-2`}>
            {boardWalls.map(({ wall, cards }, wallIndex) => (
              <article
                key={wall.id}
                data-teacher-wall-id={wall.id}
                data-teacher-wall-dropzone="true"
                className={`${styles.wallColumn} hud-section-shell hud-content-fill flex min-h-[18rem] max-h-[calc(100vh-14rem)] w-[clamp(320px,28vw,420px)] shrink-0 flex-col rounded-2xl shadow-sm`}
              >
                <div className={`${styles.wallHeader} border-b border-[var(--theme-border)] px-4 py-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`${styles.wallIndex} text-[10px]`}>활동 칸 {String(wallIndex + 1).padStart(2, "0")}</p>
                      <h2 className="text-[1.05rem] font-semibold tracking-tight text-[var(--theme-text)]">
                        {wall.title}
                      </h2>
                      {wall.description ? (
                        <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
                          {wall.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)]/60 p-0.5"
                        role="group"
                        aria-label="섹션 위치 이동"
                      >
                        <button
                          type="button"
                          aria-label="섹션 왼쪽으로 이동"
                          title={boardWalls[0]?.wall.id === wall.id ? "이미 첫 번째 섹션입니다" : "섹션을 왼쪽으로 이동"}
                          onClick={() => void moveSection(wall.id, -1)}
                          disabled={boardWalls[0]?.wall.id === wall.id}
                          className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 text-sm font-bold text-[var(--theme-text)] shadow-sm hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/45 disabled:cursor-not-allowed disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-muted)] disabled:opacity-75 disabled:hover:bg-[var(--theme-surface-muted)]"
                        >
                          <span aria-hidden className="text-base leading-none">←</span>
                          <span className="hidden text-xs font-semibold sm:inline">왼쪽</span>
                        </button>
                        <button
                          type="button"
                          aria-label="섹션 오른쪽으로 이동"
                          title={boardWalls[boardWalls.length - 1]?.wall.id === wall.id ? "이미 마지막 섹션입니다" : "섹션을 오른쪽으로 이동"}
                          onClick={() => void moveSection(wall.id, 1)}
                          disabled={boardWalls[boardWalls.length - 1]?.wall.id === wall.id}
                          className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 text-sm font-bold text-[var(--theme-text)] shadow-sm hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/45 disabled:cursor-not-allowed disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-muted)] disabled:opacity-75 disabled:hover:bg-[var(--theme-surface-muted)]"
                        >
                          <span aria-hidden className="text-base leading-none">→</span>
                          <span className="hidden text-xs font-semibold sm:inline">오른쪽</span>
                        </button>
                      </div>
                      <div
                        className="shrink-0"
                        onPointerDownCapture={(event) => rememberMenuTrigger(sectionMenuTriggerRefs, wall.id, event.currentTarget)}
                        onFocusCapture={(event) => rememberMenuTrigger(sectionMenuTriggerRefs, wall.id, event.currentTarget)}
                      >
                        <MoreMenu label="섹션 메뉴" menuClassName={`${styles.paperMenu} z-[10000] w-44 rounded-xl border border-[var(--theme-border)] bg-slate-950/95 p-2 shadow-2xl backdrop-blur`} contentClassName="flex flex-col gap-1" closeOnSelect>
                          <button type="button" role="menuitem" onClick={() => openRenameDialog({ id: wall.id, title: wall.title }, sectionMenuTriggerRefs.current[wall.id])} className={cardMenuItemClass}>이름 바꾸기</button>
                          <button type="button" role="menuitem" onClick={() => void deleteSection(wall.id, cards.length)} className={cardMenuDangerItemClass}>삭제</button>
                        </MoreMenu>
                      </div>
                      <span className={`${styles.cardCount} inline-flex h-8 min-w-8 items-center border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2 text-xs font-semibold text-[var(--theme-text)]/90`}>
                        {cards.length}장
                      </span>
                    </div>
                  </div>
                </div>
                <div data-teacher-card-composer="true"
                  className={`${styles.composer} border-b border-[var(--theme-border)] px-4 py-3`}>
                  <textarea
                    data-testid={`teacher-card-input-${wall.id}`}
                    value={cardDrafts[wall.id] ?? ""}
                    onChange={(event) =>
                      setCardDrafts((prev) => ({
                        ...prev,
                        [wall.id]: event.target.value,
                      }))
                    }
                    placeholder="수업 안내나 자료 내용을 적어 보세요"
                    aria-label="새 카드 내용"
                    className="min-h-20 w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel-strong)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] outline-none focus:border-[var(--theme-accent)]"
                  />
                  <div data-teacher-card-composer-actions="true"
                    className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={(node) => {
                          sectionFileInputs.current[wall.id] = node;
                        }}
                        type="file"
                        className="hidden"
                        onChange={(event) =>
                          void onSectionFileSelected(wall.id, event)
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          sectionFileInputs.current[wall.id]?.click()
                        }
                        disabled={sectionUploadStatus[wall.id]?.uploading}
                        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sectionUploadStatus[wall.id]?.uploading
                          ? "업로드 중…"
                          : "파일 카드 추가"}
                      </button>
                    </div>
                    <button
                      type="button"
                      data-testid={`teacher-card-submit-${wall.id}`}
                      data-teacher-card-create-action="true"
                      onClick={() => void submitCard(wall.id)}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]"
                    >
                      카드 추가
                    </button>
                  </div>
                  {sectionUploadStatus[wall.id]?.error ? (
                    <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {sectionUploadStatus[wall.id]?.error}
                    </p>
                  ) : null}
                </div>
                <div
                  data-teacher-wall-scroll-container="true"
                  className="flex-1 min-h-0 overflow-y-auto p-3.5"
                >
                  {getTeacherCardDropIndicatorCandidateCount(wall.id, cards) === 0 ? (
                    <div
                      data-testid="teacher-card-drop-indicator"
                      aria-hidden="true"
                      className="pointer-events-none mb-3 h-2.5 rounded-full border border-cyan-100/90 bg-cyan-200/90 shadow-[0_0_0_4px_rgba(34,211,238,0.16),0_8px_18px_rgba(8,145,178,0.20)]"
                    />
                  ) : null}
                  {cards.length === 0 ? (
                    <div
                      data-testid="teacher-empty-wall-hint"
                      className={`${styles.emptyWallHint} rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-muted)]/80 px-3 py-4 text-xs text-[var(--theme-text-muted)]`}
                    >
                      <p className="font-semibold text-[var(--theme-text)]">
                        아직 카드가 없어요
                      </p>
                      <p className="mt-1 leading-5">
                        위의 <span className="font-semibold">카드 추가</span>를 눌러 수업 안내나 자료를 먼저 적어 보세요.
                      </p>
                    </div>
                  ) : null}
                  {sectionMoveError ? (
                    <p className="mb-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {sectionMoveError}
                    </p>
                  ) : null}
                  {cardMoveError ? (
                    <p className="mb-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {cardMoveError}
                    </p>
                  ) : null}
                  <div className="space-y-3">
                    {cards.map((card, cardIndex) => {
                      const isHiddenFromStudents = card.is_hidden === true;
                      const visibilityInFlight = Boolean(visibilityCardIds[card.id]);
                      return (
                      <div key={card.id}>
                        {shouldRenderTeacherCardDropIndicatorBefore(wall.id, cards, card.id) ? (
                          <div
                            data-testid="teacher-card-drop-indicator"
                            aria-hidden="true"
                            className="pointer-events-none mb-3 h-2.5 rounded-full border border-cyan-100/90 bg-cyan-200/90 shadow-[0_0_0_4px_rgba(34,211,238,0.16),0_8px_18px_rgba(8,145,178,0.20)]"
                          />
                        ) : null}
                        <div
                          data-card-id={card.id}
                          data-card-hidden={isHiddenFromStudents ? "true" : "false"}
                          data-teacher-board-mutation-phase={teacherBoardMutationStates[`visibility:${card.id}`]?.phase ?? "idle"}
                          aria-busy={visibilityInFlight || undefined}
                          data-card-position={typeof card.position === "number" ? card.position : undefined}
                          data-card-color-tone={cardColorTone(card.card_color_token)}
                          data-teacher-wall-id={wall.id}
                          data-teacher-card-draggable="true"
                          data-teacher-card-dragging-origin={
                            teacherCardDragState.phase === "dragging" &&
                            teacherCardDragState.draggingCardId === card.id
                              ? "true"
                              : undefined
                          }
                          data-teacher-card-moving={
                            movingTeacherCardId === card.id ? "true" : undefined
                          }
                          onPointerDown={(event) =>
                            handleTeacherCardPointerDown(event, wall.id, card, cardIndex)
                          }
                          className={`${styles.cardSheet} hud-card-shell hud-content-fill overflow-visible rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-[var(--theme-border)]/40 transition-[opacity,box-shadow] motion-reduce:transition-none ${isHiddenFromStudents ? "border border-dashed border-cyan-300/45 opacity-85 ring-cyan-300/45" : ""} ${teacherCardDragState.phase === "dragging" && teacherCardDragState.draggingCardId === card.id ? "opacity-45 ring-2 ring-cyan-200/70" : ""} ${movingTeacherCardId === card.id ? "cursor-progress opacity-70 ring-2 ring-cyan-200/60" : ""} ${teacherCardDragEnabled ? "cursor-grab active:cursor-grabbing" : ""} ${cardColorClass(card.card_color_token)} ${!card.text && (card.attachments?.length ?? 0) > 0 ? "min-h-[180px]" : ""}`}
                        >
                        <div className="relative z-10 mb-2 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isHiddenFromStudents ? (
                              <span className={`${styles.statusBadge} border border-cyan-700/35 bg-cyan-100/90 px-2 py-0.5 text-[11px] font-bold text-cyan-950 shadow-sm`}>
                                학생에게 숨김
                              </span>
                            ) : null}
                            {isFinalArtwork(card.tags) ? (
                              <span className={`${styles.statusBadge} ${styles.finalBadge} border border-cyan-700/40 bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-950 shadow-sm`}>
                                최종 작품
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                            className="mr-1 inline-flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)]/60 p-0.5"
                            role="group"
                            aria-label="카드 위치 이동"
                            data-teacher-card-order-controls="true"
                            data-no-card-drag
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void moveCardInSection(wall.id, card.id, -1);
                              }}
                              disabled={cardIndex === 0 || Boolean(movingTeacherCardId)}
                              title={cardIndex === 0 ? "이미 첫 번째 카드입니다" : "카드를 위로 이동"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-sm font-bold text-[var(--theme-text)] shadow-sm hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/45 disabled:cursor-not-allowed disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-muted)] disabled:opacity-75 disabled:hover:bg-[var(--theme-surface-muted)]"
                              aria-label="카드 위로 이동"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void moveCardInSection(wall.id, card.id, 1);
                              }}
                              disabled={cardIndex === cards.length - 1 || Boolean(movingTeacherCardId)}
                              title={cardIndex === cards.length - 1 ? "이미 마지막 카드입니다" : "카드를 아래로 이동"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] text-sm font-bold text-[var(--theme-text)] shadow-sm hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/45 disabled:cursor-not-allowed disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-muted)] disabled:opacity-75 disabled:hover:bg-[var(--theme-surface-muted)]"
                              aria-label="카드 아래로 이동"
                            >
                              ↓
                            </button>
                          </div>
                          <div
                            className="shrink-0"
                            onPointerDownCapture={(event) => rememberMenuTrigger(cardMenuTriggerRefs, card.id, event.currentTarget)}
                            onFocusCapture={(event) => rememberMenuTrigger(cardMenuTriggerRefs, card.id, event.currentTarget)}
                          >
                            <MoreMenu
                              label="카드 메뉴 열기"
                              closeOnSelect
                              triggerClassName="h-7 w-7 rounded-md border-[var(--theme-border)] bg-[var(--theme-surface)] p-0 text-[var(--theme-text-muted)] shadow-none hover:bg-[var(--theme-surface-muted)] focus-visible:ring-cyan-300/40"
                              menuClassName={`${styles.paperMenu} min-w-[220px] rounded-xl border border-cyan-300/20 bg-slate-950 p-2 text-slate-100 shadow-[0_18px_42px_rgba(0,0,0,0.45),0_0_24px_rgba(34,211,238,0.10)] backdrop-blur`}
                              contentClassName="flex flex-col gap-1"
                            >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardMenuAction(() => openCardEditor(card, cardMenuTriggerRefs.current[card.id]));
                              }}
                              disabled={card.owner_id !== currentUserId}
                              title={
                                card.owner_id !== currentUserId
                                  ? "내가 작성한 카드만 편집할 수 있습니다."
                                  : undefined
                              }
                              className={cardMenuItemClass}
                            >
                              편집
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardMenuAction(() => openCardViewer(card, cardMenuTriggerRefs.current[card.id]));
                              }}
                              className={cardMenuItemClass}
                            >
                              크게 보기
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              data-no-card-drag
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardMenuAction(() => {
                                  void updateCardVisibility(
                                    card.id,
                                    !isHiddenFromStudents,
                                  );
                                });
                              }}
                              disabled={visibilityInFlight || !canOperateCards}
                              className={cardMenuItemClass}
                            >
                              {isHiddenFromStudents
                                ? "학생에게 공개하기"
                                : "학생에게 숨기기"}
                            </button>
                            <div className="teacher-board-menu-rule my-1 h-px bg-cyan-300/10" />
                            {card.author_type === "student" && canOperateCards ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  runCardMenuAction(() => {
                                    void updateFinalArtwork(card.id, !isFinalArtwork(card.tags));
                                  });
                                }}
                                className={cardMenuItemClass}
                              >
                                {isFinalArtwork(card.tags) ? "최종 작품 해제" : "최종 작품으로 표시"}
                              </button>
                            ) : null}
                            {card.author_type === "student" ? <div className="teacher-board-menu-rule my-1 h-px bg-cyan-300/10" /> : null}
                            <div className="teacher-board-menu-heading px-3 pb-1 pt-1 text-[11px] font-semibold tracking-[0.12em] text-slate-400">
                              카드 색상 변경
                            </div>
                            <div
                              className="grid grid-cols-2 gap-1 px-1"
                              role="group"
                              aria-label="카드 색상"
                            >
                              {CARD_COLOR_OPTIONS.map((option) => {
                                const selected =
                                  (card.card_color_token ?? "default") ===
                                  option.token;
                                return (
                                  <button
                                    key={option.label}
                                    type="button"
                                    role="menuitem"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      runCardMenuAction(() => {
                                        void updateCardColor(
                                          card.id,
                                          option.token,
                                        );
                                      });
                                    }}
                                    disabled={card.owner_id !== currentUserId}
                                    className={`teacher-board-menu-item flex h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium text-slate-100 hover:bg-cyan-300/10 focus:bg-cyan-300/10 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent ${selected ? "bg-cyan-300/10 ring-1 ring-cyan-200/30" : ""}`}
                                  >
                                    <span
                                      className={`h-3.5 w-3.5 rounded-full border border-white/30 ${option.swatchClass}`}
                                    />
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="teacher-board-menu-rule my-1 h-px bg-cyan-300/10" />
                            {canOperateCards ? <>
                              <div className="teacher-board-menu-heading px-3 pb-1 pt-1 text-[11px] font-semibold tracking-[0.12em] text-slate-400">섹션으로 이동</div>
                              {boardWalls.filter((entry) => entry.wall.id !== wall.id).map((entry) => <button key={entry.wall.id} type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); runCardMenuAction(() => { void moveCardToWall(card.id, entry.wall.id); }); }} className={cardMenuItemClass}>“{entry.wall.title}”로 이동</button>)}
                              <div className="teacher-board-menu-rule my-1 h-px bg-cyan-300/10" />
                            </> : null}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardMenuAction(() => {
                                  cardFileInputs.current[card.id]?.click();
                                });
                              }}
                              className={cardMenuItemClass}
                            >
                              첨부 추가
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardMenuAction(() => {
                                  void moveCardInSection(wall.id, card.id, -1);
                                });
                              }}
                              disabled={cardIndex === 0 || Boolean(movingTeacherCardId)}
                              className={cardMenuItemClass}
                            >
                              위로 이동
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                runCardMenuAction(() => {
                                  void moveCardInSection(wall.id, card.id, 1);
                                });
                              }}
                              disabled={cardIndex === cards.length - 1 || Boolean(movingTeacherCardId)}
                              className={cardMenuItemClass}
                            >
                              아래로 이동
                            </button>
                            {canDeleteCards ? (
                              <>
                                <div className="teacher-board-menu-rule my-1 h-px bg-cyan-300/10" />
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    runCardMenuAction(() => {
                                      void deleteCard(card.id);
                                    });
                                  }}
                                  className={cardMenuDangerItemClass}
                                >
                                  삭제
                                </button>
                              </>
                            ) : null}
                            </MoreMenu>
                          </div>
                          <input
                            ref={(node) => {
                              cardFileInputs.current[card.id] = node;
                            }}
                            type="file"
                            className="hidden"
                            onChange={(event) =>
                              void onCardFileSelected(card.id, event)
                            }
                          />
                          <button
                            type="button"
                            data-no-card-drag
                            onClick={(event) => {
                              event.stopPropagation();
                              cardFileInputs.current[card.id]?.click();
                            }}
                            disabled={cardUploadStatus[card.id]?.uploading}
                            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] h-7 min-w-7 px-2 text-xs font-medium text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cardUploadStatus[card.id]?.uploading
                              ? "업로드 중…"
                              : "첨부"}
                          </button>
                            </div>
                        </div>
                        {card.text ? (
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-6 text-[var(--theme-text)]">
                            <LinkifiedText
                              text={card.text}
                              compact
                              linkClassName="text-cyan-200 hover:text-cyan-100 focus-visible:ring-cyan-200 focus-visible:ring-offset-[var(--theme-surface)]"
                            />
                          </p>
                        ) : (
                          <p className="mb-1 text-xs text-slate-400">
                            첨부 중심 카드
                          </p>
                        )}
                        {cardUploadStatus[card.id]?.error ? (
                          <p className="mb-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                            {cardUploadStatus[card.id]?.error}
                          </p>
                        ) : null}
                        {card.attachments && card.attachments.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {card.attachments.map((attachment) => (
                              <AttachmentItem
                                key={attachment.id}
                                attachment={attachment}
                                onOpen={openAttachmentViewer}
                                onDelete={(attachment) => void deleteAttachment(attachment)}
                                deleting={attachmentDeleteStatus[attachment.id]?.deleting}
                                deleteError={attachmentDeleteStatus[attachment.id]?.error}
                              />
                            ))}
                          </div>
                        ) : null}
                        </div>
                        {teacherCardDragState.phase === "dragging" &&
                        teacherCardDragState.targetWallId === wall.id &&
                        teacherCardDragState.targetPosition ===
                          (getTeacherCardDropIndicatorCandidateCount(wall.id, cards) ?? -1) &&
                        card.id === cards[cards.length - 1]?.id ? (
                          <div
                            data-testid="teacher-card-drop-indicator"
                            aria-hidden="true"
                            className="pointer-events-none mt-3 h-2.5 rounded-full border border-cyan-100/90 bg-cyan-200/90 shadow-[0_0_0_4px_rgba(34,211,238,0.16),0_8px_18px_rgba(8,145,178,0.20)]"
                          />
                        ) : null}
                      </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
            <aside className="w-[clamp(320px,28vw,420px)] shrink-0">
              <div className={`${styles.addSectionSheet} hud-add-section hud-section-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 shadow-sm`}>
                {addingSection ? (
                  <div className="space-y-2">
                    <input
                      data-testid="teacher-section-title-input"
                      value={sectionTitle}
                      onChange={(event) => setSectionTitle(event.target.value)}
                      placeholder="섹션 이름"
                      className="w-full rounded-lg border border-[var(--theme-border)] px-2.5 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        data-testid="teacher-section-create-submit"
                        onClick={() => void submitSection()}
                        className="rounded-lg bg-[var(--theme-accent)] px-3 py-1.5 text-xs font-medium text-[var(--theme-action-text)]"
                      >
                        생성
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingSection(false)}
                        className="rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {boardWalls.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-muted)]/80 px-4 py-4 text-sm text-[var(--theme-text-muted)]">
                        <p className="text-base font-semibold text-[var(--theme-text)]">아직 섹션이 없습니다</p>
                        <p className="mt-2">수업을 시작하기 전에 첫 섹션을 만들어 주세요.</p>
                        <p className="mt-2 text-xs">예: 오늘의 질문, 사진 올리기, 교안 자료, 모둠별 정리</p>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      data-testid="teacher-section-create-open"
                      onClick={() => setAddingSection(true)}
                      className="w-full rounded-xl border border-dashed border-[var(--theme-accent)]/45 bg-[var(--theme-surface-muted)] px-4 py-7 text-base font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-surface)]"
                    >
                      {boardWalls.length === 0 ? "첫 섹션 만들기" : "섹션 추가"}
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
        {rightRailOpen ? (
          <button
            type="button"
            data-testid="canonical-mobile-tools-backdrop"
            aria-label="수업 진행 도구 닫기"
            onClick={() => closeRightRail()}
            className={`${styles.mobileBackdrop} fixed inset-0 z-[70] lg:hidden`}
          />
        ) : null}
        <aside
          data-testid="canonical-right-rail"
          data-board-rail-client-ready={rightRailClientReady ? "true" : "false"}
          data-expanded={rightRailOpen ? "true" : "false"}
          className="pointer-events-none fixed inset-0 z-[80] overflow-visible lg:inset-auto lg:right-3 lg:top-1/2 lg:z-40 lg:block lg:-translate-y-1/2"
          onMouseEnter={openRightRail}
          onMouseLeave={closeRightRailSoon}
          onFocusCapture={clearRightRailCloseTimer}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (!nextTarget || !event.currentTarget.contains(nextTarget))
              closeRightRailSoon();
          }}
        >
          <button
            ref={rightRailTriggerRef}
            type="button"
            onClick={() => {
              clearRightRailCloseTimer();
              if (rightRailOpen) closeRightRail();
              else {
                rightRailOpenSourceRef.current = "rail";
                setRightRailOpen(true);
                window.requestAnimationFrame(() => rightRailFirstTabRef.current?.focus());
              }
            }}
            className={`${styles.toolRailTrigger} absolute right-0 top-1/2 hidden min-h-40 w-14 -translate-y-1/2 items-center justify-center rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-2 py-4 text-[11px] font-semibold tracking-[0.16em] text-cyan-100 shadow-[0_18px_42px_rgba(0,0,0,0.38)] transition-[opacity,border-color] duration-150 [writing-mode:vertical-rl] hover:border-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 lg:flex ${rightRailOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"}`}
            aria-expanded={rightRailOpen}
            aria-controls="canonical-right-rail-panel"
          >
            수업 진행 도구
          </button>
          <div
            aria-hidden={!rightRailOpen}
            className="pointer-events-none absolute right-0 top-1/2 h-44 w-4 -translate-y-1/2 bg-transparent"
          />
          <div
            ref={rightRailPanelRef}
            id="canonical-right-rail-panel"
            data-testid="canonical-right-rail-panel"
            data-state={rightRailOpen ? "open" : "closed"}
            role="dialog"
            aria-modal="true"
            aria-labelledby="canonical-right-rail-title"
            aria-hidden={!rightRailOpen}
            inert={!rightRailOpen}
            onKeyDown={handleRightRailKeyDown}
            className={`${styles.toolPanel} fixed inset-x-3 bottom-3 z-[81] flex max-h-[calc(100dvh-1.5rem)] w-auto flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/92 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.45)] transition-[opacity,transform,visibility] duration-200 ease-out lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-1/2 lg:z-auto lg:max-h-[calc(100vh-96px)] lg:w-[min(20rem,calc(100vw-2rem))] ${rightRailOpen ? "pointer-events-auto visible translate-y-0 opacity-100 lg:translate-x-0 lg:-translate-y-1/2" : "pointer-events-none invisible translate-y-[calc(100%+2rem)] opacity-0 lg:translate-x-[calc(100%+16px)] lg:-translate-y-1/2"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black tracking-[0.16em] text-[var(--theme-text-muted)]">도구 서랍</p>
                <h2 id="canonical-right-rail-title" className="mt-1 text-lg font-black tracking-tight text-[var(--theme-text)]">수업 진행 도구</h2>
              </div>
              <button
                type="button"
                onClick={() => closeRightRail()}
                className="inline-flex min-h-10 items-center border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 text-xs font-black text-[var(--theme-text)]"
              >
                닫기
              </button>
            </div>
            <div className={`${styles.toolTabs} hud-right-rail-inner mt-3 grid grid-cols-4 gap-1 rounded-xl p-1.5`} role="tablist" aria-label="수업 진행 도구 메뉴">
              {RIGHT_RAIL_TABS.map((tab, tabIndex) => (
                <button
                  ref={tabIndex === 0 ? rightRailFirstTabRef : undefined}
                  key={tab.id}
                  type="button"
                  onClick={() => setRightRailTab(tab.id)}
                  onKeyDown={(event) => handleRightRailTabKeyDown(event, tabIndex)}
                  id={`canonical-right-rail-tab-${tab.id}`}
                  role="tab"
                  aria-selected={rightRailTab === tab.id}
                  aria-controls="canonical-right-rail-tabpanel"
                  tabIndex={rightRailTab === tab.id ? 0 : -1}
                  className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition ${rightRailTab === tab.id ? `${styles.toolTabActive} bg-[var(--theme-accent)] text-[var(--theme-action-text)]` : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface)]"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div
              id="canonical-right-rail-tabpanel"
              role="tabpanel"
              aria-labelledby={`canonical-right-rail-tab-${rightRailTab}`}
              className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5"
            >
              {rightRailTab === "board" ? (
                <section className="space-y-3 text-sm text-[var(--theme-text)]">
                  <div className="hud-right-rail-inner rounded-xl p-3">
                    <p className="whitespace-nowrap text-xs text-[var(--theme-text-muted)]">
                      현재 보드
                    </p>
                    <p className="mt-1 font-semibold text-[var(--theme-text)]">
                      {boardTitle}
                    </p>
                    {boardDescription ? (
                      <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
                        {boardDescription}
                      </p>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="hud-right-rail-inner rounded-lg p-2">
                      <dt className="whitespace-nowrap text-[var(--theme-text-muted)]">
                        섹션
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[var(--theme-text)]">
                        {boardSummary.sectionCount}
                      </dd>
                    </div>
                    <div className="hud-right-rail-inner rounded-lg p-2">
                      <dt className="whitespace-nowrap text-[var(--theme-text-muted)]">
                        카드
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[var(--theme-text)]">
                        {boardSummary.cardCount}
                      </dd>
                    </div>
                    <div className="hud-right-rail-inner rounded-lg p-2">
                      <dt className="whitespace-nowrap text-[var(--theme-text-muted)]">
                        첨부
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[var(--theme-text)]">
                        {boardSummary.attachmentCount}
                      </dd>
                    </div>
                  </dl>
                  <LessonActivityLauncher
                    boardId={boardId}
                    initialActiveSession={initialActiveLessonSession}
                  />
                  <AiBingoTeacherSummary
                    summary={initialAiBingoSummary}
                    lessonTitle={initialActiveLessonSession?.title ?? null}
                    studentUrl={
                      boardAccessCode
                        ? buildStudentUrl(`/s/${boardAccessCode}`)
                        : null
                    }
                  />
                  <AiJudgmentSortTeacherSummary
                    summary={initialAiJudgmentSortSummary}
                    lessonTitle={initialActiveLessonSession?.title ?? null}
                    studentUrl={
                      boardAccessCode
                        ? buildStudentUrl(`/s/${boardAccessCode}`)
                        : null
                    }
                  />
                  <PythonStudioLiteTeacherSummary
                    summary={initialPythonStudioLiteSummary}
                    lessonTitle={initialActiveLessonSession?.title ?? null}
                    studentUrl={
                      boardAccessCode
                        ? buildStudentUrl(`/s/${boardAccessCode}`)
                        : null
                    }
                  />
                  <WebCodingLiteTeacherSummary
                    boardId={boardId}
                    summary={initialWebCodingLiteSummary}
                    lessonTitle={initialActiveLessonSession?.title ?? null}
                    studentUrl={
                      boardAccessCode
                        ? buildStudentUrl(`/s/${boardAccessCode}`)
                        : null
                    }
                  />
                  {shouldShowVibePanel ? (
                    <div className="hud-card-shell hud-right-rail-inner rounded-xl p-3">
                      <p className="text-sm font-semibold">바이브코딩 제출물</p>
                      <p className="mt-1 text-xs text-[var(--theme-text-muted)]">학생 카드에서 기획, 프롬프트, 작품 링크, 실패 기록을 빠르게 확인합니다.</p>
                      <div className="mt-3 grid grid-cols-2 gap-1 text-[11px]">
                        <p>전체 {vibeSummary.total}</p><p>기획 {vibeSummary.idea}</p><p>프롬프트 {vibeSummary.prompt}</p><p>작품 링크 {vibeSummary.workLink}</p><p>Canva 시안 {vibeSummary.canvaMockup}</p><p>실패 기록 {vibeSummary.rescue}</p><p>친구 피드백 {vibeSummary.peerFeedback}</p><p>링크 있음 {vibeSummary.hasLink}</p><p>첨부 있음 {vibeSummary.hasAttachment}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(
                          [
                            ["all", "전체"],
                            ["idea", "앱 아이디어"],
                            ["prompt", "AI 프롬프트"],
                            ["work_link", "작품 링크"],
                            ["canva_mockup", "Canva 시안"],
                            ["rescue", "실패 기록"],
                            ["peer_feedback", "친구 피드백"],
                            ["has_link", "링크 있음"],
                            ["has_attachment", "첨부 있음"],
                          ] as Array<[VibePanelFilter, string]>
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={vibeFilter === id}
                            onClick={() => setVibeFilter(id)}
                            className={`rounded-[3px] border px-2 py-1 text-[11px] font-semibold ${vibeFilter === id ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-[var(--theme-action-text)]" : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)]"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 space-y-2">
                        {filteredVibeSubmissions.length === 0 ? <p className="text-xs text-[var(--theme-text-muted)]">아직 감지된 바이브코딩 제출물이 없습니다. 학생이 카드 작성에서 템플릿 버튼을 눌러 제출하면 여기에 모입니다.</p> : null}
                        {filteredVibeSubmissions.map(({ card, wallTitle, classification }) => (
                          <div key={card.id} className="rounded-lg border border-[var(--theme-border)] p-2 text-xs">
                            <p className="text-[11px] text-[var(--theme-text-muted)]">{card.author_nickname ?? card.owner_id ?? "학생"} · {wallTitle}{card.created_at ? ` · ${new Date(card.created_at).toLocaleString("ko-KR")}` : ""}</p>
                            <p className="mt-1 line-clamp-2">{card.text || "(텍스트 없음)"}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded-[3px] border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-1.5 py-0.5 text-[var(--theme-text)]">{classification.submissionMode}</span>
                              <span className="rounded-[3px] border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-1.5 py-0.5 text-[var(--theme-text)]">{classification.sourceTool}</span>
                              {classification.hasLink ? <span className="rounded-[3px] border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-1.5 py-0.5 text-[var(--theme-text)]">링크 있음</span> : null}
                              {classification.hasAttachment ? <span className="rounded-[3px] border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-1.5 py-0.5 text-[var(--theme-text)]">첨부 있음</span> : null}
                            </div>
                            <div className="mt-2 flex gap-2">
                              {classification.primaryUrl ? <a href={classification.primaryUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--theme-accent)] underline underline-offset-2">외부 링크 열기</a> : null}
                              <button type="button" onClick={(event) => openCardViewer(card, getRightRailReturnFocusTarget() ?? event.currentTarget)} className="font-semibold text-[var(--theme-accent)] underline underline-offset-2">카드 위치 보기</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <StudentAppSourceInspector boardId={boardId} classId={null} wallId={null} cardId={null} boardAccessCode={boardAccessCode} />
                  <LessonKitLauncherPanel boardId={boardId} boardAccessCode={boardAccessCode} />
                  <div className="hud-card-shell hud-right-rail-inner rounded-xl p-3">
                    <p className="whitespace-nowrap text-xs font-semibold text-[var(--theme-text-muted)]">
                      빠른 이동
                    </p>
                    <div className="mt-3 space-y-2">
                      <BoardQuickActions boardId={boardId} />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)]">
                    팁: 수업 시작 전 섹션별로 카드 1개씩 만들고 자료를 첨부하면
                    진행이 안정적입니다.
                  </p>
                </section>
              ) : null}
              {rightRailTab === "files" ? (
                <section className="space-y-2">
                  <GoogleDriveImportPanel
                    sections={boardWalls.map(({ wall }) => ({
                      id: wall.id,
                      title: wall.title,
                    }))}
                    onImportFile={importGoogleDriveFile}
                  />
                  <p className="whitespace-nowrap text-xs font-semibold text-[var(--theme-text-muted)]">
                    현재 보드 첨부
                  </p>
                  {boardSummary.recentAttachments.length === 0 ? (
                    <p className="hud-right-rail-inner rounded-lg border-dashed px-3 py-2 text-xs text-[var(--theme-text-muted)]">
                      아직 첨부 파일이 없습니다.
                    </p>
                  ) : null}
                  {boardSummary.recentAttachments.map((entry) => (
                    <button
                      key={entry.attachment.id}
                      type="button"
                      onClick={(event) => openAttachmentViewer(entry.attachment, getRightRailReturnFocusTarget() ?? event.currentTarget)}
                      className="hud-right-rail-inner w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--theme-surface-muted)]"
                    >
                      <p className="truncate text-xs font-medium text-[var(--theme-text)]">
                        {entry.attachment.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--theme-text-muted)]">
                        {entry.attachment.contentType ?? entry.attachment.kind}
                        {formatBytes(entry.attachment.size)
                          ? ` · ${formatBytes(entry.attachment.size)}`
                          : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        섹션: {entry.wallTitle}
                        {entry.cardText
                          ? ` · 카드: ${entry.cardText.slice(0, 24)}`
                          : ""}
                      </p>
                    </button>
                  ))}
                  <Link
                    href={`/dashboard/boards/${boardId}/files`}
                    className="hud-right-rail-inner block min-h-10 whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-surface)]"
                  >
                    파일 관리 열기
                  </Link>
                </section>
              ) : null}
              {rightRailTab === "settings" ? (
                <section className="space-y-3 text-sm text-[var(--theme-text)]">
                  <div className="hud-right-rail-inner rounded-xl p-3">
                    <ThemePresetPanel
                      savedTheme={savedBoardTheme}
                      selectedTheme={previewBoardTheme}
                      status={themeSaveStatus}
                      error={themeSaveError}
                      onPreview={previewTheme}
                      onResetPreview={resetThemePreview}
                      onSave={(theme) => void saveTheme(theme)}
                    />
                  </div>
                  <div className="hud-right-rail-inner rounded-xl p-3">
                    <ThemeSelector label="교실 테마" />
                  </div>
                  <div className="hud-right-rail-inner rounded-xl p-3">
                    <BoardBackupPanel
                      boardId={boardId}
                      boardTitle={boardTitle}
                      boardDescription={boardDescription}
                      boardTheme={savedBoardTheme}
                      walls={boardWalls}
                    />
                  </div>
                  <div className="hud-right-rail-inner rounded-xl p-3">
                    <p className="whitespace-nowrap text-xs text-[var(--theme-text-muted)]">
                      보드 설정
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
                      고급 설정은 기존 설정 화면에서 관리합니다.
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/boards/${boardId}/edit`}
                    className="block min-h-10 whitespace-nowrap rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-center text-xs font-medium text-[var(--theme-action-text)]"
                  >
                    보드 설정 열기
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="block min-h-10 whitespace-nowrap rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-center text-xs font-medium text-[var(--theme-text)]"
                  >
                    교사 설정 열기
                  </Link>
                </section>
              ) : null}
              {rightRailTab === "collab" ? (
                <section className="space-y-3 text-sm text-[var(--theme-text)]">
                  <div className="hud-right-rail-inner rounded-xl p-3">
                    <p className="whitespace-nowrap text-xs text-[var(--theme-text-muted)]">
                      공유 & 접근
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-text)]">
                      소유자: {collaborationSummary.ownerLabel}
                    </p>
                    <p className="mt-1 text-xs text-[var(--theme-text)]">
                      멤버 수:{" "}
                      {collaborationSummary.memberCount === null
                        ? "확인 불가"
                        : `${collaborationSummary.memberCount}명`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
                        if (!clipboard?.writeText || typeof window === "undefined") {
                          throw new Error("Clipboard API is unavailable");
                        }
                        await clipboard.writeText(window.location.href);
                        setCopiedPrivateUrl(true);
                        setPrivateUrlCopyMessage(null);
                        window.setTimeout(() => setCopiedPrivateUrl(false), 1500);
                      } catch {
                        setCopiedPrivateUrl(false);
                        setPrivateUrlCopyMessage("복사에 실패했어요. 링크를 직접 선택해 복사해 주세요.");
                      }
                    }}
                    className="min-h-10 w-full whitespace-nowrap rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-xs font-medium text-[var(--theme-text)]"
                  >
                    {copiedPrivateUrl ? "복사됨" : "관리자 링크 복사"}
                  </button>
                  {privateUrlCopyMessage ? (
                    <p className="break-words text-xs text-[var(--theme-text-muted)]" role="status">
                      {privateUrlCopyMessage}
                    </p>
                  ) : null}
                  <p className="text-xs text-[var(--theme-text-muted)]">
                    게스트는 카드 조회/작성/첨부 가능, 보드 설정/삭제 권한은
                    없습니다.
                  </p>
                  <Link
                    href={`/dashboard/boards/${boardId}/edit`}
                    className="block min-h-10 whitespace-nowrap rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-center text-xs font-medium text-[var(--theme-action-text)]"
                  >
                    보드 관리 열기
                  </Link>
                </section>
              ) : null}
            </div>
            <p className="mt-6 text-xs text-[var(--theme-text-muted)]">
              이 도구 서랍만 따로 스크롤됩니다.
            </p>
          </div>
        </aside>
      </div>
      {teacherCardDragState.phase === "dragging" ? (
        <div
          data-testid="teacher-card-drag-overlay"
          className={`pointer-events-none fixed z-[10020] max-h-[70vh] scale-[1.015] cursor-grabbing overflow-hidden rounded-xl p-4 text-[var(--theme-text)] opacity-95 shadow-[0_24px_68px_rgba(2,6,23,0.40)] ring-2 ring-cyan-200/70 will-change-transform motion-reduce:scale-100 motion-reduce:transition-none ${cardColorClass(teacherCardDragState.snapshot.colorToken)}`}
          style={{
            left:
              teacherCardDragState.currentX -
              (teacherCardDragState.startX - teacherCardDragState.cardRect.left),
            top:
              teacherCardDragState.currentY -
              (teacherCardDragState.startY - teacherCardDragState.cardRect.top),
            width: teacherCardDragState.cardRect.width,
            minHeight: Math.min(teacherCardDragState.cardRect.height, 220),
          }}
        >
          {teacherCardDragState.snapshot.text ? (
            <p className="line-clamp-5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-6">
              {teacherCardDragState.snapshot.text}
            </p>
          ) : (
            <p className="text-xs text-slate-300">첨부 중심 카드</p>
          )}
          {teacherCardDragState.snapshot.attachmentCount > 0 ? (
            <p className="mt-3 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs font-medium">
              첨부 {teacherCardDragState.snapshot.attachmentCount}개
            </p>
          ) : null}
        </div>
      ) : null}
      {teacherCardMenuAnnouncement?.kind === "success" ? (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="teacher-card-menu-status">
          {teacherCardMenuAnnouncement.message}
        </p>
      ) : null}
      {teacherCardMenuAnnouncement && teacherCardMenuAnnouncement.kind !== "success" ? (
        <p className="sr-only" role="alert" aria-atomic="true" data-testid="teacher-card-menu-error">
          {teacherCardMenuAnnouncement.message}
        </p>
      ) : null}
      {selectedAttachment ? (
        <AttachmentViewer
          attachment={selectedAttachment}
          onClose={closeAttachmentViewer}
          openerRef={attachmentDialogOpenerRef}
        />
      ) : null}
      {cardActionError ? (
        <div className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-xl border border-rose-300/30 bg-slate-950 px-4 py-3 text-sm font-medium text-rose-200 shadow-2xl">
          {cardActionError}
        </div>
      ) : null}
      {viewingCard ? (
        <AccessibleDialog
          ariaLabelledBy="view-card-dialog-title"
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/70 p-4"
          initialFocusRef={viewCardCloseButtonRef}
          onClose={closeCardViewer}
          openerRef={viewCardDialogOpenerRef}
        >
          <article
            className={`${styles.modalSheet} max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-950 p-5 text-slate-100 shadow-[0_22px_70px_rgba(0,0,0,0.55)] ${cardColorClass(viewingCard.card_color_token)}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="view-card-dialog-title" className="text-base font-semibold">카드 보기</h3>
              <button
                ref={viewCardCloseButtonRef}
                type="button"
                onClick={closeCardViewer}
                className="rounded-lg border border-cyan-300/20 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-cyan-300/10"
              >
                닫기
              </button>
            </div>
            {viewingCard.text ? (
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
                {viewingCard.text}
              </p>
            ) : (
              <p className="text-sm text-slate-400">첨부 중심 카드</p>
            )}
            {viewingCard.attachments && viewingCard.attachments.length > 0 ? (
              <div className="mt-4 space-y-2">
                {viewingCard.attachments.map((attachment) => (
                  <AttachmentItem
                    key={attachment.id}
                    attachment={attachment}
                    onDelete={(attachment) => void deleteAttachment(attachment)}
                    deleting={attachmentDeleteStatus[attachment.id]?.deleting}
                    deleteError={attachmentDeleteStatus[attachment.id]?.error}
                    onOpen={(nextAttachment) => {
                      setViewingCard(null);
                      openAttachmentViewer(nextAttachment, viewCardDialogOpenerRef.current);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </article>
        </AccessibleDialog>
      ) : null}
      {editingCard ? (
        <AccessibleDialog
          ariaLabelledBy="edit-card-dialog-title"
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/70 p-4"
          initialFocusRef={editCardTextRef}
          onClose={closeCardEditor}
          openerRef={editCardDialogOpenerRef}
        >
          <div
            className={`${styles.modalSheet} w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-slate-950 p-5 text-slate-100 shadow-[0_22px_70px_rgba(0,0,0,0.55)]`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="edit-card-dialog-title" className="text-base font-semibold">카드 편집</h3>
            <label htmlFor="teacher-card-edit-text" className="mt-4 block text-xs font-semibold text-[var(--theme-text-muted)]">
              카드 내용
            </label>
            <textarea
              ref={editCardTextRef}
              id="teacher-card-edit-text"
              value={editCardText}
              onChange={(event) => setEditCardText(event.target.value)}
              className="mt-2 min-h-44 w-full resize-y rounded-xl border border-cyan-300/20 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-200"
              placeholder="카드 내용을 입력하세요"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                onClick={closeCardEditor}
                className="rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-cyan-300/10"
              >
                취소
              </button>
                    <button
                      type="button"
                onClick={() => void saveCardEdit()}
                className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-200"
              >
                저장
              </button>
            </div>
          </div>
        </AccessibleDialog>
      ) : null}
      {themeModalOpen ? (
        <AccessibleDialog
          ariaLabelledBy="theme-dialog-title"
          className="fixed inset-0 z-[10020] flex items-end justify-center bg-slate-950/70 p-3 sm:items-center sm:p-4"
          initialFocusRef={themeCloseButtonRef}
          onClose={closeThemeDialog}
          openerRef={themeDialogOpenerRef}
          testId="board-theme-mobile-modal"
        >
          <div
            className={`${styles.modalSheet} max-h-[86vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-2xl sm:p-5`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="theme-dialog-title" className="text-base font-semibold">테마 설정</h3>
              <button
                ref={themeCloseButtonRef}
                type="button"
                onClick={closeThemeDialog}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--theme-text)]"
              >
                닫기
              </button>
            </div>
            <ThemePresetPanel
              savedTheme={savedBoardTheme}
              selectedTheme={previewBoardTheme}
              status={themeSaveStatus}
              error={themeSaveError}
              onPreview={previewTheme}
              onResetPreview={resetThemePreview}
              onSave={(theme) => void saveTheme(theme)}
            />
          </div>
        </AccessibleDialog>
      ) : null}
      <ShareGuideModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        shareCode={normalizedBoardCode ?? ""}
        shareUrl={shareEntryUrl}
        shareEnsureStatus="success"
        onEnsureShareCode={() => undefined}
      />
      {renameTarget ? (
        <AccessibleDialog
          ariaLabelledBy="rename-section-dialog-title"
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/70 p-4"
          initialFocusRef={renameInputRef}
          onClose={closeRenameDialog}
          openerRef={renameDialogOpenerRef}
        >
          <div className={`${styles.modalSheet} w-full max-w-sm rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4`} onClick={(event) => event.stopPropagation()}>
            <h3 id="rename-section-dialog-title" className="text-base font-semibold">섹션 이름 바꾸기</h3>
            <label htmlFor="rename-section-input" className="mt-3 block text-xs font-semibold text-[var(--theme-text-muted)]">
              새 섹션 이름
            </label>
            <input
              ref={renameInputRef}
              id="rename-section-input"
              autoFocus
              value={renameInput}
              onChange={(event) => setRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void renameSection();
                }
              }}
              className="mt-2 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel-strong)] px-3 py-2 text-sm"
            />
            {renameError ? <p className="mt-2 text-xs text-rose-400">{renameError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeRenameDialog} className="rounded-md border border-[var(--theme-border)] px-3 py-1.5 text-sm">취소</button>
              <button type="button" onClick={() => void renameSection()} className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950">저장</button>
            </div>
          </div>
        </AccessibleDialog>
      ) : null}
    </main>
  );
}
