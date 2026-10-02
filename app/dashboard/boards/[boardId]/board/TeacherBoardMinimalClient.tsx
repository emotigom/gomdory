"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { UiMinimapMode } from "@/lib/data/boards";
import type { Card } from "@/lib/data/cards";
import { CopyTextButton } from "@/app/_components/BoardSettingsDrawer";
import BoardSettingsSheet, { type BoardSettingsSection } from "./_components/BoardSettingsSheet";
import BoardDesignPanel from "./_components/BoardDesignPanel";
import BoardMiniMap from "@/app/_components/BoardMiniMap";
import ContextMenu from "@/app/_components/ContextMenu";
import FloatingPortal from "@/app/_components/FloatingPortal";
import WallColumn from "@/app/_components/WallColumn";
import { buttonTone, cn, pill, surface } from "@/app/_components/uiTokens";
import ShareGuideModal from "@/app/dashboard/_components/ShareGuideModal";
import { useSetDashboardChrome } from "@/app/dashboard/_components/DashboardChromeContext";
import BoardTopControls from "./BoardTopControls";
import { pushDashboardToast, useDashboardToasts } from "@/app/dashboard/useDashboardToast";
import {
  createWallAction,
  reorderWallsAction,
  updateWallAction,
  updateWallWidthAction,
  type CreateWallState,
  type UpdateWallState,
} from "../actions";
import { routes } from "@/lib/standards/routes";
import CommandPalette from "../class/CommandPalette";
import KeyboardShortcutsOverlay from "../class/KeyboardShortcutsOverlay";
import { useCommandPalette, type CommandPaletteItem } from "../class/useCommandPalette";
import { getCapabilitySet, resolveActions, runActionWithTelemetry } from "@/lib/ui/actions/registry";
import { getTeacherBoardActions } from "@/lib/ui/actions/screenActions";
import { useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";
import { markHintSeen, readHintSeen, shouldShowHint } from "@/lib/dashboard/discoverabilityHints";
import EduCoursePanel from "../class/EduCoursePanel";
import EduAssignmentsPanel from "../class/EduAssignmentsPanel";
import EduRosterPanel from "../class/EduRosterPanel";
import EduCompletionPanel from "../class/EduCompletionPanel";
import EduBroadcastPanel from "../class/EduBroadcastPanel";
import EduScenarioPanel from "../class/EduScenarioPanel";
import EduFeaturedRecommendPanel from "../class/EduFeaturedRecommendPanel";
import EduPresentationRehearsalPanel from "../class/EduPresentationRehearsalPanel";
import EduPresentationSettingsPanel from "../class/EduPresentationSettingsPanel";
import EduPresentationQueuePanel from "../class/EduPresentationQueuePanel";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { type BoardSidebarConfig, type BoardSidebarTabId } from "@/lib/site-content/boardSidebarConfig";
import { formatBoardActivityLabel, type BoardActivityItem } from "@/lib/boards/activity";
import { apiFetch } from "@/lib/http/apiFetch";
import { warnIfNotViewportFixed } from "@/lib/ui/fixedGuard";
import { applyCornerAvoidance } from "@/lib/ui/nonOverlap";
import { runPrewarm, type PrewarmPlan } from "@/lib/edu/prewarm";
import { runStartClass, type StartClassPhase } from "@/lib/edu/startClass";
import { runEndClass, type EndClassPhase } from "@/lib/edu/endClass";
import { getNetworkSaverMetricsSnapshot } from "@/lib/edu/netsaver/metrics";
import { isP2PDisabledCached } from "@/lib/edu/netsaver/p2pProbe";
import { loadNetworkSaverCodeOverride } from "@/lib/edu/netsaver/codeConfig";
import { rearmBoostWindow, setQuietModeState } from "@/lib/edu/netsaver/boostWindow";
import { disableEpidemicForRoom } from "@/lib/edu/netsaver/epidemicControl";
import { getActiveWasmSwarm } from "@/lib/edu/netsaver/wasmSwarm";
import { buildEduCodeHash, recordEduEvent } from "@/lib/edu/opsEvent";
import type { EduDailyReport, EduReportKey } from "@/lib/edu/reportTypes";
import { useTouchLike } from "@/lib/ui/isTouchLike";
import { useGlobalShortcut } from "@/lib/ui/useGlobalShortcut";
import { shouldEnableWheelDebugTracer, useWheelDebugTracer } from "@/app/_components/useWheelDebugTracer";
import {
  bumpCounter,
  finalizeHeadline,
  loadDailyReport,
} from "@/lib/edu/reportStore";
import { todayKst } from "@/lib/edu/dateKst";
import { computeWeeklyReport } from "@/lib/edu/weeklyReport";
import { computeCoachAction } from "@/lib/edu/coach";
import { snapWallWidth } from "@/lib/ui/wallResize";
import { scrollToCard } from "@/lib/board/scrollToCard";
import { computeClampedScroll, computeEdgeScrollDelta, shouldContinueAutoScrollLoop } from "@/lib/board/dragScroll";
import { CARD_DRAG_MOUSE_ACTIVATION, CARD_DRAG_TOUCH_ACTIVATION } from "@/lib/board/dragSensors";
import { moveCardAcrossWalls } from "@/lib/board/cardReorder";
import { handleBoardBackgroundWheelFallback, handleDocumentWheelFallbackForBoard, isModalScrollLocked, isWheelFromWallColumn } from "@/lib/board/wheelRouting";
import { isPracticeSubmissionCard } from "@/lib/edu/practiceSubmission";
import { buildShareUrl } from "@/lib/http/publicLinks";
import {
  clearCreatedBoardIdForOnboarding,
  getCreatedBoardIdForOnboarding,
  getHasDismissedNewBoardOnboarding,
  setHasDismissedNewBoardOnboarding,
  shouldShowNewBoardOnboarding,
} from "@/lib/dashboard/newBoardOnboarding";

const ComposeCardPanel = dynamic(() => import("@/app/_components/ComposeCardPanel"), { ssr: false });
const FileDropOverlay = dynamic(() => import("@/app/_components/FileDropOverlay"), { ssr: false });

const HINT_KEYS = {
  boardPaletteShortcut: "gomdory.ui.hint.boardPaletteShortcut.v1",
  advancedActions: "gomdory.ui.hint.advancedActions.v1",
} as const;


type WallSummary = {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  position: number;
  ui_width_px: number;
  ui_color_token: string | null;
  student_write_enabled: boolean;
};

declare global {
  interface Window {
    __gomdoryInspectBoardScroll?: () => unknown;
  }
}

type WallCard = Pick<
  Card,
  | "id"
  | "wall_id"
  | "author_name"
  | "author_type"
  | "text"
  | "created_at"
  | "position"
  | "is_hidden"
  | "is_pinned"
  | "is_featured"
  | "card_color_token"
> & {
  attachments?: Array<{
    id: string;
    kind: "image" | "file" | "url";
    label: string;
    url: string;
    contentType?: string | null;
    size?: number | null;
  }>;
};

type WallWithCards = {
  wall: WallSummary;
  cards: WallCard[];
};

type NormalizedWallEntry = WallWithCards & {
  visibleCards: WallCard[];
};

type EduEnsureResult = {
  ok: true;
  shareCode: string;
  joinShortUrl: string;
  courseUrl: string;
  entryUrl: string;
  createdCount: number;
  updatedCount?: number;
};

type EduEnsureError = {
  ok: false;
  message?: string;
};

type TeacherBoardMinimalClientProps = {
  boardId: string;
  boardTitle: string;
  boardDescription: string | null;
  shareCode: string;
  shareUrl: string;
  walls: WallWithCards[];
  minimapMode: UiMinimapMode;
  boardSidebarConfig: BoardSidebarConfig | null;
  recentActivity?: BoardActivityItem[] | null;
  initialWallpaperKey?: string | null;
  initialWallpaperUrl?: string | null;
};

const initialWallState: CreateWallState = { success: false };
const initialUpdateWallState: UpdateWallState = { success: false };
const PRACTICE_SUBMISSION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EDU_PRACTICE_SUBMISSIONS === "1";


type PresentationState = {
  enabled: boolean;
  spotlightColumnId: string | null;
  hideOthers: boolean;
  largeCards: boolean;
};

type BoardSettingsStatus = {
  state: "idle" | "saving" | "saved" | "error";
  requestId?: string;
  errorCode?: string;
};

const getOrderedColumnIds = (entries: WallWithCards[]) => entries.map((entry) => entry.wall.id);

function SubmitWallButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
    >
      {pending ? "추가 중..." : "섹션 추가"}
    </button>
  );
}

function SubmitUpdateWallButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
    >
      {pending ? "저장 중..." : "섹션 저장"}
    </button>
  );
}

type SortableWallColumnProps = {
  entry: NormalizedWallEntry;
  onAddCard: (wallId: string) => void;
  onOpenWallMenu: (wallId: string) => void;
  onResizeStop: (wallId: string, newWidth: number) => void;
  onActivate: (wallId: string) => void;
  onSpotlightSelect?: (wallId: string) => void;
  onSelectCard: (cardId: string, wallId: string) => void;
  onColumnContextMenu?: (wallId: string, x: number, y: number) => void;
  onCardContextMenu?: (cardId: string, wallId: string, x: number, y: number) => void;
  isComposeActive: boolean;
  selectedCardId: string | null;
  isSpotlight: boolean;
  isDimmed: boolean;
  presentationLargeCards: boolean;
  hideForPresentation: boolean;
  canDragCard?: (cardId: string) => boolean;
  draggingCardId?: string | null;
  overWallId?: string | null;
  onCardHoldStart?: (cardId: string) => void;
  onCardHoldEnd?: (cardId: string) => void;
};

const SortableWallColumn = memo(function SortableWallColumn({
  entry,
  onAddCard,
  onOpenWallMenu,
  onResizeStop,
  onActivate,
  onSpotlightSelect,
  onSelectCard,
  onColumnContextMenu,
  onCardContextMenu,
  isComposeActive,
  selectedCardId,
  isSpotlight,
  isDimmed,
  presentationLargeCards,
  hideForPresentation,
  canDragCard,
  draggingCardId,
  overWallId,
  onCardHoldStart,
  onCardHoldEnd,
}: SortableWallColumnProps) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: entry.wall.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        width: hideForPresentation ? 0 : undefined,
        marginRight: hideForPresentation ? 0 : undefined,
      }}
      className={`flex h-full min-h-0 flex-shrink-0 transition-[opacity,transform,width] duration-300 ${
        hideForPresentation ? "pointer-events-none overflow-hidden opacity-0" : "opacity-100"
      }`}
    >
      <WallColumn
        wall={entry.wall}
        cards={entry.visibleCards}
        role="teacher"
        onAddCard={onAddCard}
        onOpenWallMenu={onOpenWallMenu}
        onResizeStop={onResizeStop}
        onActivate={onActivate}
        onSpotlightSelect={onSpotlightSelect}
        onSelectCard={onSelectCard}
        selectedCardId={selectedCardId}
        isComposeActive={isComposeActive}
        alwaysShowCardMenu
        dragHandleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        isSpotlight={isSpotlight}
        isDimmed={isDimmed}
        presentationLargeCards={presentationLargeCards}
        onColumnContextMenu={onColumnContextMenu}
        onCardContextMenu={onCardContextMenu}
        canDragCard={canDragCard}
        draggingCardId={draggingCardId}
        overWallId={overWallId}
        onCardHoldStart={onCardHoldStart}
        onCardHoldEnd={onCardHoldEnd}
      />
    </div>
  );
});

function BoardChromeRegistrar({ boardTitle, boardControls }: { boardTitle: string; boardControls: ReactNode }) {
  const setDashboardChrome = useSetDashboardChrome();

  useEffect(() => {
    setDashboardChrome({ mode: "board", boardTitle, boardControls });
    return () => {
      setDashboardChrome({ mode: "default" });
    };
  }, [boardControls, boardTitle, setDashboardChrome]);

  return null;
}

