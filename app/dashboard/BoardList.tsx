"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useTransition,
  useRef,
  type ReactNode,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";

import CardTile from "@/app/_components/CardTile";
import MoreMenu from "@/app/_components/MoreMenu";
import { logoutAction } from "@/app/auth/logout/actions";
import type { DashboardBoardSummary } from "@/lib/data/boards";
import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn, pill, surface } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { appendSessionEvent } from "@/app/_components/sessionEvents";
import type { LiveSnapshot } from "@/app/_components/useLiveSync";
import { boardBoardHref, boardHubHref } from "@/lib/dashboard/boardHrefs";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { FileManagerSheet } from "@/components/files/FileManagerSheet";

import { BoardForm, type BoardFormHandle } from "./BoardForm";
import { clearOnboardCookie } from "./actions";
import { scheduleDashboardForceNavigationFallback } from "./forceNavigationFallback";
import useDashboardMode, { type DashboardMode } from "./useDashboardMode";
import useDashboardUiPrefs, { getFolders, setBoardFolder, setFolders } from "./useDashboardUiPrefs";
import { installPreventDefaultTracer } from "./preventDefaultTracer";
import BoardTileClean from "./_components/BoardTileClean";
import BoardTileFocusMini from "./_components/BoardTileFocusMini";
import BoardTileManage from "./_components/BoardTileManage";
import { type FlowRunLogEntry } from "./_components/CleanFlowRunner";
import { FirstRunQuickstart } from "./_components/FirstRunQuickstart";
import FocusFlowConsole from "./_components/FocusFlowConsole";
import ManageFlowSection from "./_components/ManageFlowSection";
import ModeShell from "./_components/ModeShell";
import DashboardSettingsMenu from "./_components/DashboardSettingsMenu";
import StorageUsageCard from "./_components/StorageUsageCard";
import { installDashboardInteractionInvariants } from "./devInvariants";
import { buildShareLinkInfo, type ShareLinkInfo } from "./shareLinks";
import { getProjectorUrl, getStudentUrl } from "@/lib/share/shareUrls";
import {
  type Flow,
  type FlowStep,
  type FlowStepTarget,
  deleteFlow,
  duplicateFlow,
  getActiveFlow,
  listFlows,
  normalizeFlowV2,
  saveFlow,
  setActiveFlow,
} from "./flows";
import {
  applyPresetToStorage,
  getDefaultPresets,
  getDefaultPresetForTarget,
  loadBoardPreset,
  loadPresets,
  saveBoardPreset,
  seedDefaultPresetsIfEmpty,
  type ClassPreset,
  type ClassPresetSettings,
  type ClassPresetTarget,
} from "./presets";
import { createBoardBus, writeSessionSnapshot } from "./sessionBus";
import { useDashboardBoards } from "./useDashboardBoards";
import { useDashboardClasses } from "./useDashboardClasses";
import { EmptyDashboardState } from "./_components/EmptyDashboardState";
import { OnboardingGuideBanner, useOnboardingGuideState } from "./_components/OnboardingGuideBanner";
import FirstLessonCta from "./_components/FirstLessonCta";
import { OnboardingChecklistModal } from "./_components/OnboardingChecklistModal";
import { useDashboardHotkeys } from "./useDashboardHotkeys";
import { pushDashboardToast, useDashboardToasts } from "./useDashboardToast";
import { useOnboardingChecklistState } from "./useOnboardingChecklist";
import { requestKickstart, shouldTriggerKickstart } from "./kickstart";
import SyncBadge from "./_components/SyncBadge";
import SyncCenter from "./_components/SyncCenter";
import { useNetworkStatus } from "./useNetworkStatus";
import ClassForm from "./ClassForm";
import { ClassGallery2p5D } from "./_components/ClassGallery2p5D";
import { filterBoardsByFolder } from "./boardFolders";

type BoardListProps = {
  initialCleanView?: boolean;
  shouldAutoOpenChecklist?: boolean;
  forceOnboarding?: boolean;
};

const RECENT_BOARDS_KEY = "dashboard_recent_boards";
const SPOTLIGHT_KEY = "gom:dashboard:spotlight";
const MAX_RECENT = 8;
const FIRST_RUN_STORAGE_KEY = "gomdori:firstRunDone";

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "name", label: "이름순" },
] as const;

type SortOption = (typeof sortOptions)[number]["value"];

function normalize(value: string) {
  return value.toLowerCase();
}

function readRecentBoards(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(RECENT_BOARDS_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function getSpotlightStorageKey() {
  if (typeof window === "undefined") return SPOTLIGHT_KEY;
  return `${SPOTLIGHT_KEY}:${window.location.pathname}`;
}

function readSpotlightBoardId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(getSpotlightStorageKey());
  } catch {
    return null;
  }
}

function persistSpotlightBoardId(boardId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getSpotlightStorageKey(), boardId);
  } catch {
    // ignore storage errors
  }
}

