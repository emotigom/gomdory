"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";

import type { StudentBoardModel } from "@/lib/student/boardModel";
import {
  parseStudentBoardSyncResponse,
  type StudentRuntimeAuthority,
  type StudentRuntimeClassState,
} from "@/lib/student/boardSyncContract";
import {
  dispatchStudentRuntimeAuthority,
  isStudentRuntimeAuthorityEventDetail,
  STUDENT_RUNTIME_AUTHORITY_EVENT,
  StudentSmartComposeContext,
} from "./StudentComposeContext";
import BoardMiniMap from "@/app/_components/BoardMiniMap";
import HoverExpandBar from "@/app/_components/HoverExpandBar";
import ComposeCardPanel from "@/app/_components/ComposeCardPanel";
import CardAttachments from "@/app/_components/CardAttachments";
import WallColumn from "@/app/_components/WallColumn";
import { uploadFileToCard } from "@/app/dashboard/boards/[boardId]/walls/[wallId]/uploadClient";
import { normalizeViewerName, truncateViewerName } from "@/lib/share/normalizeViewerName";
import { getOrCreateStudentDeviceId } from "@/lib/student/deviceId";
import { isOwnGuestCard } from "@/lib/student/guestCardOwnership";
import { routes } from "@/lib/standards/routes";
import { normalizeHttpUrl } from "@/lib/cards/urlAttachment";
import { isVibeCodingLessonTemplateId } from "@/lib/edu/vibe-coding/lesson-03-04-ids";
import { getVibeCodingStudentMission } from "@/lib/edu/vibe-coding/lesson-03-04-student-mission";
import { useGlobalShortcut } from "@/lib/ui/useGlobalShortcut";
import { useTouchLike } from "@/lib/ui/isTouchLike";
import { shouldEnableWheelDebugTracer, useWheelDebugTracer } from "@/app/_components/useWheelDebugTracer";
import { useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";
import CommandPalette from "@/app/_components/board/commands/CommandPalette";
import KeyboardShortcutsOverlay from "@/app/_components/board/commands/KeyboardShortcutsOverlay";
import { useCommandPalette, type CommandPaletteItem } from "@/app/_components/board/commands/useCommandPalette";
import { getCapabilitySet, resolveActions, runActionWithTelemetry } from "@/lib/ui/actions/registry";
import { getStudentBoardActions } from "@/lib/ui/actions/screenActions";
import { canReorderShareCard, moveCardAcrossWalls } from "@/lib/board/cardReorder";
import { computeClampedScroll, computeEdgeScrollDelta, shouldContinueAutoScrollLoop } from "@/lib/board/dragScroll";
import { handleBoardBackgroundWheelFallback, handleDocumentWheelFallbackForBoard, isModalScrollLocked, isWheelFromWallColumn } from "@/lib/board/wheelRouting";
import VibeCodingMissionBanner from "@/app/s/[code]/_components/VibeCodingMissionBanner";
import { resolveStudentBoardTheme, normalizeGuestViewThemeId, type BoardThemeTokens, type GuestViewThemeId } from "@/lib/ui/boardTheme";
import { normalizeCardColorTone } from "@/lib/ui/cardColors";
import StudentAppSubmitPanel, { isStudentAppSubmitModalOpenForDebug } from "./StudentAppSubmitPanel";
import StudentAppGalleryPanel from "./StudentAppGalleryPanel";
import {
  classifyStudentBoardAnnouncement,
  snapshotStudentBoardAnnouncements,
  studentBoardAnnouncementMessage,
  type StudentBoardAnnouncementSnapshot,
} from "./studentBoardAnnouncement";

const CARD_DRAG_MOUSE_ACTIVATION = { delay: 200, tolerance: 5 } as const;
const CARD_DRAG_TOUCH_ACTIVATION = { delay: 320, tolerance: 10 } as const;
const STUDENT_CARD_DRAG_ENABLED = false;
const BACKGROUND_COMPOSE_MOVE_THRESHOLD_PX = 8;
const SMART_COMPOSE_OPEN_EVENT = "student-board:open-smart-compose";
const STUDENT_BOARD_SYNC_EVENT = "gom:student-board-sync-requested";
const STUDENT_BOARD_POLL_INTERVAL_MS = 7_000;
const WALL_CONTAINER_SELECTOR =
  '[data-scroll="wall-column"][data-wall-id], [data-wall-column-runtime="WallColumn-v3"][data-wall-id]';
const EMPTY_COMPOSE_ZONE_SELECTOR =
  '[data-section-empty-area="true"], [data-board-empty-area="true"], [data-cards-list]';

type StudentBoardMinimalProps = {
  boardId: string;
  model: StudentBoardModel;
  title: string;
  shareCode: string;
  viewerName?: string | null;
  shareWriteEnabled: boolean;
  classState: StudentRuntimeClassState;
  minimapMode?: "hover" | "toggle" | "always" | "hidden";
  wallpaperUrl?: string | null;
  activeLessonTemplateId?: string | null;
  boardTheme?: BoardThemeTokens | null;
};

type ComposeWall = {
  id: string;
  title: string;
  studentWriteEnabled?: boolean;
};

type EditAttachment = {
  id: string;
  type: "file" | "external";
  label: string;
  url?: string;
  deleted?: boolean;
};

type EditingState = {
  cardId: string;
  wallId: string;
  text: string;
  attachments: StudentCardAttachments;
};

type CardMoveSnapshot = {
  cardId: string;
  fromWallId: string;
  toWallId: string;
  toIndex: number;
};

type BackgroundComposePointerStart = {
  pointerId: number;
  clientX: number;
  clientY: number;
  wallId: string;
};

type StudentAttachmentPatch = {
  cardId: string;
  wallId?: string | null;
  attachments: Array<{
    id: string;
    type: "file" | "external";
    label: string;
    url: string;
    contentType?: string | null;
  }>;
};

type StudentCardAttachments = NonNullable<
  NonNullable<StudentBoardModel["columns"]>[number]["cards"][number]["meta"]
>["attachments"];

type StudentContentPatch = {
  cardId: string;
  text: string;
  attachments: StudentCardAttachments;
};

const TODAY_LESSON_KIT_ID = "namdong-ai-theory-2026-07";
const TODAY_LESSON_KIT_FALLBACK_TITLE = "남동중학교 인공지능 이론 수업";
const TODAY_LESSON_KIT_FALLBACK_DESCRIPTION =
  "텍스트·그림·소리·영상 AI가 어떻게 작동하는지 함께 알아봅니다.";

const TODAY_LESSON_KIT_PANEL_STATE = {
  expanded: "expanded",
  collapsed: "collapsed",
} as const;
const TODAY_LESSON_KIT_PANEL_CONTENT_ID = "today-lesson-kit-panel-content";
const TODAY_LESSON_KIT_PANEL_EXPAND_BUTTON_ID = "today-lesson-kit-panel-expand-button";
const ARTWORK_SUBMISSION_HELPER_PANEL_ID = "artwork-submission-helper-panel";

type ArtworkSubmissionHelperOption = {
  id: "image" | "video" | "music" | "external-link" | "html-app";
  title: string;
  badge: string;
  template: string;
  guidance: string[];
};

type ComposeArtworkTemplate = {
  id: string;
  revision: number;
  label: string;
  body: string;
  guidance: string[];
};

const ARTWORK_SUBMISSION_HELPER_OPTIONS: ArtworkSubmissionHelperOption[] = [
  {
    id: "image",
    title: "이미지 작품",
    badge: "이미지 작품 제출",
    template: [
      "작품 제목:",
      "작품 소개:",
      "사용한 AI 도구:",
      "AI가 도와준 부분:",
      "내가 직접 고친 부분:",
    ].join("\n"),
    guidance: ["대표 이미지 cover.png 또는 work.png를 첨부해 주세요."],
  },
  {
    id: "video",
    title: "영상 작품",
    badge: "영상 작품 제출",
    template: [
      "작품 제목:",
      "작품 소개:",
      "사용한 AI 도구:",
      "AI가 도와준 부분:",
      "내가 직접 고친 부분:",
      "영상 설명:",
    ].join("\n"),
    guidance: [
      "video.mp4 파일을 첨부해 주세요. 영상 길이는 20~40초 정도가 좋습니다.",
      "다운로드가 어렵다면 외부 작품 링크를 붙여넣어도 됩니다.",
    ],
  },
  {
    id: "music",
    title: "음악 작품",
    badge: "음악 작품 제출",
    template: [
      "작품 제목:",
      "작품 소개:",
      "사용한 AI 도구:",
      "AI가 도와준 부분:",
      "내가 직접 고친 부분:",
      "음악 분위기:",
    ].join("\n"),
    guidance: [
      "song.mp3, song.wav, song.m4a 파일을 첨부해 주세요.",
      "가능하면 music-cover.png도 함께 첨부해 주세요.",
    ],
  },
  {
    id: "external-link",
    title: "외부 링크 작품",
    badge: "외부 링크 작품 제출",
    template: [
      "작품 제목:",
      "작품 소개:",
      "사용한 AI 도구:",
      "AI가 도와준 부분:",
      "내가 직접 고친 부분:",
      "외부 작품 링크:",
    ].join("\n"),
    guidance: [
      "공유 링크를 본문에 붙여넣어 주세요.",
      "링크는 교사 화면에서 새 탭으로 열립니다.",
    ],
  },
  {
    id: "html-app",
    title: "HTML 작품 / 웹앱 작품",
    badge: "HTML 작품 제출",
    template: [
      "작품 제목:",
      "작품 소개:",
      "사용한 AI 도구:",
      "AI가 도와준 부분:",
      "내가 직접 고친 부분:",
      "실행 방법:",
    ].join("\n"),
    guidance: [
      "index.html이 포함된 ZIP 파일을 제출해 주세요.",
      "README.md, .gitkeep, check-files.mjs 같은 보조 파일은 자동으로 제외됩니다.",
    ],
  },
];

const TODAY_AI_INPUT_OUTPUT_ITEMS = [
  {
    title: "텍스트 AI",
    description: "질문을 이해하고 답변, 요약, 번역, 글쓰기를 도와줍니다.",
  },
  {
    title: "그림 AI",
    description: "프롬프트를 바탕으로 이미지를 만들거나 수정합니다.",
  },
  {
    title: "소리 AI",
    description: "음악, 음성, 효과음을 만들거나 분석합니다.",
  },
  {
    title: "영상 AI",
    description: "이미지와 소리를 연결해 짧은 영상이나 장면을 만듭니다.",
  },
] as const;

const TODAY_AI_CONCEPTS = [
  ["데이터", "AI가 배울 때 참고하는 예시입니다."],
  ["패턴", "AI가 데이터 속에서 찾는 반복되는 특징입니다."],
  ["프롬프트", "사람이 AI에게 주는 요청문입니다."],
  ["생성형 AI", "새 글, 그림, 소리, 영상 등을 만들어내는 AI입니다."],
  ["검토", "AI 결과가 맞는지 사람이 다시 확인하는 과정입니다."],
] as const;

type TodayLessonKitPanelState =
  (typeof TODAY_LESSON_KIT_PANEL_STATE)[keyof typeof TODAY_LESSON_KIT_PANEL_STATE];

function getTodayLessonKitPanelStorageKeyForLesson({
  boardId,
  shareCode,
  lessonKitId,
}: {
  boardId?: string;
  shareCode: string;
  lessonKitId: string;
}) {
  const boardPart = boardId ? `board:${boardId}` : "board:unknown";
  return `gomdory:student:lesson-kit-panel:${boardPart}:share:${shareCode}:lessonKit:${lessonKitId}`;
}

function hasSelectedText() {
  if (typeof window === "undefined") return false;
  return Boolean(window.getSelection()?.toString().trim());
}

function isPrimaryReactPointer(event: ReactPointerEvent<HTMLElement>) {
  if (!event.isPrimary) return false;
  if (event.pointerType === "mouse" && event.button !== 0) return false;
  return true;
}

function getPointerMoveDistance(
  start: Pick<BackgroundComposePointerStart, "clientX" | "clientY">,
  event: ReactPointerEvent<HTMLElement>,
) {
  return Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
}

function isBlockedBackgroundComposeTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;
  return Boolean(
    target.closest(
      [
        "[data-card-id]",
        "[data-card]",
        "[data-interactive='true']",
        "[data-no-compose-open]",
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
  if (isBlockedBackgroundComposeTarget(target)) return null;
  return target.closest<HTMLElement>(EMPTY_COMPOSE_ZONE_SELECTOR);
}

function getEmptyBoardWallIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;
  const emptyZone = getEmptyComposeZone(target);
  if (!emptyZone) return null;
  const wallElement = emptyZone.closest<HTMLElement>(WALL_CONTAINER_SELECTOR) ?? target.closest<HTMLElement>(WALL_CONTAINER_SELECTOR);
  return wallElement?.dataset.wallId ?? null;
}

function readTodayLessonKitPanelState(storageKey: string): TodayLessonKitPanelState {
  if (typeof window === "undefined") return TODAY_LESSON_KIT_PANEL_STATE.collapsed;

  try {
    return window.localStorage.getItem(storageKey) === TODAY_LESSON_KIT_PANEL_STATE.expanded
      ? TODAY_LESSON_KIT_PANEL_STATE.expanded
      : TODAY_LESSON_KIT_PANEL_STATE.collapsed;
  } catch {
    return TODAY_LESSON_KIT_PANEL_STATE.collapsed;
  }
}

function writeTodayLessonKitPanelState(storageKey: string, state: TodayLessonKitPanelState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, state);
  } catch {
    // Storage may be blocked in private or embedded browsers. The in-memory state still works.
  }
}