export default function TeacherBoardMinimalClient({
  boardId,
  boardTitle,
  boardDescription,
  shareCode,
  shareUrl,
  walls,
  minimapMode,
  boardSidebarConfig,
  recentActivity,
  initialWallpaperKey = null,
  initialWallpaperUrl = null,
}: TeacherBoardMinimalClientProps) {
  const recentActivityItems = recentActivity ?? [];
  const chromePrefs = useDashboardChromePrefs();
  useEffect(() => {
    try {
      if (
        shouldShowHint({
          enabled: true,
          hasSeen: readHintSeen(HINT_KEYS.boardPaletteShortcut),
        })
      ) {
        pushDashboardToast({ title: "⌘K / Ctrl+K로 빠른 명령" });
        markHintSeen(HINT_KEYS.boardPaletteShortcut);
      }
    } catch {
      // fail-open: hint delivery must not block board actions
    }
  }, []);

  useEffect(() => {
    try {
      if (
        shouldShowHint({
          enabled: chromePrefs.showAdvancedActions,
          hasSeen: readHintSeen(HINT_KEYS.advancedActions),
        })
      ) {
        pushDashboardToast({ title: "우클릭(또는 길게 누르기)으로 고급 액션" });
        markHintSeen(HINT_KEYS.advancedActions);
      }
    } catch {
      // fail-open: hint delivery must not block board actions
    }
  }, [chromePrefs.showAdvancedActions]);
  const [orderedWalls, setOrderedWalls] = useState<WallWithCards[]>(
    () =>
      [...walls].sort((a, b) => {
        return a.wall.position - b.wall.position;
      }),
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [wheelDebugEnabled, setWheelDebugEnabled] = useState(false);
  const [composeWallId, setComposeWallId] = useState(orderedWalls[0]?.wall.id ?? "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWheelDebugEnabled(shouldEnableWheelDebugTracer());
  }, []);

  useWheelDebugTracer({
    enabled: wheelDebugEnabled,
    panelOpen: composeOpen,
    panelName: "teacher-compose-panel",
  });
  const composeRestoreFocusRef = useRef<HTMLElement | null>(null);
  const [lastActiveWallId, setLastActiveWallId] = useState(orderedWalls[0]?.wall.id ?? "");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(orderedWalls[0]?.wall.id ?? null);
  const [isBoardActive, setIsBoardActive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalWall, setEditModalWall] = useState<WallSummary | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [prewarmStatus, setPrewarmStatus] = useState<"idle" | "running" | "done" | "fail">("idle");
  const [prewarmRemainingMs, setPrewarmRemainingMs] = useState<number | null>(null);
  const [prewarmSeedLiteReady, setPrewarmSeedLiteReady] = useState(false);
  const prewarmResultsRef = useRef<Record<string, string> | null>(null);
  const [startClassPhase, setStartClassPhase] = useState<StartClassPhase>("idle");
  const [startClassRunning, setStartClassRunning] = useState(false);
  const [startClassStepLabel, setStartClassStepLabel] = useState("사전 준비");
  const [startClassPartial, setStartClassPartial] = useState(false);
  const [endClassPhase, setEndClassPhase] = useState<EndClassPhase>("idle");
  const [endClassPartial, setEndClassPartial] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileDropWallId, setFileDropWallId] = useState<string | null>(null);
  const [presentationEnabled, setPresentationEnabled] = useState(false);
  const [presentationSpotlightId, setPresentationSpotlightId] = useState<string | null>(
    orderedWalls[0]?.wall.id ?? null,
  );
  const [presentationHideOthers, setPresentationHideOthers] = useState(false);
  const [presentationLargeCards, setPresentationLargeCards] = useState(true);
  const [shareGuideOpen, setShareGuideOpen] = useState(false);
  const shareGuideCtaRef = useRef<HTMLButtonElement | null>(null);
  const previousShareGuideOpen = useRef(shareGuideOpen);
  const [shareInfo, setShareInfo] = useState({
    code: shareCode,
    shareUrl,
    presentUrl: "",
  });
  const [columnContextMenu, setColumnContextMenu] = useState<{ wallId: string; x: number; y: number } | null>(null);
  const [cardContextMenu, setCardContextMenu] = useState<{ cardId: string; wallId: string; x: number; y: number } | null>(null);
  const [boardTitleValue, setBoardTitleValue] = useState(boardTitle);
  const [boardDescriptionValue, setBoardDescriptionValue] = useState(boardDescription ?? "");
  const [boardSettingsDraft, setBoardSettingsDraft] = useState({
    title: boardTitle,
    description: boardDescription ?? "",
  });
  const [boardSettingsStatus, setBoardSettingsStatus] = useState<BoardSettingsStatus>({
    state: "idle",
  });
  const [selectedWallpaper, setSelectedWallpaper] = useState<{ key: string; url: string } | null>(
    initialWallpaperKey && initialWallpaperUrl ? { key: initialWallpaperKey, url: initialWallpaperUrl } : null,
  );
  const [wallpaperSaveState, setWallpaperSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [expandedSidebarBlocks, setExpandedSidebarBlocks] = useState<Record<string, boolean>>({});
  const [showNewBoardOnboarding, setShowNewBoardOnboarding] = useState(false);
  const [newBoardOnboardingDismissBusy, setNewBoardOnboardingDismissBusy] = useState(false);
  const [shareEnsureStatus, setShareEnsureStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [shareEnsureError, setShareEnsureError] = useState<string | null>(null);
  const [eduEnsureLoading, setEduEnsureLoading] = useState(false);
  const [eduEnsureNotice, setEduEnsureNotice] = useState<string | null>(null);
  const [eduEnsureError, setEduEnsureError] = useState<string | null>(null);
  const [practiceEnsureLoading, setPracticeEnsureLoading] = useState(false);
  const [practiceEnsureNotice, setPracticeEnsureNotice] = useState<string | null>(null);
  const [practiceEnsureError, setPracticeEnsureError] = useState<string | null>(null);
  const shareEnsureInFlightRef = useRef<Promise<void> | null>(null);
  const [downgraded, setDowngraded] = useState(false);
  const [netsaverMode, setNetsaverMode] = useState<"lease_only" | "auto">("auto");
  const [boostInFlight, setBoostInFlight] = useState(false);
  const [coachSnoozeUntil, setCoachSnoozeUntil] = useState<number | null>(null);
  const [coachForceLeaseOnly, setCoachForceLeaseOnly] = useState(false);
  const dateKST = useMemo(() => todayKst(), []);
  const { touchLike } = useTouchLike();
  const defaultReportTotals = useMemo<Record<EduReportKey, number>>(
    () => ({
      prewarm_runs: 0,
      prewarm_ok: 0,
      prewarm_partial: 0,
      share_ensure_ok: 0,
      share_ensure_fail: 0,
      netsaver_auto_downgrade: 0,
      boost_started: 0,
      boost_completed: 0,
      endclass_runs: 0,
    }),
    [],
  );
  const [dailyReport, setDailyReport] = useState<EduDailyReport | null>(null);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const gearButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement | null>(null);
  const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollWallIdRef = useRef<string | null>(null);
  const autoScrollBoardRectRef = useRef<DOMRect | null>(null);
  const autoScrollColumnRectRef = useRef<DOMRect | null>(null);
  const autoScrollMeasuredColumnIdRef = useRef<string | null>(null);
  const autoScrollMeasuredColumnElRef = useRef<HTMLElement | null>(null);
  const autoScrollLastMeasureRef = useRef(0);
  const autoScrollNeedsMeasureRef = useRef(true);
  const autoScrollResizeObserverRef = useRef<ResizeObserver | null>(null);
  const isDraggingRef = useRef(false);
  const moveInFlightRef = useRef(false);
  const moveFailureResyncRef = useRef(false);
  const hideOthersRestoreRef = useRef<boolean | null>(null);
  const prewarmControllerRef = useRef<AbortController | null>(null);
  const prewarmEndsAtRef = useRef<number | null>(null);
  const startClassControllerRef = useRef<AbortController | null>(null);
  const startClassRunningRef = useRef(false);
  const startClassTimeoutRef = useRef<number | null>(null);
  const boostTimerRef = useRef<number | null>(null);
  const boostEndsAtRef = useRef<number | null>(null);
  const endClassRunningRef = useRef(false);

  const [wallState, wallAction] = useFormState(createWallAction, initialWallState);
  const [updateWallState, updateWallFormAction] = useFormState(
    updateWallAction,
    initialUpdateWallState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const boardSettingsDirty = useMemo(() => {
    return (
      boardSettingsDraft.title.trim() !== boardTitleValue.trim() ||
      boardSettingsDraft.description.trim() !== boardDescriptionValue.trim()
    );
  }, [boardSettingsDraft, boardTitleValue, boardDescriptionValue]);

  const boardSettingsTitleValid = boardSettingsDraft.title.trim().length > 0;

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const dismissed = await getHasDismissedNewBoardOnboarding();
      const createdBoardId = getCreatedBoardIdForOnboarding();
      const shouldShow = shouldShowNewBoardOnboarding({
        hasDismissed: dismissed,
        boardId,
        createdBoardId,
      });

      clearCreatedBoardIdForOnboarding();

      if (!isCancelled) {
        setShowNewBoardOnboarding(shouldShow);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [boardId]);

  const handleDismissNewBoardOnboarding = useCallback(async () => {
    if (newBoardOnboardingDismissBusy) return;

    setNewBoardOnboardingDismissBusy(true);
    const saved = await setHasDismissedNewBoardOnboarding(true);
    if (!saved) {
      pushDashboardToast({ title: "안내 숨김 저장에 실패했어요." });
      setNewBoardOnboardingDismissBusy(false);
      return;
    }

    setShowNewBoardOnboarding(false);
    setNewBoardOnboardingDismissBusy(false);
  }, [newBoardOnboardingDismissBusy]);

  const saveBoardSettings = useCallback(async () => {
    const requestId = crypto.randomUUID();
    const runAttempt = async (attempt: number): Promise<void> => {
      const title = boardSettingsDraft.title.trim();
      const description = boardSettingsDraft.description.trim();

      if (!title) {
        setBoardSettingsStatus({ state: "error", requestId, errorCode: "TITLE_REQUIRED" });
        return;
      }

      setBoardSettingsStatus({ state: "saving", requestId });

      try {
        const response = await apiFetch(routes.api.boards.settings(boardId), {
          method: "PATCH",
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            "x-client-request-id": requestId,
          },
          body: JSON.stringify({
            requestId,
            patch: {
              title,
              description: description ? description : null,
            },
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok: true; requestId?: string; board?: { title?: string; description?: string | null } }
          | { ok: false; requestId?: string; error?: { code?: string } }
          | null;

        if (!response.ok || !payload || !payload.ok) {
          if (attempt === 0) {
            await runAttempt(1);
            return;
          }
          const errorCode =
            payload && payload.ok === false ? payload.error?.code : undefined;
          setBoardSettingsStatus({
            state: "error",
            requestId: payload?.requestId ?? requestId,
            errorCode: errorCode ?? "BOARD_SETTINGS_SAVE_FAILED",
          });
          return;
        }

        const nextTitle = payload.board?.title ?? title;
        const nextDescription = payload.board?.description ?? (description ? description : "");

        setBoardTitleValue(nextTitle);
        setBoardDescriptionValue(nextDescription ?? "");
        setBoardSettingsDraft({
          title: nextTitle,
          description: nextDescription ?? "",
        });
        setBoardSettingsStatus({ state: "saved", requestId: payload.requestId ?? requestId });
      } catch (error) {
        if (attempt === 0) {
          await runAttempt(1);
          return;
        }

        const fallbackRequestId = (error as { requestId?: string }).requestId ?? requestId;
        setBoardSettingsStatus({
          state: "error",
          requestId: fallbackRequestId,
          errorCode: "BOARD_SETTINGS_SAVE_FAILED",
        });
      }
    };

    await runAttempt(0);
  }, [boardId, boardSettingsDraft, setBoardSettingsStatus, setBoardTitleValue, setBoardDescriptionValue]);

  const handleBoardSettingsSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void saveBoardSettings();
    },
    [saveBoardSettings],
  );

  const boardSettingsSaving = boardSettingsStatus.state === "saving";
  const boardSettingsSaved = boardSettingsStatus.state === "saved";
  const boardSettingsError = boardSettingsStatus.state === "error";

  useEffect(() => {
    if (boardSettingsStatus.state !== "saved") return;
    const timer = window.setTimeout(() => {
      setBoardSettingsStatus({ state: "idle" });
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [boardSettingsStatus.state]);

  const presentationStorageKey = useMemo(() => `board_presentation:${boardId}`, [boardId]);

  const coachSnoozeKey = useMemo(() => `edu_coach_snooze:${boardId}`, [boardId]);
  const coachForceLeaseOnlyKey = useMemo(
    () => `edu_coach_force_lease_only:${boardId}`,
    [boardId],
  );

  useEffect(() => {
    setDailyReport(loadDailyReport(boardId, dateKST));
  }, [boardId, dateKST]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(coachSnoozeKey);
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        setCoachSnoozeUntil(parsed);
      }
    } catch {
      // ignore
    }
  }, [coachSnoozeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(coachForceLeaseOnlyKey);
      setCoachForceLeaseOnly(raw === "1");
    } catch {
      // ignore
    }
  }, [coachForceLeaseOnlyKey]);

  useEffect(() => {
    if (previousShareGuideOpen.current && !shareGuideOpen) {
      shareGuideCtaRef.current?.focus();
    }
    previousShareGuideOpen.current = shareGuideOpen;
  }, [shareGuideOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (coachForceLeaseOnly) {
        window.sessionStorage.setItem(coachForceLeaseOnlyKey, "1");
      } else {
        window.sessionStorage.removeItem(coachForceLeaseOnlyKey);
      }
    } catch {
      // ignore
    }
  }, [coachForceLeaseOnly, coachForceLeaseOnlyKey]);

  useEffect(() => {
    if (!coachSnoozeUntil) return;
    if (coachSnoozeUntil > Date.now()) return;
    try {
      window.localStorage.removeItem(coachSnoozeKey);
    } catch {
      // ignore
    }
    setCoachSnoozeUntil(null);
  }, [coachSnoozeKey, coachSnoozeUntil]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(presentationStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PresentationState>;
      setPresentationEnabled(Boolean(parsed.enabled));
      setPresentationHideOthers(Boolean(parsed.hideOthers));
      setPresentationLargeCards(parsed.largeCards ?? true);
      setPresentationSpotlightId(parsed.spotlightColumnId ?? null);
    } catch {
      // ignore
    }
  }, [presentationStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PresentationState = {
      enabled: presentationEnabled,
      spotlightColumnId: presentationSpotlightId,
      hideOthers: presentationHideOthers,
      largeCards: presentationLargeCards,
    };
    try {
      window.localStorage.setItem(presentationStorageKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    presentationEnabled,
    presentationHideOthers,
    presentationLargeCards,
    presentationSpotlightId,
    presentationStorageKey,
  ]);

  useEffect(() => {
    const orderedIds = getOrderedColumnIds(orderedWalls);
    if (orderedIds.length === 0) {
      setPresentationSpotlightId(null);
      return;
    }
    if (presentationSpotlightId && orderedIds.includes(presentationSpotlightId)) return;
    setPresentationSpotlightId(orderedIds[0]);
  }, [orderedWalls, presentationSpotlightId]);

  useEffect(() => {
    if (!presentationEnabled || !presentationSpotlightId) return;
    if (!scrollRef.current) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-wall-id="${presentationSpotlightId}"]`);
      target?.scrollIntoView({ inline: "center", block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [presentationEnabled, presentationSpotlightId]);

  useEffect(() => {
    if (!presentationEnabled) return;
    if (drawerOpen) setDrawerOpen(false);
  }, [drawerOpen, presentationEnabled]);

  useEffect(() => {
    if (!presentationEnabled) return;
    if (boardSettingsOpen) setBoardSettingsOpen(false);
  }, [boardSettingsOpen, presentationEnabled]);

  useEffect(() => {
    setShareInfo((prev) => ({
      ...prev,
      code: shareCode,
      shareUrl,
    }));
    if (shareCode) {
      setShareEnsureStatus("idle");
      setShareEnsureError(null);
    }
  }, [shareCode, shareUrl]);

  useEffect(() => {
    let active = true;
    const syncStatus = async () => {
      const metrics = getNetworkSaverMetricsSnapshot();
      const resolvedMode = metrics.mode === "lease_only" ? "lease_only" : "auto";
      if (active) {
        setNetsaverMode(coachForceLeaseOnly ? "lease_only" : resolvedMode);
      }
      if (!shareInfo.code) {
        if (active) setDowngraded(false);
        return;
      }
      let nextDowngraded = isP2PDisabledCached(shareInfo.code);
      const override = await loadNetworkSaverCodeOverride(shareInfo.code);
      if (override?.override?.disabledUntil && override.override.disabledUntil > Date.now()) {
        nextDowngraded = true;
      }
      if (active) {
        setDowngraded(nextDowngraded);
      }
    };
    void syncStatus();
    return () => {
      active = false;
    };
  }, [coachForceLeaseOnly, shareInfo.code]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.info("[teacher-board-runtime]", {
      marker: "teacher-board-canonical-v3",
      client: "TeacherBoardMinimalClient",
      boardId,
    });
  }, [boardId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return;
    type ProbeNode = {
      label: string;
      selector: string;
      element: HTMLElement | null;
    };
    const describe = (node: ProbeNode) => {
      if (!node.element) {
        return { ...node, missing: true };
      }
      const style = window.getComputedStyle(node.element);
      return {
        label: node.label,
        selector: node.selector,
        tag: node.element.tagName.toLowerCase(),
        className: node.element.className,
        dataset: node.element.dataset,
        clientHeight: node.element.clientHeight,
        scrollHeight: node.element.scrollHeight,
        clientWidth: node.element.clientWidth,
        scrollWidth: node.element.scrollWidth,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        position: style.position,
        pointerEvents: style.pointerEvents,
        display: style.display,
        flex: style.flex,
        flexDirection: style.flexDirection,
        minHeight: style.minHeight,
        height: style.height,
        maxHeight: style.maxHeight,
        scrollableY: node.element.scrollHeight > node.element.clientHeight,
        scrollableX: node.element.scrollWidth > node.element.clientWidth,
      };
    };
    const inspectAncestorChain = (element: HTMLElement | null) => {
      const rows: Array<Record<string, unknown>> = [];
      let current: HTMLElement | null = element;
      while (current) {
        rows.push(describe({ label: "ancestor", selector: "n/a", element: current }));
        current = current.parentElement;
      }
      return rows;
    };
    window.__gomdoryInspectBoardScroll = () => {
      const boardRoot = document.querySelector<HTMLElement>('[data-board-runtime="teacher-board-canonical"]');
      const boardScroller = document.querySelector<HTMLElement>('[data-board-scroll="horizontal"]');
      const wallColumn = document.querySelector<HTMLElement>("[data-wall-column-runtime]");
      const wallScroller = document.querySelector<HTMLElement>('[data-wall-scroll="vertical"]');
      const card = document.querySelector<HTMLElement>("[data-card-id]");
      const attachment = document.querySelector<HTMLElement>("[data-card-attachment-id],[data-card-attachment]");
      const points: ProbeNode[] = [
        { label: "boardRoot", selector: '[data-board-runtime="teacher-board-canonical"]', element: boardRoot },
        { label: "boardScroller", selector: '[data-board-scroll="horizontal"]', element: boardScroller },
        { label: "wallColumn", selector: "[data-wall-column-runtime]", element: wallColumn },
        { label: "wallScroller", selector: '[data-wall-scroll="vertical"]', element: wallScroller },
        { label: "card", selector: "[data-card-id]", element: card },
        { label: "attachment", selector: "[data-card-attachment-id],[data-card-attachment]", element: attachment },
      ];
      console.groupCollapsed("[board-scroll-probe] points");
      points.forEach((point) => console.log(point.label, describe(point)));
      console.groupEnd();
      console.groupCollapsed("[board-scroll-probe] wallScroller ancestors");
      console.table(inspectAncestorChain(wallScroller));
      console.groupEnd();
      console.groupCollapsed("[board-scroll-probe] boardScroller ancestors");
      console.table(inspectAncestorChain(boardScroller));
      console.groupEnd();
      return points.map((point) => describe(point));
    };
    return () => {
      delete window.__gomdoryInspectBoardScroll;
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleWindowPointerDown = (event: PointerEvent) => {
      const panel = drawerPanelRef.current;
      if (!panel) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(panel)) return;
      setDrawerOpen(false);
    };
    window.addEventListener("pointerdown", handleWindowPointerDown, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, { capture: true });
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!gearButtonRef.current) return;
    warnIfNotViewportFixed(gearButtonRef.current, "TeacherBoardGear");
  }, []);

  useEffect(() => {
    const minimapEl = document.querySelector<HTMLElement>('[data-floating="minimap"]');
    const gearEl = document.querySelector<HTMLElement>('[data-floating="gear"]');
    if (!minimapEl || !gearEl) return;
    return applyCornerAvoidance(minimapEl, gearEl);
  }, [minimapMode]);

  useEffect(() => {
    if (wallState.success && createModalOpen) {
      formRef.current?.reset();
      setCreateModalOpen(false);
    }
  }, [createModalOpen, wallState.success]);

  useEffect(() => {
    if (prewarmStatus !== "running") {
      setPrewarmRemainingMs(null);
      return;
    }
    const updateRemaining = () => {
      const endsAt = prewarmEndsAtRef.current;
      const remaining = endsAt ? Math.max(0, endsAt - Date.now()) : null;
      setPrewarmRemainingMs(remaining);
    };
    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 500);
    return () => window.clearInterval(timerId);
  }, [prewarmStatus]);

  useEffect(() => {
    return () => {
      prewarmControllerRef.current?.abort();
      startClassControllerRef.current?.abort();
      if (startClassTimeoutRef.current) {
        window.clearTimeout(startClassTimeoutRef.current);
      }
      if (boostTimerRef.current) {
        window.clearTimeout(boostTimerRef.current);
      }
    };
  }, []);

  const updateReport = useCallback(
    (key: EduReportKey, meta?: { type?: string; ts?: number }) => {
      const next = bumpCounter(boardId, dateKST, key, meta);
      setDailyReport(next);
      return next;
    },
    [boardId, dateKST],
  );

  const recordEduEventWithReport = useCallback(
    (input: { type: string; boardId: string; codeHash?: string | null; extra?: Record<string, unknown> }) => {
      void recordEduEvent(input);
      let key: EduReportKey | null = null;
      if (input.type === "netsaver_auto_downgrade") {
        key = "netsaver_auto_downgrade";
      } else if (input.type === "startclass_boost_start") {
        key = "boost_started";
      } else if (input.type === "startclass_boost_end") {
        key = "boost_completed";
      } else if (input.type === "endclass_done") {
        key = "endclass_runs";
      }
      if (key) {
        updateReport(key, { type: input.type });
      }
    },
    [updateReport],
  );

  const handlePrewarm = useCallback(
    async (durationMs: number) => {
      if (prewarmStatus === "running") return;
      const controller = new AbortController();
      prewarmControllerRef.current = controller;
      prewarmEndsAtRef.current = Date.now() + durationMs;
      setPrewarmStatus("running");
      setPrewarmSeedLiteReady(false);
      prewarmResultsRef.current = null;

      const plan: PrewarmPlan = {
        wasm: true,
        config: true,
        tokenizer: true,
        shards: false,
      };

      const metrics = getNetworkSaverMetricsSnapshot();
      let downgraded = false;
      if (shareCode) {
        downgraded = isP2PDisabledCached(shareCode);
        const override = await loadNetworkSaverCodeOverride(shareCode);
        if (override?.override?.disabledUntil && override.override.disabledUntil > Date.now()) {
          downgraded = true;
        }
      }

      const result = await runPrewarm({
        plan,
        durationMs,
        netsaverState: {
          boardId,
          shareCode,
          mode: metrics.mode,
          tier: metrics.tier,
          p2pProbeStatus: metrics.p2pProbe.status,
          downgraded,
        },
        onProgress: (progress) => {
          if (progress.status === "done") {
            prewarmEndsAtRef.current = null;
          }
        },
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        setPrewarmStatus("idle");
        prewarmResultsRef.current = null;
      } else {
        setPrewarmStatus(result.ok ? "done" : "fail");
        setPrewarmSeedLiteReady(result.results.seedLite === "ok");
        prewarmResultsRef.current = result.results;
        updateReport("prewarm_runs", { type: "prewarm_end" });
        if (result.ok) {
          updateReport("prewarm_ok");
        } else {
          updateReport("prewarm_partial");
        }
      }
      prewarmControllerRef.current = null;
      prewarmEndsAtRef.current = null;
    },
    [boardId, prewarmStatus, shareCode, updateReport],
  );

  const updateStartClassPhase = useCallback((phase: StartClassPhase) => {
    setStartClassPhase(phase);
    if (phase === "prewarm") {
      setStartClassStepLabel("사전 준비");
      return;
    }
    if (phase === "boost") {
      setStartClassStepLabel("부스트");
      return;
    }
    if (phase === "quiet") {
      setStartClassStepLabel("조용 모드");
    }
  }, []);

  const handleStartClass = useCallback(async () => {
    if (startClassRunningRef.current) return;
    startClassRunningRef.current = true;
    setStartClassRunning(true);
    setStartClassPartial(false);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 180_000);
    startClassTimeoutRef.current = timeoutId;
    startClassControllerRef.current = controller;

    const metrics = getNetworkSaverMetricsSnapshot();
    let downgraded = false;
    if (shareInfo.code) {
      downgraded = isP2PDisabledCached(shareInfo.code);
      const override = await loadNetworkSaverCodeOverride(shareInfo.code);
      if (override?.override?.disabledUntil && override.override.disabledUntil > Date.now()) {
        downgraded = true;
      }
    }

    const codeHash = shareInfo.code ? await buildEduCodeHash(boardId, shareInfo.code) : null;

    try {
      const result = await runStartClass({
        boardId,
        classCodeHash: codeHash,
        netsaverState: {
          mode: metrics.mode,
          tier: metrics.tier,
          p2pProbeStatus: metrics.p2pProbe.status,
          downgraded,
        },
        runPrewarm,
        startBoost: async (durationMs) => {
          if (!shareInfo.code) return { ok: false, reason: "unavailable" };
          const boostResult = await rearmBoostWindow(shareInfo.code, durationMs);
          if (!boostResult.ok) {
            return { ok: false, reason: boostResult.reason };
          }
          if (boostTimerRef.current) {
            window.clearTimeout(boostTimerRef.current);
          }
          boostEndsAtRef.current = Date.now() + durationMs;
          boostTimerRef.current = window.setTimeout(() => {
            boostEndsAtRef.current = null;
          }, durationMs);
          return { ok: true };
        },
        stopBoostAndQuiet: () => {
          if (!shareInfo.code) return;
          setQuietModeState(shareInfo.code, true, Date.now(), "explicit");
        },
        setPhase: updateStartClassPhase,
        recordEduEvent: recordEduEventWithReport,
        toast: (message) => {
          pushDashboardToast({ title: message });
        },
        signal: controller.signal,
        options: {
          durationPrewarmMs: 30_000,
          durationBoostMs: 120_000,
          allowAuto: true,
        },
      });
      setStartClassPartial(Boolean(result.partial));
    } finally {
      window.clearTimeout(timeoutId);
      startClassTimeoutRef.current = null;
      startClassControllerRef.current = null;
      startClassRunningRef.current = false;
      setStartClassRunning(false);
    }
  }, [boardId, recordEduEventWithReport, shareInfo.code, updateStartClassPhase]);

  const abortInFlight = useCallback(() => {
    prewarmControllerRef.current?.abort();
    startClassControllerRef.current?.abort();
    if (startClassTimeoutRef.current) {
      window.clearTimeout(startClassTimeoutRef.current);
      startClassTimeoutRef.current = null;
    }
    if (boostTimerRef.current) {
      window.clearTimeout(boostTimerRef.current);
      boostTimerRef.current = null;
    }
    boostEndsAtRef.current = null;
    prewarmEndsAtRef.current = null;
    startClassRunningRef.current = false;
    setStartClassRunning(false);
  }, []);

  const handleEndClass = useCallback(async () => {
    if (endClassRunningRef.current) return;
    endClassRunningRef.current = true;
    setEndClassPartial(false);
    setEndClassPhase("stopping");

    const metrics = getNetworkSaverMetricsSnapshot();
    let downgraded = false;
    if (shareInfo.code) {
      downgraded = isP2PDisabledCached(shareInfo.code);
      const override = await loadNetworkSaverCodeOverride(shareInfo.code);
      if (override?.override?.disabledUntil && override.override.disabledUntil > Date.now()) {
        downgraded = true;
      }
    }

    const codeHash = shareInfo.code ? await buildEduCodeHash(boardId, shareInfo.code) : null;
    const boostUntil =
      metrics.boost.startAt && metrics.boost.durationMs
        ? metrics.boost.startAt + metrics.boost.durationMs
        : null;

    const result = await runEndClass({
      boardId,
      classCodeHash: codeHash,
      netsaverState: {
        mode: metrics.mode,
        tier: metrics.tier,
        boostUntil,
        downgraded,
        seedLiteReady: prewarmSeedLiteReady,
        prewarmResults: prewarmResultsRef.current,
      },
      forceQuiet: () => {
        if (shareInfo.code) {
          setQuietModeState(shareInfo.code, true, Date.now(), "explicit");
        }
        const swarm = getActiveWasmSwarm();
        if (swarm) {
          swarm.stopSeedLite("endclass", { disconnectPeers: true, downgrade: false });
        }
      },
      stopBroadcasts: async () => {
        if (!shareInfo.code) return;
        await disableEpidemicForRoom(shareInfo.code);
      },
      abortInFlight,
      clearSessionState: () => {
        setEndClassPhase("resetting");
        setPrewarmStatus("idle");
        setPrewarmRemainingMs(null);
        setPrewarmSeedLiteReady(false);
        prewarmResultsRef.current = null;
        setStartClassPhase("idle");
        setStartClassStepLabel("사전 준비");
        setStartClassPartial(false);
        setStartClassRunning(false);
        startClassRunningRef.current = false;
        boostEndsAtRef.current = null;
        if (boostTimerRef.current) {
          window.clearTimeout(boostTimerRef.current);
          boostTimerRef.current = null;
        }
      },
      recordEduEvent: recordEduEventWithReport,
      toast: (message) => {
        pushDashboardToast({ title: message });
      },
    });

    setEndClassPhase(result.ok ? "done" : "error");
    setEndClassPartial(Boolean(result.partial));
    endClassRunningRef.current = false;
  }, [abortInFlight, boardId, prewarmSeedLiteReady, recordEduEventWithReport, shareInfo.code]);

  const handleEnsureShareCode = useCallback(async () => {
    if (shareInfo.code) return;
    if (shareEnsureInFlightRef.current) {
      return shareEnsureInFlightRef.current;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    setShareEnsureStatus("pending");
    setShareEnsureError(null);
    const ensurePromise = (async () => {
      try {
        const response = await apiFetch(apiV1Path(`boards/${boardId}/share/ensure`), {
          method: "POST",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          code?: string;
          shareUrl?: string;
          presentUrl?: string;
          requestId?: string;
          error?: { message?: string };
        };
        if (!response.ok || !payload.ok || !payload.code || !payload.shareUrl || !payload.presentUrl) {
          const requestId = payload.requestId ?? response.headers.get("x-request-id");
          const detail = payload.error?.message ? ` (${payload.error.message})` : "";
          throw new Error(
            `공유코드 생성 실패 (네트워크/권한). 잠시 후 다시 시도하거나 우측 관리 버튼에서 확인하세요.${detail}${requestId ? ` [${requestId}]` : ""}`,
          );
        }
        setShareInfo({
          code: payload.code,
          shareUrl: payload.shareUrl,
          presentUrl: payload.presentUrl,
        });
        setShareEnsureStatus("success");
        pushDashboardToast({
          title: "입장코드가 생성되었습니다.",
        });
        updateReport("share_ensure_ok", { type: "share_ensure_ok" });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "공유코드 생성 실패 (네트워크/권한). 잠시 후 다시 시도하거나 우측 관리 버튼에서 확인하세요.";
        setShareEnsureStatus("error");
        setShareEnsureError(message);
        updateReport("share_ensure_fail", { type: "share_ensure_fail" });
      } finally {
        window.clearTimeout(timeoutId);
        shareEnsureInFlightRef.current = null;
      }
    })();
    shareEnsureInFlightRef.current = ensurePromise;
    return ensurePromise;
  }, [boardId, shareInfo.code, updateReport]);

  const handleEnsureEduLessonLink = useCallback(async () => {
    if (eduEnsureLoading || !shareInfo.code) return;
    setEduEnsureLoading(true);
    setEduEnsureError(null);
    setEduEnsureNotice(null);
    try {
      const response = await apiFetch(apiV1Path("edu/course/ensure"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const payload = (await response.json()) as EduEnsureResult | EduEnsureError;
      if (!response.ok || !payload.ok) {
        setEduEnsureError((payload as EduEnsureError).message ?? "EDU 4교시 링크를 만들지 못했습니다.");
        return;
      }
      const result = payload as EduEnsureResult;
      const statusText = result.createdCount === 0 ? "이미 준비된 4교시 링크를 확인했습니다." : "EDU 4교시 링크 카드를 만들었습니다.";
      setEduEnsureNotice(statusText);
      pushDashboardToast({ title: "EDU 4교시 링크 준비 완료" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "EDU 4교시 링크를 만들지 못했습니다.";
      setEduEnsureError(message);
    } finally {
      setEduEnsureLoading(false);
    }
  }, [boardId, eduEnsureLoading, shareInfo.code]);

  const handleEnsurePracticeTemplate = useCallback(async () => {
    if (practiceEnsureLoading || !shareInfo.code) return;
    setPracticeEnsureLoading(true);
    setPracticeEnsureError(null);
    setPracticeEnsureNotice(null);
    try {
      const response = await apiFetch(apiV1Path("edu/course/ensure"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, mode: "practiceTemplate" }),
      });
      const payload = (await response.json()) as EduEnsureResult | EduEnsureError;
      if (!response.ok || !payload.ok) {
        setPracticeEnsureError((payload as EduEnsureError).message ?? "실습 템플릿을 만들지 못했습니다.");
        return;
      }
      const result = payload as EduEnsureResult;
      const changed = result.createdCount + (result.updatedCount ?? 0);
      setPracticeEnsureNotice(changed === 0 ? "이미 준비되어 있어요." : "템플릿을 준비했어요.");
      pushDashboardToast({ title: "4교시 실습 템플릿 준비 완료" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "실습 템플릿을 만들지 못했습니다.";
      setPracticeEnsureError(message);
    } finally {
      setPracticeEnsureLoading(false);
    }
  }, [boardId, practiceEnsureLoading, shareInfo.code]);

  const handleOpenPracticeInbox = useCallback(() => {
    setOrderedWalls((prev) => {
      const filtered = prev
        .map((entry) => ({
          ...entry,
          cards: [...entry.cards]
            .filter((card) => isPracticeSubmissionCard(card))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        }))
        .filter((entry) => entry.cards.length > 0)
        .sort((a, b) => a.wall.position - b.wall.position);
      return filtered.length > 0 ? filtered : prev;
    });
    setDrawerOpen(false);
    pushDashboardToast({
      title: "제출함 보기",
      description: "실습 제출 카드만 모아 보여줍니다.",
    });
  }, []);

  const handleBoost30s = useCallback(async () => {
    if (!shareInfo.code || boostInFlight) return;
    setBoostInFlight(true);
    const result = await rearmBoostWindow(shareInfo.code, 30_000);
    setBoostInFlight(false);
    if (result.ok) {
      pushDashboardToast({ title: "부스트 30초가 시작됐어요." });
      updateReport("boost_started", { type: "coach_boost_start" });
      return;
    }
    if (result.reason === "cooldown") {
      pushDashboardToast({ title: "부스트는 잠시 후 다시 사용할 수 있어요." });
      return;
    }
    if (result.reason === "blocked") {
      pushDashboardToast({ title: "부스트 재시도가 많아 잠시 제한됐어요." });
      return;
    }
    pushDashboardToast({ title: "부스트를 시작하지 못했어요." });
  }, [boostInFlight, shareInfo.code, updateReport]);

  const handleForceLeaseOnly = useCallback(async () => {
    if (!shareInfo.code) return;
    setCoachForceLeaseOnly(true);
    setNetsaverMode("lease_only");
    pushDashboardToast({ title: "안정 모드로 전환했어요." });
  }, [shareInfo.code]);

  const handleCoachSnooze = useCallback(() => {
    const nextUntil = Date.now() + 2 * 60 * 60 * 1000;
    setCoachSnoozeUntil(nextUntil);
    try {
      window.localStorage.setItem(coachSnoozeKey, String(nextUntil));
    } catch {
      // ignore
    }
  }, [coachSnoozeKey]);

  const shareEnsurePill =
    shareEnsureStatus === "pending"
      ? "입장코드 생성 중…"
      : shareEnsureStatus === "error"
        ? "입장코드 생성 실패: 네트워크/권한을 확인해주세요."
        : null;

  const report = useMemo(
    () =>
      dailyReport ??
      finalizeHeadline({
        dateKST,
        boardId,
        totals: { ...defaultReportTotals },
        lastEvents: [],
        headline: {
          level: "green",
          text: "",
          guidance: "",
        },
      }),
    [boardId, dailyReport, dateKST, defaultReportTotals],
  );

  const weeklyReport = useMemo(() => computeWeeklyReport(boardId), [boardId]);

  const isCoachSnoozed = useMemo(() => {
    if (!coachSnoozeUntil) return false;
    return coachSnoozeUntil > Date.now();
  }, [coachSnoozeUntil]);

  const effectiveNetsaverMode = coachForceLeaseOnly ? "lease_only" : netsaverMode;

  const coachAction = useMemo(() => {
    const metrics = getNetworkSaverMetricsSnapshot();
    const boostEndsAt =
      metrics.boost.startAt && metrics.boost.durationMs
        ? metrics.boost.startAt + metrics.boost.durationMs
        : null;
    const isBoosting = boostEndsAt ? Date.now() < boostEndsAt : false;
    const boostState = isBoosting ? "boosting" : metrics.quietMode.enabled ? "quiet" : "idle";
    return computeCoachAction({
      todayReport: { headline: report.headline, totals: report.totals },
      weeklyReport: { headline: weeklyReport.headline, totals: weeklyReport.totals },
      netsaverMode: effectiveNetsaverMode,
      downgraded,
      prewarmStatus: prewarmStatus === "fail" ? "partial_fail" : prewarmStatus,
      shareCodePresent: Boolean(shareInfo.code),
      boostState,
      startClassPhase,
    });
  }, [
    downgraded,
    effectiveNetsaverMode,
    prewarmStatus,
    report.headline,
    report.totals,
    shareInfo.code,
    startClassPhase,
    weeklyReport.headline,
    weeklyReport.totals,
  ]);

  const coachActionLabel = useMemo(() => {
    switch (coachAction.kind) {
      case "run_prewarm_30s":
        return "사전 준비 30초";
      case "start_class_oneclick":
        return "수업 시작(원클릭)";
      case "boost_30s":
        return "부스트 30초";
      case "force_lease_only":
        return "안정 모드";
      case "create_share_code":
        return "입장코드 생성";
      default:
        return null;
    }
  }, [coachAction.kind]);

  const coachActionDisabled = useMemo(() => {
    switch (coachAction.kind) {
      case "run_prewarm_30s":
        return prewarmStatus === "running";
      case "start_class_oneclick":
        return startClassRunning || startClassPhase !== "idle";
      case "boost_30s":
        return boostInFlight || !shareInfo.code;
      case "force_lease_only":
        return effectiveNetsaverMode === "lease_only" || !shareInfo.code;
      case "create_share_code":
        return shareEnsureStatus === "pending" || Boolean(shareInfo.code);
      default:
        return true;
    }
  }, [
    boostInFlight,
    coachAction.kind,
    effectiveNetsaverMode,
    prewarmStatus,
    shareEnsureStatus,
    shareInfo.code,
    startClassPhase,
    startClassRunning,
  ]);

  const handleCoachAction = useCallback(() => {
    switch (coachAction.kind) {
      case "run_prewarm_30s":
        void handlePrewarm(30_000);
        return;
      case "start_class_oneclick":
        void handleStartClass();
        return;
      case "boost_30s":
        void handleBoost30s();
        return;
      case "force_lease_only":
        void handleForceLeaseOnly();
        return;
      case "create_share_code":
        void handleEnsureShareCode();
        return;
      default:
        return;
    }
  }, [
    coachAction.kind,
    handleBoost30s,
    handleEnsureShareCode,
    handleForceLeaseOnly,
    handlePrewarm,
    handleStartClass,
  ]);

  const prewarmStatusLabel = useMemo(() => {
    if (prewarmStatus === "idle") return "대기";
    if (prewarmStatus === "running") {
      const remainingSec = prewarmRemainingMs
        ? Math.max(1, Math.ceil(prewarmRemainingMs / 1000))
        : null;
      return remainingSec ? `진행 중… (남은 시간: ${remainingSec}초)` : "진행 중…";
    }
    if (prewarmStatus === "done") return "완료";
    return "일부 준비에 실패했어요. 그래도 수업은 진행할 수 있어요.";
  }, [prewarmRemainingMs, prewarmStatus]);

  const startClassStatusLabel = useMemo(() => {
    if (startClassPartial) {
      return "일부 준비 실패, 그래도 진행 중";
    }
    if (startClassPhase === "idle") return "대기";
    if (startClassPhase === "done") return "수업 시작됨";
    if (startClassRunning) {
      return `진행 중… (단계: ${startClassStepLabel})`;
    }
    return "대기";
  }, [startClassPartial, startClassPhase, startClassRunning, startClassStepLabel]);

  const endClassStatusLabel = useMemo(() => {
    if (endClassPhase === "idle") return "대기";
    if (endClassPhase === "stopping" || endClassPhase === "resetting") return "정리 중…";
    if (endClassPhase === "done") {
      return endClassPartial ? "일부 정리 실패, 그래도 완료" : "정리 완료";
    }
    return "일부 정리 실패, 그래도 완료";
  }, [endClassPartial, endClassPhase]);

  useEffect(() => {
    if (editModalWall) {
      setEditTitle(editModalWall.title);
      setEditDescription(editModalWall.description ?? "");
    }
  }, [editModalWall]);

  useEffect(() => {
    if (updateWallState.success && editModalWall) {
      setEditModalWall(null);
    }
  }, [editModalWall, updateWallState.success]);

  useEffect(() => {
    setOrderedWalls(
      [...walls].sort((a, b) => {
        return a.wall.position - b.wall.position;
      }),
    );
  }, [walls]);

  useEffect(() => {
    if (!lastActiveWallId || !orderedWalls.find((entry) => entry.wall.id === lastActiveWallId)) {
      setLastActiveWallId(orderedWalls[0]?.wall.id ?? "");
    }
  }, [lastActiveWallId, orderedWalls]);

  useEffect(() => {
    if (!composeWallId && orderedWalls.length > 0) {
      setComposeWallId(orderedWalls[0]?.wall.id ?? "");
    }
  }, [composeWallId, orderedWalls]);

  const normalizedWalls = useMemo<NormalizedWallEntry[]>(
    () =>
      orderedWalls.map((entry) => ({
        ...entry,
        visibleCards: entry.cards.filter((card) => !card.is_hidden),
      })),
    [orderedWalls],
  );

  const composeWalls = useMemo(
    () => orderedWalls.map((entry) => ({ id: entry.wall.id, title: entry.wall.title })),
    [orderedWalls],
  );

  const wallIds = useMemo(() => normalizedWalls.map((entry) => entry.wall.id), [normalizedWalls]);
  const orderedColumnIds = useMemo(() => getOrderedColumnIds(orderedWalls), [orderedWalls]);

  const cardIdsByWall = useMemo(() => {
    const map = new Map<string, string[]>();
    normalizedWalls.forEach((entry) => {
      map.set(
        entry.wall.id,
        entry.visibleCards.map((card) => card.id),
      );
    });
    return map;
  }, [normalizedWalls]);

  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [overWallId, setOverWallId] = useState<string | null>(null);

  const cardLocationById = useMemo(() => {
    const map = new Map<string, { wallId: string; index: number }>();
    normalizedWalls.forEach((entry) => {
      entry.visibleCards.forEach((card, index) => {
        map.set(card.id, { wallId: entry.wall.id, index });
      });
    });
    return map;
  }, [normalizedWalls]);

  const canDragCard = useCallback((cardId: string) => cardLocationById.has(cardId), [cardLocationById]);
  const onCardHoldStart = useCallback((cardId: string) => {
    void cardId;
  }, []);
  const onCardHoldEnd = useCallback((cardId: string) => {
    void cardId;
  }, []);

  useEffect(() => {
    if (activeColumnId && wallIds.includes(activeColumnId)) return;
    setActiveColumnId(wallIds[0] ?? null);
  }, [activeColumnId, wallIds]);

  useEffect(() => {
    if (selectedCardId && !cardLocationById.has(selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [cardLocationById, selectedCardId]);


  const parseCardSortableId = useCallback((value: string) => (value.startsWith("card:") ? value.slice(5) : null), []);
  const parseWallDroppableId = useCallback((value: string) => (value.startsWith("wall:") ? value.slice(5) : null), []);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: CARD_DRAG_MOUSE_ACTIVATION,
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: CARD_DRAG_TOUCH_ACTIVATION,
  });
  const sensors = useSensors(mouseSensor, ...(touchLike ? [touchSensor] : []));

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
    if (!force && !autoScrollNeedsMeasureRef.current && now - autoScrollLastMeasureRef.current < 400) return;
    autoScrollLastMeasureRef.current = now;
    autoScrollNeedsMeasureRef.current = false;
    autoScrollBoardRectRef.current = board.getBoundingClientRect();
    const columnId = autoScrollWallIdRef.current;
    const shouldResolveColumn =
      force ||
      autoScrollMeasuredColumnIdRef.current !== columnId ||
      !autoScrollMeasuredColumnElRef.current;
    if (shouldResolveColumn) {
      autoScrollMeasuredColumnIdRef.current = columnId;
      autoScrollMeasuredColumnElRef.current = resolveWallScrollContainer(columnId);
    }
    autoScrollColumnRectRef.current = autoScrollMeasuredColumnElRef.current?.getBoundingClientRect() ?? null;
  }, [resolveWallScrollContainer]);

  const startAutoScrollLoop = useCallback(() => {
    if (autoScrollRafRef.current !== null) return;
    const tick = () => {
      autoScrollRafRef.current = null;
      if (!isDraggingRef.current) return;
      const pointer = autoScrollPointerRef.current;
      const board = scrollRef.current;
      if (!pointer || !board) return;

      measureAutoScrollTargets();
      const boardRect = autoScrollBoardRectRef.current ?? board.getBoundingClientRect();
      autoScrollBoardRectRef.current = boardRect;

      const deltaX = computeEdgeScrollDelta({
        pointer: pointer.x,
        rect: boardRect,
        axis: "x",
        zonePx: 72,
        maxSpeedPxPerFrame: 24,
      });

      let deltaY = 0;
      let movedY = false;
      const column = autoScrollMeasuredColumnElRef.current;
      if (column) {
        const columnRect = autoScrollColumnRectRef.current ?? column.getBoundingClientRect();
        autoScrollColumnRectRef.current = columnRect;
        deltaY = computeEdgeScrollDelta({
          pointer: pointer.y,
          rect: columnRect,
          axis: "y",
          zonePx: 72,
          maxSpeedPxPerFrame: 20,
        });
        if (Math.abs(deltaY) > 0.01) {
          const nextScrollTop = computeClampedScroll({
            current: column.scrollTop,
            delta: deltaY,
            max: column.scrollHeight - column.clientHeight,
          });
          movedY = nextScrollTop !== column.scrollTop;
          if (movedY) column.scrollTop = nextScrollTop;
        }
      }

      if (!movedY) {
        const boardDeltaY = computeEdgeScrollDelta({
          pointer: pointer.y,
          rect: boardRect,
          axis: "y",
          zonePx: 72,
          maxSpeedPxPerFrame: 18,
        });
        deltaY = boardDeltaY;
        if (Math.abs(boardDeltaY) > 0.01) {
          const nextBoardTop = computeClampedScroll({
            current: board.scrollTop,
            delta: boardDeltaY,
            max: board.scrollHeight - board.clientHeight,
          });
          movedY = nextBoardTop !== board.scrollTop;
          if (movedY) board.scrollTop = nextBoardTop;
        }
      }

      let movedX = false;
      if (Math.abs(deltaX) > 0.01) {
        const nextBoardLeft = computeClampedScroll({
          current: board.scrollLeft,
          delta: deltaX,
          max: board.scrollWidth - board.clientWidth,
        });
        movedX = nextBoardLeft !== board.scrollLeft;
        if (movedX) board.scrollLeft = nextBoardLeft;
      }

      if (shouldContinueAutoScrollLoop({ deltaX, deltaY, movedX, movedY })) {
        autoScrollRafRef.current = requestAnimationFrame(tick);
      }
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, [measureAutoScrollTargets]);


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
          board: "teacher",
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
          board: "teacher",
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
  }, [normalizedWalls.length]);

  useEffect(() => {
    const board = scrollRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() => {
      autoScrollNeedsMeasureRef.current = true;
    });
    observer.observe(board);
    const columns = board.querySelectorAll<HTMLElement>('[data-scroll="wall-column"][data-wall-id]');
    for (const column of columns) {
      observer.observe(column);
    }
    autoScrollResizeObserverRef.current = observer;
    return () => {
      observer.disconnect();
      if (autoScrollResizeObserverRef.current === observer) {
        autoScrollResizeObserverRef.current = null;
      }
    };
  }, [orderedColumnIds]);

  const resyncOnceAfterMoveFailure = useCallback(() => {
    if (moveFailureResyncRef.current) return;
    moveFailureResyncRef.current = true;
    window.setTimeout(() => {
      router.refresh();
    }, 0);
  }, [router]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      dragStartPointerRef.current = null;
      autoScrollPointerRef.current = null;
      autoScrollWallIdRef.current = null;
      autoScrollMeasuredColumnIdRef.current = null;
      autoScrollMeasuredColumnElRef.current = null;
      autoScrollNeedsMeasureRef.current = true;
      stopAutoScrollLoop();
      if (hideOthersRestoreRef.current !== null) {
        setPresentationHideOthers(hideOthersRestoreRef.current);
        hideOthersRestoreRef.current = null;
      }
      setOverWallId(null);
      const { active, over } = event;
      const activeCardId = parseCardSortableId(String(active.id));
      if (activeCardId) {
        setDraggingCardId(null);
        setOverWallId(null);
        if (!over) return;

        const source = cardLocationById.get(activeCardId);
        if (!source) return;

        const overCardId = parseCardSortableId(String(over.id));
        const wallFromDropZone = parseWallDroppableId(String(over.id));
        const targetWallId =
          wallFromDropZone ?? (overCardId ? (cardLocationById.get(overCardId)?.wallId ?? null) : null) ?? source.wallId;
        if (!targetWallId) return;

        const targetCards = cardIdsByWall.get(targetWallId) ?? [];
        const overIndex = overCardId ? targetCards.indexOf(overCardId) : targetCards.length;
        const toIndex = overIndex < 0 ? targetCards.length : overIndex;

        const prev = orderedWalls.map((entry) => ({ ...entry, cards: [...entry.cards] }));
        const moved = moveCardAcrossWalls({
          entries: prev.map((entry) => ({ wall: { id: entry.wall.id }, cards: entry.cards })),
          cardId: activeCardId,
          toWallId: targetWallId,
          toIndex,
        });
        if (!moved.changed) return;
        const nextWalls = prev.map((entry) => {
          const movedEntry = moved.entries.find((candidate) => candidate.wall.id === entry.wall.id);
          return {
            ...entry,
            cards: movedEntry?.cards ?? entry.cards,
          };
        });
        setOrderedWalls(nextWalls);

        void (async () => {
          try {
            const res = await fetch(routes.api.v1("dashboard", "cards", activeCardId, "move"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ boardId, wallId: targetWallId, clientMutationId: crypto.randomUUID() }),
            });
            if (!res.ok) throw new Error("move failed");
          } catch {
            setOrderedWalls(prev);
            resyncOnceAfterMoveFailure();
            pushDashboardToast({ title: "카드 이동을 저장하지 못했어요." });
          }
        })();
        return;
      }

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedWalls.findIndex((entry) => entry.wall.id === active.id);
      const newIndex = orderedWalls.findIndex((entry) => entry.wall.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const nextWalls = arrayMove(orderedWalls, oldIndex, newIndex);
      setOrderedWalls(nextWalls);
      const nextOrder = nextWalls.map((entry) => entry.wall.id);
      void reorderWallsAction({
        boardId,
        wallIdsInOrder: JSON.stringify(nextOrder),
      });
    },
    [boardId, cardIdsByWall, cardLocationById, orderedWalls, parseCardSortableId, parseWallDroppableId, resyncOnceAfterMoveFailure, stopAutoScrollLoop],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeCardId = parseCardSortableId(String(event.active.id));
      if (activeCardId) {
        setDraggingCardId(activeCardId);
        }
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
      isDraggingRef.current = true;
      autoScrollWallIdRef.current = activeCardId ? cardLocationById.get(activeCardId)?.wallId ?? null : null;
      autoScrollNeedsMeasureRef.current = true;
      measureAutoScrollTargets(true);
      if (presentationEnabled && presentationHideOthers) {
        hideOthersRestoreRef.current = presentationHideOthers;
        setPresentationHideOthers(false);
      }
    },
    [cardLocationById, measureAutoScrollTargets, parseCardSortableId, presentationEnabled, presentationHideOthers],
  );

  const handleDragMove = useCallback((event: DragMoveEvent) => {
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
    if (!isDraggingRef.current) return;

    if (nextWallId) {
      autoScrollWallIdRef.current = nextWallId;
      autoScrollMeasuredColumnIdRef.current = null;
      autoScrollMeasuredColumnElRef.current = null;
      autoScrollColumnRectRef.current = null;
      autoScrollNeedsMeasureRef.current = true;
    }

    const startPointer = dragStartPointerRef.current;
    if (!startPointer) return;
    autoScrollPointerRef.current = {
      x: startPointer.x + event.delta.x,
      y: startPointer.y + event.delta.y,
    };
    startAutoScrollLoop();
  }, [startAutoScrollLoop]);

  useEffect(() => () => stopAutoScrollLoop(), [stopAutoScrollLoop]);

  const handleWallResizeStop = useCallback(
    async (wallId: string, nextWidth: number) => {
      const currentEntry = orderedWalls.find((entry) => entry.wall.id === wallId);
      if (!currentEntry) return;

      // TODO: board settings 확장 시 snapWidthEnabled를 연결해 스냅 옵션을 제어합니다.
      const isResizeSnapEnabled = true;
      const widthPx = snapWallWidth(nextWidth, isResizeSnapEnabled);
      const previousWidth = currentEntry.wall.ui_width_px;

      if (widthPx === previousWidth) return;

      setOrderedWalls((prev) =>
        prev.map((entry) =>
          entry.wall.id === wallId
            ? { ...entry, wall: { ...entry.wall, ui_width_px: widthPx } }
            : entry,
        ),
      );

      const formData = new FormData();
      formData.set("boardId", boardId);
      formData.set("wallId", wallId);
      formData.set("widthPx", String(widthPx));

      const result = await updateWallWidthAction({ success: false }, formData);

      if (!result.success) {
        setOrderedWalls((prev) =>
          prev.map((entry) =>
            entry.wall.id === wallId
              ? { ...entry, wall: { ...entry.wall, ui_width_px: previousWidth } }
              : entry,
          ),
        );
        pushDashboardToast({
          title: "섹션 너비 저장 실패",
          description: result.error ?? "섹션 너비를 저장하지 못했습니다.",
        });
      }
    },
    [boardId, orderedWalls],
  );

  const handleComposeOpen = useCallback((wallId: string) => {
    if (!wallId) return;
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      composeRestoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    }
    setLastActiveWallId(wallId);
    setActiveColumnId(wallId);
    setComposeWallId(wallId);
    setComposeOpen(true);
  }, []);

  const closeComposeWithFocusRestore = useCallback(() => {
    setComposeOpen(false);
    const restoreTarget = composeRestoreFocusRef.current;
    composeRestoreFocusRef.current = null;
    if (restoreTarget) {
      requestAnimationFrame(() => {
        restoreTarget.focus({ preventScroll: true });
      });
    }
  }, []);

  const handleActivateWall = useCallback((wallId: string) => {
    if (!wallId) return;
    setLastActiveWallId(wallId);
    setActiveColumnId(wallId);
  }, []);

  const handleSelectCard = useCallback(
    (cardId: string, wallId: string) => {
      setSelectedCardId(cardId);
      setActiveColumnId(wallId);
      setLastActiveWallId(wallId);
    },
    [],
  );

  const handlePresentationSpotlightSelect = useCallback(
    (wallId: string) => {
      if (!presentationEnabled) return;
      setPresentationSpotlightId(wallId);
    },
    [presentationEnabled],
  );

  const handleActivityCardJump = useCallback((cardId: string) => {
    const location = cardLocationById.get(cardId);
    if (location) {
      setActiveColumnId(location.wallId);
      setLastActiveWallId(location.wallId);
    }
    setSelectedCardId(cardId);
    scrollToCard(cardId, { block: "nearest", inline: "nearest" });
  }, [cardLocationById]);

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  };

  const closeBoardContextMenus = useCallback(() => {
    setColumnContextMenu(null);
    setCardContextMenu(null);
  }, []);

  const copyTextToClipboard = useCallback(async (value: string, successTitle: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushDashboardToast({ title: successTitle });
    } catch (error) {
      pushDashboardToast({
        title: "복사 실패",
        description: error instanceof Error ? error.message : "클립보드 복사에 실패했습니다.",
      });
    }
  }, []);

  const teacherBoardUrl = useMemo(() => {
    if (typeof window === "undefined") return `/dashboard/boards/${boardId}/board`;
    return new URL(`/dashboard/boards/${boardId}/board`, window.location.origin).toString();
  }, [boardId]);

  const studentBoardUrl = useMemo(() => {
    if (!shareInfo.code) return "";
    return buildShareUrl(shareInfo.code);
  }, [shareInfo.code]);

  const boardWallLink = useCallback((wallId: string) => {
    if (typeof window === "undefined") return `/dashboard/boards/${boardId}/walls/${wallId}`;
    return new URL(`/dashboard/boards/${boardId}/walls/${wallId}`, window.location.origin).toString();
  }, [boardId]);

  const boardCardLink = useCallback((wallId: string, cardId: string) => {
    if (typeof window === "undefined") return `/dashboard/boards/${boardId}/walls/${wallId}?card=${cardId}`;
    return new URL(`/dashboard/boards/${boardId}/walls/${wallId}?card=${cardId}`, window.location.origin).toString();
  }, [boardId]);

  const isBoardShortcutBlocked = useCallback(
    (target: EventTarget | null) => {
      if (!isBoardActive) return true;
      if (isEditableTarget(target)) return true;
      if (isDraggingRef.current) return true;
      if (drawerOpen || createModalOpen || editModalWall || composeOpen) return true;
      if (typeof document !== "undefined") {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (dialog) return true;
      }
      return false;
    },
    [composeOpen, createModalOpen, drawerOpen, editModalWall, isBoardActive],
  );

  const isPresentationShortcutBlocked = useCallback(
    (target: EventTarget | null) => {
      if (isEditableTarget(target)) return true;
      if (drawerOpen || createModalOpen || editModalWall || composeOpen) return true;
      if (typeof document !== "undefined") {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) return true;
      }
      return false;
    },
    [composeOpen, createModalOpen, drawerOpen, editModalWall],
  );

  const updatePresentationEnabled = useCallback(
    (nextEnabled: boolean) => {
      setPresentationEnabled(nextEnabled);
      if (nextEnabled) {
        const nextSpotlight = presentationSpotlightId ?? orderedColumnIds[0] ?? null;
        setPresentationSpotlightId(nextSpotlight);
      }
    },
    [orderedColumnIds, presentationSpotlightId],
  );

  const movePresentationSpotlight = useCallback(
    (direction: "prev" | "next") => {
      if (orderedColumnIds.length === 0) return;
      const currentIndex = presentationSpotlightId
        ? orderedColumnIds.indexOf(presentationSpotlightId)
        : 0;
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const delta = direction === "next" ? 1 : -1;
      const nextIndex = (safeIndex + delta + orderedColumnIds.length) % orderedColumnIds.length;
      setPresentationSpotlightId(orderedColumnIds[nextIndex] ?? null);
    },
    [orderedColumnIds, presentationSpotlightId],
  );

  const resolveActiveWallId = useCallback(() => {
    if (selectedCardId) {
      const location = cardLocationById.get(selectedCardId);
      if (location) return location.wallId;
    }
    return activeColumnId ?? lastActiveWallId ?? wallIds[0] ?? null;
  }, [activeColumnId, cardLocationById, lastActiveWallId, selectedCardId, wallIds]);

  const stickyComposeWallId = useMemo(
    () => activeColumnId ?? lastActiveWallId ?? composeWallId ?? orderedWalls[0]?.wall.id ?? "",
    [activeColumnId, composeWallId, lastActiveWallId, orderedWalls],
  );
  const showBottomComposeDock = touchLike && !presentationEnabled && chromePrefs.showDockCompose;

  const moveSelectedCard = useCallback(
    async (direction: "up" | "down" | "left" | "right") => {
      if (moveInFlightRef.current) return false;
      if (!selectedCardId) return false;
      const location = cardLocationById.get(selectedCardId);
      if (!location) return false;

      if (direction === "up" || direction === "down") {
        const delta = direction === "up" ? -1 : 1;
        const ids = cardIdsByWall.get(location.wallId) ?? [];
        const nextIndex = location.index + delta;
        if (nextIndex < 0 || nextIndex >= ids.length) return false;
        setOrderedWalls((prev) =>
          prev.map((entry) => {
            if (entry.wall.id !== location.wallId) return entry;
            const visibleIds = entry.cards.filter((card) => !card.is_hidden).map((card) => card.id);
            const fromId = visibleIds[location.index];
            const toId = visibleIds[nextIndex];
            if (!fromId || !toId) return entry;
            const fromIndex = entry.cards.findIndex((card) => card.id === fromId);
            const toIndex = entry.cards.findIndex((card) => card.id === toId);
            if (fromIndex < 0 || toIndex < 0) return entry;
            return { ...entry, cards: arrayMove(entry.cards, fromIndex, toIndex) };
          }),
        );
        return true;
      }

      const wallIndex = wallIds.indexOf(location.wallId);
      if (wallIndex < 0) return false;
      const offset = direction === "left" ? -1 : 1;
      const nextWallId = wallIds[wallIndex + offset];
      if (!nextWallId) return false;

      const snapshot = orderedWalls;
      const nextWalls = orderedWalls.map((entry) => {
        if (entry.wall.id !== location.wallId) return entry;
        const nextCards = entry.cards.filter((card) => card.id !== selectedCardId);
        return { ...entry, cards: nextCards };
      });

      let movedCard: WallCard | null = null;
      for (const entry of orderedWalls) {
        if (entry.wall.id === location.wallId) {
          movedCard = entry.cards.find((card) => card.id === selectedCardId) ?? null;
          break;
        }
      }
      if (!movedCard) return false;

      const updatedWalls = nextWalls.map((entry) => {
        if (entry.wall.id !== nextWallId) return entry;
        const visibleIds = entry.cards.filter((card) => !card.is_hidden).map((card) => card.id);
        const targetId = visibleIds[location.index] ?? null;
        const nextCards = [...entry.cards];
        if (targetId) {
          const targetIndex = nextCards.findIndex((card) => card.id === targetId);
          if (targetIndex >= 0) {
            nextCards.splice(targetIndex, 0, movedCard);
          } else {
            nextCards.unshift(movedCard);
          }
        } else {
          nextCards.unshift(movedCard);
        }
        return { ...entry, cards: nextCards };
      });

      setOrderedWalls(updatedWalls);
      setActiveColumnId(nextWallId);
      setLastActiveWallId(nextWallId);
      moveInFlightRef.current = true;
      try {
        const response = await apiFetch(apiV1Path(`dashboard/cards/${selectedCardId}/move`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, wallId: nextWallId, clientMutationId: crypto.randomUUID() }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "카드를 이동하지 못했습니다.");
        }
      } catch (error) {
        setOrderedWalls(snapshot);
        resyncOnceAfterMoveFailure();
        pushDashboardToast({
          title: "카드 이동 실패",
          description: error instanceof Error ? error.message : "카드를 이동하지 못했습니다.",
        });
        return false;
      } finally {
        moveInFlightRef.current = false;
      }

      return true;
    },
    [boardId, cardIdsByWall, cardLocationById, orderedWalls, resyncOnceAfterMoveFailure, selectedCardId, wallIds],
  );

  useEffect(() => {
    if (!isBoardActive || !selectedCardId) return;
    const frame = requestAnimationFrame(() => {
      scrollToCard(selectedCardId, { behavior: "smooth", block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [isBoardActive, selectedCardId]);

  useGlobalShortcut({
    key: "n",
    enabled: isBoardActive,
    onTrigger: () => {
      if (isBoardShortcutBlocked(typeof document === "undefined" ? null : document.activeElement)) return;
      const targetWallId = lastActiveWallId || orderedWalls[0]?.wall.id || "";
      if (!targetWallId) return;
      handleComposeOpen(targetWallId);
    },
  });

  useGlobalShortcut({
    key: "Escape",
    enabled: composeOpen,
    onTrigger: () => {
      closeComposeWithFocusRestore();
    },
  });

  const handleBoardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) return;

    if (event.key === "Escape") {
      closeComposeWithFocusRestore();
      setDrawerOpen(false);
      setEditModalWall(null);
      setCreateModalOpen(false);
      return;
    }

    if (isBoardShortcutBlocked(event.target)) return;

    const isArrowKey =
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight";

    if (event.altKey && isArrowKey) {
      if (!selectedCardId) return;
      const location = cardLocationById.get(selectedCardId);
      if (!location) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const delta = event.key === "ArrowUp" ? -1 : 1;
        const ids = cardIdsByWall.get(location.wallId) ?? [];
        const nextIndex = location.index + delta;
        if (nextIndex < 0 || nextIndex >= ids.length) return;
      } else {
        const offset = event.key === "ArrowLeft" ? -1 : 1;
        const wallIndex = wallIds.indexOf(location.wallId);
        const targetWallId = wallIds[wallIndex + offset];
        if (!targetWallId) return;
      }
      event.preventDefault();
      void moveSelectedCard(
        event.key === "ArrowUp"
          ? "up"
          : event.key === "ArrowDown"
            ? "down"
            : event.key === "ArrowLeft"
              ? "left"
              : "right",
      );
      return;
    }

    if (!isArrowKey) return;

    const activeWallId = resolveActiveWallId();
    if (!activeWallId) return;

    const selectFromWall = (wallId: string, index: number) => {
      const ids = cardIdsByWall.get(wallId) ?? [];
      const targetIndex = Math.min(Math.max(index, 0), ids.length - 1);
      const nextId = ids[targetIndex];
      if (!nextId) return false;
      handleSelectCard(nextId, wallId);
      return true;
    };

    if (!selectedCardId || !cardLocationById.has(selectedCardId)) {
      const initialWallId =
        (cardIdsByWall.get(activeWallId)?.length ?? 0) > 0
          ? activeWallId
          : wallIds.find((id) => (cardIdsByWall.get(id)?.length ?? 0) > 0) ?? null;
      if (!initialWallId) return;
      const initialIds = cardIdsByWall.get(initialWallId) ?? [];
      const initialIndex = event.key === "ArrowUp" ? initialIds.length - 1 : 0;
      if (initialIds.length === 0) return;
      event.preventDefault();
      selectFromWall(initialWallId, initialIndex);
      return;
    }

    const location = cardLocationById.get(selectedCardId);
    if (!location) return;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const delta = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex = location.index + delta;
      const ids = cardIdsByWall.get(location.wallId) ?? [];
      if (nextIndex < 0 || nextIndex >= ids.length) return;
      event.preventDefault();
      selectFromWall(location.wallId, nextIndex);
      return;
    }

    const offset = event.key === "ArrowLeft" ? -1 : 1;
    const wallIndex = wallIds.indexOf(location.wallId);
    const targetWallId = wallIds[wallIndex + offset];
    if (!targetWallId) return;
    const targetIds = cardIdsByWall.get(targetWallId) ?? [];
    if (targetIds.length === 0) return;
    event.preventDefault();
    selectFromWall(targetWallId, location.index);
  };

  const activeWallEntry = useMemo(
    () => orderedWalls.find((entry) => entry.wall.id === (activeColumnId || lastActiveWallId)) ?? orderedWalls[0] ?? null,
    [activeColumnId, lastActiveWallId, orderedWalls],
  );

  const deleteSelectedCardAction = useCallback(() => {
    if (!selectedCardId) return;
    void (async () => {
      const response = await apiFetch(apiV1Path(`dashboard/cards/${selectedCardId}`), { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        pushDashboardToast({ title: "카드 삭제 실패", description: payload?.error ?? "카드를 휴지통으로 이동하지 못했습니다." });
        return;
      }
      setOrderedWalls((prev) => prev.map((entry) => ({ ...entry, cards: entry.cards.filter((card) => card.id !== selectedCardId) })));
      setSelectedCardId(null);
      pushDashboardToast({ title: "카드를 휴지통으로 이동했어요" });
    })();
  }, [selectedCardId]);

  const boardActionsContext = useMemo(() => ({
    activeWallId: activeWallEntry?.wall.id ?? null,
    activeWallTitle: activeWallEntry?.wall.title ?? null,
    hasSelectedCard: Boolean(selectedCardId),
    hasAnyCard: wallIds.some((id) => (cardIdsByWall.get(id)?.length ?? 0) > 0),
    canCopyStudentLink: Boolean(studentBoardUrl),
    presentationEnabled,
    openCompose: (wallId: string) => handleComposeOpen(wallId),
    openCreateColumn: () => setCreateModalOpen(true),
    openRenameActiveColumn: () => {
      if (!activeWallEntry) return;
      setEditModalWall(activeWallEntry.wall);
    },
    copyTeacherLink: () => { void copyTextToClipboard(teacherBoardUrl, "교사용 보드 링크를 복사했어요"); },
    copyStudentLink: () => {
      if (!studentBoardUrl) return;
      void copyTextToClipboard(studentBoardUrl, "학생 링크를 복사했어요");
    },
    toggleCardSelection: () => {
      if (selectedCardId) {
        setSelectedCardId(null);
        return;
      }
      const firstWallId = wallIds.find((id) => (cardIdsByWall.get(id)?.length ?? 0) > 0);
      if (!firstWallId) return;
      const firstCardId = cardIdsByWall.get(firstWallId)?.[0];
      if (!firstCardId) return;
      handleSelectCard(firstCardId, firstWallId);
    },
    moveSelectedCardLeft: () => { void moveSelectedCard("left"); },
    moveSelectedCardRight: () => { void moveSelectedCard("right"); },
    deleteSelectedCard: deleteSelectedCardAction,
    togglePresentation: () => updatePresentationEnabled(!presentationEnabled),
    openColumnRenameFromMenu: () => {
      if (!columnContextMenu) return;
      const target = orderedWalls.find((entry) => entry.wall.id === columnContextMenu.wallId)?.wall;
      if (target) setEditModalWall(target);
    },
    resetColumnWidth: () => {
      if (!columnContextMenu) return;
      void handleWallResizeStop(columnContextMenu.wallId, 360);
    },
    copyColumnLinkFromMenu: () => {
      if (!columnContextMenu) return;
      void copyTextToClipboard(boardWallLink(columnContextMenu.wallId), "컬럼 링크를 복사했어요");
    },
    openCardDetailFromMenu: () => {
      if (!cardContextMenu) return;
      handleSelectCard(cardContextMenu.cardId, cardContextMenu.wallId);
      scrollToCard(cardContextMenu.cardId, { behavior: "smooth", block: "nearest", inline: "nearest" });
    },
    copyCardLinkFromMenu: () => {
      if (!cardContextMenu) return;
      void copyTextToClipboard(boardCardLink(cardContextMenu.wallId, cardContextMenu.cardId), "카드 링크를 복사했어요");
    },
    deleteCardFromMenu: () => {
      if (!cardContextMenu) return;
      const cardId = cardContextMenu.cardId;
      void (async () => {
        const response = await apiFetch(apiV1Path(`dashboard/cards/${cardId}`), { method: "DELETE" });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          pushDashboardToast({ title: "카드 삭제 실패", description: payload?.error ?? "카드를 휴지통으로 이동하지 못했습니다." });
          return;
        }
        setOrderedWalls((prev) => prev.map((entry) => ({ ...entry, cards: entry.cards.filter((card) => card.id !== cardId) })));
        if (selectedCardId === cardId) setSelectedCardId(null);
        pushDashboardToast({ title: "카드를 휴지통으로 이동했어요" });
      })();
    },
  }), [
    activeWallEntry,
    boardCardLink,
    boardWallLink,
    cardContextMenu,
    cardIdsByWall,
    columnContextMenu,
    copyTextToClipboard,
    deleteSelectedCardAction,
    handleComposeOpen,
    handleSelectCard,
    handleWallResizeStop,
    moveSelectedCard,
    orderedWalls,
    presentationEnabled,
    selectedCardId,
    studentBoardUrl,
    teacherBoardUrl,
    updatePresentationEnabled,
    wallIds,
  ]);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);

  const boardPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const actions = getTeacherBoardActions(boardActionsContext);
    const baseItems = resolveActions(actions, boardActionsContext, "palette", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("TeacherBoard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    }).map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      keywords: action.keywords ?? [],
      enabled: action.enabled,
      run: () => runActionWithTelemetry({ action, context: boardActionsContext, surface: "palette", source: "palette" }),
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
  }, [boardActionsContext, chromePrefs.showAdvancedActions]);

  const columnContextActions = useMemo(() => {
    if (!columnContextMenu) return [];
    const actions = getTeacherBoardActions({ ...boardActionsContext, activeWallId: columnContextMenu.wallId, hasSelectedCard: false });
    return resolveActions(actions, { ...boardActionsContext, activeWallId: columnContextMenu.wallId, hasSelectedCard: false }, "context", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("TeacherBoard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    })
      .filter((action) => ["board-rename-column", "board-reset-column-width", "board-copy-column-link"].includes(action.id));
  }, [boardActionsContext, chromePrefs.showAdvancedActions, columnContextMenu]);

  const cardContextActions = useMemo(() => {
    if (!cardContextMenu) return [];
    const ctx = { ...boardActionsContext, hasSelectedCard: true };
    const actions = getTeacherBoardActions(ctx);
    return resolveActions(actions, ctx, "context", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("TeacherBoard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    })
      .filter((action) => ["board-open-card-detail", "board-copy-card-link", "board-delete-card"].includes(action.id));
  }, [boardActionsContext, cardContextMenu, chromePrefs.showAdvancedActions]);

  const boardPalette = useCommandPalette(boardPaletteItems);
  const toggleBoardPalette = boardPalette.toggle;

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("button, a, input, textarea, select, [role='button']")
    ) {
      return;
    }
    setIsBoardActive(true);
    boardRef.current?.focus({ preventScroll: true });
  };

  const handleBoardMainPointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest("[data-card-id]")) return;
    if (target.closest("button, a, input, textarea, select, [role='menu'], [role='dialog']")) return;
    if (target.closest(".card, .gallery-card, .featured-link, .link-placeholder")) return;
    if (target.closest("[data-no-compose-open]")) return;

    if (presentationEnabled || createModalOpen || editModalWall || drawerOpen || composeOpen) return;

    const targetWallId = stickyComposeWallId || orderedWalls[0]?.wall.id || "";
    if (!targetWallId) return;
    handleComposeOpen(targetWallId);
  }, [composeOpen, createModalOpen, drawerOpen, editModalWall, handleComposeOpen, orderedWalls, presentationEnabled, stickyComposeWallId]);

  const handleBoardFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.target)) {
      setIsBoardActive(true);
    }
  };

  useEffect(() => {
    if (!presentationEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPresentationShortcutBlocked(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        updatePresentationEnabled(false);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        movePresentationSpotlight(event.key === "ArrowRight" ? "next" : "prev");
        return;
      }
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setPresentationHideOthers((prev) => !prev);
        return;
      }
      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        setPresentationLargeCards((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPresentationShortcutBlocked, movePresentationSpotlight, presentationEnabled, updatePresentationEnabled]);

  useEffect(() => {
    const handlePaletteToggle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      toggleBoardPalette();
    };

    window.addEventListener("keydown", handlePaletteToggle);
    window.addEventListener("scroll", closeBoardContextMenus, true);
    return () => {
      window.removeEventListener("keydown", handlePaletteToggle);
      window.removeEventListener("scroll", closeBoardContextMenus, true);
    };
  }, [closeBoardContextMenus, toggleBoardPalette]);

  const handleBoardBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsBoardActive(false);
  };

  const handleOpenWallMenu = useCallback(
    (wallId: string) => {
      const entry = orderedWalls.find((item) => item.wall.id === wallId);
      if (entry) {
        setEditModalWall(entry.wall);
      }
    },
    [orderedWalls],
  );

  const handleFileDrop = (files: File[], wallId: string | null) => {
    const targetWallId = wallId || composeWallId || orderedWalls[0]?.wall.id || "";
    if (!targetWallId || files.length === 0) return;
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      composeRestoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    }
    setComposeWallId(targetWallId);
    setPendingFiles(files);
    setComposeOpen(true);
  };

  const toasts = useDashboardToasts();
  const toastStack =
    toasts.length > 0 ? (
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full max-w-md rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg ring-1 ring-gray-100"
          >
            <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
            {toast.description ? (
              <p className="text-xs text-gray-600">{toast.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    ) : null;

  const shouldShowAdminPanels = !presentationEnabled;
  const presentationToggleButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => updatePresentationEnabled(!presentationEnabled)}
        className={`flex items-center justify-center rounded-md border text-sm shadow-sm transition ${
          touchLike ? "h-9 w-9" : "h-8 w-8"
        } ${
          presentationEnabled
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
        }`}
        aria-label="수업 화면"
        title="수업 화면"
      >
        🖥️
      </button>
    ),
    [presentationEnabled, touchLike, updatePresentationEnabled],
  );

  const boardTopControls = useMemo(
    () => (
      <BoardTopControls
        shouldShowAdminPanels={shouldShowAdminPanels}
        shareGuideCtaRef={shareGuideCtaRef}
        onOpenShareGuide={() => setShareGuideOpen(true)}
        onOpenBoardSettings={() => setBoardSettingsOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
        presentationToggleButton={presentationToggleButton}
        showSecondaryActions={chromePrefs.showSecondaryLinks}
      />
    ),
    [chromePrefs.showSecondaryLinks, presentationToggleButton, shouldShowAdminPanels],
  );
  const presentationControls = presentationEnabled ? (
    <FloatingPortal>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] left-1/2 z-[90] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-md border border-white/70 bg-white/80 px-2 py-2 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => movePresentationSpotlight("prev")}
            className="flex h-10 w-10 items-center justify-center rounded-md text-lg text-slate-700 transition hover:bg-white"
            aria-label="이전 섹션"
            title="이전"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => movePresentationSpotlight("next")}
            className="flex h-10 w-10 items-center justify-center rounded-md text-lg text-slate-700 transition hover:bg-white"
            aria-label="다음 섹션"
            title="다음"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => setPresentationHideOthers((prev) => !prev)}
            className={`flex h-10 w-10 items-center justify-center rounded-md text-lg transition ${
              presentationHideOthers ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"
            }`}
            aria-label="다른 섹션 숨기기"
            title="다른 섹션 숨기기"
          >
            🧱
          </button>
          <button
            type="button"
            onClick={() => setPresentationLargeCards((prev) => !prev)}
            className={`flex h-10 w-10 items-center justify-center rounded-md text-lg transition ${
              presentationLargeCards ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white"
            }`}
            aria-label="카드 크게"
            title="카드 크게"
          >
            🔍
          </button>
          <button
            type="button"
            onClick={() => updatePresentationEnabled(false)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-lg text-slate-700 transition hover:bg-white"
            aria-label="발표 화면 종료"
            title="닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </FloatingPortal>
  ) : null;

  const handleWallpaperSelect = useCallback(async (key: string, url: string) => {
    setSelectedWallpaper({ key, url });
    setWallpaperSaveState("saving");

    try {
      const response = await apiFetch(routes.api.boards.settings(boardId), {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ patch: { wallpaperKey: key } }),
      });

      if (!response.ok) {
        setWallpaperSaveState("error");
        return;
      }

      setWallpaperSaveState("idle");
    } catch {
      setWallpaperSaveState("error");
    }
  }, [boardId]);

  const handleWallpaperReset = useCallback(async () => {
    setSelectedWallpaper(null);
    setWallpaperSaveState("saving");

    try {
      const response = await apiFetch(routes.api.boards.settings(boardId), {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ patch: { wallpaperKey: null } }),
      });

      if (!response.ok) {
        setWallpaperSaveState("error");
        return;
      }

      setWallpaperSaveState("idle");
    } catch {
      setWallpaperSaveState("error");
    }
  }, [boardId]);

  const boardBackgroundStyle = selectedWallpaper
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.9)), url(${selectedWallpaper.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed" as const,
      }
    : undefined;

  const defaultBoardSettingsSections = [
    {
      id: "general",
      label: "일반",
      description: "보드 제목과 설명을 저장합니다.",
      content: (
        <div className="space-y-4">
          <form onSubmit={handleBoardSettingsSubmit} className={cn(surface.card, "space-y-4 p-4")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">보드 정보</p>
                <p className="text-[11px] text-slate-400">변경사항은 저장 후 적용됩니다.</p>
              </div>
              {boardSettingsSaved ? (
                <span
                  className={cn(
                    pill.chip,
                    "border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700",
                  )}
                >
                  저장됨
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600" htmlFor="board-settings-title">
                보드 제목
              </label>
              <input
                id="board-settings-title"
                value={boardSettingsDraft.title}
                onChange={(event) =>
                  setBoardSettingsDraft((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="보드 제목"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-900 focus:outline-none"
                aria-label="보드 제목"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600" htmlFor="board-settings-description">
                설명
              </label>
              <textarea
                id="board-settings-description"
                value={boardSettingsDraft.description}
                onChange={(event) =>
                  setBoardSettingsDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="보드 설명 (선택)"
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-900 focus:outline-none"
                aria-label="보드 설명"
              />
            </div>

            {!boardSettingsTitleValid ? (
              <p className="text-[11px] text-rose-600">제목을 입력하세요.</p>
            ) : null}

            {boardSettingsError ? (
              <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                <p>저장 실패 (RID: {boardSettingsStatus.requestId ?? "unknown"})</p>
                {boardSettingsStatus.errorCode ? (
                  <p className="text-[10px] text-rose-600">코드: {boardSettingsStatus.errorCode}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveBoardSettings()}
                  className={cn(buttonTone("secondary", { size: "sm" }), "text-[11px]")}
                >
                  다시 시도
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                마지막 제목: {boardTitleValue || "없음"}
              </span>
              <button
                type="submit"
                disabled={!boardSettingsDirty || !boardSettingsTitleValid || boardSettingsSaving}
                className={cn(buttonTone("primary", { size: "sm", tone: "slate" }), "text-xs")}
              >
                {boardSettingsSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={routes.page.dashboard.boardEdit(boardId)}
              className={cn(buttonTone("secondary", { size: "sm", muted: true }), "text-xs")}
            >
              보드 편집
            </Link>
            <Link
              href={routes.page.dashboard.root()}
              className={cn(buttonTone("ghost", { size: "sm" }), "text-xs")}
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>
      ),
    },
    {
      id: "class",
      label: "수업",
      description: "공유 링크와 입장 코드를 복사합니다.",
      content: (
        <div className="space-y-4">
          <div className={cn(surface.card, "space-y-3 p-4 text-xs text-slate-600")}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">입장 코드</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-700">{shareInfo.code || "없음"}</span>
                <CopyTextButton value={shareInfo.code} disabled={!shareInfo.code} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">공유 URL</span>
              <div className="flex items-center gap-2">
                <span className="max-w-[160px] truncate font-mono text-slate-600">
                  {shareInfo.shareUrl || "없음"}
                </span>
                <CopyTextButton value={shareInfo.shareUrl} disabled={!shareInfo.shareUrl} />
              </div>
            </div>
            {shareEnsurePill ? (
              <span className="inline-flex w-fit rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {shareEnsurePill}
              </span>
            ) : null}
            {!shareInfo.code ? (
              <button
                type="button"
                onClick={handleEnsureShareCode}
                disabled={shareEnsureStatus === "pending"}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {shareEnsureStatus === "pending" ? "생성 중..." : "입장코드 생성"}
              </button>
            ) : null}
          </div>

          <div className={cn(surface.card, "space-y-2 p-4 text-xs text-slate-600")}>
            <p className="font-semibold text-slate-800">EDU 4교시 링크 만들기</p>
            <p className="text-[11px] text-slate-500">EDU 섹션을 맞춰두고 링크+입장 ↗ 버튼 카드까지 자동으로 준비합니다.</p>
            <button
              type="button"
              onClick={handleEnsureEduLessonLink}
              disabled={eduEnsureLoading || !shareInfo.code}
              className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              {eduEnsureLoading ? "생성 중..." : "EDU 4교시 링크 만들기"}
            </button>
            {!shareInfo.code ? <p className="text-[11px] text-slate-500">먼저 입장코드를 생성해야 합니다.</p> : null}
            {eduEnsureNotice ? <p className="text-[11px] font-semibold text-emerald-600">{eduEnsureNotice}</p> : null}
            {eduEnsureError ? <p className="text-[11px] text-rose-600">{eduEnsureError}</p> : null}
          </div>

          <div className={cn(surface.card, "space-y-2 p-4 text-xs text-slate-600")}>
            <p className="font-semibold text-slate-800">4교시 실습 템플릿 생성</p>
            <p className="text-[11px] text-slate-500">오늘 수업 시작/실습 안내/코드 시작하기/제출 방법 카드를 중복 없이 준비합니다.</p>
            <button
              type="button"
              onClick={handleEnsurePracticeTemplate}
              disabled={practiceEnsureLoading || !shareInfo.code}
              className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              {practiceEnsureLoading ? "생성 중..." : "4교시 실습 템플릿 생성"}
            </button>
            {!shareInfo.code ? <p className="text-[11px] text-slate-500">먼저 입장코드를 생성해야 합니다.</p> : null}
            {practiceEnsureNotice ? <p className="text-[11px] font-semibold text-emerald-600">{practiceEnsureNotice}</p> : null}
            {practiceEnsureError ? <p className="text-[11px] text-rose-600">{practiceEnsureError}</p> : null}
          </div>

          <div className={cn(surface.subtle, "space-y-2 p-4 text-xs text-slate-500")}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-600">수업 관리</p>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                {PRACTICE_SUBMISSION_ENABLED ? "ON" : "OFF"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              실습 제출 카드만 모아 최근순으로 빠르게 확인할 수 있어요.
            </p>
            {PRACTICE_SUBMISSION_ENABLED ? (
              <button
                type="button"
                onClick={handleOpenPracticeInbox}
                className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                제출함 열기
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
              >
                제출함 열기
              </button>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "design",
      label: "디자인",
      description: "보드 배경을 선택해 즉시 미리보기할 수 있습니다.",
      content: (
        <BoardDesignPanel
          boardId={boardId}
          selectedKey={selectedWallpaper?.key ?? null}
          onSelect={handleWallpaperSelect}
          onReset={handleWallpaperReset}
          saveState={wallpaperSaveState}
        />
      ),
    },
    {
      id: "ops",
      label: "운영",
      description: "보드 운영 도구는 다음 단계에서 제공됩니다.",
      content: (
        <div className={cn(surface.subtle, "space-y-2 p-4 text-xs text-slate-500")}>
          <p className="text-xs font-semibold text-slate-600">운영 대시보드</p>
          <p className="text-[11px] text-slate-400">리포트/모더레이션 기능은 준비 중입니다.</p>
          {renderRecentActivityBlock()}
          <span className="inline-flex w-fit rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            Soon
          </span>
        </div>
      ),
    },
    {
      id: "advanced",
      label: "고급",
      description: "캡처용 식별 정보와 요청 ID를 확인합니다.",
      content: (
        <div className={cn(surface.subtle, "space-y-2 p-4 text-xs text-slate-600")}>
          {renderRecentActivityBlock()}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Board ID</span>
            <span className="font-mono text-slate-500">{boardId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">RID</span>
            <span className="font-mono text-slate-500">{boardSettingsStatus.requestId ?? "unknown"}</span>
          </div>
        </div>
      ),
    },
  ];
  const toggleSidebarBlock = useCallback((blockKey: string) => {
    setExpandedSidebarBlocks((prev) => ({
      ...prev,
      [blockKey]: !prev[blockKey],
    }));
  }, []);

  function renderRecentActivityBlock() {
    return (
    <div className={cn(surface.card, "space-y-2 p-4 text-xs text-slate-600")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">최근 활동</p>
        <span className="text-[10px] text-slate-400">최대 10개</span>
      </div>
      {recentActivityItems.length === 0 ? (
        <p className="text-[11px] text-slate-400">표시할 활동이 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {recentActivityItems.map((entry) => {
            const time = new Date(entry.createdAt).toLocaleString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            return (
              <li key={entry.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-slate-700">{formatBoardActivityLabel(entry.action)}</p>
                  <p className="text-[10px] text-slate-400">{time}</p>
                </div>
                {entry.cardId ? (
                  <button
                    type="button"
                    onClick={() => handleActivityCardJump(entry.cardId as string)}
                    className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    카드로 이동
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  
    );
  }

  const newBoardOnboardingBlock = showNewBoardOnboarding ? (
    <section className={cn(surface.card, "space-y-2 border-emerald-200 bg-emerald-50/40 p-3 text-xs text-slate-700")}>
      <p className="text-sm font-semibold text-slate-800">새 보드를 만들었어요. 다음 단계를 도와드릴게요.</p>
      <p className="text-[11px] text-slate-600">EDU 수업 링크와 실습 템플릿을 바로 준비할 수 있어요.</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleEnsureEduLessonLink}
          disabled={eduEnsureLoading || !shareInfo.code}
          className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
        >
          {eduEnsureLoading ? "생성 중..." : "EDU 4교시 링크 만들기"}
        </button>
        <button
          type="button"
          onClick={handleEnsurePracticeTemplate}
          disabled={practiceEnsureLoading || !shareInfo.code}
          className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
        >
          {practiceEnsureLoading ? "생성 중..." : "4교시 실습 템플릿 생성"}
        </button>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleDismissNewBoardOnboarding()}
          disabled={newBoardOnboardingDismissBusy}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          다시 보지 않기
        </button>
      </div>
    </section>
  ) : null;

  const sectionsById = new Map(defaultBoardSettingsSections.map((section) => [section.id as BoardSidebarTabId, section]));
  const configuredBoardSettingsSections = boardSidebarConfig
    ? (boardSidebarConfig.tabs
        .map((tab) => {
          const baseSection = sectionsById.get(tab.id);
          if (!baseSection) return null;

          const contentBlocks = tab.contentBlocks.length > 0 ? (
            <div className="space-y-2">
              {tab.contentBlocks.map((block) => {
                const blockKey = `${tab.id}:${block.id}`;
                const isOpen = expandedSidebarBlocks[blockKey] ?? false;
                return (
                  <section key={blockKey} className={cn(surface.card, "space-y-2 p-3 text-xs text-slate-600")}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">{block.title}</h4>
                      <button
                        type="button"
                        onClick={() => toggleSidebarBlock(blockKey)}
                        className="inline-flex h-7 min-w-14 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "접기" : "더보기"}
                      </button>
                    </div>
                    {isOpen ? (
                      <div className="space-y-2">
                        <p className="whitespace-pre-wrap text-xs leading-5 text-slate-600">{block.body}</p>
                        {block.links.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {block.links.map((link) => (
                              <Link
                                key={`${blockKey}:${link.href}:${link.label}`}
                                href={link.href}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null;

          const extraItems = tab.items.length > 0 ? (
            <div className={cn(surface.card, "space-y-2 p-4 text-xs text-slate-600")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">빠른 작업</p>
              <div className="space-y-2">
                {tab.items.map((item, index) => {
                  if (item.type === "action") {
                    if (item.id === "eduLessonLink") {
                      return (
                        <button
                          key={`${tab.id}:${item.id}:${index}`}
                          type="button"
                          onClick={handleEnsureEduLessonLink}
                          disabled={eduEnsureLoading || !shareInfo.code}
                          className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                        >
                          {eduEnsureLoading ? "생성 중..." : item.label}
                        </button>
                      );
                    }

                    return (
                      <button
                        key={`${tab.id}:${item.id}:${index}`}
                        type="button"
                        onClick={handleEnsurePracticeTemplate}
                        disabled={practiceEnsureLoading || !shareInfo.code}
                        className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                      >
                        {practiceEnsureLoading ? "생성 중..." : item.label}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={`${tab.id}:link:${item.href}:${index}`}
                      href={item.href}
                      className="block w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null;

          const operatorBlocks = (
            <>
              {contentBlocks}
              {extraItems}
            </>
          );

          return {
            ...baseSection,
            label: tab.label,
            content: (
              <>
                {baseSection.content}
                {tab.id === "ops"
                  ? (
                      <>
                        {operatorBlocks}
                        {newBoardOnboardingBlock}
                      </>
                    )
                  : operatorBlocks}
              </>
            ),
          };
        })
        .filter((section) => section !== null) as BoardSettingsSection[])
    : null;
  const defaultBoardSettingsSectionsWithOnboarding = defaultBoardSettingsSections.map((section) => {
    if (section.id !== "ops") {
      return section;
    }

    return {
      ...section,
      content: (
        <>
          {section.content}
          {newBoardOnboardingBlock}
        </>
      ),
    };
  });


  const boardSettingsSections: BoardSettingsSection[] =
    configuredBoardSettingsSections && configuredBoardSettingsSections.length > 0
      ? configuredBoardSettingsSections
      : defaultBoardSettingsSectionsWithOnboarding;

  return (
    <div
      ref={boardRef}
      data-board-runtime="teacher-board-canonical"
      tabIndex={0}
      onKeyDown={handleBoardKeyDown}
      onFocusCapture={handleBoardFocus}
      onBlurCapture={handleBoardBlur}
      onPointerDownCapture={handleBoardPointerDown}
      className={`flex min-h-dvh min-w-0 flex-col overflow-hidden bg-slate-50 text-slate-900 focus:outline-none ${
        presentationEnabled ? "isPresentation" : ""
      }`}
    >
      <BoardChromeRegistrar boardTitle={boardTitleValue} boardControls={boardTopControls} />
      <ShareGuideModal
        open={shareGuideOpen}
        onClose={() => setShareGuideOpen(false)}
        shareCode={shareInfo.code}
        shareUrl={shareInfo.shareUrl}
        shareEnsureStatus={shareEnsureStatus}
        shareEnsureError={shareEnsureError}
        onEnsureShareCode={handleEnsureShareCode}
      />

      <div className="flex min-h-0 min-w-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {normalizedWalls.length === 0 ? (
            <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-6 py-16 text-center">
              <div className="w-full max-w-xl rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 shadow-sm">
                <p className="text-2xl font-semibold text-slate-900">+ 섹션 추가</p>
                <p className="mt-2 text-sm text-slate-600">
                  보드 중앙에서 바로 섹션을 만들어 카드를 받으세요.
                </p>
                <button
                  type="button"
                  data-add-section-affordance="compact-v2"
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-6 inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  첫 섹션 만들기
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              data-scroll="board-main"
              data-board-scroll="horizontal"
              onPointerDownCapture={handleBoardMainPointerDownCapture}
              style={boardBackgroundStyle}
              className={`flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+120px)] sm:pb-[calc(env(safe-area-inset-bottom)+120px)] overscroll-x-contain overscroll-y-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch] ${
                presentationEnabled && presentationHideOthers ? "gap-0" : "gap-6"
              }`}
            >
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={wallIds} strategy={horizontalListSortingStrategy}>
                  {normalizedWalls.map((entry) => (
                    <SortableWallColumn
                      key={entry.wall.id}
                      entry={entry}
                      onAddCard={handleComposeOpen}
                      onOpenWallMenu={handleOpenWallMenu}
                      onResizeStop={handleWallResizeStop}
                      onActivate={handleActivateWall}
                      onSpotlightSelect={presentationEnabled ? handlePresentationSpotlightSelect : undefined}
                      onSelectCard={handleSelectCard}
                      onColumnContextMenu={(wallId, x, y) => {
                        if (!chromePrefs.showAdvancedActions) return;
                        setCardContextMenu(null);
                        setColumnContextMenu({ wallId, x, y });
                      }}
                      onCardContextMenu={(cardId, wallId, x, y) => {
                        if (!chromePrefs.showAdvancedActions) return;
                        handleSelectCard(cardId, wallId);
                        setColumnContextMenu(null);
                        setCardContextMenu({ cardId, wallId, x, y });
                      }}
                      canDragCard={canDragCard}
                      draggingCardId={draggingCardId}
                      overWallId={overWallId}
                      onCardHoldStart={onCardHoldStart}
                      onCardHoldEnd={onCardHoldEnd}
                      isComposeActive={composeOpen && composeWallId === entry.wall.id}
                      selectedCardId={selectedCardId}
                      isSpotlight={presentationEnabled && presentationSpotlightId === entry.wall.id}
                      isDimmed={
                        presentationEnabled &&
                        Boolean(presentationSpotlightId) &&
                        presentationSpotlightId !== entry.wall.id
                      }
                      presentationLargeCards={presentationEnabled && presentationLargeCards}
                      hideForPresentation={
                        presentationEnabled &&
                        presentationHideOthers &&
                        Boolean(presentationSpotlightId) &&
                        presentationSpotlightId !== entry.wall.id
                      }
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {draggingCardId ? (
                    <div className="w-[320px] scale-[0.94] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-2xl">
                      카드 이동 중...
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              {!presentationEnabled ? (
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="flex h-fit min-h-[110px] min-w-[300px] flex-shrink-0 flex-col items-center justify-center gap-1.5 self-start rounded-xl border border-dashed border-slate-300/90 bg-white/70 px-5 py-5 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-white hover:text-slate-800"
                >
                  <span className="text-xl leading-none">＋</span>
                  <span>섹션 추가</span>
                </button>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {shouldShowAdminPanels ? (
        <FloatingPortal>
          <button
            ref={gearButtonRef}
            type="button"
            onClick={() => setBoardSettingsOpen(true)}
            data-floating="gear"
            className="fixed bottom-[calc(var(--vvb,0px)+env(safe-area-inset-bottom)+12px)] right-[12px] z-40 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--ui-border)] bg-white text-lg text-slate-700 shadow-lg transition hover:border-slate-400 hover:bg-[var(--bg-cream)] hover:text-[var(--ink)]"
            aria-label="보드 설정"
            title="보드 설정"
          >
            ⚙
          </button>
        </FloatingPortal>
      ) : null}

      {drawerOpen && shouldShowAdminPanels ? (
        <FloatingPortal>
          <div className="pointer-events-none fixed inset-0 z-[70]">
            <div
              className="pointer-events-none absolute inset-0 bg-black/40"
              aria-hidden
            />
            <div
              ref={drawerPanelRef}
              data-no-compose-open
              className="pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-[360px] flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">관리 패널</h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
                {!isCoachSnoozed ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500">추천</p>
                      <button
                        type="button"
                        onClick={handleCoachSnooze}
                        className="text-[10px] font-semibold text-slate-400 transition hover:text-slate-600"
                      >
                        숨기기(2시간)
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                      <p className="text-xs font-medium text-slate-700">{coachAction.message}</p>
                      {coachAction.kind !== "none" && coachActionLabel ? (
                        <button
                          type="button"
                          onClick={handleCoachAction}
                          disabled={coachActionDisabled}
                          className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {coachActionLabel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">수업 시작</p>
                  <div className="space-y-2 border border-slate-200 p-3 text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={handleStartClass}
                      disabled={startClassRunning}
                      className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
                    >
                      수업 시작(원클릭)
                    </button>
                    <span className="inline-flex w-fit rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {startClassStatusLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">수업 종료</p>
                  <div className="space-y-2 border border-slate-200 p-3 text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={handleEndClass}
                      disabled={endClassPhase === "stopping" || endClassPhase === "resetting"}
                      className="w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
                    >
                      수업 종료(정리)
                    </button>
                    <span className="inline-flex w-fit rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {endClassStatusLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">사전 준비(Prewarm)</p>
                  <div
                    className="space-y-2 border border-slate-200 p-3 text-xs text-slate-600"
                    data-seed-lite-ready={prewarmSeedLiteReady ? "1" : "0"}
                  >
                    <button
                      type="button"
                      onClick={() => handlePrewarm(30000)}
                      disabled={prewarmStatus === "running"}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      사전 준비 30초
                    </button>
                    <p className="text-[11px] text-slate-500">{prewarmStatusLabel}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">EDU 수업 링크</p>
                  <EduCoursePanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">EDU 진행 현황</p>
                  <EduRosterPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">레슨 완료 현황</p>
                  <EduCompletionPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">EDU 방송</p>
                  <EduBroadcastPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">EDU 시나리오</p>
                  <EduScenarioPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">EDU 과제</p>
                  <EduAssignmentsPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <EduFeaturedRecommendPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <EduPresentationRehearsalPanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <EduPresentationQueuePanel boardId={boardId} />
                </div>

                <div className="space-y-2">
                  <EduPresentationSettingsPanel boardId={boardId} />
                </div>

              </div>
            </div>
          </div>
        </FloatingPortal>
      ) : null}

      <BoardSettingsSheet
        open={boardSettingsOpen}
        onClose={() => setBoardSettingsOpen(false)}
        sections={boardSettingsSections}
      />

      {createModalOpen ? (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div data-no-compose-open className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">섹션 생성</p>
                <p className="text-xs text-slate-500">보드에 새 섹션을 추가합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <form ref={formRef} action={wallAction} className="space-y-4 px-5 py-4">
              <input type="hidden" name="boardId" value={boardId} />
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">섹션 이름</label>
                <input
                  name="title"
                  required
                  placeholder="섹션 제목"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">설명 (선택)</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="섹션 설명"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              {wallState.error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {wallState.error}
                </p>
              ) : null}
              <div className="flex justify-end">
                <SubmitWallButton />
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editModalWall ? (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div data-no-compose-open className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">섹션 수정</p>
                <p className="text-xs text-slate-500">섹션 이름과 설명을 수정합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalWall(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <form action={updateWallFormAction} className="space-y-4 px-5 py-4">
              <input type="hidden" name="boardId" value={boardId} />
              <input type="hidden" name="wallId" value={editModalWall.id} />
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">섹션 이름</label>
                <input
                  name="title"
                  required
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">설명 (선택)</label>
                <textarea
                  name="description"
                  rows={3}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              {updateWallState.error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {updateWallState.error}
                </p>
              ) : null}
              <div className="flex justify-end">
                <SubmitUpdateWallButton />
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {normalizedWalls.length > 0 && showBottomComposeDock ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <div className="pointer-events-auto mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] bg-white/95 px-3 py-2 shadow-lg backdrop-blur sm:px-4">
            <button
              type="button"
              onClick={() => handleComposeOpen(stickyComposeWallId)}
              disabled={!stickyComposeWallId}
              aria-label="카드 작성 (단축키 C)"
              title="카드 작성 (단축키 C)"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:border-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              카드 작성
            </button>
          </div>
        </div>
      ) : null}

      {columnContextMenu ? (
        <ContextMenu
          isOpen={Boolean(columnContextMenu)}
          x={columnContextMenu.x}
          y={columnContextMenu.y}
          className="fixed z-40 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          ariaLabel="컬럼 컨텍스트 메뉴"
          onClose={closeBoardContextMenus}
        >
          {columnContextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100", action.dangerous ? "text-red-700 hover:bg-red-50" : null)}
              onClick={() => {
                runActionWithTelemetry({
                  action,
                  context: { ...boardActionsContext, activeWallId: columnContextMenu.wallId, hasSelectedCard: false },
                  surface: "context",
                  source: "contextmenu",
                });
                closeBoardContextMenus();
              }}
            >
              {action.label}
            </button>
          ))}
        </ContextMenu>
      ) : null}

      {cardContextMenu ? (
        <ContextMenu
          isOpen={Boolean(cardContextMenu)}
          x={cardContextMenu.x}
          y={cardContextMenu.y}
          className="fixed z-40 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          ariaLabel="카드 컨텍스트 메뉴"
          onClose={closeBoardContextMenus}
        >
          {cardContextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100", action.dangerous ? "text-red-700 hover:bg-red-50" : null)}
              onClick={() => {
                runActionWithTelemetry({
                  action,
                  context: { ...boardActionsContext, hasSelectedCard: true },
                  surface: "context",
                  source: "contextmenu",
                });
                closeBoardContextMenus();
              }}
            >
              {action.label}
            </button>
          ))}
        </ContextMenu>
      ) : null}

      <CommandPalette
        isOpen={boardPalette.isOpen}
        query={boardPalette.query}
        items={boardPalette.filteredItems}
        activeIndex={boardPalette.activeIndex}
        onQueryChange={boardPalette.setQuery}
        onClose={boardPalette.close}
        onSelect={boardPalette.runItem}
        onActiveChange={boardPalette.setActiveIndex}
        toggleHint="⌘K / Ctrl+K"
      />

      <KeyboardShortcutsOverlay
        isOpen={shortcutsOverlayOpen}
        showAdvancedActionsEnabled={chromePrefs.showAdvancedActions}
        onClose={() => setShortcutsOverlayOpen(false)}
        onOpenAdvancedSettings={() => {
          setShortcutsOverlayOpen(false);
          window.location.href = "/dashboard/settings";
        }}
      />

      <FileDropOverlay
        walls={composeWalls}
        onDropFiles={handleFileDrop}
        onTargetWallChange={setFileDropWallId}
      />
      {composeOpen ? (
        <ComposeCardPanel
          isOpen={composeOpen}
          onClose={closeComposeWithFocusRestore}
          walls={composeWalls}
          initialWallId={fileDropWallId || composeWallId}
          initialFiles={pendingFiles}
          onInitialFilesConsumed={() => setPendingFiles([])}
          mode="teacher"
          boardId={boardId}
        />
      ) : null}

      {!presentationEnabled ? (
        <BoardMiniMap
          mode={minimapMode}
          scrollRef={scrollRef}
          columns={normalizedWalls.map((entry) => ({
            id: entry.wall.id,
            widthPx: entry.wall.ui_width_px,
            cardCount: entry.visibleCards.length,
          }))}
        />
      ) : null}
      {presentationControls}
      {toastStack}
    </div>
  );
}