function SectionHeader({
  title,
  badge,
  action,
  tone = "default",
}: {
  title: string;
  badge?: string;
  action?: ReactNode;
  tone?: "default" | "inverse";
}) {
  const titleClass = tone === "inverse" ? "text-slate-100" : "text-gray-900";
  const badgeClass =
    tone === "inverse"
      ? "bg-white/10 text-slate-100 ring-1 ring-white/20"
      : "bg-gray-100 text-gray-700 ring-1 ring-gray-200/80";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className={cn("text-sm font-semibold", titleClass)}>{title}</h3>
        {badge ? (
          <span
            className={cn(pill.badge, badgeClass)}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function BoardList({
  initialCleanView = false,
  shouldAutoOpenChecklist,
  forceOnboarding = false,
}: BoardListProps) {
  const router = useRouter();
  const {
    boards,
    pinnedIds,
    ensuredShareLinks,
    status,
    statusByBoardId,
    failedActionsByBoardId,
    droppedCount,
    issue: fetchIssue,
    degraded: boardsDegraded,
    loadState,
    syncState,
    lastSyncError,
    lastSyncAt,
    recentOps,
    invalidationNotice,
    externalInvalidationPending,
    clearLastError,
    revalidate,
    refetch,
    deleteBoardOptimistic,
    pinBoardOptimistic,
    unpinBoardOptimistic,
    savePresetsOptimistic,
    actions,
  } = useDashboardBoards();
  const {
    retryBoardAction,
    rollbackFailedDelete,
    cacheEnsuredShareLink,
    movePin,
  } = actions;
  const {
    classes,
    issue: classesIssue,
    loadState: classesLoadState,
    actions: classActions,
  } = useDashboardClasses();
  const loading = loadState === "loading";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [manageFilter, setManageFilter] = useState<"all" | "recent" | "pinned" | "shareOn" | "shareOff">("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderDraftName, setFolderDraftName] = useState("");
  const [folderEditingId, setFolderEditingId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentBoards());
  const [safeMode, setSafeMode] = useState(false);
  const [focusPicker, setFocusPicker] = useState<"pinned" | "recent" | "all">("pinned");
  const [manageView, setManageView] = useState<"table" | "grid">("table");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const [isPendingPin, setIsPendingPin] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalCount, setDeleteModalCount] = useState(1);
  const [deleteModalBoardIds, setDeleteModalBoardIds] = useState<string[]>([]);
  const [deleteModalInput, setDeleteModalInput] = useState("");
  const [deleteModalPending, setDeleteModalPending] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [presets, setPresets] = useState<ClassPreset[]>(() => loadPresets());
  const presetsSyncedRef = useRef(false);
  const [presetSheetTarget, setPresetSheetTarget] = useState<ClassPresetTarget | null>(null);
  const [presetManagerOpen, setPresetManagerOpen] = useState(false);
  const [flows, setFlows] = useState<Flow[]>(() => listFlows());
  const [flowDefaultsVersion, setFlowDefaultsVersion] = useState(0);
  const [flowStepIndex, setFlowStepIndex] = useState(0);
  const [, setFlowRunLog] = useState<FlowRunLogEntry[]>([]);
  const [flowShareInfo, setFlowShareInfo] = useState<ShareLinkInfo | null>(null);
  const [flowShareTarget, setFlowShareTarget] = useState<FlowStepTarget | null>(null);
  const [flowShareLoading, setFlowShareLoading] = useState(false);
  const [flowShareError, setFlowShareError] = useState<string | null>(null);
  const [flowActionError, setFlowActionError] = useState<string | null>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [classPanelOpen, setClassPanelOpen] = useState(false);
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const toasts = useDashboardToasts();
  const [kickstartState, setKickstartState] = useState<"idle" | "running" | "done" | "skipped" | "failed">("idle");
  const [kickstartBoardId, setKickstartBoardId] = useState<string | null>(null);
  const [showRecentSync, setShowRecentSync] = useState(false);
  const [kickstartError, setKickstartError] = useState<string | null>(null);
  const [kickstartNoticeOpen, setKickstartNoticeOpen] = useState(false);
  const [firstRunDone, setFirstRunDone] = useState(false);
  const [firstRunHydrated, setFirstRunHydrated] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(forceOnboarding);
  const { prefs, notice, updatePrefs, retryRemote } = useDashboardUiPrefs(initialCleanView);
  const { mode, setMode } = useDashboardMode(initialCleanView);
  const { online } = useNetworkStatus();
  const cleanView = mode === "clean";
  const folders = getFolders(prefs);

  const handleSetBoardFolder = useCallback((boardId: string, nextFolderId: string | null) => {
    updatePrefs(setBoardFolder(prefs, boardId, nextFolderId));
  }, [prefs, updatePrefs]);

  const handleSaveFolder = useCallback(() => {
    const name = folderDraftName.trim();
    if (!name) return;
    const next = [...folders];
    if (folderEditingId) {
      const index = next.findIndex((folder) => folder.id === folderEditingId);
      if (index >= 0) next[index] = { ...next[index], name };
    } else {
      const baseId = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
      const id = baseId || `folder-${Date.now()}`;
      if (!next.some((folder) => folder.id === id)) {
        next.push({ id, name });
      }
    }
    updatePrefs(setFolders(prefs, next));
    setFolderDraftName("");
    setFolderEditingId(null);
  }, [folderDraftName, folderEditingId, folders, prefs, updatePrefs]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const nextFolders = folders.filter((folder) => folder.id !== folderId);
    let nextPrefs = setFolders(prefs, nextFolders);
    Object.entries(nextPrefs.boardFolderMap).forEach(([boardId, mappedId]) => {
      if (mappedId === folderId) {
        nextPrefs = setBoardFolder(nextPrefs, boardId, null);
      }
    });
    updatePrefs(nextPrefs);
    if (folderFilter === folderId) setFolderFilter("all");
  }, [folderFilter, folders, prefs, updatePrefs]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(FIRST_RUN_STORAGE_KEY);
      const done = stored === "1";
      setFirstRunDone(done);
      setFirstRunOpen(forceOnboarding || !done);
    } catch {
      setFirstRunDone(false);
      setFirstRunOpen(true);
    } finally {
      setFirstRunHydrated(true);
    }
  }, [forceOnboarding]);

  useEffect(() => {
    if (!firstRunHydrated) return;
    try {
      if (firstRunDone) {
        window.localStorage.setItem(FIRST_RUN_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(FIRST_RUN_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [firstRunDone, firstRunHydrated]);

  const focusPresetButtonRef = useRef<HTMLButtonElement | null>(null);
  const createFormRef = useRef<BoardFormHandle | null>(null);
  const modeRef = useRef<DashboardMode>(mode);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);
  const { dismissed: guideDismissed, dismiss: dismissGuide, reset: resetGuide } = useOnboardingGuideState();
  const [checklistOpen, setChecklistOpen] = useState(false);
  const autoOpenRef = useRef(false);
  const clearOnboardCookieRef = useRef(false);
  const kickstartTriggeredRef = useRef(false);
  const kickstartAbortRef = useRef<AbortController | null>(null);
  const [syncCenterOpen, setSyncCenterOpen] = useState(false);

  const focusCreateInput = useCallback(() => {
    createFormRef.current?.focusTitle();
  }, []);

  const openCreatePanel = useCallback(() => {
    setCreatePanelOpen(true);
  }, []);

  useEffect(() => {
    if (!createPanelOpen) return;
    const timer = window.setTimeout(() => {
      focusCreateInput();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [createPanelOpen, focusCreateInput]);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }, []);

  const handleRetry = useCallback(() => {
    void revalidate();
  }, [revalidate]);

  const handleRecent = useCallback(
    (boardId: string) => {
      if (!boardId) return;
      const next = [boardId, ...recentIds.filter((id) => id !== boardId)].slice(0, MAX_RECENT);
      setRecentIds(next);
      try {
        window.localStorage.setItem(RECENT_BOARDS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    },
    [recentIds],
  );

  const refreshFlows = useCallback(() => {
    setFlows(listFlows());
  }, []);

  const handleSaveFlow = useCallback(
    (flow: Flow) => {
      saveFlow(flow);
      refreshFlows();
    },
    [refreshFlows],
  );

  const handleDeleteFlow = useCallback(
    (flowId: string) => {
      deleteFlow(flowId);
      refreshFlows();
    },
    [refreshFlows],
  );

  const handleDuplicateFlow = useCallback(
    (flowId: string) => {
      const result = duplicateFlow(flowId);
      refreshFlows();
      return result;
    },
    [refreshFlows],
  );

  const handleSetActiveFlow = useCallback((boardId: string, flowId: string | null) => {
    setActiveFlow(boardId, flowId);
    setFlowDefaultsVersion((prev) => prev + 1);
  }, []);

  const formatFlowTimestamp = useCallback(
    (date: Date) => date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    [],
  );

  const openDeleteModal = useCallback((boardIds: string[]) => {
    const ids = boardIds.map((id) => id.trim()).filter(Boolean);
    setDeleteModalBoardIds(ids);
    setDeleteModalCount(ids.length);
    setDeleteModalInput("");
    setDeleteModalPending(false);
    setDeleteModalError(null);
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteModalBoardIds([]);
    setDeleteModalCount(1);
    setDeleteModalInput("");
    setDeleteModalPending(false);
    setDeleteModalError(null);
  }, []);

  const boardLookup = useMemo(() => {
    const map = new Map<string, DashboardBoardSummary>();
    boards.forEach((board) => {
      if (board.boardId) {
        map.set(board.boardId, board);
      }
    });
    return map;
  }, [boards]);

  const deleteModalValid = useMemo(() => {
    if (deleteModalCount < 1) return false;
    const normalized = deleteModalInput.trim();
    return normalized.toUpperCase() === "DELETE" || normalized === String(deleteModalCount);
  }, [deleteModalCount, deleteModalInput]);

  const handleDeleteModalConfirm = useCallback(async () => {
    if (deleteModalPending) return;
    const ids = deleteModalBoardIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      setDeleteModalError("삭제 대상을 찾지 못했습니다.");
      return;
    }
    const validIds = ids.filter((id) => boardLookup.has(id));
    if (validIds.length === 0) {
      setDeleteModalError("삭제 대상이 목록에 없습니다. (boardId 불일치)");
      return;
    }
    if (!deleteModalValid) {
      setDeleteModalError("확인 입력이 올바르지 않습니다.");
      return;
    }
    setDeleteModalPending(true);
    setDeleteModalError(null);
    try {
      if (validIds.length === 1) {
        await deleteBoardOptimistic(validIds[0]);
      } else {
        for (const boardId of validIds) {
          await deleteBoardOptimistic(boardId);
        }
        startDeleteTransition(() => {
          setSelectedIds(new Set());
        });
      }
      const deletedCount = validIds.length;
      closeDeleteModal();
      pushDashboardToast({
        title: deletedCount === 1 ? "보드를 삭제했어요." : `보드 ${deletedCount}개를 삭제했어요.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "삭제에 실패했습니다.";
      setDeleteModalError(message);
      setDeleteModalPending(false);
      return;
    }
  }, [
    boardLookup,
    closeDeleteModal,
    deleteBoardOptimistic,
    deleteModalBoardIds,
    deleteModalPending,
    deleteModalValid,
    startDeleteTransition,
  ]);

  useEffect(() => {
    if (!deleteModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (deleteModalPending) return;
      closeDeleteModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDeleteModal, deleteModalOpen, deleteModalPending]);

  const filteredBoards = useMemo(() => {
    const folderScoped = filterBoardsByFolder(boards, folderFilter, prefs.boardFolderMap);
    const query = normalize(search.trim());
    const list = query
      ? folderScoped.filter((board) =>
          normalize(`${board.title} ${board.description ?? ""}`).includes(query),
        )
      : [...folderScoped];

    if (sortBy === "name") {
      return list.sort((a, b) => a.title.localeCompare(b.title, "ko-KR"));
    }

    return list.sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    );
  }, [boards, folderFilter, prefs.boardFolderMap, search, sortBy]);

  const filteredBoardIdSet = useMemo(() => new Set(filteredBoards.map((board) => board.boardId).filter(Boolean) as string[]), [filteredBoards]);

  const pinnedBoardIds = useMemo(
    () => pinnedIds.filter((id) => boardLookup.has(id) && filteredBoardIdSet.has(id)),
    [boardLookup, filteredBoardIdSet, pinnedIds],
  );

  const pinnedBoardObjects = pinnedBoardIds
    .map((id) => boardLookup.get(id))
    .filter((board): board is DashboardBoardSummary => Boolean(board));

  const recentBoards = useMemo(
    () =>
      recentIds
        .map((id) => boardLookup.get(id))
        .filter((board): board is DashboardBoardSummary => Boolean(board)),
    [boardLookup, recentIds],
  );

  const pinnedDisplay = pinnedBoardObjects.slice(0, 6);
  const recentDisplay = recentBoards.slice(0, 6);

  const unpinnedBoards = filteredBoards.filter(
    (board) => !board.boardId || !pinnedIds.includes(board.boardId),
  );

  const manageBoards = useMemo(() => {
    if (manageFilter === "recent") {
      return filteredBoards.filter((board) => board.boardId && recentIds.includes(board.boardId));
    }
    if (manageFilter === "pinned") {
      return filteredBoards.filter((board) => board.boardId && pinnedIds.includes(board.boardId));
    }
    if (manageFilter === "shareOn") {
      return filteredBoards.filter((board) => board.shareEnabled);
    }
    if (manageFilter === "shareOff") {
      return filteredBoards.filter((board) => board.shareEnabled === false);
    }
    return filteredBoards;
  }, [filteredBoards, manageFilter, pinnedIds, recentIds]);

  const getBoardStatus = useCallback(
    (boardId?: string | null) => (boardId ? statusByBoardId[boardId] ?? "idle" : "idle"),
    [statusByBoardId],
  );

  const getBoardStatusAction = useCallback(
    (boardId?: string | null) => {
      if (!boardId) return null;
      const failedAction = failedActionsByBoardId[boardId];
      if (!failedAction) return null;
      const label =
        failedAction.type === "delete"
          ? "되돌리기"
          : failedAction.type === "create"
            ? "다시 시도"
            : "재시도";
      const onAction =
        failedAction.type === "delete"
          ? () => rollbackFailedDelete(boardId)
          : () => {
              void retryBoardAction(boardId);
            };
      return { label, onAction };
    },
    [failedActionsByBoardId, rollbackFailedDelete, retryBoardAction],
  );

  const missingBoardIdCount =
    boards.filter((board) => !board.boardId).length + (droppedCount > 0 ? droppedCount : 0);

  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const activeBoard =
    activeBoardId && boardLookup.has(activeBoardId) ? boardLookup.get(activeBoardId) ?? null : null;
  const networkStatus = fetchIssue || syncState === "failed" ? "점검 필요" : "연결 양호";
  const boardCount = boards.filter((board) => Boolean(board.boardId)).length;
  const { state: checklistState, markShareOpened, markPresentOpened } =
    useOnboardingChecklistState(boardCount);
  const emptyBoards = boards.length === 0;
  const showFirstRunPanel =
    (firstRunHydrated || forceOnboarding) && (firstRunOpen || forceOnboarding || (!firstRunDone && boardCount === 0));

  const focusCreateForm = useCallback(() => {
    if (createPanelOpen) {
      focusCreateInput();
      return;
    }
    openCreatePanel();
  }, [createPanelOpen, focusCreateInput, openCreatePanel]);

  const handleFirstRunComplete = useCallback(() => {
    setFirstRunDone(true);
    setFirstRunOpen(false);
  }, []);

  const handleFirstRunClose = useCallback(() => {
    setFirstRunOpen(false);
  }, []);

  const reopenFirstRun = useCallback(() => {
    setFirstRunOpen(true);
  }, []);

  useEffect(() => {
    if (!shouldAutoOpenChecklist || guideDismissed || autoOpenRef.current) return;
    setChecklistOpen(true);
    autoOpenRef.current = true;
  }, [guideDismissed, shouldAutoOpenChecklist]);

  useEffect(() => {
    if (!shouldAutoOpenChecklist || clearOnboardCookieRef.current) return;
    clearOnboardCookieRef.current = true;
    void clearOnboardCookie();
  }, [shouldAutoOpenChecklist]);

  useEffect(() => {
    if (
      !shouldTriggerKickstart({
        boardCount,
        loadState,
        hasTriggered: kickstartTriggeredRef.current,
        shouldAutoOpenChecklist,
      })
    ) {
      return;
    }

    kickstartTriggeredRef.current = true;
    setKickstartState("running");
    setKickstartError(null);

    const controller = new AbortController();
    kickstartAbortRef.current = controller;

    void (async () => {
      try {
        const payload = await requestKickstart(fetch, controller.signal);
        if (payload.ok && payload.created) {
          const nextBoardId = payload.boardId ?? null;
          setKickstartBoardId(nextBoardId);
          setKickstartNoticeOpen(true);
          setKickstartState("done");
          if (nextBoardId) {
            setActiveBoardId(nextBoardId);
          }
          if (seedDefaultPresetsIfEmpty()) {
            setPresets(getDefaultPresets());
          }
          publishDashboardInvalidate({
            type: "boards_changed",
            reason: "created",
            ts: Date.now(),
          });
          await revalidate();
          return;
        }

        setKickstartState("skipped");
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "킥스타트를 완료하지 못했습니다.";
        setKickstartError(message);
        setKickstartState("failed");
      } finally {
        kickstartAbortRef.current = null;
      }
    })();

    return () => {
      controller.abort();
    };
  }, [boardCount, loadState, revalidate, shouldAutoOpenChecklist]);

  const primaryCreateCta = useMemo(
    () => (
      <div className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm ring-1 ring-indigo-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-indigo-800">새 보드 만들기</p>
            <p className="text-xs text-indigo-600">
              수업 보드를 바로 생성하고, 생성 즉시 모든 탭에서 동기화합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={focusCreateForm}
              data-interactive="true"
              className={buttonTone("primary", { size: "lg", tone: "emerald" })}
            >
              새 보드 만들기
            </button>
          </div>
        </div>
        {emptyBoards ? (
          <ol className="mt-4 grid gap-3 text-sm text-indigo-900 sm:grid-cols-3">
            <li className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-3 py-2 ring-1 ring-indigo-100">
              <span className="mt-0.5 rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white">1</span>
              <span>보드를 만들고 기본 보기 타입을 설정하세요.</span>
            </li>
            <li className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-3 py-2 ring-1 ring-indigo-100">
              <span className="mt-0.5 rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white">2</span>
              <span>공유 코드 · QR로 학생/동료에게 바로 공유하세요.</span>
            </li>
            <li className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-3 py-2 ring-1 ring-indigo-100">
              <span className="mt-0.5 rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white">3</span>
              <span>학생 참여가 들어오면 Clean/Focus 모드에서 바로 진행!</span>
            </li>
          </ol>
        ) : null}
      </div>
    ),
    [emptyBoards, focusCreateForm],
  );

  const classSection = (
    <div className="space-y-3">
      <SectionHeader
        title="클래스"
        badge={`${classes.length}개`}
        action={
          <button
            type="button"
            onClick={() => setClassPanelOpen(true)}
            data-interactive="true"
            className={buttonTone("primary", { size: "sm", tone: "indigo" })}
          >
            클래스 만들기
          </button>
        }
      />
      {classesIssue ? (
        <InlineAlert
          tone="warning"
          title="클래스 목록을 불러오지 못했습니다."
          description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        />
      ) : null}
      {classesLoadState === "loading" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-28 rounded-2xl border border-slate-200 bg-white animate-pulse" />
          <div className="h-28 rounded-2xl border border-slate-200 bg-white animate-pulse" />
        </div>
      ) : classes.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {classes.map((classItem) => (
            <div key={classItem.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{classItem.title}</p>
                  <p className="text-xs text-slate-500">클래스 코드: {classItem.short_code}</p>
                </div>
                <Link
                  href={`/dashboard/classes/${classItem.id}`}
                  data-interactive="true"
                  className={buttonTone("secondary", { size: "sm" })}
                >
                  열기
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          아직 클래스가 없습니다. 클래스 코드를 만들어 수업 보드를 묶어보세요.
        </div>
      )}
    </div>
  );

  const allSelectableIds = useMemo(
    () => filteredBoards.map((board) => board.boardId).filter((boardId): boardId is string => Boolean(boardId)),
    [filteredBoards],
  );

  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.has(id));

  const selectedBoardIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  useEffect(() => {
    installPreventDefaultTracer();
  }, []);

  useEffect(() => {
    return installDashboardInteractionInvariants();
  }, []);

  useEffect(() => {
    if (!presetsSyncedRef.current) {
      presetsSyncedRef.current = true;
      return;
    }
    savePresetsOptimistic(presets);
  }, [presets, savePresetsOptimistic]);

  useEffect(() => {
    if (!status.lastOkAt) {
      setShowRecentSync(false);
      return;
    }
    const elapsed = Date.now() - status.lastOkAt;
    if (elapsed >= 10_000) {
      setShowRecentSync(false);
      return;
    }
    setShowRecentSync(true);
    const timeout = window.setTimeout(() => setShowRecentSync(false), 10_000 - elapsed);
    return () => window.clearTimeout(timeout);
  }, [status.lastOkAt]);

  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        window.clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const storedSpotlightId = readSpotlightBoardId();
    if (storedSpotlightId && boardLookup.has(storedSpotlightId)) {
      setActiveBoardId(storedSpotlightId);
    }
  }, [boardLookup]);

  useEffect(() => {
    if (mode !== "focus" || !activeBoardId) return;
    persistSpotlightBoardId(activeBoardId);
  }, [activeBoardId, mode]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set<string>();
      current.forEach((id) => {
        if (boardLookup.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [boardLookup]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.shiftKey && !event.altKey) return;
      if (event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      setMode(cleanView ? "manage" : "clean");
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [cleanView, setMode]);

  useEffect(() => {
    if (prefs.dashboardCleanView === cleanView) return;
    updatePrefs({ dashboardCleanView: cleanView });
  }, [cleanView, prefs.dashboardCleanView, updatePrefs]);

  useEffect(() => {
    if (activeBoardId && boardLookup.has(activeBoardId)) return;
    const fallback =
      recentBoards.find((board) => Boolean(board.boardId))?.boardId ??
      pinnedBoardObjects[0]?.boardId ??
      filteredBoards.find((board) => Boolean(board.boardId))?.boardId ??
      null;
    if (fallback) {
      setActiveBoardId(fallback);
    }
  }, [activeBoardId, boardLookup, filteredBoards, pinnedBoardObjects, recentBoards]);

  const handleSelectBoard = useCallback(
    (boardId: string) => {
      setActiveBoardId(boardId);
      handleRecent(boardId);
    },
    [handleRecent],
  );

  const getPresetForBoardTarget = useCallback(
    (boardId: string | null, target: ClassPresetTarget) => {
      const fallback = getDefaultPresetForTarget(presets, target);
      if (!boardId) return fallback;
      return loadBoardPreset(boardId, presets, target) ?? fallback;
    },
    [presets],
  );

  const openPresetSheet = useCallback(
    (target: ClassPresetTarget) => {
      if (target === "share") {
        markShareOpened();
      }
      if (target === "present") {
        markPresentOpened();
      }
      setPresetSheetTarget(target);
    },
    [markPresentOpened, markShareOpened],
  );

  const kickstartBoardReady = Boolean(kickstartBoardId && boardLookup.has(kickstartBoardId));

  const handleKickstartShare = useCallback(() => {
    if (!kickstartBoardId || !kickstartBoardReady) return;
    setActiveBoardId(kickstartBoardId);
    openPresetSheet("share");
  }, [kickstartBoardId, kickstartBoardReady, openPresetSheet]);

  const handleKickstartClass = useCallback(() => {
    if (!kickstartBoardId || !kickstartBoardReady) return;
    setActiveBoardId(kickstartBoardId);
    openPresetSheet("class");
  }, [kickstartBoardId, kickstartBoardReady, openPresetSheet]);

  const closePresetSheet = useCallback(() => {
    setPresetSheetTarget(null);
  }, []);

  useEffect(() => {
    if (!presetSheetTarget) return;
    if (mode === "manage") {
      closePresetSheet();
    }
  }, [closePresetSheet, mode, presetSheetTarget]);

  useEffect(() => {
    if (modeRef.current !== mode && presetSheetTarget) {
      closePresetSheet();
    }
    modeRef.current = mode;
  }, [closePresetSheet, mode, presetSheetTarget]);

  const handleToggleSelect = useCallback((boardId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(boardId)) {
        next.delete(boardId);
      } else {
        next.add(boardId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allSelectableIds));
  };

  useDashboardHotkeys({
    mode,
    isCreateOpen: createPanelOpen,
    onFocusCreate: focusCreateInput,
    onOpenCreate: openCreatePanel,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onSelectAll: () => handleSelectAll(),
    onClearSelection: () => setSelectedIds(new Set()),
    onSetMode: (nextMode) => setMode(nextMode),
  });

  const handleBulkDelete = () => {
    if (selectedBoardIds.length === 0) return;
    openDeleteModal([...selectedBoardIds]);
  };

  const selectedPinnedCount = useMemo(
    () => selectedBoardIds.filter((boardId) => pinnedIds.includes(boardId)).length,
    [pinnedIds, selectedBoardIds],
  );
  const allSelectedPinned = selectedBoardIds.length > 0 && selectedPinnedCount === selectedBoardIds.length;

  const handleBulkPinToggle = useCallback(async () => {
    if (selectedBoardIds.length === 0 || isPendingPin) return;
    setIsPendingPin(true);
    try {
      for (const boardId of selectedBoardIds) {
        if (allSelectedPinned) {
          await unpinBoardOptimistic(boardId);
        } else {
          await pinBoardOptimistic(boardId);
        }
      }
      publishDashboardInvalidate({
        type: "boards_changed",
        reason:
          selectedBoardIds.length > 1 ? "bulk" : allSelectedPinned ? "unpinned" : "pinned",
        ts: Date.now(),
      });
    } finally {
      setIsPendingPin(false);
    }
  }, [
    allSelectedPinned,
    isPendingPin,
    pinBoardOptimistic,
    selectedBoardIds,
    unpinBoardOptimistic,
  ]); 

  const handleMovePinned = useCallback(
    (boardId: string, direction: "up" | "down") => {
      movePin(boardId, direction);
    },
    [movePin],
  );

  const handleRunPreset = useCallback(
    (
      event: MouseEvent<HTMLButtonElement>,
      preset: ClassPreset,
      settings: ClassPresetSettings,
      options: { boardId: string | null; shareInfo?: ShareLinkInfo | null },
    ) => {
      const resolvedPreset: ClassPreset = { ...preset, settings: { ...settings } };
      const shareCode = options.shareInfo?.code ?? null;
      applyPresetToStorage(resolvedPreset, { shareCode });
      if (options.boardId) {
        saveBoardPreset(options.boardId, preset);
      }

      if (options.boardId) {
        handleRecent(options.boardId);
      }

      if (preset.target === "class") {
        if (!options.boardId) return;
        const href = boardBoardHref(options.boardId);
        router.push(href);
        scheduleDashboardForceNavigationFallback(event, href);
        closePresetSheet();
        return;
      }

      if (preset.target === "present") {
        if (!options.shareInfo?.presentUrl) return;
        const href = options.shareInfo.presentUrl;
        window.location.assign(href);
        closePresetSheet();
        return;
      }

      if (preset.target === "share") {
        if (!options.shareInfo?.shareUrl) return;
        const href = options.shareInfo.shareUrl;
        window.location.assign(href);
        closePresetSheet();
      }
    },
    [closePresetSheet, handleRecent, router],
  );

  const ensureFlowShareInfo = useCallback(
    async (boardId: string, shareCode?: string | null) => {
      setFlowShareLoading(true);
      setFlowShareError(null);

      try {
        const shareInfo = await actions.ensureShare(boardId, shareCode ?? null);
        if (!shareInfo) {
          setFlowShareError("공유 링크를 준비하지 못했습니다.");
        }
        return shareInfo;
      } catch (error) {
        const message = error instanceof Error ? error.message : "공유 링크를 준비하지 못했습니다.";
        console.warn("share ensure request errored", {
          boardId,
          message,
        });
        setFlowShareError(message);
        return null;
      } finally {
        setFlowShareLoading(false);
      }
    },
    [actions],
  );

  const topLabel =
    mode === "clean" ? "Clean · 교실 런처" : mode === "focus" ? "Focus · 스테이지 콘솔" : "Manage · 운영 센터";

  const renderAlerts = () => (
    <div className="space-y-3">
      {kickstartNoticeOpen && kickstartBoardId ? (
        <InlineAlert
          tone="success"
          title="첫 수업 보드를 준비했어요."
          description="공유코드로 학생을 초대하고, 발표(HUD)로 바로 진행해 보세요."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleKickstartShare}
                disabled={!kickstartBoardReady}
                className={buttonTone("primary", { size: "sm", tone: "indigo" })}
              >
                공유코드 보기
              </button>
              <button
                type="button"
                onClick={handleKickstartClass}
                disabled={!kickstartBoardReady}
                className={buttonTone("secondary", { size: "sm", tone: "emerald" })}
              >
                수업 시작
              </button>
            </div>
          }
        />
      ) : null}
      {kickstartState === "failed" && kickstartError ? (
        <InlineAlert
          tone="warning"
          title="첫 수업 준비를 완료하지 못했습니다."
          description={kickstartError}
        />
      ) : null}
      {notice ? (
        <InlineAlert
          title={notice.title}
          description={notice.description}
          action={
            notice.actionLabel ? (
              <button
                type="button"
                onClick={retryRemote}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50"
              >
                {notice.actionLabel}
              </button>
            ) : null
          }
        />
      ) : null}
      {boardsDegraded ? (
        <InlineAlert
          tone="warning"
          title="일시적인 오류로 보드 목록을 불러오지 못했습니다."
          description={`잠시 후 새로고침 해주세요.${boardsDegraded.requestId ? ` (요청ID: ${boardsDegraded.requestId})` : ""}`}
        />
      ) : null}
      {fetchIssue ? (
        <InlineAlert
          tone={fetchIssue.unauthorized ? "info" : "warning"}
          title={fetchIssue.unauthorized ? "로그인이 필요합니다." : "보드 목록을 불러오지 못했습니다."}
          description={[
            fetchIssue.unauthorized
              ? "세션이 없거나 만료되었습니다. 다시 로그인해 주세요."
              : "문제가 지속되면 시스템 진단을 확인해 주세요.",
            `오류 코드: ${fetchIssue.code}`,
            fetchIssue.requestId ? `요청 ID: ${fetchIssue.requestId}` : null,
          ]
            .filter(Boolean)
            .join(" • ")}
          action={
            <div className="flex flex-wrap gap-2">
              {fetchIssue.unauthorized ? (
                <Link
                  href="/auth/login?returnTo=/dashboard"
                  data-interactive="true"
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50"
                >
                  로그인하기
                </Link>
              ) : (
                <Link
                  href="/dashboard/system"
                  data-interactive="true"
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50"
                >
                  시스템 진단
                </Link>
              )}
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-50"
              >
                재시도
              </button>
            </div>
          }
        />
      ) : null}
      {missingBoardIdCount > 0 ? (
        <InlineAlert
          tone="warning"
          title="보드 식별자 누락"
          description="일부 보드에 식별자가 없어 보드 열기/수업 시작 버튼을 비활성화했습니다. 보드 목록을 다시 불러오거나 관리자에게 문의해 주세요."
        />
      ) : null}
    </div>
  );

  const createOverlay = createPanelOpen ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={cn("w-full max-w-2xl space-y-4 p-6", surface.overlay)}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">새 보드 만들기</p>
            <h2 className="text-lg font-semibold text-gray-900">대시보드에서 바로 수업 시작</h2>
            <p className="text-xs font-medium text-gray-600">N으로 열기 · Ctrl/Cmd + Enter로 제출</p>
          </div>
          <button
            type="button"
            onClick={() => setCreatePanelOpen(false)}
            data-interactive="true"
            className={buttonTone("ghost", { size: "sm", muted: true })}
          >
            닫기
          </button>
        </div>
        <BoardForm
          ref={createFormRef}
          autoFocus
          onCreated={(created) => {
            if (!created.boardId) {
              pushDashboardToast({ title: "보드를 생성하지 못했습니다." });
              return;
            }
            router.replace(boardHubHref(created.boardId));
          }}
          onSubmitted={() => setCreatePanelOpen(false)}
        />
      </div>
    </div>
  ) : null;

  const classOverlay = classPanelOpen ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={cn("w-full max-w-xl space-y-4 p-6", surface.overlay)}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">새 클래스 만들기</p>
            <h2 className="text-lg font-semibold text-gray-900">클래스 코드로 보드를 묶어보세요</h2>
            <p className="text-xs font-medium text-gray-600">4~6자리 코드가 자동으로 생성됩니다.</p>
          </div>
          <button
            type="button"
            onClick={() => setClassPanelOpen(false)}
            data-interactive="true"
            className={buttonTone("ghost", { size: "sm", muted: true })}
          >
            닫기
          </button>
        </div>
        <ClassForm
          autoFocus
          createClass={classActions.createClass}
          onCreated={(createdId) => {
            setClassPanelOpen(false);
            if (createdId) {
              router.push(`/dashboard/classes/${createdId}`);
            }
          }}
          onSubmitted={() => setClassPanelOpen(false)}
        />
      </div>
    </div>
  ) : null;

  const syncBadge = (
    <SyncBadge
      online={online}
      syncState={syncState}
      lastSyncError={status.lastErrorMessage ?? lastSyncError}
      showInvalidation={externalInvalidationPending || invalidationNotice}
      invalidationLabel={
        externalInvalidationPending ? "다른 탭에서 변경됨(복귀 시 동기화)" : undefined
      }
      labelOverride={showRecentSync ? "반영됨" : undefined}
      onClick={() => setSyncCenterOpen(true)}
      onRetry={() => void refetch()}
    />
  );

  const kickstartBadge =
    kickstartState === "running" ? (
      <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[12px] font-semibold text-indigo-700 ring-1 ring-indigo-100/80">
        <span>준비 중…</span>
      </div>
    ) : null;

  const toastStack = (
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
  );

  const syncCenter = (
    <SyncCenter
      isOpen={syncCenterOpen}
      online={online}
      syncState={syncState}
      lastSyncAt={lastSyncAt}
      lastSyncError={status.lastErrorMessage ?? lastSyncError}
      recentOps={recentOps}
      onRefresh={() => void revalidate()}
      onClose={() => setSyncCenterOpen(false)}
      onClearError={clearLastError}
    />
  );

  const onboardingChecklistModal = (
    <OnboardingChecklistModal
      isOpen={checklistOpen}
      onOpenChange={setChecklistOpen}
      dismissed={guideDismissed}
      onDismiss={dismissGuide}
      onResetDismiss={resetGuide}
      mode={mode}
      boardCount={boardCount}
      checklistState={checklistState}
      onCreateBoard={focusCreateForm}
      onOpenSharePanel={() => openPresetSheet("share")}
      onOpenPresentHud={() => openPresetSheet("present")}
    />
  );
  const folderModal = folderModalOpen ? (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">폴더 관리</h3>
          <button type="button" onClick={() => setFolderModalOpen(false)} className="text-xs text-slate-500">닫기</button>
        </div>
        <div className="mt-3 space-y-2">
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-2 text-sm">
              <span>{folder.name}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="text-xs text-slate-600" onClick={() => { setFolderEditingId(folder.id); setFolderDraftName(folder.name); }}>이름변경</button>
                <button type="button" className="text-xs text-red-600" onClick={() => handleDeleteFolder(folder.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={folderDraftName} onChange={(event) => setFolderDraftName(event.target.value)} placeholder="폴더 이름" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="button" onClick={handleSaveFolder} className={buttonTone("secondary", { size: "sm" })}>{folderEditingId ? "수정" : "추가"}</button>
        </div>
      </div>
    </div>
  ) : null;

  const firstRunPanel = showFirstRunPanel ? (
    <FirstRunQuickstart
      open={showFirstRunPanel}
      onClose={handleFirstRunClose}
      onComplete={handleFirstRunComplete}
      onRequestCreateBoard={focusCreateForm}
    />
  ) : null;

  const modeOptions: Array<{
    value: DashboardMode;
    title: string;
    description: string;
    icon: string;
  }> = [
    { value: "clean", title: "Clean · 런처", description: "큰 CTA로 수업 시작", icon: "▶" },
    { value: "focus", title: "Focus · HUD", description: "상태/진행/질문 모니터", icon: "◎" },
    { value: "manage", title: "Manage · 정리", description: "일괄선택 · 편집", icon: "▦" },
  ];

  const shortcutHint: Record<DashboardMode, string> = {
    clean: "1 / C",
    focus: "2 / F",
    manage: "3 / M",
  };

  const renderModeSwitcher = () => (
    <div className="grid gap-2 rounded-[20px] bg-white/80 p-2 shadow-sm sm:grid-cols-3">
      {modeOptions.map((option) => {
        const active = mode === option.value;
        const baseClass =
          option.value === "clean"
            ? "border-emerald-200 bg-white text-emerald-900"
            : option.value === "manage"
              ? "border-slate-300 bg-slate-100 text-slate-900"
              : "border-indigo-200 bg-indigo-100 text-indigo-900";
        const activeClass =
          option.value === "clean"
            ? "border-emerald-600 bg-emerald-600 text-white shadow-lg"
            : option.value === "manage"
              ? "border-slate-950 bg-slate-950 text-white shadow-lg"
              : "border-indigo-600 bg-indigo-600 text-white shadow-lg";
        return (
          <button
              key={option.value}
              type="button"
              aria-pressed={active}
              aria-current={active ? "true" : undefined}
              onClick={() => setMode(option.value)}
            className={cn(
              "flex min-h-[72px] items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
              active ? activeClass : baseClass,
            )}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-base font-semibold leading-tight">
                <span className={cn("rounded-full px-2 py-1 text-xs", active ? "bg-white/20 text-white" : "bg-black/5 text-current opacity-80")}>
                  {option.icon}
                </span>
                <span>{option.title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5",
                    active ? "bg-white/15 text-white" : "bg-black/5 text-current opacity-80",
                  )}
                >
                  {option.description}
                </span>
                <span className={cn("text-[11px]", active ? "text-white/80" : "text-current opacity-70")}>
                  {shortcutHint[option.value]}
                </span>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] font-semibold",
                active ? "bg-white/20 text-white" : "bg-black/5 text-current opacity-80",
              )}
            >
              {active ? "선택됨" : "전환"}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderCleanGrid = (items: DashboardBoardSummary[]) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((board) => {
        return (
          <BoardTileClean
            key={board.boardId ?? board.title}
            board={board}
            pinned={board.boardId ? pinnedIds.includes(board.boardId) : false}
            recent={board.boardId ? recentIds.includes(board.boardId) : false}
            onRecent={handleRecent}
            onDelete={(boardId) => openDeleteModal([boardId])}
            folders={folders}
            currentFolderId={board.boardId ? prefs.boardFolderMap[board.boardId] ?? null : null}
            onMoveToFolder={handleSetBoardFolder}
          />
        );
      })}
    </div>
  );

  const renderFocusGrid = (items: DashboardBoardSummary[]) => (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((board) => {
        const statusAction = getBoardStatusAction(board.boardId);
        const boardId = board.boardId ?? null;
        const hasShare = Boolean(board.shareEnabled && board.shareCode);
        const hasPreset = boardId ? Boolean(getPresetForBoardTarget(boardId, "present")) : false;
        const hudHref = hasShare ? getProjectorUrl(board.shareCode ?? "") : null;
        const shareHref = hasShare ? getStudentUrl(board.shareCode ?? "") : null;
        return (
            <BoardTileFocusMini
              key={board.boardId ?? board.title}
              board={board}
              pinned={board.boardId ? pinnedIds.includes(board.boardId) : false}
              recent={board.boardId ? recentIds.includes(board.boardId) : false}
              active={board.boardId ? activeBoardId === board.boardId : false}
              onSelect={handleSelectBoard}
              onDelete={(boardId) => openDeleteModal([boardId])}
              hudHref={hudHref}
              classHref={boardId ? boardBoardHref(boardId) : null}
              shareHref={shareHref}
              hasPreset={hasPreset}
              hasShare={hasShare}
              folders={folders}
              currentFolderId={board.boardId ? prefs.boardFolderMap[board.boardId] ?? null : null}
              onMoveToFolder={handleSetBoardFolder}
            status={getBoardStatus(board.boardId)}
            statusActionLabel={statusAction?.label}
            onStatusAction={statusAction?.onAction}
          />
        );
      })}
    </div>
  );

  const renderManageTable = (items: DashboardBoardSummary[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
          <tr>
            <th className="w-[56px] px-3 py-3">
              <span className="sr-only">선택</span>
            </th>
            <th className="px-3 py-3">보드</th>
            <th className="px-3 py-3">뷰</th>
            <th className="px-3 py-3">생성일</th>
            <th className="px-3 py-3">공유</th>
            <th className="px-3 py-3 text-right">CTA</th>
          </tr>
        </thead>
        <tbody>
          {items.map((board) => {
            const boardId = board.boardId;
            const selected = boardId ? selectedIds.has(boardId) : false;
            const disabledButtonClass = cn(
              buttonTone("secondary", { size: "sm" }),
              "cursor-not-allowed text-slate-400",
            );
            return (
              <tr
                key={board.boardId ?? board.title}
                className={cn(
                  "h-16 border-t border-slate-100 text-slate-900 transition hover:bg-slate-50",
                  selected ? "bg-slate-50" : "bg-white",
                )}
                onClick={() => {
                  if (boardId) {
                    handleToggleSelect(boardId);
                  }
                }}
              >
                <td className="px-3 py-4">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      if (boardId) {
                        handleToggleSelect(boardId);
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    disabled={!boardId}
                    data-interactive="true"
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-3 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{board.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{board.description ?? "설명 없음"}</p>
                  </div>
                </td>
                <td className="px-3 py-4 text-xs text-slate-500">
                  {board.board_view_type === "wall" ? "담벼락" : board.board_view_type ?? "-"}
                </td>
                <td className="px-3 py-4 text-xs text-slate-500">
                  {board.created_at ? new Date(board.created_at).toLocaleDateString("ko-KR") : "-"}
                </td>
                <td className="px-3 py-4 text-xs text-slate-500">
                  {board.shareEnabled && board.shareCode ? "ON" : "OFF"}
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {boardId ? (
                      <>
                        <Link
                          href={boardHubHref(boardId)}
                          data-interactive="true"
                          data-force-nav="true"
                          onClick={(event) => event.stopPropagation()}
                          className={buttonTone("secondary", { size: "sm" })}
                        >
                          열기
                        </Link>
                        <Link
                          href={boardBoardHref(boardId)}
                          data-interactive="true"
                          data-force-nav="true"
                          onClick={(event) => event.stopPropagation()}
                          className={buttonTone("secondary", { size: "sm" })}
                        >
                          수업
                        </Link>
                        <Link
                          href={`/dashboard/boards/${boardId}/edit`}
                          data-interactive="true"
                          data-force-nav="true"
                          onClick={(event) => event.stopPropagation()}
                          className={buttonTone("secondary", { size: "sm" })}
                        >
                          설정
                        </Link>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled className={disabledButtonClass}>
                          열기
                        </button>
                        <button type="button" disabled className={disabledButtonClass}>
                          수업
                        </button>
                        <button type="button" disabled className={disabledButtonClass}>
                          설정
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderManageExplorer = (items: DashboardBoardSummary[]) => (
    <div className="space-y-4">
      <div className="sticky top-[var(--dashboard-sticky-top,96px)] z-20 space-y-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Bulk Toolbar</p>
            <p className="text-xs text-slate-500">정리/편집 작업을 위한 일괄 제어 영역</p>
          </div>
          <div className="flex items-center gap-2">
            {(["table", "grid"] as const).map((view) => {
              const active = manageView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setManageView(view)}
                  data-interactive="true"
                  className={cn(
                    "rounded-full px-3 py-2 text-xs font-semibold",
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {view === "table" ? "리스트" : "그리드"}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
          <div>
            <label htmlFor="board-search" className="sr-only">
              보드 검색
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                id="board-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="보드 제목/설명 검색"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  data-interactive="true"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  지우기
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFolderModalOpen(true)}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), "text-xs")}
            >
              폴더 관리
            </button>
            <button
              type="button"
              onClick={() => setFolderFilter("all")}
              data-interactive="true"
              className={cn("rounded-full px-3 py-2 text-xs font-semibold", folderFilter === "all" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700")}
            >
              전체
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setFolderFilter(folder.id)}
                data-interactive="true"
                className={cn("rounded-full px-3 py-2 text-xs font-semibold", folderFilter === folder.id ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700")}
              >
                {folder.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: "all", label: "전체" },
              { value: "recent", label: "최근" },
              { value: "pinned", label: "고정" },
              { value: "shareOn", label: "공유 ON" },
              { value: "shareOff", label: "공유 OFF" },
            ].map((filter) => {
              const active = manageFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setManageFilter(filter.value as typeof manageFilter)}
                  data-interactive="true"
                  className={cn(
                    "rounded-full px-3 py-2 text-xs font-semibold",
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="board-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-slate-900 focus:outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-slate-500">{items.length}개</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>선택 {selectedBoardIds.length}개</span>
            <span className="text-xs font-medium text-slate-500">대량 작업</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              data-interactive="true"
              className={buttonTone("secondary", { size: "sm" })}
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
            <button
              type="button"
              onClick={handleBulkPinToggle}
              disabled={selectedBoardIds.length === 0 || isPendingPin}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), isPendingPin ? "opacity-70" : "")}
            >
              {isPendingPin ? "처리 중" : allSelectedPinned ? "핀 해제" : "핀 고정"}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedBoardIds.length === 0 || isPendingDelete}
              data-interactive="true"
              className={cn(
                buttonTone("secondary", { size: "sm" }),
                "border-red-200 text-red-600 hover:bg-red-50",
              )}
            >
              {isPendingDelete ? "삭제 중" : "선택 삭제"}
            </button>
            <button
              type="button"
              disabled
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), "cursor-not-allowed text-slate-400")}
            >
              클래스 묶기
            </button>
            <button
              type="button"
              disabled
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "sm" }), "cursor-not-allowed text-slate-400")}
            >
              내보내기
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <CardTile variant="dense" subdued className="border-dashed">
          <p className="text-sm text-slate-600">조건에 맞는 보드가 없습니다.</p>
        </CardTile>
      ) : (
        manageView === "table" ? renderManageTable(items) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((board) => {
              const statusAction = getBoardStatusAction(board.boardId);
              return (
                <BoardTileManage
                  key={board.boardId ?? board.title}
                  board={board}
                  pinned={board.boardId ? pinnedIds.includes(board.boardId) : false}
                  recent={board.boardId ? recentIds.includes(board.boardId) : false}
                  selected={board.boardId ? selectedIds.has(board.boardId) : false}
                  onSelect={handleToggleSelect}
                  onPin={pinBoardOptimistic}
                  onUnpin={unpinBoardOptimistic}
                  onMoveUp={board.boardId ? () => handleMovePinned(board.boardId, "up") : undefined}
                  onMoveDown={board.boardId ? () => handleMovePinned(board.boardId, "down") : undefined}
                  onDeleteConfirm={() => {
                    if (!board.boardId) {
                      pushDashboardToast({ title: "보드 ID가 없습니다." });
                      return;
                    }
                    openDeleteModal([board.boardId]);
                  }}
                  status={getBoardStatus(board.boardId)}
                  statusActionLabel={statusAction?.label}
                  onStatusAction={statusAction?.onAction}
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );

  const focusBoard = useMemo(
    () =>
      activeBoard ??
      recentBoards[0] ??
      pinnedBoardObjects[0] ??
      filteredBoards.find((board) => Boolean(board.boardId)) ??
      null,
    [activeBoard, filteredBoards, pinnedBoardObjects, recentBoards],
  );

  const modeBoardId = activeBoardId ?? focusBoard?.boardId ?? null;

  useEffect(() => {
    if (!modeBoardId) return;
    createBoardBus(modeBoardId).publish({
      type: "MODE_CHANGE",
      boardId: modeBoardId,
      mode,
      ts: Date.now(),
    });
  }, [mode, modeBoardId]);

  const runnerBoard = mode === "clean" ? activeBoard : mode === "focus" ? focusBoard : null;
  const runnerBoardId = runnerBoard?.boardId ?? null;
  const runnerFlowId = useMemo(() => {
    if (!runnerBoardId) return null;
    void flowDefaultsVersion;
    return getActiveFlow(runnerBoardId);
  }, [runnerBoardId, flowDefaultsVersion]);
  const runnerFlow = useMemo(() => {
    if (!runnerBoardId) return null;
    const selected = runnerFlowId ? flows.find((flow) => flow.id === runnerFlowId) ?? null : null;
    return selected ?? flows[0] ?? null;
  }, [flows, runnerBoardId, runnerFlowId]);
  const runnerStep = runnerFlow?.steps[flowStepIndex] ?? null;
  const flowBoard = focusBoard;
  const liveSync = useLiveSync({ mode: "teacher", boardId: runnerBoardId ?? undefined });
  const flowBoardActiveFlowId = useMemo(() => {
    if (!flowBoard?.boardId) return null;
    void flowDefaultsVersion;
    return getActiveFlow(flowBoard.boardId);
  }, [flowBoard?.boardId, flowDefaultsVersion]);

  useEffect(() => {
    if (autoNextTimerRef.current) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setFlowStepIndex(0);
    setFlowShareInfo(null);
    setFlowShareTarget(null);
    setFlowShareError(null);
    setFlowActionError(null);
    setFlowShareLoading(false);
    setFlowRunLog([]);
  }, [runnerBoardId, runnerFlow?.id]);

  const publishFlowEvent = useCallback(
    (
      type: "FLOW_RUN" | "FLOW_NEXT" | "FLOW_PREV",
      stepIndex: number,
      step: FlowStep,
      currentStep?: LiveSnapshot["currentStep"],
    ) => {
      if (!runnerBoardId || !runnerFlow?.id) return;
      const ts = Date.now();
      const snapshot = {
        flowId: runnerFlow.id,
        stepId: step.id,
        stepIndex,
        target: step.target,
        label: step.label,
        currentStep,
        ts,
      };
      writeSessionSnapshot(runnerBoardId, snapshot);
      createBoardBus(runnerBoardId).publish({
        type,
        boardId: runnerBoardId,
        ...snapshot,
      });
      void liveSync.publish({
        boardId: runnerBoardId,
        ...snapshot,
      });
    },
    [liveSync, runnerBoardId, runnerFlow?.id],
  );

  const applyStepActions = useCallback(
    async (actions: FlowStep["actions"]) => {
      if (!actions || !runnerBoardId) return { ok: true };
      const errors: string[] = [];

      if (actions.qa) {
        const nextOpen = actions.qa === "open";
        const result = await liveSync.publish({
          qnaOpen: nextOpen,
          qnaEndsAt: null,
          ts: Date.now(),
        });
        if (!result) {
          errors.push("Q&A 상태를 변경하지 못했습니다.");
        }
      }

      if (actions.pulse === "reset") {
        try {
          const response = await fetch(apiV1Path(`boards/${runnerBoardId}/pulse`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset" }),
          });
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; error?: { message?: string } }
            | null;
          if (!response.ok || payload?.ok !== true) {
            const message = payload?.error?.message ?? "Pulse 초기화를 실패했습니다.";
            throw new Error(message);
          }
          if (liveSync.activeSessionId) {
            await appendSessionEvent({
              boardId: runnerBoardId,
              sessionId: liveSync.activeSessionId,
              type: "pulse_reset",
              payload: {},
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Pulse 초기화를 실패했습니다.";
          errors.push(message);
        }
      }

      if (actions.poll) {
        const pollId = actions.poll.pollId ?? liveSync.data?.poll?.id ?? null;
        if (!pollId) {
          errors.push("투표 ID를 찾지 못했습니다.");
        } else {
          try {
            const response = await fetch(apiV1Path(`boards/${runnerBoardId}/polls/${pollId}`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: actions.poll.mode }),
            });
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
              const message = payload?.error?.message ?? "투표 상태를 변경하지 못했습니다.";
              throw new Error(message);
            }
            if (liveSync.activeSessionId) {
              await appendSessionEvent({
                boardId: runnerBoardId,
                sessionId: liveSync.activeSessionId,
                type: actions.poll.mode === "open" ? "poll_opened" : "poll_closed",
                payload: {
                  pollId,
                  title: liveSync.data?.poll?.question ?? null,
                },
              });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "투표 상태를 변경하지 못했습니다.";
            errors.push(message);
          }
        }
      }

      if (errors.length > 0) {
        return { ok: false, message: errors.join(" / ") };
      }
      return { ok: true };
    },
    [liveSync, runnerBoardId],
  );

  const handleRunFlowStep = useCallback(
    async (event?: MouseEvent<HTMLButtonElement>) => {
      if (!runnerStep || !runnerBoardId) return;
      const preset = presets.find((item) => item.id === runnerStep.presetId) ?? null;
      if (!preset) {
        setFlowShareError("프리셋을 찾을 수 없습니다.");
        return;
      }
      setFlowActionError(null);

      const resolvedPreset: ClassPreset = { ...preset, settings: { ...preset.settings } };
      const shareCode = runnerBoard?.shareCode ?? null;
      let resolvedShareInfo: ShareLinkInfo | null = null;

      if (runnerStep.target !== "class") {
        const existing = flowShareInfo?.boardId === runnerBoardId ? flowShareInfo : null;
        resolvedShareInfo = existing ?? (shareCode ? buildShareLinkInfo(runnerBoardId, shareCode) : null);
        if (!resolvedShareInfo) {
          resolvedShareInfo = await ensureFlowShareInfo(runnerBoardId, shareCode);
        }
        if (!resolvedShareInfo) return;
      }

      applyPresetToStorage(resolvedPreset, { shareCode: resolvedShareInfo?.code ?? shareCode ?? null });
      saveBoardPreset(runnerBoardId, resolvedPreset);
      handleRecent(runnerBoardId);

      setFlowRunLog((prev) => [
        {
          id: `${Date.now()}_${Math.random()}`,
          timestamp: formatFlowTimestamp(new Date()),
          label: runnerStep.label,
          target: runnerStep.target,
        },
        ...prev,
      ].slice(0, 5));

      const normalizedStep = normalizeFlowV2(runnerStep);
      const startedAt = Date.now();
      const actionResult = await applyStepActions(normalizedStep.actions);
      if (!actionResult.ok) {
        setFlowActionError(actionResult.message ?? "스텝 액션을 일부 실행하지 못했습니다.");
      }
      publishFlowEvent("FLOW_RUN", flowStepIndex, runnerStep, {
        flowId: runnerFlow?.id ?? "",
        stepIndex: flowStepIndex,
        stepId: runnerStep.id,
        title: normalizedStep.title,
        prompt: normalizedStep.prompt,
        startedAt,
        seconds: normalizedStep.seconds,
        actions: normalizedStep.actions,
        actionsApplied: actionResult.ok,
      });

      if (runnerStep.target === "class") {
        const href = boardBoardHref(runnerBoardId);
        router.push(href);
        if (event) {
          scheduleDashboardForceNavigationFallback(event, href);
        }
        setFlowShareInfo(null);
        setFlowShareTarget(null);
      } else {
        setFlowShareInfo(resolvedShareInfo);
        setFlowShareTarget(runnerStep.target);
      }

      if (runnerStep.autoNextAfterMs) {
        if (autoNextTimerRef.current) {
          window.clearTimeout(autoNextTimerRef.current);
        }
        autoNextTimerRef.current = window.setTimeout(() => {
          setFlowStepIndex((current) => {
            if (!runnerFlow) return current;
            return Math.min(current + 1, runnerFlow.steps.length - 1);
          });
        }, runnerStep.autoNextAfterMs);
      }
    },
    [
      applyStepActions,
      ensureFlowShareInfo,
      flowShareInfo,
      flowStepIndex,
      formatFlowTimestamp,
      handleRecent,
      publishFlowEvent,
      presets,
      router,
      runnerBoard?.shareCode,
      runnerBoardId,
      runnerFlow,
      runnerStep,
    ],
  );

  const handlePrevFlowStep = useCallback(() => {
    if (!runnerFlow) return;
    const nextIndex = Math.max(flowStepIndex - 1, 0);
    setFlowStepIndex(nextIndex);
    const nextStep = runnerFlow.steps[nextIndex];
    if (nextStep) {
      publishFlowEvent("FLOW_PREV", nextIndex, nextStep);
    }
  }, [flowStepIndex, publishFlowEvent, runnerFlow]);

  const handleNextFlowStep = useCallback(() => {
    if (!runnerFlow) return;
    const nextIndex = Math.min(flowStepIndex + 1, runnerFlow.steps.length - 1);
    setFlowStepIndex(nextIndex);
    const nextStep = runnerFlow.steps[nextIndex];
    if (nextStep) {
      publishFlowEvent("FLOW_NEXT", nextIndex, nextStep);
    }
  }, [flowStepIndex, publishFlowEvent, runnerFlow]);

  const handleOpenFlowTarget = useCallback(
    (target: FlowStepTarget) => {
      if (!flowShareInfo) return;
      if (target === "share") {
        markShareOpened();
      }
      if (target === "present") {
        markPresentOpened();
      }
      const href = target === "present" ? flowShareInfo.presentUrl : flowShareInfo.shareUrl;
      window.location.assign(href);
    },
    [flowShareInfo, markPresentOpened, markShareOpened],
  );

  useEffect(() => {
    if (mode !== "focus") return;
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void handleRunFlowStep();
        return;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        handleNextFlowStep();
        return;
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "h") {
        event.preventDefault();
        handlePrevFlowStep();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [handleNextFlowStep, handlePrevFlowStep, handleRunFlowStep, isEditableTarget, mode]);

  const fileManagerSheet = (
    <FileManagerSheet
      open={fileManagerOpen}
      onClose={() => setFileManagerOpen(false)}
      title="파일 관리"
      description="보드에 올릴 파일을 업로드하고 태그로 정리하세요."
    />
  );

  const deleteModal = deleteModalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      onPointerDown={(event) => {
        if (deleteModalPending) return;
        if (event.target === event.currentTarget) {
          closeDeleteModal();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">정말 삭제할까요?</h3>
        <p className="mt-2 text-sm text-slate-600">
          되돌릴 수 없어요. 계속하려면 <span className="font-semibold text-slate-900">DELETE</span> 또는{" "}
          <span className="font-semibold text-slate-900">{deleteModalCount}</span> 입력
        </p>
        <input
          autoFocus
          value={deleteModalInput}
          onChange={(event) => setDeleteModalInput(event.target.value)}
          placeholder="DELETE 또는 숫자 입력"
          disabled={deleteModalPending}
          className={cn(
            "mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200",
            deleteModalPending ? "cursor-not-allowed bg-slate-50 text-slate-500" : "",
          )}
        />
        <p className="mt-2 text-xs text-slate-500">
          대상: {deleteModalCount}개 · 첫 ID: {deleteModalBoardIds[0]?.slice(0, 8) ?? "-"} · 입력 유효:{" "}
          {deleteModalValid ? "예" : "아니오"}
        </p>
        {deleteModalError ? (
          <p className="mt-3 text-sm text-rose-600">{deleteModalError}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeDeleteModal();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={deleteModalPending}
            className={cn(
              buttonTone("secondary", { size: "sm" }),
              deleteModalPending ? "cursor-not-allowed opacity-60" : "",
            )}
          >
            취소
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleDeleteModalConfirm();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={!deleteModalValid || deleteModalPending}
            className={cn(
              buttonTone("primary", { size: "sm", tone: "rose" }),
              !deleteModalValid || deleteModalPending ? "cursor-not-allowed opacity-60" : "",
            )}
          >
            {deleteModalPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <>
        {onboardingChecklistModal}
        {toastStack}
        {syncCenter}
        {fileManagerSheet}
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
          <p className="text-sm text-gray-600">대시보드 데이터를 불러오는 중입니다…</p>
        </div>
      </>
    );
  }

  if (!loading && emptyBoards) {
    return (
      <>
        {onboardingChecklistModal}
        {fileManagerSheet}
        <ModeShell
          mode={mode}
          title={topLabel}
          description="새 보드를 만들어 수업을 시작하세요."
          rightActions={
            <>
              <DashboardSettingsMenu />
              <button
                type="button"
                onClick={focusCreateForm}
                aria-label="새 보드 만들기"
                data-interactive="true"
                className={buttonTone("primary", { size: "md", tone: "indigo" })}
              >
                새 보드 만들기
              </button>
              <Link
                href="/dashboard/storage"
                data-interactive="true"
                className={buttonTone("secondary", { size: "md" })}
              >
                저장소
              </Link>
              <button
                type="button"
                onClick={() => setChecklistOpen(true)}
                data-interactive="true"
                className="text-xs font-semibold text-indigo-700 underline underline-offset-4"
              >
                체크리스트
              </button>
              <button
                type="button"
                onClick={reopenFirstRun}
                data-interactive="true"
                className="text-xs font-semibold text-emerald-700 underline underline-offset-4"
              >
                1분 시작하기
              </button>
              <FirstLessonCta size="sm" />
              {kickstartBadge}
              {syncBadge}
            </>
          }
          modeSwitcher={renderModeSwitcher()}
        >
          <div className="space-y-4">
            {firstRunPanel}
            <OnboardingGuideBanner onCreate={focusCreateForm} dismissed={guideDismissed} onDismiss={dismissGuide} />
            {renderAlerts()}
            {classSection}
            <EmptyDashboardState onCreate={focusCreateForm} showDemoCta={mode === "clean"} />
          </div>
        </ModeShell>
        {createOverlay}
        {classOverlay}
      </>
    );
  }

  if (mode === "clean") {
    const lastOpenedBoard = recentBoards[0] ?? null;
    const quickStartBoard = lastOpenedBoard ?? pinnedBoardObjects[0] ?? recentBoards[0] ?? null;
    const quickStartBoardId = quickStartBoard?.boardId ?? null;

    const cleanShowcase = [...pinnedBoardObjects, ...recentBoards.filter((board) => !pinnedIds.includes(board.boardId))]
      .slice(0, 6);
    const galleryItems = (() => {
      const seen = new Set<string>();
      const combined = [...pinnedBoardObjects, ...recentBoards];
      const items: {
        boardId: string;
        title: string;
        shareCode?: string | null;
        heroFileId?: string | null;
        updatedAt?: string | null;
        pinned?: boolean;
      }[] = [];

      for (const board of combined) {
        if (!board.boardId || seen.has(board.boardId)) {
          continue;
        }
        seen.add(board.boardId);
        items.push({
          boardId: board.boardId,
          title: board.title,
          shareCode: board.shareCode ?? null,
          heroFileId: board.heroFileId ?? null,
          updatedAt: board.updatedAt ?? board.created_at ?? null,
          pinned: pinnedIds.includes(board.boardId),
        });
        if (items.length >= 10) {
          break;
        }
      }

      return items;
    })();

    return (
      <>
        {onboardingChecklistModal}
        <ModeShell
          mode={mode}
          title={topLabel}
          description="큰 CTA로 바로 시작하는 수업 런처 모드입니다."
          rightActions={
            <>
              <DashboardSettingsMenu />
              {kickstartBadge}
              {syncBadge}
            </>
          }
          modeSwitcher={renderModeSwitcher()}
        >
          <div className="space-y-6">
            {firstRunPanel}
            <OnboardingGuideBanner onCreate={focusCreateForm} dismissed={guideDismissed} onDismiss={dismissGuide} />
            {renderAlerts()}
            <ClassGallery2p5D items={galleryItems} ensuredShareLinks={ensuredShareLinks} onCreate={focusCreateForm} />
            <CardTile
              variant="present"
              className={cn("border-emerald-200 bg-white/95")}
              data-testid="clean-launcher-panel"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                    Quick Start Rail
                  </p>
                  <h2 className="text-2xl font-semibold text-emerald-950">수업을 바로 시작하세요</h2>
                  <p className="text-sm text-emerald-700">최근/핀 보드를 기반으로 즉시 실행합니다.</p>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                    {quickStartBoard ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-emerald-700">최근/핀 보드</p>
                        <p className="text-lg font-semibold text-emerald-950">{quickStartBoard.title}</p>
                        <p className="text-xs text-emerald-700">
                          마지막 열림 {quickStartBoard.created_at ? new Date(quickStartBoard.created_at).toLocaleDateString("ko-KR") : "기록 없음"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-emerald-700">보드 없음</p>
                        <p className="text-sm text-emerald-800">보드를 만들면 런처가 활성화됩니다.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  <button
                    type="button"
                    onClick={focusCreateForm}
                    data-interactive="true"
                    className={cn(buttonTone("primary", { size: "lg", tone: "emerald", fullWidth: true }), "min-h-[72px] text-lg")}
                  >
                    새 보드 만들기
                  </button>
                  {quickStartBoardId ? (
                    <Link
                      href={boardBoardHref(quickStartBoardId)}
                      data-force-nav="true"
                      prefetch={false}
                      data-interactive="true"
                      onClick={(event) => {
                        handleRecent(quickStartBoardId);
                        scheduleDashboardForceNavigationFallback(event, boardBoardHref(quickStartBoardId));
                      }}
                      className={cn(buttonTone("primary", { size: "lg", tone: "indigo", fullWidth: true }), "min-h-[72px] text-lg")}
                    >
                      수업 시작
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={cn(
                        buttonTone("secondary", { size: "lg", tone: "neutral", fullWidth: true }),
                        "min-h-[72px] cursor-not-allowed text-slate-500",
                      )}
                    >
                      수업 시작
                    </button>
                  )}
                  <Link
                    href="/dashboard/gallery?tv=1"
                    data-interactive="true"
                    className={cn(buttonTone("secondary", { size: "lg", fullWidth: true }), "min-h-[72px] text-lg")}
                  >
                    TV 갤러리
                  </Link>
                  <button
                    type="button"
                    data-interactive="true"
                    onClick={() => setFileManagerOpen(true)}
                    className={cn(buttonTone("primary", { size: "lg", fullWidth: true }), "min-h-[72px] text-lg")}
                  >
                    파일 관리
                  </button>
                  <Link
                    href="/dashboard/storage"
                    data-interactive="true"
                    className={cn(buttonTone("secondary", { size: "lg", fullWidth: true }), "min-h-[72px] text-lg")}
                  >
                    저장소 현황
                  </Link>
                </div>
              </div>
            </CardTile>

            {cleanShowcase.length > 0 ? (
              <div className="space-y-2">
                <SectionHeader title="Pinned/Recent Showcase" badge={`${cleanShowcase.length}/6`} />
                {renderCleanGrid(cleanShowcase)}
              </div>
            ) : (
              <CardTile variant="present" subdued>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">런처에 표시할 보드가 없습니다.</p>
                    <p className="text-xs text-gray-700">PIN 또는 최근 보드를 추가해 주세요.</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    PIN 추천
                  </span>
                </div>
              </CardTile>
            )}
          </div>
        </ModeShell>
        {createOverlay}
        {classOverlay}
        {fileManagerSheet}
      </>
    );
  }

  if (mode === "focus") {
    const focusBoardId = focusBoard?.boardId ?? null;
    const focusPreferredList =
      focusPicker === "pinned"
        ? pinnedDisplay
        : focusPicker === "recent"
          ? recentDisplay
          : filteredBoards.slice(0, 6);
    const focusQuickList =
      focusPreferredList.length > 0
        ? focusPreferredList
        : pinnedDisplay.length > 0
          ? pinnedDisplay
          : recentDisplay.length > 0
            ? recentDisplay
            : unpinnedBoards.slice(0, 6);
    const focusPreset = getPresetForBoardTarget(focusBoardId, "present");
    const focusShareInfo = focusBoardId ? ensuredShareLinks[focusBoardId] ?? null : null;
    const focusLiveStatus = liveSync.status;
    const focusLastEventAt = liveSync.data?.ts ? new Date(liveSync.data.ts) : null;
    const focusLagMs = liveSync.data?.ts ? Math.max(0, Date.now() - liveSync.data.ts) : null;
    const focusShareEnabled = Boolean(focusBoard?.shareEnabled && focusBoard?.shareCode);
    const focusShareCode = focusBoard?.shareCode ?? null;
    const focusWarnings = [
      focusLiveStatus === "offline"
        ? "라이브 연결이 끊겼습니다. 네트워크 상태를 확인하세요."
        : focusLiveStatus === "degraded"
          ? "라이브 상태가 느립니다. HUD/공유 지연 가능성이 있습니다."
          : null,
      focusBoard && !focusShareEnabled ? "공유 링크가 비활성화되어 있습니다." : null,
      focusBoard && !focusBoard.shareCode ? "공유 코드가 아직 생성되지 않았습니다." : null,
    ].filter(Boolean) as string[];

    return (
      <>
        {onboardingChecklistModal}
        {toastStack}
        {syncCenter}
        {fileManagerSheet}
        <ModeShell
          mode={mode}
          title={topLabel}
          description="진행/관제에 필요한 상태를 한 화면에서 확인합니다."
          rightActions={
            <>
              <DashboardSettingsMenu />
              {syncBadge}
              <button
                type="button"
                data-interactive="true"
                onClick={() => setFileManagerOpen(true)}
                className={buttonTone("secondary", { size: "sm" })}
              >
                파일
              </button>
              <FirstLessonCta size="sm" />
            </>
          }
          modeSwitcher={renderModeSwitcher()}
        >
          <div className="space-y-5">
            <CardTile
              variant="present"
              className="sticky top-[var(--dashboard-sticky-top,120px)] z-20 border-indigo-500/40 bg-slate-950/80 text-slate-100 backdrop-blur"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Live Status Strip</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-semibold tracking-[0.2em]">
                      {focusShareCode ?? "----"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        focusLiveStatus === "live"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : focusLiveStatus === "degraded"
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-rose-500/20 text-rose-200",
                      )}
                    >
                      {focusLiveStatus === "live" ? "ONLINE" : focusLiveStatus === "degraded" ? "SLOW" : "OFFLINE"}
                    </span>
                    {focusLastEventAt ? (
                      <span className="text-xs text-indigo-200">
                        마지막 이벤트 {focusLastEventAt.toLocaleTimeString("ko-KR")}
                      </span>
                    ) : (
                      <span className="text-xs text-indigo-200">이벤트 대기 중</span>
                    )}
                    {typeof focusLagMs === "number" ? (
                      <span className="text-xs text-indigo-200">지연 {focusLagMs}ms</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-indigo-200">
                    {focusBoard?.title ?? "보드 미선택"} · {networkStatus}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {focusBoardId ? (
                    <Link
                      href={boardBoardHref(focusBoardId)}
                      data-interactive="true"
                      className={buttonTone("primary", { size: "md", tone: "indigo" })}
                    >
                      클래스
                    </Link>
                  ) : (
                    <button type="button" disabled className={buttonTone("secondary", { size: "md" })}>
                      클래스
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSafeMode((prev) => !prev)}
                  data-interactive="true"
                  className={cn(
                    "mt-2 rounded-full px-4 py-2 text-xs font-semibold",
                    safeMode ? "bg-rose-500/20 text-rose-200" : "bg-emerald-500/20 text-emerald-200",
                  )}
                >
                  {safeMode ? "읽기 전용 ON" : "편집 가능"}
                </button>
              </div>
            </CardTile>

            {focusWarnings.length > 0 ? (
              <div className="space-y-2">
                {focusWarnings.map((warning) => (
                  <InlineAlert key={warning} tone="warning" title="경고" description={warning} />
                ))}
              </div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                {renderAlerts()}

                <FocusFlowConsole
                  focusBoard={focusBoard}
                  focusPreset={focusPreset}
                  focusBoardId={focusBoardId}
                  focusShareInfo={focusShareInfo}
                  runnerFlow={runnerFlow}
                  runnerStep={runnerStep}
                  liveSnapshot={liveSync.data}
                  flowStepIndex={flowStepIndex}
                  flowShareInfo={flowShareInfo}
                  flowShareTarget={flowShareTarget}
                  flowShareLoading={flowShareLoading}
                  flowShareError={flowShareError}
                  flowActionError={flowActionError}
                  presetSheetOpen={presetSheetTarget === "present"}
                  presets={presets}
                  shareCode={focusBoard?.shareCode ?? null}
                  presetButtonRef={focusPresetButtonRef}
                  onOpenPreset={() => openPresetSheet("present")}
                  onClosePresetSheet={closePresetSheet}
                  onRecent={handleRecent}
                  onFlowRun={() => void handleRunFlowStep()}
                  onFlowNext={handleNextFlowStep}
                  onFlowPrev={handlePrevFlowStep}
                  onOpenFlowTarget={handleOpenFlowTarget}
                  onShareReady={cacheEnsuredShareLink}
                  onRunPreset={(event, preset, settings, shareInfo) =>
                    handleRunPreset(event, preset, settings, {
                      boardId: focusBoardId,
                      shareInfo: shareInfo ?? focusShareInfo,
                    })
                  }
                  networkStatus={networkStatus}
                  lockMode={safeMode}
                />
              </div>

              <div className="space-y-5">
                <CardTile variant="dense" subdued className="border-indigo-500/40 bg-slate-950/70 text-slate-100">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">보드 선택</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { key: "pinned", label: "PIN" },
                        { key: "recent", label: "최근" },
                        { key: "all", label: "전체" },
                      ].map((option) => {
                        const active = focusPicker === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setFocusPicker(option.key as typeof focusPicker)}
                            data-interactive="true"
                            className={cn(
                              "rounded-full px-3 py-2 text-xs font-semibold",
                              active ? "bg-indigo-500 text-white" : "bg-white/10 text-indigo-100",
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setMode("manage")}
                        data-interactive="true"
                        className={cn("rounded-full px-3 py-2 text-xs font-semibold", "bg-white/10 text-indigo-100")}
                      >
                        관리 모드
                      </button>
                    </div>
                    <p className="text-xs text-indigo-200">선택하면 HUD가 즉시 갱신됩니다.</p>
                  </div>
                </CardTile>

                <div className="space-y-2">
                  <SectionHeader title="즉시 선택" badge={`${focusQuickList.length}개`} tone="inverse" />
                  {focusQuickList.length > 0 ? (
                    renderFocusGrid(focusQuickList)
                  ) : (
                    <CardTile variant="dense" subdued className="border-dashed">
                      <p className="text-sm text-gray-700">빠르게 선택할 보드가 없습니다.</p>
                    </CardTile>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModeShell>
        {createOverlay}
        {classOverlay}
      </>
    );
  }

  return (
    <>
      {onboardingChecklistModal}
      {folderModal}
      {toastStack}
      {syncCenter}
      {fileManagerSheet}
      <ModeShell
        mode={mode}
        title={topLabel}
        description="정리/편집/대량 작업 중심의 관리 뷰입니다."
        rightActions={
          <div className="flex flex-wrap items-center gap-2">
            <DashboardSettingsMenu />
            <button
              type="button"
              onClick={focusCreateForm}
              data-interactive="true"
              className={buttonTone("primary", { size: "md", tone: "emerald" })}
            >
              새 보드 만들기
            </button>
            <Link href="/dashboard/import/board" data-interactive="true" className={buttonTone("secondary", { size: "md" })}>
              보드 가져오기
            </Link>
            <button
              type="button"
              data-interactive="true"
              onClick={() => setFileManagerOpen(true)}
              className={buttonTone("secondary", { size: "md" })}
            >
              파일 관리
            </button>
            <FirstLessonCta size="sm" />
            <MoreMenu label="더보기" align="right">
              <Link
                href="/dashboard/system"
                data-interactive="true"
                className="block rounded-md px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
              >
                시스템 진단
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  data-interactive="true"
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                >
                  로그아웃
                </button>
              </form>
            </MoreMenu>
          </div>
        }
        modeSwitcher={renderModeSwitcher()}
      >
        <div className="space-y-4">
          {renderAlerts()}
          {classSection}
          {primaryCreateCta}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">{renderManageExplorer(manageBoards)}</div>
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setPresetManagerOpen((prev) => !prev)}
                data-interactive="true"
                className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-xs font-semibold text-slate-700 shadow-sm"
              >
                프리셋 관리
              </button>
              <StorageUsageCard />
              <ManageFlowSection
                flows={flows}
                presets={presets}
                boardId={flowBoard?.boardId ?? null}
                boardTitle={flowBoard?.title ?? null}
                activeFlowId={flowBoardActiveFlowId}
                presetManagerOpen={presetManagerOpen}
                onSaveFlow={handleSaveFlow}
                onDeleteFlow={handleDeleteFlow}
                onDuplicateFlow={handleDuplicateFlow}
                onSetActiveFlow={handleSetActiveFlow}
                onChangePresets={setPresets}
                onClosePresetManager={() => setPresetManagerOpen(false)}
              />
            </div>
          </div>
        </div>
      </ModeShell>
      {deleteModal}
      {createOverlay}
      {classOverlay}
    </>
  );
}