function getTodayLessonKitPanelData() {
  return {
    title: TODAY_LESSON_KIT_FALLBACK_TITLE,
    description: TODAY_LESSON_KIT_FALLBACK_DESCRIPTION,
  };
}

function TodayLessonKitPanel({
  state,
  ready,
  onCollapse,
  onExpand,
}: {
  state: TodayLessonKitPanelState;
  ready: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  const lessonKit = getTodayLessonKitPanelData();
  const collapsed = state === TODAY_LESSON_KIT_PANEL_STATE.collapsed;

  if (!ready || collapsed) {
    return (
      <section
        id={TODAY_LESSON_KIT_PANEL_CONTENT_ID}
        data-testid="today-lesson-kit-panel"
        data-state={ready ? "collapsed" : "pending"}
        className="relative z-30 mb-3 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)]/92 px-3 py-2 text-[var(--theme-text)] shadow-lg shadow-black/10 ring-1 ring-[var(--theme-border)]/40 backdrop-blur"
        aria-label="오늘의 수업 자료"
      >
        <button
          type="button"
          id={TODAY_LESSON_KIT_PANEL_EXPAND_BUTTON_ID}
          onClick={onExpand}
          className="min-w-0 truncate text-left text-xs font-bold text-[var(--theme-text)] transition hover:text-[var(--theme-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)]"
          aria-controls={TODAY_LESSON_KIT_PANEL_CONTENT_ID}
          aria-expanded={false}
          aria-label={ready ? "오늘의 수업 자료 다시 열기" : "오늘의 수업 자료 열기"}
        >
          {ready ? "오늘의 수업 자료 다시 열기" : "오늘의 수업 자료 열기"}
        </button>
      </section>
    );
  }

  return (
    <section
      id={TODAY_LESSON_KIT_PANEL_CONTENT_ID}
      data-testid="today-lesson-kit-panel"
      data-state="expanded"
      className="relative z-30 mb-3 max-h-[min(58vh,34rem)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]/92 px-3 py-3 text-[var(--theme-text)] shadow-lg shadow-black/10 ring-1 ring-[var(--theme-border)]/40 backdrop-blur sm:max-h-[min(50vh,36rem)] sm:px-4"
      aria-label="오늘의 수업 자료"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-[var(--theme-text-muted)]">오늘의 수업 자료</p>
          <h2 className="mt-1 truncate text-sm font-bold text-[var(--theme-text)] sm:text-base">
            {lessonKit.title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--theme-text-muted)] sm:text-sm">
            {lessonKit.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-xs font-bold text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)]"
            aria-controls={TODAY_LESSON_KIT_PANEL_CONTENT_ID}
            aria-expanded={true}
            aria-label="오늘의 수업 자료 접기"
          >
            접기
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 border-t border-[var(--theme-border)] pt-3 text-xs leading-5 text-[var(--theme-text-muted)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
        <div className="grid gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-[var(--theme-text-muted)]">오늘의 핵심 질문</p>
            <ul className="mt-2 grid gap-1">
              {[
                "AI는 글, 그림, 소리, 영상을 어떻게 이해할까요?",
                "AI가 만든 결과물은 왜 매번 조금씩 다를까요?",
                "AI를 사용할 때 사람이 꼭 확인해야 하는 것은 무엇일까요?",
              ].map((question) => (
                <li key={question} className="flex gap-1.5">
                  <span aria-hidden="true">·</span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            data-today-lesson-kit-note="true"
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]/70 px-3 py-2"
          >
            <p className="font-semibold text-[var(--theme-text)]">활동 안내</p>
            <ul className="mt-1 grid gap-1">
              <li>보드의 참고 사이트를 열어 AI 예시를 살펴봅니다.</li>
              <li>마음에 드는 예시나 궁금한 점을 카드로 남깁니다.</li>
              <li>AI가 잘하는 일과 사람이 확인해야 하는 일을 구분해 봅니다.</li>
            </ul>
          </div>
        </div>
        <div className="grid gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-[var(--theme-text-muted)]">AI가 다루는 입력과 출력</p>
            <p className="mt-1 text-sm font-bold text-[var(--theme-text)]">
              생성형 AI는 여러 형태의 정보를 입력받고, 새 결과물을 만들어냅니다.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {TODAY_AI_INPUT_OUTPUT_ITEMS.map((item) => (
              <article
                key={item.title}
                data-today-lesson-kit-item="true"
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]/70 px-3 py-2.5"
              >
                <h3 className="text-xs font-bold text-[var(--theme-text)]">{item.title}</h3>
                <p className="mt-2">{item.description}</p>
              </article>
            ))}
          </div>
          <div
            data-today-lesson-kit-concepts="true"
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]/70 px-3 py-2.5"
          >
            <p className="text-xs font-bold text-[var(--theme-text)]">오늘 기억할 개념</p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              {TODAY_AI_CONCEPTS.map(([term, description]) => (
                <div key={term}>
                  <dt className="font-semibold text-[var(--theme-text)]">{term}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArtworkSubmissionHelperPanel({
  open,
  disabled,
  onClose,
  onSelect,
}: {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onSelect: (option: ArtworkSubmissionHelperOption) => void;
}) {
  if (!open) return null;

  return (
    <section
      data-testid="artwork-submission-helper-panel"
      id={ARTWORK_SUBMISSION_HELPER_PANEL_ID}
      data-no-compose-open="true"
      className="relative z-30 mb-3 max-h-[min(56vh,30rem)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]/95 px-3 py-3 text-[var(--theme-text)] shadow-lg shadow-black/10 ring-1 ring-[var(--theme-border)]/40 backdrop-blur sm:max-h-[min(48vh,32rem)] sm:px-4"
      aria-label="활동 안내"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase text-[var(--theme-text-muted)]">활동 안내</p>
          <h2 className="mt-1 text-sm font-bold text-[var(--theme-text)]">무엇을 카드로 남길까요?</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-8 w-fit items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-xs font-bold text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)]"
        >
          닫기
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {ARTWORK_SUBMISSION_HELPER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-artwork-submission-helper-option="true"
            onClick={() => onSelect(option)}
            disabled={disabled}
            className="min-h-[112px] rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)]/75 px-3 py-2.5 text-left transition hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="block text-xs font-bold text-[var(--theme-text)]">{option.title}</span>
            <span className="mt-2 block text-[11px] leading-5 text-[var(--theme-text-muted)]">
              {option.guidance[0]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function normalizeStudentAttachmentPatch(detail: unknown): StudentAttachmentPatch | null {
  if (!detail || typeof detail !== "object") return null;
  const raw = detail as {
    cardId?: unknown;
    wallId?: unknown;
    attachments?: unknown;
  };
  if (typeof raw.cardId !== "string" || raw.cardId.length === 0) return null;
  if (!Array.isArray(raw.attachments) || raw.attachments.length === 0) return null;

  const attachments: StudentAttachmentPatch["attachments"] = raw.attachments
    .flatMap((attachment) => {
      if (!attachment || typeof attachment !== "object") return [];
      const item = attachment as {
        id?: unknown;
        type?: unknown;
        label?: unknown;
        url?: unknown;
        contentType?: unknown;
      };
      if (typeof item.id !== "string" || typeof item.url !== "string" || !item.url.startsWith("/")) {
        return [];
      }
      return [{
        id: item.id,
        type: item.type === "external" ? ("external" as const) : ("file" as const),
        label: typeof item.label === "string" && item.label.trim() ? item.label : "file",
        url: item.url,
        contentType: typeof item.contentType === "string" ? item.contentType : null,
      }];
    });

  if (attachments.length === 0) return null;
  return {
    cardId: raw.cardId,
    wallId: typeof raw.wallId === "string" ? raw.wallId : null,
    attachments,
  };
}

function mergeAttachmentPatchIntoColumns(
  columns: StudentBoardModel["columns"],
  patch: StudentAttachmentPatch,
): { columns: StudentBoardModel["columns"]; applied: boolean } {
  let applied = false;
  const nextColumns = columns.map((column) => {
    if (patch.wallId && column.key !== patch.wallId) return column;
    let columnChanged = false;
    const nextCards = column.cards.map((card) => {
      if (card.id !== patch.cardId) return card;
      const existing = card.meta?.attachments ?? [];
      const byId = new Map(existing.map((attachment) => [attachment.id, attachment]));
      for (const attachment of patch.attachments) {
        byId.set(attachment.id, attachment);
      }
      applied = true;
      columnChanged = true;
      return {
        ...card,
        meta: {
          ...(card.meta ?? {}),
          attachments: Array.from(byId.values()),
        },
      };
    });
    return columnChanged ? { ...column, cards: nextCards } : column;
  });
  return { columns: applied ? nextColumns : columns, applied };
}

function mergeStudentAttachmentPatches(
  columns: StudentBoardModel["columns"],
  patches: Record<string, StudentAttachmentPatch>,
): { columns: StudentBoardModel["columns"]; appliedCardIds: string[] } {
  let nextColumns = columns;
  const appliedCardIds: string[] = [];
  for (const patch of Object.values(patches)) {
    const result = mergeAttachmentPatchIntoColumns(nextColumns, patch);
    nextColumns = result.columns;
    if (result.applied) {
      appliedCardIds.push(patch.cardId);
    }
  }
  return { columns: nextColumns, appliedCardIds };
}

function mergeStudentContentPatches(
  columns: StudentBoardModel["columns"],
  patches: Record<string, StudentContentPatch>,
): { columns: StudentBoardModel["columns"]; appliedCardIds: string[] } {
  let applied = false;
  const appliedCardIds: string[] = [];
  const nextColumns = columns.map((column) => {
    let columnChanged = false;
    const nextCards = column.cards.map((card) => {
      const patch = patches[card.id];
      if (!patch) return card;
      applied = true;
      columnChanged = true;
      appliedCardIds.push(card.id);
      return {
        ...card,
        text: patch.text,
        title: toTitleFromText(patch.text),
        meta: {
          ...(card.meta ?? {}),
          attachments: patch.attachments,
        },
      };
    });
    return columnChanged ? { ...column, cards: nextCards } : column;
  });

  return { columns: applied ? nextColumns : columns, appliedCardIds };
}

function mergeStudentBoardColumns(
  currentColumns: StudentBoardModel["columns"],
  serverColumns: StudentBoardModel["columns"],
): StudentBoardModel["columns"] {
  const currentByKey = new Map(currentColumns.map((column) => [column.key, column]));
  const serverByKey = new Map(serverColumns.map((column) => [column.key, column]));
  const merged = serverColumns.map((serverColumn) => {
    const currentColumn = currentByKey.get(serverColumn.key);
    if (!currentColumn) return serverColumn;
    const currentCardsById = new Map(currentColumn.cards.map((card) => [card.id, card]));
    const cards = serverColumn.cards.map((serverCard) => {
      const currentCard = currentCardsById.get(serverCard.id);
      return currentCard && JSON.stringify(currentCard) === JSON.stringify(serverCard)
        ? currentCard
        : serverCard;
    });
    return {
      ...currentColumn,
      ...serverColumn,
      cards,
    };
  });

  for (const currentColumn of currentColumns) {
    if (serverByKey.has(currentColumn.key)) continue;
    merged.push({
      ...currentColumn,
      cards: [],
    });
  }

  return merged;
}

function areStudentBoardColumnsEqual(
  left: StudentBoardModel["columns"],
  right: StudentBoardModel["columns"],
) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

const toTitleFromText = (text: string) => {
  const [firstLine] = text.trim().split("\n");
  return firstLine || undefined;
};

function isContentPatchSettled(
  card: NonNullable<StudentBoardModel["columns"]>[number]["cards"][number] | undefined,
  patch: StudentContentPatch | undefined,
) {
  if (!card || !patch || card.text !== patch.text) return false;
  const serverAttachmentIds = new Set((card.meta?.attachments ?? []).map((attachment) => attachment.id));
  return (patch.attachments ?? [])
    .filter((attachment) => attachment.type === "file")
    .every((attachment) => serverAttachmentIds.has(attachment.id));
}

function updateStudentCardContentInColumns(
  columns: StudentBoardModel["columns"],
  input: {
    cardId: string;
    text: string;
    attachments?: StudentCardAttachments;
    externalUrl?: string | null;
  },
): StudentBoardModel["columns"] {
  return columns.map((column) => {
    let changed = false;
    const cards = column.cards.map((card) => {
      if (card.id !== input.cardId) return card;
      changed = true;
      const currentAttachments = card.meta?.attachments ?? [];
      const fileAttachments = currentAttachments.filter((attachment) => attachment.type !== "external");
      const nextExternalAttachment = input.externalUrl
        ? [{
            id: `url:${input.externalUrl}`,
            type: "external" as const,
            label: input.externalUrl,
            url: input.externalUrl,
          }]
        : [];
      const nextAttachments = [
        ...fileAttachments,
        ...nextExternalAttachment,
        ...(input.attachments ?? []).filter(
          (attachment) => !fileAttachments.some((current) => current.id === attachment.id),
        ),
      ];
      return {
        ...card,
        text: input.text,
        title: toTitleFromText(input.text),
        meta: {
          ...(card.meta ?? {}),
          attachments: nextAttachments,
        },
      };
    });
    return changed ? { ...column, cards } : column;
  });
}

export default function StudentBoardMinimal({
  boardId,
  model,
  title,
  shareCode,
  viewerName,
  shareWriteEnabled,
  classState,
  minimapMode = "hover",
  wallpaperUrl = null,
  activeLessonTemplateId = null,
  boardTheme = null,
}: StudentBoardMinimalProps) {
  const router = useRouter();
  const openSmartComposer = useContext(StudentSmartComposeContext);
  const [studentComposeReady, setStudentComposeReady] = useState(false);
  useEffect(() => setStudentComposeReady(true), []);
  const { touchLike } = useTouchLike();
  const [columns, setColumns] = useState(() => model.columns ?? []);
  const [runtimeAuthority, setRuntimeAuthority] = useState<StudentRuntimeAuthority>(() => ({
    shareWriteEnabled,
    classState,
  }));
  const [boardAnnouncement, setBoardAnnouncement] = useState({ key: "", message: "" });
  const [movePendingCount, setMovePendingCount] = useState(0);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const lastAppliedModelColumnsRef = useRef(model.columns ?? []);
  const deferredModelColumnsRef = useRef<typeof model.columns | null>(null);
  const pendingAttachmentPatchesRef = useRef<Record<string, StudentAttachmentPatch>>({});
  const pendingContentPatchesRef = useRef<Record<string, StudentContentPatch>>({});
  const syncAbortRef = useRef<AbortController | null>(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const announcementBaselineRef = useRef<StudentBoardAnnouncementSnapshot | null>(null);
  const announcedChangeKeysRef = useRef(new Set<string>());
  const hiddenAnnouncementCardIdsRef = useRef(new Set<string>());

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

  const applyServerColumns = useCallback((
    serverColumns: StudentBoardModel["columns"],
    options?: { markModelPropsApplied?: boolean },
  ) => {
    if (options?.markModelPropsApplied) {
      lastAppliedModelColumnsRef.current = serverColumns;
    }
    deferredModelColumnsRef.current = null;

    setColumns((currentColumns) => {
      const mergedColumns = mergeStudentBoardColumns(currentColumns, serverColumns);
      const mergedAttachments = mergeStudentAttachmentPatches(mergedColumns, pendingAttachmentPatchesRef.current);
      for (const cardId of mergedAttachments.appliedCardIds) {
        delete pendingAttachmentPatchesRef.current[cardId];
      }
      const mergedContent = mergeStudentContentPatches(mergedAttachments.columns, pendingContentPatchesRef.current);
      for (const cardId of mergedContent.appliedCardIds) {
        const serverCard = serverColumns.flatMap((column) => column.cards).find((card) => card.id === cardId);
        if (isContentPatchSettled(serverCard, pendingContentPatchesRef.current[cardId])) {
          delete pendingContentPatchesRef.current[cardId];
        }
      }
      return areStudentBoardColumnsEqual(currentColumns, mergedContent.columns) ? currentColumns : mergedContent.columns;
    });
  }, []);

  useEffect(() => {
    const nextModelColumns = model.columns ?? [];
    const modelColumnsChanged = lastAppliedModelColumnsRef.current !== nextModelColumns;
    if (!modelColumnsChanged) return;

    if (movePendingCount > 0 || draggingCardId) {
      deferredModelColumnsRef.current = nextModelColumns;
      return;
    }

    applyServerColumns(nextModelColumns, { markModelPropsApplied: true });
  }, [applyServerColumns, draggingCardId, model.columns, movePendingCount]);

  useEffect(() => {
    if (movePendingCount > 0 || draggingCardId) return;
    const deferredModelColumns = deferredModelColumnsRef.current;
    if (!deferredModelColumns) return;
    if (deferredModelColumns === lastAppliedModelColumnsRef.current) {
      deferredModelColumnsRef.current = null;
      return;
    }
    applyServerColumns(deferredModelColumns, { markModelPropsApplied: true });
  }, [applyServerColumns, draggingCardId, model.columns, movePendingCount]);

  const syncStudentBoard = useCallback(async (reason: "poll" | "visible" | "mutation" = "poll") => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (movePendingCount > 0 || draggingCardId || hasSelectedText()) {
      syncQueuedRef.current = true;
      return;
    }
    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    const controller = new AbortController();
    syncAbortRef.current = controller;

    try {
      const response = await fetch(routes.api.v1("share", shareCode, "sync"), {
        cache: "no-store",
        signal: controller.signal,
      });
      const rawPayload = await response.json().catch(() => null);
      if (!response.ok) return;

      const payload = parseStudentBoardSyncResponse(rawPayload);
      if (!payload) {
        dispatchStudentRuntimeAuthority({
          shareCode,
          shareWriteEnabled: false,
          classState: "idle",
        });
        console.debug("[student-board-sync] invalid payload; writes locked until valid sync", {
          reason,
        });
        return;
      }
      if (payload.boardId !== boardId) return;

      dispatchStudentRuntimeAuthority({
        shareCode,
        shareWriteEnabled: payload.shareWriteEnabled,
        classState: payload.classState,
      });
      if (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debugStudentModal") === "1" &&
        isStudentAppSubmitModalOpenForDebug(boardId, shareCode)
      ) {
        console.info("[StudentAppSubmitPanel] sync applied while modal open", {
          boardId,
          shareCode,
          reason,
        });
      }
      applyServerColumns(payload.model.columns);
      syncQueuedRef.current = false;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.debug("[student-board-sync] retry later", { reason, error });
      }
    } finally {
      syncInFlightRef.current = false;
      if (syncAbortRef.current === controller) {
        syncAbortRef.current = null;
      }
    }
  }, [applyServerColumns, boardId, draggingCardId, movePendingCount, shareCode]);

  useEffect(() => {
    if (movePendingCount > 0 || draggingCardId || !syncQueuedRef.current || hasSelectedText()) return;
    syncStudentBoard("mutation");
  }, [draggingCardId, movePendingCount, syncStudentBoard]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scheduleNextPoll = () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await syncStudentBoard("poll");
        }
        scheduleNextPoll();
      }, STUDENT_BOARD_POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncStudentBoard("visible");
        scheduleNextPoll();
      }
    };
    const handleSyncRequested = () => {
      syncStudentBoard("mutation");
    };

    scheduleNextPoll();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(STUDENT_BOARD_SYNC_EVENT, handleSyncRequested);

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      syncAbortRef.current?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(STUDENT_BOARD_SYNC_EVENT, handleSyncRequested);
    };
  }, [syncStudentBoard]);

  useEffect(() => {
    const handleStudentCardAttachmentsFinalized = (event: Event) => {
      const patch = normalizeStudentAttachmentPatch(
        event instanceof CustomEvent ? event.detail : null,
      );
      if (!patch) return;

      pendingAttachmentPatchesRef.current[patch.cardId] = {
        ...patch,
        attachments: [
          ...(pendingAttachmentPatchesRef.current[patch.cardId]?.attachments ?? []),
          ...patch.attachments,
        ],
      };

      setColumns((currentColumns) => {
        const result = mergeAttachmentPatchIntoColumns(currentColumns, patch);
        if (result.applied) {
          delete pendingAttachmentPatchesRef.current[patch.cardId];
        }
        return result.columns;
      });
    };

    window.addEventListener("gom:student-card-attachments-finalized", handleStudentCardAttachmentsFinalized);
    return () => {
      window.removeEventListener("gom:student-card-attachments-finalized", handleStudentCardAttachmentsFinalized);
    };
  }, []);
  const columnWalls = useMemo(
    () =>
      columns.map((column, index) => ({
        id: column.key,
        title: column.title,
        description: null,
        ui_width_px: 320,
        position: index,
        ui_color_token: column.uiColorToken ?? null,
        student_write_enabled: column.studentWriteEnabled ?? true,
      })),
    [columns],
  );
  const scrollRef = useRef<HTMLElement>(null!);
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      scrollRef.current = node;
    }
  }, []);

  // Device identity is browser storage-backed. Keep the hydration render
  // identity-neutral, then enable ownership actions after the client mounts.
  const [clientId, setClientId] = useState("");
  useEffect(() => {
    setClientId(getOrCreateStudentDeviceId());
  }, []);
  useEffect(() => {
    // The board's first client snapshot is a baseline, never an announcement.
    // This effect only observes stable IDs and ownership metadata, not card text.
    const snapshot = snapshotStudentBoardAnnouncements(columns.flatMap((column) => column.cards.map((card) => ({
      id: card.id,
      isOwn: isOwnGuestCard({
        authorType: card.meta?.authorType ?? null,
        authorClientId: card.meta?.authorClientId ?? null,
      }, clientId),
    }))));
    const change = classifyStudentBoardAnnouncement(
      announcementBaselineRef.current,
      snapshot,
      hiddenAnnouncementCardIdsRef.current,
    );
    if (change.type === "remote-card-hidden") {
      for (const cardId of change.cardIds) hiddenAnnouncementCardIdsRef.current.add(cardId);
    } else if (change.type === "remote-card-restored") {
      for (const cardId of change.cardIds) hiddenAnnouncementCardIdsRef.current.delete(cardId);
    }
    announcementBaselineRef.current = snapshot;
    if (!("key" in change) || announcedChangeKeysRef.current.has(change.key)) return;
    announcedChangeKeysRef.current.add(change.key);
    setBoardAnnouncement({ key: change.key, message: studentBoardAnnouncementMessage(change) });
  }, [clientId, columns]);
  const writeLocked =
    !runtimeAuthority.shareWriteEnabled || runtimeAuthority.classState === "ended";
  const chromePrefs = useDashboardChromePrefs();
  const writeLockedMessage =
    runtimeAuthority.classState === "ended"
      ? "오늘 수업은 종료되었어요. 다음에 다시 만나요!"
      : "지금은 글쓰기가 잠겨있습니다.";
  const normalizedViewerName = useMemo(
    () => normalizeViewerName(viewerName ?? ""),
    [viewerName],
  );
  const displayViewerName = useMemo(
    () => truncateViewerName(normalizedViewerName),
    [normalizedViewerName],
  );
  const guestThemeStorageKey = `gomdory:guest-view-theme:${shareCode}`;
  const [guestViewTheme, setGuestViewTheme] = useState<GuestViewThemeId>("bright");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = window.localStorage.getItem(guestThemeStorageKey);
    setGuestViewTheme(storedTheme ? normalizeGuestViewThemeId(storedTheme) : "bright");
  }, [guestThemeStorageKey]);
  const onChangeGuestViewTheme = useCallback((nextTheme: GuestViewThemeId) => {
    setGuestViewTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(guestThemeStorageKey, nextTheme);
    }
  }, [guestThemeStorageKey]);
  const resolvedThemeVars = useMemo(() => resolveStudentBoardTheme({ boardTheme, guestViewTheme }), [boardTheme, guestViewTheme]);
  const normalizedGuestViewTheme = normalizeGuestViewThemeId(guestViewTheme);
  const resolvedThemeId = normalizedGuestViewTheme === "follow-teacher" ? "follow-teacher" : normalizedGuestViewTheme;
  const isBrightTheme = resolvedThemeId === "bright";

  const boardBackgroundStyle = wallpaperUrl
    ? {
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed" as const,
      }
    : undefined;

  const boardDimOpacity = wallpaperUrl ? Number.parseFloat(resolvedThemeVars["--board-bg-dim-opacity"] ?? "0.08") : 0;
  const shouldRenderBoardDimLayer = !isBrightTheme && boardDimOpacity > 0;
  const boardSurfaceTintClassName = guestViewTheme === "high-contrast"
    ? "bg-[var(--theme-card)]/12"
    : guestViewTheme === "bright"
      ? "bg-transparent"
      : wallpaperUrl
        ? "bg-transparent"
        : "bg-[var(--theme-card)]/3";
  const boardScrollSurfaceClassName = `relative z-10 flex min-h-0 flex-1 gap-6 overflow-x-auto overflow-y-auto ${boardSurfaceTintClassName} px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+112px)] pr-[max(1.5rem,calc(env(safe-area-inset-right)+1.5rem))] overscroll-x-contain overscroll-y-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-4 sm:pr-[max(2.5rem,calc(env(safe-area-inset-right)+2.5rem))] lg:gap-7 lg:px-8 lg:pr-[max(4rem,calc(env(safe-area-inset-right)+4rem))]`;

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
    const boardRoot = document.querySelector('[data-testid="student-board-root"]');
    const boardSurface = document.querySelector('[data-testid="student-board-scroll-surface"]');
    const backgroundLayer = document.querySelector('[data-testid="student-board-background"]');
    const dimLayer = document.querySelector('[data-testid="board-background-dim-layer"]');
    if (!(boardRoot instanceof HTMLElement) || !(boardSurface instanceof HTMLElement)) return;
    const rootStyle = window.getComputedStyle(boardRoot);
    const surfaceStyle = window.getComputedStyle(boardSurface);
    const backgroundStyle = backgroundLayer instanceof HTMLElement ? window.getComputedStyle(backgroundLayer) : null;
    const dimStyle = dimLayer instanceof HTMLElement ? window.getComputedStyle(dimLayer) : null;
    const parentChain: Array<Record<string, string>> = [];
    let cursor: HTMLElement | null = boardSurface;
    while (cursor) {
      const computed = window.getComputedStyle(cursor);
      const row = {
        tag: cursor.tagName.toLowerCase(),
        testid: cursor.dataset.testid ?? "",
        className: cursor.className,
        opacity: computed.opacity,
        filter: computed.filter,
        backdropFilter: computed.backdropFilter,
        backgroundColor: computed.backgroundColor,
        backgroundImage: computed.backgroundImage,
      };
      if (computed.opacity !== "1" || computed.filter !== "none" || computed.backdropFilter !== "none" || computed.backgroundImage.includes("linear-gradient")) {
        parentChain.push(row);
      }
      cursor = cursor.parentElement;
    }
    console.debug("[student-board-theme-debug]", {
      selectedGuestViewTheme: guestViewTheme,
      normalizedGuestViewTheme,
      resolvedThemeId,
      isBrightTheme,
      boardThemeVars: {
        "--board-bg-dim-opacity": resolvedThemeVars["--board-bg-dim-opacity"],
        "--board-surface-opacity": resolvedThemeVars["--board-surface-opacity"],
      },
    });
    console.table({
      root: {
        dimOpacity: rootStyle.getPropertyValue("--board-bg-dim-opacity").trim(),
        surfaceOpacity: rootStyle.getPropertyValue("--board-surface-opacity").trim(),
        background: rootStyle.background,
        backgroundColor: rootStyle.backgroundColor,
        backgroundImage: rootStyle.backgroundImage,
        opacity: rootStyle.opacity,
        filter: rootStyle.filter,
        backdropFilter: rootStyle.backdropFilter,
      },
      surface: {
        background: surfaceStyle.background,
        backgroundColor: surfaceStyle.backgroundColor,
        opacity: surfaceStyle.opacity,
        filter: surfaceStyle.filter,
        backdropFilter: surfaceStyle.backdropFilter,
      },
      dimLayer: dimStyle ? {
        display: dimStyle.display,
        opacity: dimStyle.opacity,
        background: dimStyle.background,
        backgroundColor: dimStyle.backgroundColor,
        pointerEvents: dimStyle.pointerEvents,
        zIndex: dimStyle.zIndex,
      } : { display: "absent" },
      background: backgroundStyle ? {
        backgroundImage: backgroundStyle.backgroundImage,
        opacity: backgroundStyle.opacity,
        filter: backgroundStyle.filter,
        backdropFilter: backgroundStyle.backdropFilter,
      } : { display: "absent" },
      parentChain,
    });
  }, [guestViewTheme, isBrightTheme, normalizedGuestViewTheme, resolvedThemeId, resolvedThemeVars]);

  const lessonMode = isVibeCodingLessonTemplateId(activeLessonTemplateId) ? "vibe_coding" : null;
  const mission = getVibeCodingStudentMission(activeLessonTemplateId);

  const composeWalls: ComposeWall[] = useMemo(
    () =>
      columns.map((column) => ({
        id: column.key,
        title: column.title,
        studentWriteEnabled: column.studentWriteEnabled ?? true,
      })),
    [columns],
  );

  const [composeOpen, setComposeOpen] = useState(false);
  const [wheelDebugEnabled, setWheelDebugEnabled] = useState(false);
  const [composeWallId, setComposeWallId] = useState(composeWalls[0]?.id ?? "");
  const composeRestoreFocusRef = useRef<HTMLElement | null>(null);
  const [activeWallId, setActiveWallId] = useState(composeWalls[0]?.id ?? "");
  const [showBoardHelpPill, setShowBoardHelpPill] = useState(false);
  const [todayLessonPanelState, setTodayLessonPanelState] = useState<TodayLessonKitPanelState>(
    TODAY_LESSON_KIT_PANEL_STATE.collapsed,
  );
  const [todayLessonPanelReadyShareCode, setTodayLessonPanelReadyShareCode] = useState<string | null>(null);
  const todayLessonPanelReady = todayLessonPanelReadyShareCode === shareCode;
  const todayLessonPanelStorageKey = useMemo(
    () => getTodayLessonKitPanelStorageKeyForLesson({ boardId, shareCode, lessonKitId: TODAY_LESSON_KIT_ID }),
    [boardId, shareCode],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = "guest-board-help-pill-dismissed-v1";
    if (!window.sessionStorage.getItem(storageKey)) {
      setShowBoardHelpPill(true);
    }
  }, []);

  useEffect(() => {
    setTodayLessonPanelState(readTodayLessonKitPanelState(todayLessonPanelStorageKey));
    setTodayLessonPanelReadyShareCode(shareCode);
  }, [shareCode, todayLessonPanelStorageKey]);

  const collapseTodayLessonPanel = useCallback(() => {
    setTodayLessonPanelState(TODAY_LESSON_KIT_PANEL_STATE.collapsed);
    setTodayLessonPanelReadyShareCode(shareCode);
    writeTodayLessonKitPanelState(todayLessonPanelStorageKey, TODAY_LESSON_KIT_PANEL_STATE.collapsed);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById(TODAY_LESSON_KIT_PANEL_EXPAND_BUTTON_ID)?.focus();
      });
    }
  }, [shareCode, todayLessonPanelStorageKey]);

  const expandTodayLessonPanel = useCallback(() => {
    setTodayLessonPanelState(TODAY_LESSON_KIT_PANEL_STATE.expanded);
    setTodayLessonPanelReadyShareCode(shareCode);
    writeTodayLessonKitPanelState(todayLessonPanelStorageKey, TODAY_LESSON_KIT_PANEL_STATE.expanded);
  }, [shareCode, todayLessonPanelStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWheelDebugEnabled(shouldEnableWheelDebugTracer());
  }, []);

  useWheelDebugTracer({
    enabled: wheelDebugEnabled,
    panelOpen: composeOpen,
    panelName: "student-compose-panel",
  });

  const [columnContextMenu, setColumnContextMenu] = useState<{ wallId: string; x: number; y: number } | null>(null);
  const [cardContextMenu, setCardContextMenu] = useState<{ cardId: string; wallId: string; x: number; y: number } | null>(null);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);
  const [dragReadyCardId, setDragReadyCardId] = useState<string | null>(null);
  const [overWallId, setOverWallId] = useState<string | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const moveFailureResyncRef = useRef(false);
  const autoScrollPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollWallIdRef = useRef<string | null>(null);
  const autoScrollBoardRectRef = useRef<DOMRect | null>(null);
  const autoScrollColumnRectRef = useRef<DOMRect | null>(null);
  const autoScrollLastMeasureRef = useRef(0);
  const backgroundComposePointerStartRef = useRef<BackgroundComposePointerStart | null>(null);


  const [editing, setEditing] = useState<EditingState | null>(null);
  const [artworkSubmissionHelperOpen, setArtworkSubmissionHelperOpen] = useState(false);
  const [composeArtworkTemplate, setComposeArtworkTemplate] = useState<ComposeArtworkTemplate | null>(null);
  const [editText, setEditText] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editAttachments, setEditAttachments] = useState<EditAttachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [replacingAttachmentId, setReplacingAttachmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [deleteErrorByCardId, setDeleteErrorByCardId] = useState<Record<string, string>>({});
  const [sectionMovingCardId, setSectionMovingCardId] = useState<string | null>(null);
  const [sectionMoveErrorByCardId, setSectionMoveErrorByCardId] = useState<Record<string, string>>({});
  const attachmentsRef = useRef<HTMLDivElement | null>(null);

  const openCompose = useCallback((wallId: string, options?: { keepArtworkTemplate?: boolean }) => {
    const targetColumn = columns.find((column) => column.key === wallId);
    if (targetColumn?.studentWriteEnabled === false) {
      return;
    }
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      composeRestoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    }
    if (!options?.keepArtworkTemplate) {
      setComposeArtworkTemplate(null);
    }
    setActiveWallId(wallId);
    setComposeWallId(wallId);
    setComposeOpen(true);
    if (openSmartComposer) {
      openSmartComposer(wallId);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SMART_COMPOSE_OPEN_EVENT, { detail: { wallId } }));
    }
  }, [columns, openSmartComposer]);

  const closeArtworkSubmissionHelper = useCallback(() => {
    setArtworkSubmissionHelperOpen(false);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById(TODAY_LESSON_KIT_PANEL_EXPAND_BUTTON_ID)?.focus();
      });
    }
  }, []);

  const selectArtworkSubmissionType = useCallback((option: ArtworkSubmissionHelperOption) => {
    const targetWallId = composeWallId || activeWallId || composeWalls[0]?.id || "";
    if (!targetWallId) return;
    setComposeArtworkTemplate({
      id: option.id,
      revision: Date.now(),
      label: option.badge,
      body: option.template,
      guidance: option.guidance,
    });
    setArtworkSubmissionHelperOpen(false);
    openCompose(targetWallId, { keepArtworkTemplate: true });
  }, [activeWallId, composeWallId, composeWalls, openCompose]);


  const handleBoardMainPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    backgroundComposePointerStartRef.current = null;
    if (writeLocked || composeOpen) return;
    if (event.defaultPrevented) return;
    if (!isPrimaryReactPointer(event)) return;

    const targetWallId = getEmptyBoardWallIdFromTarget(event.target);
    if (!targetWallId) return;
    if (!composeWalls.some((wall) => wall.id === targetWallId)) return;

    backgroundComposePointerStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      wallId: targetWallId,
    };
  }, [composeOpen, composeWalls, writeLocked]);

  const handleBoardMainPointerUpCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = backgroundComposePointerStartRef.current;
    backgroundComposePointerStartRef.current = null;
    if (!start) return;
    if (writeLocked || composeOpen) return;
    if (event.defaultPrevented) return;
    if (!isPrimaryReactPointer(event)) return;
    if (event.pointerId !== start.pointerId) return;
    if (getPointerMoveDistance(start, event) > BACKGROUND_COMPOSE_MOVE_THRESHOLD_PX) return;
    if (hasSelectedText()) return;

    const targetWallId = getEmptyBoardWallIdFromTarget(event.target);
    if (!targetWallId || targetWallId !== start.wallId) return;

    event.preventDefault();
    event.stopPropagation();
    openCompose(start.wallId);
  }, [composeOpen, openCompose, writeLocked]);

  const handleBoardMainPointerCancelCapture = useCallback(() => {
    backgroundComposePointerStartRef.current = null;
  }, []);

  const closeComposeWithFocusRestore = () => {
    setComposeOpen(false);
    setComposeArtworkTemplate(null);
    const restoreTarget = composeRestoreFocusRef.current;
    composeRestoreFocusRef.current = null;
    if (restoreTarget) {
      requestAnimationFrame(() => {
        restoreTarget.focus({ preventScroll: true });
      });
    }
  };

  const openEdit = useCallback((card: (typeof columns)[number]["cards"][number], wallId: string) => {
    const existingAttachments = card.meta?.attachments ?? [];
    const attachments = existingAttachments.map((att) => ({
      id: att.id,
      type: att.type,
      label: att.label,
      url: att.url,
    })) as EditAttachment[];

    const initialText = (card.text ?? "").trim();
    const nextText = initialText === "첨부 파일" && attachments.length > 0 ? "" : initialText;

    setEditing({ cardId: card.id, wallId, text: nextText, attachments: existingAttachments });
    setEditText(nextText);
    setEditUrl(
      attachments.find((att) => att.type === "external")?.url ?? "",
    );
    setEditAttachments(attachments);
    setNewFiles([]);
    setEditError(null);
  }, []);

  const closeEdit = () => {
    if (saving || replacingAttachmentId) return;
    setEditing(null);
    setEditText("");
    setEditUrl("");
    setEditAttachments([]);
    setNewFiles([]);
    setReplacingAttachmentId(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const trimmedUrl = editUrl.trim();
    if (trimmedUrl.length > 0 && !normalizeHttpUrl(trimmedUrl)) {
      setEditError("URL은 http:// 또는 https://로 시작해야 합니다.");
      return;
    }

    setSaving(true);
    setEditError(null);

    try {
      const patchRes = await fetch(routes.api.v1("share", shareCode, "cards", editing.cardId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, text: editText, content: editText, url: editUrl }),
      });
      const patchPayload = (await patchRes.json().catch(() => null)) as
        | { ok?: boolean; text?: string; error?: { message?: string } }
        | null;
      if (!patchRes.ok) {
        throw new Error(patchPayload?.error?.message ?? "카드 수정에 실패했습니다.");
      }

      const normalizedEditUrl = normalizeHttpUrl(editUrl.trim());
      const uploadedAttachments: StudentCardAttachments = [];
      for (const file of newFiles) {
        const uploadResult = await uploadFileToCard(editing.cardId, file, {
          initiateUrl: routes.api.v1("share", shareCode, "cards", editing.cardId, "files", "initiate"),
          finalizeUrl: (fileId) => routes.api.v1("share", shareCode, "files", fileId, "finalize"),
          initiateBodyExtras: { clientId },
          finalizeBody: { clientId },
        });
        if (!uploadResult.ok) {
          throw new Error(uploadResult.error);
        }
        uploadedAttachments.push({
          id: uploadResult.fileId,
          type: "file",
          label: file.name,
          url: routes.api.v1("share", shareCode, "files", uploadResult.fileId, "download"),
          contentType: file.type || null,
        });
      }

      setColumns((currentColumns) => {
        const nextColumns = updateStudentCardContentInColumns(currentColumns, {
          cardId: editing.cardId,
          text: patchPayload?.text ?? editText.trim(),
          attachments: uploadedAttachments,
          externalUrl: normalizedEditUrl,
        });
        const updatedCard = nextColumns
          .flatMap((column) => column.cards)
          .find((card) => card.id === editing.cardId);
        pendingContentPatchesRef.current[editing.cardId] = {
          cardId: editing.cardId,
          text: updatedCard?.text ?? patchPayload?.text ?? editText.trim(),
          attachments: updatedCard?.meta?.attachments ?? editing.attachments,
        };
        return nextColumns;
      });
      setEditing(null);
      setEditText("");
      setEditUrl("");
      setEditAttachments([]);
      setNewFiles([]);
      setReplacingAttachmentId(null);
      setEditError(null);
      window.dispatchEvent(new Event(STUDENT_BOARD_SYNC_EVENT));
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "카드 수정에 실패했습니다.";
      setEditError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async () => {
    if (!editing) return;
    if (!window.confirm("이 카드를 삭제할까요?")) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(routes.api.v1("share", shareCode, "cards", editing.cardId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "카드 삭제에 실패했습니다.");
      }
      setEditing(null);
      setEditText("");
      setEditUrl("");
      setEditAttachments([]);
      setNewFiles([]);
      setReplacingAttachmentId(null);
      setEditError(null);
      setColumns((currentColumns) =>
        currentColumns.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.id !== editing.cardId),
        })),
      );
      window.dispatchEvent(new Event(STUDENT_BOARD_SYNC_EVENT));
    } catch (error) {
      const message = error instanceof Error ? error.message : "카드 삭제에 실패했습니다.";
      setEditError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteOwnCard = useCallback(async (cardId: string) => {
    if (!window.confirm("이 카드를 삭제할까요?")) return;
    setDeletingCardId(cardId);
    setDeleteErrorByCardId((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
    try {
      const res = await fetch(routes.api.v1("share", shareCode, "cards", cardId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "삭제하지 못했어요. 다시 시도해 주세요.");
      }
      setColumns((currentColumns) =>
        currentColumns.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.id !== cardId),
        })),
      );
      window.dispatchEvent(new Event(STUDENT_BOARD_SYNC_EVENT));
    } catch (error) {
      const message = error instanceof Error ? error.message : "삭제하지 못했어요. 다시 시도해 주세요.";
      setDeleteErrorByCardId((current) => ({ ...current, [cardId]: message }));
    } finally {
      setDeletingCardId((current) => (current === cardId ? null : current));
    }
  }, [clientId, shareCode]);

  useGlobalShortcut({
    key: "n",
    enabled: !writeLocked,
    onTrigger: () => {
      const targetWallId = composeWallId || composeWalls[0]?.id || "";
      if (!targetWallId) return;
      openCompose(targetWallId);
    },
  });

  useGlobalShortcut({
    key: "Escape",
    enabled: composeOpen,
    onTrigger: () => {
      closeComposeWithFocusRestore();
    },
  });

  useEffect(() => {
    const board = scrollRef.current;
    if (!board) return;

    const wheelDebug = shouldEnableWheelDebugTracer();

    const handleBoardWheelCapture = (event: WheelEvent) => {
      const before = wheelDebug
        ? {
            top: board.scrollTop,
            left: board.scrollLeft,
            defaultPrevented: event.defaultPrevented,
          }
        : null;
      const handled = handleBoardBackgroundWheelFallback(board, event);

      if (wheelDebug) {
        console.info("[wheel-debug] board-main-capture", {
          board: "student",
          gotWheel: true,
          target: event.target instanceof Element ? event.target.tagName.toLowerCase() : "unknown",
          fromWallColumn: isWheelFromWallColumn(event.target),
          handled,
          preventDefaultCalled: !before?.defaultPrevented && event.defaultPrevented,
          before,
          after: { top: board.scrollTop, left: board.scrollLeft, defaultPrevented: event.defaultPrevented },
        });
      }
    };

    const handleDocumentWheelCapture = (event: WheelEvent) => {
      if (isModalScrollLocked()) return;
      const handled = handleDocumentWheelFallbackForBoard(board, event);
      if (wheelDebug && handled) {
        console.info("[wheel-debug] document-fallback-routed", {
          board: "student",
          handled,
          target: event.target instanceof Element ? event.target.tagName.toLowerCase() : "unknown",
        });
      }
    };

    board.addEventListener("wheel", handleBoardWheelCapture, { capture: true, passive: false });
    document.addEventListener("wheel", handleDocumentWheelCapture, { capture: true, passive: false });
    return () => {
      board.removeEventListener("wheel", handleBoardWheelCapture, { capture: true });
      document.removeEventListener("wheel", handleDocumentWheelCapture, { capture: true });
    };
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const canDragCard = useCallback((cardId: string) => {
    // 학생 화면에서는 카드 순서/위치 저장이 완전히 보장되지 않으므로 드래그 이동 핸들을 노출하지 않는다.
    // 섹션 이동은 후속 명시적 UI로 제공한다.
    if (!STUDENT_CARD_DRAG_ENABLED) return false;

    for (const column of columns) {
      const found = column.cards.find((card) => card.id === cardId);
      if (!found) continue;
      return canReorderShareCard(found.meta?.authorClientId ?? null, clientId);
    }
    return false;
  }, [clientId, columns]);

  const onCardHoldStart = useCallback((cardId: string) => {
    if (!canDragCard(cardId)) return;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => setDragReadyCardId(cardId), 200);
  }, [canDragCard, clearHoldTimer]);

  const onCardHoldEnd = useCallback((cardId: string) => {
    clearHoldTimer();
    setDragReadyCardId((current) => (current === cardId ? null : current));
  }, [clearHoldTimer]);


  const parseCardSortableId = useCallback((value: string) => (value.startsWith("card:") ? value.slice(5) : null), []);
  const parseWallDroppableId = useCallback((value: string) => (value.startsWith("wall:") ? value.slice(5) : null), []);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: CARD_DRAG_MOUSE_ACTIVATION,
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: CARD_DRAG_TOUCH_ACTIVATION,
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const stopAutoScrollLoop = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const resolveWallScrollContainer = useCallback((wallId: string | null) => {
    if (!wallId) return null;
    const candidates = document.querySelectorAll<HTMLElement>('[data-scroll="wall-column"][data-wall-id]');
    for (const candidate of candidates) {
      if (candidate.dataset.wallId === wallId) return candidate;
    }
    return null;
  }, []);

  const measureAutoScrollTargets = useCallback((force = false) => {
    const board = scrollRef.current;
    if (!board) return;
    const now = Date.now();
    if (!force && now - autoScrollLastMeasureRef.current < 200) return;
    autoScrollLastMeasureRef.current = now;
    autoScrollBoardRectRef.current = board.getBoundingClientRect();
    const column = resolveWallScrollContainer(autoScrollWallIdRef.current);
    autoScrollColumnRectRef.current = column?.getBoundingClientRect() ?? null;
  }, [resolveWallScrollContainer]);

  const startAutoScrollLoop = useCallback(() => {
    if (autoScrollRafRef.current !== null) return;
    const tick = () => {
      autoScrollRafRef.current = null;
      const pointer = autoScrollPointerRef.current;
      const board = scrollRef.current;
      if (!pointer || !board) return;

      measureAutoScrollTargets();
      const boardRect = autoScrollBoardRectRef.current ?? board.getBoundingClientRect();
      autoScrollBoardRectRef.current = boardRect;

      const deltaX = computeEdgeScrollDelta({ pointer: pointer.x, rect: boardRect, axis: "x", zonePx: 72, maxSpeedPxPerFrame: 24 });
      let deltaY = 0;
      let movedY = false;

      const column = resolveWallScrollContainer(autoScrollWallIdRef.current);
      if (column) {
        const columnRect = autoScrollColumnRectRef.current ?? column.getBoundingClientRect();
        autoScrollColumnRectRef.current = columnRect;
        deltaY = computeEdgeScrollDelta({ pointer: pointer.y, rect: columnRect, axis: "y", zonePx: 72, maxSpeedPxPerFrame: 20 });
        if (Math.abs(deltaY) > 0.01) {
          const nextTop = computeClampedScroll({ current: column.scrollTop, delta: deltaY, max: column.scrollHeight - column.clientHeight });
          movedY = nextTop !== column.scrollTop;
          if (movedY) column.scrollTop = nextTop;
        }
      }

      if (!movedY) {
        const boardDeltaY = computeEdgeScrollDelta({ pointer: pointer.y, rect: boardRect, axis: "y", zonePx: 72, maxSpeedPxPerFrame: 18 });
        deltaY = boardDeltaY;
        if (Math.abs(boardDeltaY) > 0.01) {
          const nextBoardTop = computeClampedScroll({ current: board.scrollTop, delta: boardDeltaY, max: board.scrollHeight - board.clientHeight });
          movedY = nextBoardTop !== board.scrollTop;
          if (movedY) board.scrollTop = nextBoardTop;
        }
      }

      let movedX = false;
      if (Math.abs(deltaX) > 0.01) {
        const nextLeft = computeClampedScroll({ current: board.scrollLeft, delta: deltaX, max: board.scrollWidth - board.clientWidth });
        movedX = nextLeft !== board.scrollLeft;
        if (movedX) board.scrollLeft = nextLeft;
      }

      if (shouldContinueAutoScrollLoop({ deltaX, deltaY, movedX, movedY })) {
        autoScrollRafRef.current = requestAnimationFrame(tick);
      }
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, [measureAutoScrollTargets, resolveWallScrollContainer]);

  const handleCardDragStart = useCallback((event: DragStartEvent) => {
    const activeCardId = parseCardSortableId(String(event.active.id));
    if (!activeCardId) return;
    if (!canDragCard(activeCardId)) return;
    setDraggingCardId(activeCardId);
    setDragReadyCardId(null);
    const sourceColumn = columns.find((column) => column.cards.some((card) => card.id === activeCardId));
    autoScrollWallIdRef.current = sourceColumn?.key ?? null;
    const activatorEvent = event.activatorEvent;
    if (activatorEvent instanceof PointerEvent || activatorEvent instanceof MouseEvent) {
      dragStartPointerRef.current = { x: activatorEvent.clientX, y: activatorEvent.clientY };
    } else if (activatorEvent instanceof TouchEvent) {
      const touch = activatorEvent.touches[0];
      dragStartPointerRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    } else {
      dragStartPointerRef.current = null;
    }
    autoScrollPointerRef.current = dragStartPointerRef.current;
    measureAutoScrollTargets(true);
  }, [canDragCard, columns, measureAutoScrollTargets, parseCardSortableId]);

  const handleCardDragMove = useCallback((event: DragMoveEvent) => {
    const overData = event.over?.data.current;
    let nextWallId: string | null = null;
    if (overData?.type === "wall") {
      nextWallId = overData.wallId as string;
      setOverWallId(nextWallId);
    } else if (overData?.type === "card") {
      nextWallId = overData.wallId as string;
      setOverWallId(nextWallId);
    } else {
      setOverWallId(null);
    }
    if (nextWallId) {
      autoScrollWallIdRef.current = nextWallId;
      autoScrollColumnRectRef.current = null;
    }
    const startPointer = dragStartPointerRef.current;
    if (!startPointer) return;
    autoScrollPointerRef.current = { x: startPointer.x + event.delta.x, y: startPointer.y + event.delta.y };
    startAutoScrollLoop();
  }, [startAutoScrollLoop]);

  const resyncOnceAfterMoveFailure = useCallback(() => {
    if (moveFailureResyncRef.current) return;
    moveFailureResyncRef.current = true;
    window.setTimeout(() => {
      window.dispatchEvent(new Event(STUDENT_BOARD_SYNC_EVENT));
      moveFailureResyncRef.current = false;
    }, 0);
  }, []);

  const commitCardMove = useCallback(async (
    snapshot: CardMoveSnapshot,
    nextColumns: typeof columns,
    rollbackColumns: typeof columns,
  ) => {
    if (!snapshot.cardId || !snapshot.fromWallId || !snapshot.toWallId) return;
    if (!Number.isFinite(snapshot.toIndex) || snapshot.toIndex < 0) {
      setColumns(rollbackColumns);
      return;
    }
    setMovePendingCount((value) => value + 1);
    setColumns(nextColumns);
    try {
      const res = await fetch(routes.api.v1("share", shareCode, "cards", snapshot.cardId, "move"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          wallId: snapshot.toWallId,
          position: snapshot.toIndex,
          clientMutationId: crypto.randomUUID(),
        }),
      });
      if (!res.ok) throw new Error("forbidden");
    } catch {
      setColumns(rollbackColumns);
      resyncOnceAfterMoveFailure();
    } finally {
      setMovePendingCount((value) => Math.max(0, value - 1));
    }
  }, [clientId, resyncOnceAfterMoveFailure, shareCode]);

  const moveOwnCardToSection = useCallback(async (cardId: string, fromWallId: string, toWallId: string) => {
    if (!cardId || !fromWallId || !toWallId || fromWallId === toWallId) return true;

    const sourceColumn = columns.find((column) => column.key === fromWallId);
    const targetColumn = columns.find((column) => column.key === toWallId);
    const targetCard = sourceColumn?.cards.find((card) => card.id === cardId);
    if (!sourceColumn || !targetColumn || !targetCard) return false;
    if (!isOwnGuestCard({
      authorType: targetCard.meta?.authorType ?? null,
      authorClientId: targetCard.meta?.authorClientId ?? null,
    }, clientId)) {
      return false;
    }

    const rollbackColumns = columns;
    const previousColumns = columns.map((column) => ({ ...column, cards: [...column.cards] }));
    const toIndex = targetColumn.cards.length;
    const moved = moveCardAcrossWalls({
      entries: previousColumns.map((column) => ({ wall: { id: column.key }, cards: column.cards })),
      cardId,
      toWallId,
      toIndex,
    });
    if (!moved.changed) return true;

    const nextColumns = previousColumns.map((column) => {
      const nextEntry = moved.entries.find((entry) => entry.wall.id === column.key);
      return { ...column, cards: nextEntry?.cards ?? column.cards };
    });

    setSectionMovingCardId(cardId);
    setSectionMoveErrorByCardId((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
    setMovePendingCount((value) => value + 1);
    setColumns(nextColumns);

    try {
      const res = await fetch(routes.api.v1("share", shareCode, "cards", cardId, "move"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          wallId: toWallId,
          position: toIndex,
          clientMutationId: crypto.randomUUID(),
        }),
      });
      if (!res.ok) throw new Error("section_move_failed");
      return true;
    } catch {
      setColumns(rollbackColumns);
      setSectionMoveErrorByCardId((current) => ({
        ...current,
        [cardId]: "섹션을 이동하지 못했어요. 잠시 후 다시 시도해 주세요.",
      }));
      resyncOnceAfterMoveFailure();
      return false;
    } finally {
      setSectionMovingCardId((current) => (current === cardId ? null : current));
      setMovePendingCount((value) => Math.max(0, value - 1));
    }
  }, [clientId, columns, resyncOnceAfterMoveFailure, shareCode]);

  const handleCardDragEnd = useCallback(async (event: DragEndEvent) => {
    dragStartPointerRef.current = null;
    autoScrollPointerRef.current = null;
    autoScrollWallIdRef.current = null;
    stopAutoScrollLoop();
    const activeCardId = parseCardSortableId(String(event.active.id));
    setDraggingCardId(null);
    setOverWallId(null);
    if (!activeCardId || !event.over) return;

    const sourceColumn = columns.find((column) => column.cards.some((card) => card.id === activeCardId));
    if (!sourceColumn) return;

    const overId = String(event.over.id);
    const overCardId = parseCardSortableId(overId);
    const wallFromDropZone = parseWallDroppableId(overId);
    const targetWallId = wallFromDropZone
      ?? (overCardId ? columns.find((column) => column.cards.some((card) => card.id === overCardId))?.key ?? null : null)
      ?? sourceColumn.key;
    if (!targetWallId) return;

    const targetColumn = columns.find((column) => column.key === targetWallId);
    const targetCards = targetColumn?.cards ?? [];
    const toIndex = overCardId ? Math.max(0, targetCards.findIndex((card) => card.id === overCardId)) : targetCards.length;

    const prev = columns.map((column) => ({ ...column, cards: [...column.cards] }));
    const moved = moveCardAcrossWalls({
      entries: prev.map((column) => ({ wall: { id: column.key }, cards: column.cards })),
      cardId: activeCardId,
      toWallId: targetWallId,
      toIndex,
    });
    if (!moved.changed) return;

    const nextColumns = prev.map((column) => {
      const nextEntry = moved.entries.find((entry) => entry.wall.id === column.key);
      return { ...column, cards: nextEntry?.cards ?? column.cards };
    });

    const rollbackColumns = columns;
    await commitCardMove(
      { cardId: activeCardId, fromWallId: sourceColumn.key, toWallId: targetWallId, toIndex },
      nextColumns,
      rollbackColumns,
    );
  }, [columns, commitCardMove, parseCardSortableId, parseWallDroppableId, stopAutoScrollLoop]);

  useEffect(() => () => stopAutoScrollLoop(), [stopAutoScrollLoop]);

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  };

  const closeContextMenus = useCallback(() => {
    setColumnContextMenu(null);
    setCardContextMenu(null);
  }, []);

  const copyTextToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  }, []);

  const activeWall = useMemo(() => composeWalls.find((wall) => wall.id === activeWallId) ?? composeWalls[0] ?? null, [activeWallId, composeWalls]);

  const studentActionsContext = useMemo(() => ({
    activeWallId: activeWall?.id ?? null,
    activeWallTitle: activeWall?.title ?? null,
    writeLocked,
    hasSelectedCard: Boolean(cardContextMenu?.cardId),
    openCompose: (wallId: string) => openCompose(wallId),
    copyShareLink: () => {
      void copyTextToClipboard(typeof window === "undefined" ? `/s/${shareCode}` : new URL(`/s/${shareCode}`, window.location.origin).toString());
    },
    copyColumnLink: () => {
      const wallId = columnContextMenu?.wallId ?? activeWall?.id;
      if (!wallId) return;
      const value = typeof window === "undefined" ? `/s/${shareCode}/walls/${wallId}` : new URL(`/s/${shareCode}/walls/${wallId}`, window.location.origin).toString();
      void copyTextToClipboard(value);
    },
    openCardDetail: () => {
      if (!cardContextMenu) return;
      const targetColumn = columns.find((column) => column.key === cardContextMenu.wallId);
      const targetCard = targetColumn?.cards.find((card) => card.id === cardContextMenu.cardId);
      if (targetCard) openEdit(targetCard, cardContextMenu.wallId);
    },
    copyCardLink: () => {
      if (!cardContextMenu) return;
      const value = typeof window === "undefined" ? `/s/${shareCode}/walls/${cardContextMenu.wallId}?card=${cardContextMenu.cardId}` : new URL(`/s/${shareCode}/walls/${cardContextMenu.wallId}?card=${cardContextMenu.cardId}`, window.location.origin).toString();
      void copyTextToClipboard(value);
    },
  }), [activeWall, cardContextMenu, columns, copyTextToClipboard, openCompose, openEdit, shareCode, writeLocked, columnContextMenu]);

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const actions = getStudentBoardActions(studentActionsContext);
    const baseItems = resolveActions(actions, studentActionsContext, "palette", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("StudentBoard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    }).map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      keywords: action.keywords ?? [],
      enabled: action.enabled,
      run: () => runActionWithTelemetry({ action, context: studentActionsContext, surface: "palette", source: "palette" }),
    }));

    return [
      {
        id: "ui-open-keyboard-shortcuts",
        label: "단축키 보기",
        description: "⌘K, ESC, ↑↓, Enter, 우클릭/롱프레스 안내",
        keywords: ["단축키", "keyboard", "shortcut", "help"],
        enabled: true,
        run: () => setShortcutsOverlayOpen(true),
      },
      ...baseItems,
    ];
  }, [chromePrefs.showAdvancedActions, studentActionsContext]);

  const columnContextActions = useMemo(() => {
    if (!columnContextMenu) return [];
    const ctx = { ...studentActionsContext, activeWallId: columnContextMenu.wallId, hasSelectedCard: false };
    const actions = getStudentBoardActions(ctx);
    return resolveActions(actions, ctx, "context", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("StudentBoard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    })
      .filter((action) => action.id === "student-copy-column-link");
  }, [chromePrefs.showAdvancedActions, columnContextMenu, studentActionsContext]);

  const cardContextActions = useMemo(() => {
    if (!cardContextMenu) return [];
    const ctx = { ...studentActionsContext, hasSelectedCard: true };
    const actions = getStudentBoardActions(ctx);
    return resolveActions(actions, ctx, "context", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("StudentBoard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    })
      .filter((action) => action.id === "student-open-card-detail" || action.id === "student-copy-card-link");
  }, [cardContextMenu, chromePrefs.showAdvancedActions, studentActionsContext]);

  const palette = useCommandPalette(paletteItems);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      palette.toggle();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", closeContextMenus);
    window.addEventListener("scroll", closeContextMenus, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", closeContextMenus);
      window.removeEventListener("scroll", closeContextMenus, true);
    };
  }, [closeContextMenus, palette]);

  return (
    <div
      data-page-marker="student-board"
      data-testid="student-board-root"
      data-current-view-theme={resolvedThemeId}
      data-public-guest-board="modern-hud"
      data-board-runtime="student-share-modern"
      data-hud-theme-surface="dashboard-board"
      className="hud-board-shell relative flex min-h-dvh flex-col overflow-hidden bg-[var(--theme-bg)] text-[var(--theme-text)] antialiased"
      style={resolvedThemeVars as CSSProperties}
    >
      <div
        role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="student-board-live-announcement"
      data-announcement-event-key={boardAnnouncement.key}
      >
        {boardAnnouncement.message ? <span key={boardAnnouncement.key}>{boardAnnouncement.message}</span> : null}
      </div>
      <div data-testid="student-board-background" aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={boardBackgroundStyle} />
      {/* These triggers live in HoverExpandBar, which unmounts expanded content on close.
          Keep their portal-owning hosts at this stable board level so sync cannot remove an open dialog. */}
      <StudentAppSubmitPanel boardId={boardId} shareCode={shareCode} displayMode="modal-host" />
      <StudentAppGalleryPanel boardId={boardId} shareCode={shareCode} displayMode="modal-host" />
      {shouldRenderBoardDimLayer ? (
        <div
          data-testid="board-background-dim-layer"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `rgba(2, 6, 23, ${boardDimOpacity})`,
          }}
        />
      ) : null}
      <header className="sticky top-0 z-[80] px-3 pt-3 sm:px-5">
        <div className="rounded-2xl border border-[var(--theme-topbar-border)] bg-[var(--theme-topbar-bg)] shadow-[0_8px_38px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <HoverExpandBar
          activationMode="click"
          heightCollapsed={28}
          heightExpanded={48}
          rootTestId="student-topbar-root"
          collapsedTestId="student-topbar-collapsed"
          toggleTestId="student-topbar-toggle"
          expandedTestId="student-topbar-expanded"
          rootClassName="z-[80] border-b border-[var(--theme-topbar-border)] bg-[var(--theme-topbar-bg)] text-[var(--theme-topbar-text)]"
          collapsedClassName="text-[var(--theme-topbar-text)]"
          toggleClassName="text-[var(--theme-topbar-text-muted)] hover:bg-[var(--theme-topbar-pill-bg)] hover:text-[var(--theme-topbar-text)] focus-visible:outline-[var(--theme-topbar-focus)]"
          panelContainerClassName="pointer-events-none"
          panelClassName="rounded-2xl border border-[var(--theme-topbar-menu-border)] bg-[var(--theme-topbar-menu-bg)] text-[var(--theme-topbar-menu-text)] shadow-2xl shadow-[var(--theme-topbar-menu-shadow,rgba(2,6,23,0.35))] ring-1 ring-[var(--theme-topbar-menu-border)]/60 supports-[backdrop-filter]:backdrop-blur"
          collapsedContent={
            <div className="flex w-full items-center justify-between gap-2">
              <span
                data-student-topbar-title-scrim="true"
                className="min-w-0 max-w-[70%] truncate rounded-md border border-[var(--theme-topbar-border)]/70 bg-[var(--theme-topbar-pill-bg)]/80 px-2.5 py-1 font-semibold text-[var(--theme-topbar-text)] shadow-sm sm:max-w-3xl"
              >
                {title}
              </span>
              <span
                className="max-w-[160px] shrink-0 truncate rounded-full border border-[var(--theme-topbar-border)] bg-[var(--theme-topbar-pill-bg)] px-2.5 py-1 text-sm font-semibold text-[var(--theme-topbar-pill-text)]"
                title={normalizedViewerName}
              >
                {displayViewerName}
              </span>
            </div>
          }
          expandedContent={
            <div className="pointer-events-none flex w-full justify-center px-3 py-2 text-[var(--theme-topbar-menu-text)] sm:justify-end sm:px-4">
              <div
                data-student-topbar-workbench="true"
                className="pointer-events-auto flex w-fit max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 rounded-2xl border border-[var(--theme-topbar-menu-border)]/80 bg-[var(--theme-topbar-menu-bg)]/90 px-2.5 py-2 shadow-lg shadow-[var(--theme-topbar-menu-shadow,rgba(2,6,23,0.25))] backdrop-blur md:max-w-[min(920px,calc(100vw-32px))] sm:px-3"
              >
                <div
                  data-student-topbar-section="identity"
                  className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--theme-topbar-menu-border)]/70 bg-[var(--theme-topbar-pill-bg)]/55 px-2.5"
                >
                  <span className="text-xs font-semibold text-[var(--theme-topbar-menu-text)]">참여자</span>
                  <span
                    className="max-w-[160px] truncate rounded-full border border-[var(--theme-topbar-menu-border)] bg-[var(--theme-topbar-pill-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--theme-topbar-pill-text)] sm:max-w-[200px]"
                    title={normalizedViewerName}
                  >
                    {displayViewerName}
                  </span>
                </div>
                <div
                  data-student-topbar-section="status"
                  className="flex min-h-11 items-center rounded-full border border-[var(--theme-topbar-menu-border)]/70 bg-[var(--theme-topbar-pill-bg)]/45 px-3"
                >
                  <p className="text-xs font-medium text-[var(--theme-topbar-menu-muted)]">
                    {writeLocked ? writeLockedMessage : "카드를 작성할 수 있어요"}
                  </p>
                </div>
                <div
                  data-student-topbar-section="tools"
                  className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--theme-topbar-menu-border)]/70 bg-[var(--theme-topbar-pill-bg)]/45 px-2.5"
                >
                  <StudentAppSubmitPanel boardId={boardId} shareCode={shareCode} />
                  <StudentAppGalleryPanel boardId={boardId} shareCode={shareCode} displayMode="button" />
                  <label className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[var(--theme-topbar-menu-muted)]">
                    보기 테마
                    <select
                      aria-label="보기 테마 선택"
                      className="min-h-10 cursor-pointer appearance-none rounded-full border border-[var(--theme-topbar-menu-border)] bg-[var(--theme-topbar-pill-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--theme-topbar-pill-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(2,6,23,0.18)] transition-colors hover:bg-[color-mix(in_oklab,var(--theme-topbar-pill-bg)_84%,white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-topbar-focus)]"
                      value={guestViewTheme}
                      onChange={(event) => onChangeGuestViewTheme(normalizeGuestViewThemeId(event.target.value))}
                    >
                      <option value="follow-teacher">선생님 화면처럼 보기</option>
                      <option value="bright">밝게</option>
                      <option value="contrast">선명</option>
                      <option value="calm">편안</option>
                      <option value="high-contrast">고대비</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          }
        />
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-5 sm:py-5">
        {showBoardHelpPill ? (
          <div
            data-testid="guest-board-help-pill"
            className="relative z-30 mb-3 inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)]/90 px-3 py-1.5 text-xs text-[var(--theme-text-muted)] shadow-sm backdrop-blur"
          >
            <span>카드를 남길 칸에서 빈 곳이나 ‘카드 작성’을 누르세요.</span>
            <button
              type="button"
              aria-label="도움말 닫기"
              className="rounded-full px-1 text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-muted)]"
              onClick={() => {
                setShowBoardHelpPill(false);
                if (typeof window !== "undefined") {
                  window.sessionStorage.setItem("guest-board-help-pill-dismissed-v1", "1");
                }
              }}
            >
              ✕
            </button>
          </div>
        ) : null}
        <TodayLessonKitPanel
          state={todayLessonPanelState}
          ready={todayLessonPanelReady}
          onCollapse={collapseTodayLessonPanel}
          onExpand={expandTodayLessonPanel}
        />
        <ArtworkSubmissionHelperPanel
          open={artworkSubmissionHelperOpen}
          disabled={writeLocked || composeWalls.length === 0}
          onClose={closeArtworkSubmissionHelper}
          onSelect={selectArtworkSubmissionType}
        />
        {mission ? (
          <VibeCodingMissionBanner
            mission={mission}
            onOpenComposer={writeLocked || composeWalls.length === 0 ? undefined : () => openCompose(composeWallId || composeWalls[0]?.id || "")}
          />
        ) : null}

        {columns.length === 0 ? (
          <div
            data-testid="student-board-empty-state"
            className="mx-auto max-w-xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]/80 px-6 py-12 text-center shadow-2xl shadow-cyan-950/20"
          >
            <h1 className="text-xl font-semibold text-[var(--theme-text)]">선생님이 활동 공간을 준비하고 있어요</h1>
            <p className="mt-2 text-sm text-[var(--theme-text-subtle)]">새 칸이 열리면 바로 참여할 수 있어요. 잠시만 기다려 주세요.</p>
            <p className="mt-3 text-xs font-medium text-[var(--theme-text-muted)]">사진이나 파일도 함께 올릴 수 있어요.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleCardDragStart}
            onDragMove={handleCardDragMove}
            onDragEnd={handleCardDragEnd}
          >
          <div
            className={boardScrollSurfaceClassName}
            data-testid="student-board-scroll-surface"
            data-board-scroll-surface="true"
            data-scroll="board-main"
            onPointerDownCapture={handleBoardMainPointerDownCapture}
            onPointerUpCapture={handleBoardMainPointerUpCapture}
            onPointerCancelCapture={handleBoardMainPointerCancelCapture}
            ref={setScrollRef}
          >
            {columns.map((column, index) => {
              const wall = columnWalls[index];
              if (!wall) {
                return null;
              }
              const columnCards = column.cards.map((card) => {
                const isOwnCard = isOwnGuestCard(
                  {
                    authorType: card.meta?.authorType ?? null,
                    authorClientId: card.meta?.authorClientId ?? null,
                  },
                  clientId,
                );
                const attachments = card.meta?.attachments ?? [];
                const externalLinks =
                  attachments
                    .filter((att) => att.type === "external")
                    .map((att) => {
                      const safeUrl = normalizeHttpUrl((att as { url?: unknown }).url);
                      if (!safeUrl) return null;
                      const label = String((att as { label?: unknown }).label ?? "").trim();
                      return {
                        kind: "link",
                        url: safeUrl,
                        filename: label || "링크",
                      };
                    })
                    .filter(
                      (entry): entry is { kind: "link"; url: string; filename: string } =>
                        Boolean(entry),
                    );

                const authorType = card.meta?.authorType ?? "student";
                const authorName = authorType === "teacher" ? "선생님" : card.authorLabel ?? null;
                const text =
                  (card.text ?? "").trim() || (card.title ?? "").trim() || "텍스트 없음";
                const cardColorTone = normalizeCardColorTone(card.cardColorToken);

                return {
                  id: card.id,
                  wall_id: column.key,
                  board_id: null,
                  position: typeof card.meta?.position === "number" ? card.meta.position : null,
                  author_type: authorType,
                  author_name: authorName,
                  author_client_id: card.meta?.authorClientId ?? null,
                  text,
                  created_at: card.createdAt,
                  is_hidden: false,
                  hidden_at: null,
                  is_pinned: Boolean(card.meta?.pinned),
                  pinned_at: null,
                  is_featured: false,
                  featured_at: null,
                  card_color_token: cardColorTone,
                  deleted_at: null,
                  deleted_by: null,
                  delete_reason: null,
                  external_attachments: externalLinks,
                  student: {
                    isOwnCard,
                    attachments,
                    authorLabel: authorType === "teacher" ? "선생님" : card.authorLabel ?? "익명",
                    title: card.title,
                    onEdit: isOwnCard ? () => openEdit(card, column.key) : undefined,
                    onDelete: isOwnCard ? () => void deleteOwnCard(card.id) : undefined,
                    sectionMoveOptions: isOwnCard
                      ? columns.map((sectionColumn) => ({
                          id: sectionColumn.key,
                          title: sectionColumn.title,
                          isCurrent: sectionColumn.key === column.key,
                        }))
                      : undefined,
                    onMoveToSection: isOwnCard
                      ? (targetWallId: string) => moveOwnCardToSection(card.id, column.key, targetWallId)
                      : undefined,
                    movingSection: sectionMovingCardId === card.id,
                    sectionMoveError: sectionMoveErrorByCardId[card.id] ?? null,
                    deleting: deletingCardId === card.id,
                    deleteError: deleteErrorByCardId[card.id] ?? null,
                  },
                };
              });

              return (
                <WallColumn
                  key={column.key}
                  role="student"
                  wall={wall}
                  cards={columnCards}
                  onAddCard={openCompose}
                  onActivate={setActiveWallId}
                  onColumnContextMenu={(wallId, x, y) => {
                    if (!chromePrefs.showAdvancedActions) return;
                    setCardContextMenu(null);
                    setColumnContextMenu({ wallId, x, y });
                  }}
                  onCardContextMenu={(cardId, wallId, x, y) => {
                    if (!chromePrefs.showAdvancedActions) return;
                    setColumnContextMenu(null);
                    setCardContextMenu({ cardId, wallId, x, y });
                    setActiveWallId(wallId);
                  }}
                  alwaysShowCardMenu={false}
                  isComposeActive={composeOpen && composeWallId === column.key}
                  addDisabled={
                    !studentComposeReady || writeLocked || composeWalls.length === 0 || column.studentWriteEnabled === false
                  }
                  addDisabledMessage={
                    column.studentWriteEnabled === false
                      ? "이 섹션은 제출이 닫혔어요."
                      : writeLocked
                        ? writeLockedMessage
                        : undefined
                  }
                  canDragCard={canDragCard}
                  dragReadyCardId={dragReadyCardId}
                  draggingCardId={draggingCardId}
                  overWallId={overWallId}
                  onCardHoldStart={onCardHoldStart}
                  onCardHoldEnd={onCardHoldEnd}
                />
              );
            })}
            <div aria-hidden="true" className="relative z-10 h-px w-4 flex-shrink-0 sm:w-8 lg:w-12" />
          </div>
          <DragOverlay>
            {draggingCardId ? (
              <div className="w-[320px] scale-[0.94] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-sm text-[var(--theme-text)] shadow-2xl">
                카드 이동 중...
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>
        )}
      </main>

      {columnContextMenu ? (
        <div
          data-student-context-menu="column"
          className="fixed z-40 min-w-44 rounded-lg border border-[var(--theme-menu-border)] bg-[var(--theme-menu-bg)] p-1 text-[var(--theme-menu-text)] shadow-lg"
          style={{ top: columnContextMenu.y, left: columnContextMenu.x }}
          role="menu"
          aria-label="컬럼 컨텍스트 메뉴"
        >
          {columnContextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--theme-menu-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              onClick={() => {
                runActionWithTelemetry({
                  action,
                  context: { ...studentActionsContext, activeWallId: columnContextMenu.wallId, hasSelectedCard: false },
                  surface: "context",
                  source: "contextmenu",
                });
                closeContextMenus();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {cardContextMenu ? (
        <div
          data-student-context-menu="card"
          className="fixed z-40 min-w-44 rounded-lg border border-[var(--theme-menu-border)] bg-[var(--theme-menu-bg)] p-1 text-[var(--theme-menu-text)] shadow-lg"
          style={{ top: cardContextMenu.y, left: cardContextMenu.x }}
          role="menu"
          aria-label="카드 컨텍스트 메뉴"
        >
          {cardContextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--theme-menu-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
              onClick={() => {
                runActionWithTelemetry({
                  action,
                  context: { ...studentActionsContext, hasSelectedCard: true },
                  surface: "context",
                  source: "contextmenu",
                });
                closeContextMenus();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <CommandPalette
        isOpen={palette.isOpen}
        query={palette.query}
        items={palette.filteredItems}
        activeIndex={palette.activeIndex}
        onQueryChange={palette.setQuery}
        onClose={palette.close}
        onSelect={palette.runItem}
        onActiveChange={palette.setActiveIndex}
        toggleHint="⌘K / Ctrl+K"
      />

      <KeyboardShortcutsOverlay
        isOpen={shortcutsOverlayOpen}
        showAdvancedActionsEnabled={chromePrefs.showAdvancedActions}
        onClose={() => setShortcutsOverlayOpen(false)}
        onOpenAdvancedSettings={() => {
          setShortcutsOverlayOpen(false);
          router.push(routes.page.dashboard.settings());
        }}
      />

      {columns.length > 0 && touchLike ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <div
            data-testid="student-mobile-compose-bar"
            className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 shadow-lg shadow-black/30 backdrop-blur sm:px-4"
          >
            <button
              type="button"
              onClick={() => openCompose(composeWallId || composeWalls[0]?.id || "")}
              disabled={writeLocked || composeWalls.length === 0}
              aria-label="카드 작성 (단축키 C)"
              title="카드 작성 (단축키 C)"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-4 text-sm font-semibold text-[var(--theme-accent-text)] transition hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] disabled:cursor-not-allowed disabled:border-[var(--theme-border)] disabled:bg-[var(--theme-surface-muted)] disabled:text-[var(--theme-text-subtle)]"
            >
              카드 작성
            </button>
          </div>
        </div>
      ) : null}

      <BoardMiniMap mode={minimapMode} scrollRef={scrollRef} columnCount={columns.length} />

      <ComposeCardPanel
        isOpen={composeOpen}
        onClose={closeComposeWithFocusRestore}
        walls={composeWalls}
        initialWallId={composeWallId || composeWalls[0]?.id || ""}
        initialTemplate={composeArtworkTemplate}
        mode="student"
        code={shareCode}
        writeLocked={writeLocked}
        writeLockedMessage={writeLockedMessage}
        lessonMode={lessonMode}
      />

      {editing ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            data-testid="student-card-edit-dialog"
            className="w-full max-w-lg rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--theme-text)]">카드 수정</p>
                <p className="text-xs text-[var(--theme-text-subtle)]">내가 작성한 카드만 수정할 수 있어요</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                data-student-card-edit-action="close-header"
                className="rounded-lg border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-text-muted)] hover:bg-[var(--theme-card-muted)]"
                disabled={saving || Boolean(replacingAttachmentId)}
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--theme-text-muted)]">내용</label>
                <textarea
                  data-student-card-edit-field="content"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="h-28 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-border-strong)]"
                  placeholder="내용을 입력하세요"
                  disabled={saving || writeLocked}
                />
              </div>

                <div className="space-y-2" ref={attachmentsRef}>
                  <div className="flex items-center justify-between">
                    <span className="theme-card-muted-copy text-xs font-semibold">첨부</span>
                    <label
                      data-student-card-edit-action="attach"
                      className="attachment-download-label cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold shadow-sm"
                    >
                    + 파일 추가
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      disabled={saving || writeLocked}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length === 0) return;
                        setNewFiles((prev) => [...prev, ...files]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {editAttachments.filter((a) => !a.deleted).length === 0 && newFiles.length === 0 ? (
                  <p className="text-xs text-[var(--theme-text-subtle)]">첨부 파일이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    <CardAttachments
                      attachments={editAttachments
                        .filter((att) => !att.deleted)
                        .map((att) => ({
                          id: att.id,
                          type: att.type === "file" ? ("file" as const) : ("url" as const),
                          label: att.label,
                          url: att.url ?? "",
                          contentType: null,
                        }))
                        .filter((att) => Boolean(att.url))}
                      mode="share"
                      disabledReason="공유 화면에서는 첨부 파일 제거가 불가하고 링크만 편집에서 제거할 수 있어요."
                    />

                    {newFiles.length > 0 ? (
                      <div className="space-y-1">
	                        <p className="theme-card-muted-copy text-[11px] font-semibold">추가될 파일</p>
                        {newFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            data-student-card-edit-file="pending"
                            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--theme-border)] px-3 py-2"
                          >
	                            <span className="theme-card-muted-copy truncate text-xs">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                              data-student-card-edit-action="remove-pending"
	                              className="theme-card-muted-control rounded-lg border border-[var(--theme-border)] px-2 py-0.5 text-xs font-semibold"
                              disabled={saving || writeLocked}
                            >
                              취소
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--theme-text-muted)]">URL</label>
                <input
                  data-student-card-edit-field="url"
                  value={editUrl}
                  onChange={(event) => setEditUrl(event.target.value)}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-border-strong)]"
                  placeholder="https://example.com"
                  disabled={saving || writeLocked}
                />
                <p className="text-[11px] text-[var(--theme-text-subtle)]">http:// 또는 https://로 시작하는 링크만 저장할 수 있어요.</p>
              </div>

              {editError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {editError}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--theme-border)] px-5 py-4">
              <button
                type="button"
                onClick={deleteCard}
                data-student-card-edit-action="delete"
                className="rounded-lg border border-rose-200 bg-[var(--theme-card)] px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-60"
                disabled={saving || writeLocked || Boolean(replacingAttachmentId)}
              >
                카드 삭제
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  data-student-card-edit-action="cancel"
	                  className="theme-card-muted-control rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-xs font-semibold shadow-sm disabled:opacity-60"
                  disabled={saving || Boolean(replacingAttachmentId)}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  data-student-card-edit-action="save"
                  className="rounded-lg bg-[var(--theme-accent)] px-4 py-2 text-xs font-semibold text-[var(--theme-accent-text)] shadow-sm transition-colors enabled:hover:bg-[var(--theme-accent-strong)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100"
                  disabled={saving || writeLocked || Boolean(replacingAttachmentId)}
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
