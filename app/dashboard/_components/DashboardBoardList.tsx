"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";

import InlineAlert from "@/app/_components/InlineAlert";
import ContextMenu from "@/app/_components/ContextMenu";
import CommandPalette from "@/app/dashboard/boards/[boardId]/class/CommandPalette";
import KeyboardShortcutsOverlay from "@/app/dashboard/boards/[boardId]/class/KeyboardShortcutsOverlay";
import { useCommandPalette, type CommandPaletteItem } from "@/app/dashboard/boards/[boardId]/class/useCommandPalette";
import { cn } from "@/app/_components/uiTokens";
import { pushDashboardToast, useDashboardToasts } from "@/app/dashboard/useDashboardToast";
import {
  BoardIcon,
  DashboardButton,
  DashboardEmptyState,
  DashboardModal,
  DashboardPanel,
  DashboardToastStack,
} from "@/app/dashboard/_components/dashboardUi";
import { dashboardGlassButtonClass } from "@/app/dashboard/_components/dashboardGlassButton";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { normalizeBoardSummary } from "@/lib/data/boards";
import { sortBoardsForDashboard } from "@/lib/dashboard/sortBoardsForDashboard";
import { filterBoardsByQuery } from "@/lib/dashboard/filterBoardsByQuery";
import { setCreatedBoardIdForOnboarding } from "@/lib/dashboard/newBoardOnboarding";
import { setPinnedBoardIds as persistPinnedBoardIds } from "@/lib/dashboard/pinnedBoards";
import { useDashboardChromePrefs } from "@/lib/dashboard/chromePrefs";
import { getSupabaseBrowserAccessToken, subscribeSupabaseBrowserAuthState } from "@/lib/supabase/client";
import {
  computeSelectedBoardIds,
  isBulkDeleteConfirmationValid,
  toggleBoardSelection,
} from "@/lib/dashboard/boardSelection";
import { getCapabilitySet, resolveActions, runActionWithTelemetry } from "@/lib/ui/actions/registry";
import { getDashboardActions } from "@/lib/ui/actions/screenActions";
import { markHintSeen, readHintSeen, shouldShowHint } from "@/lib/dashboard/discoverabilityHints";

import {
  DASHBOARD_CREATE_BOARD_SUCCESS_EVENT,
  type DashboardCreateBoardSuccessDetail,
} from "@/app/dashboard/createBoardSuccess";

type DashboardBoard = {
  id: string;
  title: string;
  created_at: string;
  lastUpdatedAt?: string | null;
};

type DeleteState = {
  boardId: string | null;
  isOpen: boolean;
  isDeleting: boolean;
};

type RenameState = {
  boardId: string | null;
  isOpen: boolean;
  isSaving: boolean;
  titleInput: string;
};

type BulkDeleteState = {
  isOpen: boolean;
  isDeleting: boolean;
  confirmInput: string;
};
type BulkActionState = {
  unpinPending: boolean;
  copyPending: boolean;
};

type DashboardBoardListProps = {
  initialBoards: DashboardBoard[];
  initialPinnedBoardIds?: string[];
  initialLastOpenedBoardId?: string | null;
  initialLoadSucceeded?: boolean;
};

type BoardListLoadState =
  | "checking-auth"
  | "loading"
  | "ready_with_boards"
  | "ready_empty"
  | "error"
  | "auth_error";

type DashboardBoardsPayload = {
  boards?: unknown[];
  error?: string | { message?: string; code?: string };
  message?: string;
  requestId?: string;
};

const initialDeleteState: DeleteState = {
  boardId: null,
  isOpen: false,
  isDeleting: false,
};

const PAGE_SIZE = 20;

const initialRenameState: RenameState = {
  boardId: null,
  isOpen: false,
  isSaving: false,
  titleInput: "",
};

const initialBulkDeleteState: BulkDeleteState = {
  isOpen: false,
  isDeleting: false,
  confirmInput: "",
};

const HINT_KEYS = {
  dashboardPaletteShortcut: "gomdory.ui.hint.dashboardPaletteShortcut.v1",
  advancedActions: "gomdory.ui.hint.advancedActions.v1",
} as const;

export default function DashboardBoardList({
  initialBoards,
  initialPinnedBoardIds = [],
  initialLastOpenedBoardId = null,
  initialLoadSucceeded = true,
}: DashboardBoardListProps) {
  const [boards, setBoards] = useState<DashboardBoard[]>(initialBoards);
  const boardsRef = useRef<DashboardBoard[]>(initialBoards);
  const [pinnedBoardIds, setPinnedBoardIds] = useState<string[]>(initialPinnedBoardIds);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listLoadState, setListLoadState] = useState<BoardListLoadState>(
    initialLoadSucceeded
      ? initialBoards.length > 0
        ? "ready_with_boards"
        : "ready_empty"
      : "checking-auth",
  );
  const [listErrorMessage, setListErrorMessage] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(initialDeleteState);
  const [renameState, setRenameState] = useState<RenameState>(initialRenameState);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [bulkDeleteState, setBulkDeleteState] = useState<BulkDeleteState>(initialBulkDeleteState);
  const [bulkActionState, setBulkActionState] = useState<BulkActionState>({ unpinPending: false, copyPending: false });
  const [highlightedBoardId, setHighlightedBoardId] = useState<string | null>(null);
  const pendingSnapshotRef = useRef<DashboardBoard[] | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const boardRefMap = useRef(new Map<string, HTMLDivElement>());
  const [contextMenuState, setContextMenuState] = useState<{ boardId: string; x: number; y: number } | null>(null);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);

  const [openBoardMenuId, setOpenBoardMenuId] = useState<string | null>(null);
  const menuTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuPanelRefs = useRef(new Map<string, HTMLDivElement>());
  const chromePrefs = useDashboardChromePrefs();
  const toasts = useDashboardToasts();

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  useEffect(() => {
    setListLoadState((current) => {
      if (current !== "ready_with_boards" && current !== "ready_empty") return current;
      return boards.length > 0 ? "ready_with_boards" : "ready_empty";
    });
  }, [boards.length]);

  const loadBoards = useCallback(async (accessToken?: string | null, showLoading = false) => {
    if (showLoading || boardsRef.current.length === 0) {
      setListLoadState("loading");
    }
    setListErrorMessage(null);

    try {
      const headers = new Headers({ "cache-control": "no-cache" });
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      const response = await fetch(apiV1Path("dashboard/boards"), {
        cache: "no-store",
        headers,
      });
      const payload = (await response.json().catch(() => null)) as DashboardBoardsPayload | null;

      if (!response.ok) {
        const nestedError =
          payload && typeof payload.error === "object" && payload.error
            ? payload.error
            : null;
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : nestedError?.message ??
              payload?.message ??
              "보드 목록을 불러오지 못했어요.";
        if (response.status === 401 || response.status === 403) {
          setListLoadState("auth_error");
          setListErrorMessage(message);
          return;
        }
        throw new Error(message);
      }

      if (!payload || !Array.isArray(payload.boards)) {
        throw new Error("보드 목록 응답을 확인하지 못했어요.");
      }

      const nextBoards = payload.boards
        .map((item) => normalizeBoardSummary(item))
        .filter((board): board is NonNullable<typeof board> => Boolean(board?.boardId))
        .map((board) => ({
          id: board.boardId,
          title: board.title,
          created_at: board.created_at ?? new Date().toISOString(),
          lastUpdatedAt: board.updatedAt ?? board.created_at ?? null,
        }));

      setBoards(nextBoards);
      setListLoadState(nextBoards.length > 0 ? "ready_with_boards" : "ready_empty");
      setListErrorMessage(null);
    } catch (error) {
      console.error("[dashboard:boards] failed to load board list", error);
      setListLoadState("error");
      setListErrorMessage(
        error instanceof Error && error.message ? error.message : "보드 목록을 불러오지 못했어요.",
      );
    }
  }, []);

  const markLoginRequired = useCallback(() => {
    setListLoadState("auth_error");
    setListErrorMessage("로그인이 필요합니다.");
  }, []);

  const loadBoardsWithCurrentSession = useCallback(async () => {
    setListLoadState("loading");
    setListErrorMessage(null);
    try {
      const token = await getSupabaseBrowserAccessToken();
      if (!token) {
        markLoginRequired();
        return;
      }

      await loadBoards(token, true);
    } catch (error) {
      console.error("[dashboard:boards] failed to read browser session", error);
      setListLoadState("auth_error");
      setListErrorMessage("로그인이 필요합니다.");
    }
  }, [loadBoards, markLoginRequired]);

  useEffect(() => {
    let cancelled = false;

    const markAuthReady = (accessToken?: string | null) => {
      if (cancelled) return;
      if (!accessToken) {
        markLoginRequired();
        return;
      }
      void loadBoards(accessToken);
    };

    const subscription = subscribeSupabaseBrowserAuthState((event, accessToken) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        markAuthReady(accessToken);
      }
      if (event === "SIGNED_OUT") {
        markLoginRequired();
      }
    });

    if (!subscription) {
      void loadBoards(null);
      return () => {
        cancelled = true;
      };
    }

    void getSupabaseBrowserAccessToken()
      .then((accessToken) => markAuthReady(accessToken))
      .catch(() => markAuthReady(null));

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadBoards, markLoginRequired]);

  useEffect(() => {
    try {
      if (
        shouldShowHint({
          enabled: true,
          hasSeen: readHintSeen(HINT_KEYS.dashboardPaletteShortcut),
        })
      ) {
        pushDashboardToast({ title: "⌘K / Ctrl+K로 보드 찾기" });
        markHintSeen(HINT_KEYS.dashboardPaletteShortcut);
      }
    } catch {
      // fail-open: hint delivery must not block dashboard actions
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
        pushDashboardToast({ title: "우클릭하거나 길게 눌러 보드 도구 열기" });
        markHintSeen(HINT_KEYS.advancedActions);
      }
    } catch {
      // fail-open: hint delivery must not block dashboard actions
    }
  }, [chromePrefs.showAdvancedActions]);

  const boardById = useMemo(() => {
    const map = new Map<string, DashboardBoard>();
    boards.forEach((board) => map.set(board.id, board));
    return map;
  }, [boards]);

  const sortedBoards = useMemo(
    () =>
      sortBoardsForDashboard(
        boards.map((board) => ({
          ...board,
          createdAt: board.created_at,
          lastUpdatedAt: board.lastUpdatedAt ?? board.created_at,
        })),
        initialLastOpenedBoardId,
        pinnedBoardIds,
      ),
    [boards, initialLastOpenedBoardId, pinnedBoardIds],
  );

  const filteredBoards = useMemo(() => filterBoardsByQuery(sortedBoards, query), [query, sortedBoards]);
  const pinnedBoardSet = useMemo(() => new Set(pinnedBoardIds), [pinnedBoardIds]);
  const pinnedBoards = useMemo(
    () => sortedBoards.filter((board) => pinnedBoardSet.has(board.id)),
    [pinnedBoardSet, sortedBoards],
  );
  const nonPinnedBoards = useMemo(
    () => sortedBoards.filter((board) => !pinnedBoardSet.has(board.id)),
    [pinnedBoardSet, sortedBoards],
  );
  const hasQuery = query.trim().length > 0;
  const visibleBoards = useMemo(
    () => (hasQuery ? filteredBoards : nonPinnedBoards.slice(0, visibleCount)),
    [filteredBoards, hasQuery, nonPinnedBoards, visibleCount],
  );
  const hasMoreBoards = !hasQuery && visibleBoards.length < nonPinnedBoards.length;

  const selectedBoard = deleteState.boardId ? boardById.get(deleteState.boardId) ?? null : null;
  const selectedRenameBoard = renameState.boardId ? boardById.get(renameState.boardId) ?? null : null;
  const selectedIds = useMemo(
    () => computeSelectedBoardIds(selectedBoardIds, boards.map((board) => board.id)),
    [boards, selectedBoardIds],
  );
  const selectedBoards = useMemo(
    () => selectedIds.map((boardId) => boardById.get(boardId)).filter((board): board is DashboardBoard => Boolean(board)),
    [boardById, selectedIds],
  );
  const selectedPinnedBoards = useMemo(
    () => selectedBoards.filter((board) => pinnedBoardSet.has(board.id)),
    [pinnedBoardSet, selectedBoards],
  );
  const selectedCount = selectedBoards.length;
  const selectedPinnedCount = selectedPinnedBoards.length;

  const openDeleteModal = useCallback((boardId: string) => {
    setDeleteState({ boardId, isOpen: true, isDeleting: false });
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleteState.isDeleting) return;
    setDeleteState(initialDeleteState);
  }, [deleteState.isDeleting]);

  const handleDelete = useCallback(async () => {
    if (!deleteState.boardId) return;
    if (deleteState.isDeleting) return;

    const targetId = deleteState.boardId;
    const snapshot = boards;
    pendingSnapshotRef.current = snapshot;

    setBoards((prev) => prev.filter((board) => board.id !== targetId));
    setErrorMessage(null);
    setDeleteState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const response = await fetch(apiV1Path(`dashboard/boards/${targetId}`), { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (!response.ok || !payload?.ok) {
        const message = payload?.message || "보드를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.";
        throw new Error(message);
      }

      pendingSnapshotRef.current = null;
      setSelectedBoardIds((current) => current.filter((boardId) => boardId !== targetId));
      setDeleteState(initialDeleteState);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "보드를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.";
      const rollback = pendingSnapshotRef.current;
      if (rollback) {
        setBoards(rollback);
      }
      pendingSnapshotRef.current = null;
      setDeleteState(initialDeleteState);
      setErrorMessage(message);
    }
  }, [boards, deleteState.boardId, deleteState.isDeleting]);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => {
      if (current) {
        setSelectedBoardIds([]);
        setBulkDeleteState(initialBulkDeleteState);
      }
      setOpenBoardMenuId(null);
      return !current;
    });
  }, []);

  const handleToggleBoardSelection = useCallback((boardId: string) => {
    setSelectedBoardIds((current) => toggleBoardSelection(current, boardId));
  }, []);

  const openBulkDeleteModal = useCallback(() => {
    if (selectedIds.length === 0) return;
    setBulkDeleteState({ isOpen: true, isDeleting: false, confirmInput: "" });
  }, [selectedIds.length]);

  const closeBulkDeleteModal = useCallback(() => {
    if (bulkDeleteState.isDeleting) return;
    setBulkDeleteState(initialBulkDeleteState);
  }, [bulkDeleteState.isDeleting]);

  const handleBulkDelete = useCallback(async () => {
    if (bulkDeleteState.isDeleting) return;
    if (selectedIds.length === 0) return;
    if (!isBulkDeleteConfirmationValid(bulkDeleteState.confirmInput, selectedIds.length)) {
      setErrorMessage("여러 보드 삭제는 확인 문구 ‘삭제’를 입력해야 합니다.");
      return;
    }

    const snapshot = boards;
    pendingSnapshotRef.current = snapshot;
    setBoards((prev) => prev.filter((board) => !selectedIds.includes(board.id)));
    setErrorMessage(null);
    setBulkDeleteState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const requests = selectedIds.map(async (boardId) => {
        const response = await fetch(apiV1Path(`dashboard/boards/${boardId}`), { method: "DELETE" });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "보드를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
      });
      await Promise.all(requests);
      pendingSnapshotRef.current = null;
      setSelectedBoardIds([]);
      setSelectionMode(false);
      setBulkDeleteState(initialBulkDeleteState);
    } catch (error) {
      const rollback = pendingSnapshotRef.current;
      if (rollback) setBoards(rollback);
      pendingSnapshotRef.current = null;
      setBulkDeleteState(initialBulkDeleteState);
      setErrorMessage(error instanceof Error ? error.message : "보드를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }, [boards, bulkDeleteState.confirmInput, bulkDeleteState.isDeleting, selectedIds]);

  const openRenameModal = useCallback((boardId: string) => {
    const board = boardById.get(boardId);
    setRenameState({
      boardId,
      isOpen: true,
      isSaving: false,
      titleInput: board?.title ?? "",
    });
  }, [boardById]);

  const closeRenameModal = useCallback(() => {
    if (renameState.isSaving) return;
    setRenameState(initialRenameState);
  }, [renameState.isSaving]);

  useEffect(() => {
    setVisibleCount((current) => Math.min(Math.max(PAGE_SIZE, current), Math.max(PAGE_SIZE, nonPinnedBoards.length)));
  }, [nonPinnedBoards.length]);

  useEffect(() => {
    if (query.trim()) {
      setVisibleCount(filteredBoards.length);
      return;
    }
    setVisibleCount(PAGE_SIZE);
  }, [filteredBoards.length, query]);

  useEffect(() => {
    setSelectedBoardIds((current) => computeSelectedBoardIds(current, boards.map((board) => board.id)));
  }, [boards]);

  useEffect(() => {
    const handleSelectionEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!selectionMode) return;
      setSelectionMode(false);
      setSelectedBoardIds([]);
      setBulkDeleteState(initialBulkDeleteState);
    };

    const currentWindow = window as Window;
    currentWindow.addEventListener("keydown", handleSelectionEscape);
    return () => currentWindow.removeEventListener("keydown", handleSelectionEscape);
  }, [selectionMode]);


  useEffect(() => {
    if (!openBoardMenuId) return;
    if (typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const activeMenuId = openBoardMenuId;
      if (!activeMenuId) return;
      const trigger = menuTriggerRefs.current.get(activeMenuId) ?? null;
      const panel = menuPanelRefs.current.get(activeMenuId) ?? null;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const isInsidePath = path.length > 0 && [trigger, panel].some((node) => (node ? path.includes(node) : false));
      const target = event.target instanceof Node ? event.target : null;
      const isInsideTarget = Boolean(target && ((trigger?.contains(target) ?? false) || (panel?.contains(target) ?? false)));
      if (isInsidePath || isInsideTarget) return;
      setOpenBoardMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      menuTriggerRefs.current.get(openBoardMenuId)?.focus();
      setOpenBoardMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openBoardMenuId]);
  useEffect(() => {
    const handleSlashToFocus = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          return;
        }
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleSlashToFocus);
    return () => window.removeEventListener("keydown", handleSlashToFocus);
  }, []);

  const updateBoardTitle = useCallback(async (boardId: string, title: string) => {
    const response = await fetch(apiV1Path(`dashboard/boards/${boardId}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !payload?.ok) {
      const message = payload?.message || "보드 이름을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.";
      throw new Error(message);
    }
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (!renameState.boardId) return;
    if (renameState.isSaving) return;

    const normalizedTitle = renameState.titleInput.trim();
    if (!normalizedTitle) {
      setErrorMessage("보드 이름을 입력해주세요.");
      return;
    }

    const targetId = renameState.boardId;
    const snapshot = boards;
    pendingSnapshotRef.current = snapshot;

    setBoards((prev) =>
      prev.map((board) => (board.id === targetId ? { ...board, title: normalizedTitle } : board)),
    );
    setErrorMessage(null);
    setRenameState((prev) => ({ ...prev, isSaving: true }));

    try {
      await updateBoardTitle(targetId, normalizedTitle);
      pendingSnapshotRef.current = null;
      setRenameState(initialRenameState);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "보드 이름을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.";
      const rollback = pendingSnapshotRef.current;
      if (rollback) {
        setBoards(rollback);
      }
      pendingSnapshotRef.current = null;
      setRenameState(initialRenameState);
      setErrorMessage(message);
    }
  }, [boards, renameState.boardId, renameState.isSaving, renameState.titleInput, updateBoardTitle]);

  useEffect(() => {
    const handleCreateSuccess = (event: Event) => {
      const customEvent = event as CustomEvent<DashboardCreateBoardSuccessDetail>;
      const detail = customEvent.detail;

      if (!detail?.boardId) {
        return;
      }

      setCreatedBoardIdForOnboarding(detail.boardId);
      setListLoadState("ready_with_boards");
      setListErrorMessage(null);

      setBoards((prev) => {
        const exists = prev.some((board) => board.id === detail.boardId);
        if (exists) {
          return prev;
        }

        const nextBoards = [
          { id: detail.boardId, title: detail.title, created_at: detail.createdAt, lastUpdatedAt: detail.createdAt },
          ...prev,
        ];
        const sortedNextBoards = sortBoardsForDashboard(
          nextBoards.map((board) => ({
            ...board,
            createdAt: board.created_at,
            lastUpdatedAt: board.lastUpdatedAt ?? board.created_at,
          })),
          initialLastOpenedBoardId,
          pinnedBoardIds,
        );
        if (!query.trim()) {
          const insertedIndex = sortedNextBoards.findIndex((board) => board.id === detail.boardId);
          setVisibleCount((current) => Math.max(current, insertedIndex + 1, 1));
        }
        return nextBoards;
      });

      const matchesQuery = filterBoardsByQuery([{ title: detail.title }], query).length > 0;
      const shouldHighlight = !query.trim() || matchesQuery;
      setHighlightedBoardId(shouldHighlight ? detail.boardId : null);

      if (!shouldHighlight) {
        return;
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const boardNode = boardRefMap.current.get(detail.boardId);
          if (boardNode) {
            boardNode.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }

          listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    };

    window.addEventListener(DASHBOARD_CREATE_BOARD_SUCCESS_EVENT, handleCreateSuccess as EventListener);
    return () => {
      window.removeEventListener(DASHBOARD_CREATE_BOARD_SUCCESS_EVENT, handleCreateSuccess as EventListener);
    };
  }, [initialLastOpenedBoardId, pinnedBoardIds, query]);

  useEffect(() => {
    if (!highlightedBoardId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedBoardId((current) => (current === highlightedBoardId ? null : current));
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedBoardId]);

  const handleTogglePinned = useCallback(async (boardId: string) => {
    const previous = pinnedBoardIds;
    const next = previous.includes(boardId)
      ? previous.filter((id) => id !== boardId)
      : [...previous, boardId];

    setPinnedBoardIds(next);

    const ok = await persistPinnedBoardIds(next);
    if (!ok) {
      setPinnedBoardIds(previous);
      setErrorMessage("고정 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }, [pinnedBoardIds]);

  const handleCopyLink = useCallback(async (boardId: string) => {
    const href = `/dashboard/boards/${boardId}/board`;
    try {
      await navigator.clipboard.writeText(href);
      pushDashboardToast({ title: "링크를 복사했어요", description: href });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "보드 링크를 복사하지 못했습니다.";
      setErrorMessage(message || "보드 링크를 복사하지 못했습니다.");
    }
  }, []);

  const handleBulkUnpin = useCallback(async () => {
    if (selectedCount === 0) return;
    if (selectedPinnedBoards.length === 0 || bulkActionState.unpinPending) return;
    const targetPinnedIds = new Set(selectedPinnedBoards.map((board) => board.id));
    const next = pinnedBoardIds.filter((id) => !targetPinnedIds.has(id));
    const previous = pinnedBoardIds;
    setBulkActionState((prev) => ({ ...prev, unpinPending: true }));
    setPinnedBoardIds(next);
    const ok = await persistPinnedBoardIds(next);
    if (!ok) {
      setPinnedBoardIds(previous);
      setErrorMessage("고정 해제를 완료하지 못했습니다. 새로고침 후 다시 시도해주세요.");
      setBulkActionState((prev) => ({ ...prev, unpinPending: false }));
      return;
    }
    setSelectedBoardIds((current) => current.filter((id) => !targetPinnedIds.has(id)));
    setBulkActionState((prev) => ({ ...prev, unpinPending: false }));
    pushDashboardToast({ title: "선택한 보드 고정을 해제했어요" });
  }, [bulkActionState.unpinPending, pinnedBoardIds, selectedCount, selectedPinnedBoards]);

  const handleBulkCopyLinks = useCallback(async () => {
    if (selectedCount === 0 || bulkActionState.copyPending) return;
    const links = selectedIds.map((boardId) => `/dashboard/boards/${boardId}/board`).join("\n");
    setBulkActionState((prev) => ({ ...prev, copyPending: true }));
    try {
      await navigator.clipboard.writeText(links);
      pushDashboardToast({ title: "선택한 보드 링크를 복사했어요", description: `${selectedCount}개` });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "보드 링크를 복사하지 못했습니다.");
    } finally {
      setBulkActionState((prev) => ({ ...prev, copyPending: false }));
    }
  }, [bulkActionState.copyPending, selectedCount, selectedIds]);

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  };

  const dashboardActionContext = useMemo(
    () => ({
      selectionMode,
      selectedCount,
      selectedPinnedCount,
      focusSearch: () => searchInputRef.current?.focus(),
      toggleSelectionMode: handleToggleSelectionMode,
      bulkCopySelectedLinks: () => {
        void handleBulkCopyLinks();
      },
      bulkUnpinSelected: () => {
        void handleBulkUnpin();
      },
      bulkDeleteSelected: openBulkDeleteModal,
      openBoard: (boardId: string) => {
        window.location.href = `/dashboard/boards/${boardId}/board`;
      },
      renameBoard: (boardId: string) => openRenameModal(boardId),
      copyBoardLink: (boardId: string) => {
        void handleCopyLink(boardId);
      },
      toggleBoardPin: (boardId: string) => {
        void handleTogglePinned(boardId);
      },
      deleteBoard: (boardId: string) => openDeleteModal(boardId),
    }),
    [
      handleBulkCopyLinks,
      handleBulkUnpin,
      handleCopyLink,
      handleTogglePinned,
      handleToggleSelectionMode,
      openBulkDeleteModal,
      openDeleteModal,
      openRenameModal,
      selectedCount,
      selectedPinnedCount,
      selectionMode,
    ],
  );

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const actionContext = {
      ...dashboardActionContext,
      visibleBoards: visibleBoards.slice(0, 20).map((board) => ({ id: board.id, title: board.title, pinned: pinnedBoardSet.has(board.id) })),
    };
    const actions = getDashboardActions(actionContext);
    const baseItems = resolveActions(actions, actionContext, "palette", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("Dashboard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    }).map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      keywords: action.keywords ?? [],
      enabled: action.enabled,
      run: () => runActionWithTelemetry({ action, context: actionContext, surface: "palette", source: "palette" }),
    }));

    return [
      {
        id: "ui-open-keyboard-shortcuts",
        label: "단축키 보기",
        description: "보드 찾기와 메뉴 이동 단축키",
        keywords: ["단축키", "keyboard", "shortcut", "help"],
        enabled: true,
        run: () => setShortcutsOverlayOpen(true),
      },
      ...baseItems,
    ];
  }, [chromePrefs.showAdvancedActions, dashboardActionContext, pinnedBoardSet, visibleBoards]);

  const contextMenuActions = useMemo(() => {
    if (!contextMenuState) return [];
    const board = visibleBoards.find((entry) => entry.id === contextMenuState.boardId);
    if (!board) return [];
    const actionContext = {
      ...dashboardActionContext,
      visibleBoards: [{ id: board.id, title: board.title, pinned: pinnedBoardSet.has(board.id) }],
    };
    const actions = getDashboardActions(actionContext);
    return resolveActions(actions, actionContext, "context", {
      showAdvancedActions: chromePrefs.showAdvancedActions,
      capabilities: getCapabilitySet("Dashboard", { showAdvancedActions: chromePrefs.showAdvancedActions }),
    }).map((action) => ({
      id: action.id,
      label: action.label,
      dangerous: action.dangerous,
      enabled: action.enabled,
      run: () => runActionWithTelemetry({ action, context: actionContext, surface: "context", source: "contextmenu" }),
    }));
  }, [chromePrefs.showAdvancedActions, contextMenuState, dashboardActionContext, pinnedBoardSet, visibleBoards]);

  const palette = useCommandPalette(paletteItems);

  useEffect(() => {
    const handlePaletteKeydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      palette.toggle();
    };

    const closeContextMenu = () => setContextMenuState(null);

    window.addEventListener("keydown", handlePaletteKeydown);
    window.addEventListener("scroll", closeContextMenu, true);
    return () => {
      window.removeEventListener("keydown", handlePaletteKeydown);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, [palette]);

  return (
    <div data-dashboard-board-list-scope className="hud-dashboard-panel space-y-4">
      {errorMessage ? (
        <InlineAlert tone="error" title="보드 작업에 실패했어요." description={errorMessage} />
      ) : null}

      <section className="hud-dashboard-command-strip space-y-2 rounded-xl border border-[var(--theme-border)]/70 bg-[var(--theme-panel-strong)]/65 px-4 py-3">
        <label htmlFor="dashboard-board-search" className="sr-only">
          보드 검색
        </label>
        <input
          ref={searchInputRef}
          id="dashboard-board-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setQuery("");
            listRef.current?.focus();
          }}
          placeholder="보드 이름 검색"
          aria-describedby="dashboard-board-search-hint"
          className="w-full rounded-[var(--ui-radius-sm)] border border-[var(--theme-border)]/85 bg-[var(--theme-surface-2)]/95 px-3.5 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] shadow-inner shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/65"
        />
        <p id="dashboard-board-search-hint" className="text-xs text-[var(--theme-text-muted)]">
          보드 이름으로 검색
        </p>
      </section>

      <div className="flex items-center justify-between">
        <DashboardButton
          type="button"
          data-testid="dashboard-board-select-mode-toggle"
          onClick={handleToggleSelectionMode}
          className="text-xs uppercase tracking-[0.12em]"
        >
          {selectionMode ? "선택 종료" : "선택"}
        </DashboardButton>
        {selectionMode ? (
          <p className="text-xs text-[var(--theme-text-muted)]">ESC로 선택 모드를 종료할 수 있어요.</p>
        ) : null}
      </div>

      {selectionMode ? (
        <DashboardPanel className="sticky top-2 z-10 border border-[var(--theme-border)] bg-[var(--theme-panel-strong)]/95 p-3 backdrop-blur hud-dashboard-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--theme-text)]">{selectedCount}개 선택됨</p>
            <div className="flex items-center gap-2">
              <DashboardButton
                type="button"
                data-testid="dashboard-board-bulk-unpin"
                onClick={() => { void handleBulkUnpin(); }}
                disabled={selectedCount === 0 || selectedPinnedCount === 0 || bulkActionState.unpinPending}
                className="text-xs uppercase tracking-[0.14em]"
              >
                {bulkActionState.unpinPending ? "처리 중…" : "고정 해제"}
              </DashboardButton>
              <DashboardButton
                type="button"
                data-testid="dashboard-board-bulk-copy-links"
                onClick={() => { void handleBulkCopyLinks(); }}
                disabled={selectedCount === 0 || bulkActionState.copyPending}
                className="text-xs uppercase tracking-[0.14em]"
              >
                {bulkActionState.copyPending ? "복사 중…" : "링크 복사"}
              </DashboardButton>
              <DashboardButton
                type="button"
                tone="danger"
                data-testid="dashboard-board-bulk-delete-open"
                onClick={openBulkDeleteModal}
                disabled={selectedCount === 0}
                className="text-xs uppercase tracking-[0.14em]"
              >
                선택 삭제
              </DashboardButton>
            </div>
          </div>
          {selectedPinnedCount > 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              고정된 보드 {selectedPinnedCount}개가 포함되어 있어요. 삭제 전에 다시 확인해주세요.
            </p>
          ) : null}
        </DashboardPanel>
      ) : null}

       {!hasQuery && pinnedBoards.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-[var(--theme-border)]/65 bg-[var(--theme-panel)]/35 p-3">
          <h3 className="text-sm font-semibold text-[var(--theme-text)]">고정된 보드</h3>
          <div className="grid gap-3">
            {pinnedBoards.map((board) => (
              <DashboardPanel key={`pinned-${board.id}`} className={cn("hud-dashboard-row border border-amber-300/25 bg-[var(--theme-panel-strong)]/75 p-4", selectionMode && selectedIds.includes(board.id) ? "ring-2 ring-emerald-500" : null)}>
                <div className="flex items-center justify-between gap-3">
                  {selectionMode ? (
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(board.id)}
                        onChange={() => handleToggleBoardSelection(board.id)}
                        onClick={(event) => event.stopPropagation()}
                        data-testid={`dashboard-board-select-pinned-${board.id}`}
                        aria-label={`${board.title} 선택`}
                        className="mt-1 h-4 w-4 rounded border-[var(--ui-border)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--theme-text)]">{board.title}</span>
                        <span className="block text-xs text-[var(--theme-text-muted)]">생성일 {new Date(board.created_at).toLocaleDateString("ko-KR")}</span>
                      </span>
                    </label>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--theme-text)]">{board.title}</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">생성일 {new Date(board.created_at).toLocaleDateString("ko-KR")}</p>
                    </div>
                  )}
                  {!selectionMode ? (
                    <Link
                      href={`/dashboard/boards/${board.id}/board`}
                      aria-label={`${board.title} 열기`}
                      className={dashboardGlassButtonClass("secondary", "dashboard-board-list-control min-w-0 px-3 py-2 text-xs [overflow-wrap:anywhere] active:translate-y-px")}
                    >
                      열기
                    </Link>
                  ) : null}
                </div>
              </DashboardPanel>
            ))}
          </div>
        </section>
      ) : null}

      {listLoadState === "checking-auth" || listLoadState === "loading" ? (
        <DashboardPanel className="border border-[var(--theme-border)]/70 bg-[var(--theme-panel-strong)]/66 p-6 text-sm font-medium text-[var(--theme-text-muted)]">
          보드 목록을 불러오는 중이에요...
        </DashboardPanel>
      ) : listLoadState === "error" || listLoadState === "auth_error" ? (
        <DashboardPanel className="space-y-3 border border-rose-300/40 bg-rose-950/10 p-6">
          <div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">보드 목록을 불러오지 못했어요.</p>
            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              {listLoadState === "auth_error"
                ? "로그인 상태를 확인한 뒤 다시 시도해 주세요."
                : "잠시 후 다시 시도해 주세요. 계속 안 되면 새로고침하거나 다시 로그인해 주세요."}
            </p>
            {listErrorMessage ? (
              <p className="mt-2 text-xs text-[var(--theme-text-muted)]">{listErrorMessage}</p>
            ) : null}
          </div>
          <DashboardButton type="button" onClick={() => void loadBoardsWithCurrentSession()} className="text-xs uppercase tracking-[0.12em]">
            다시 시도
          </DashboardButton>
        </DashboardPanel>
      ) : listLoadState === "ready_empty" ? (
        <DashboardPanel className="flex min-h-56 flex-col items-center justify-center gap-3 border border-dashed border-[var(--theme-border)] bg-[var(--theme-panel-strong)]/66 p-8 text-center">
          <div className="text-[var(--theme-text-muted)]">
            <BoardIcon />
          </div>
          <p className="text-base font-semibold text-[var(--theme-text)]">아직 만든 보드가 없습니다.</p>
          <p className="max-w-md text-sm text-[var(--theme-text-muted)]">첫 수업 보드를 만들어 보세요.</p>
          <Link
            href="#dashboard-create-board"
            className={dashboardGlassButtonClass("primary", "dashboard-board-list-control min-w-0 px-3 py-2 text-xs [overflow-wrap:anywhere] active:translate-y-px")}
          >
            새 보드 만들기
          </Link>
        </DashboardPanel>
      ) : filteredBoards.length === 0 ? (
        <DashboardEmptyState
          icon={<BoardIcon />}
          title="검색 결과가 없습니다."
          description="다른 검색어를 입력해 보세요."
        />
      ) : (
        <div ref={listRef} id="dashboard-board-list" tabIndex={-1} className="hud-dashboard-list grid gap-2.5 focus:outline-none">
          {visibleBoards.map((board) => (
            <div
              key={board.id}
              ref={(node) => {
                if (node) {
                  boardRefMap.current.set(board.id, node);
                  return;
                }

                boardRefMap.current.delete(board.id);
              }}
              onClick={(event) => {
                if (!selectionMode) return;
                const target = event.target as HTMLElement | null;
                if (target?.closest("[data-interactive='true']")) return;
                handleToggleBoardSelection(board.id);
              }}
            >
              <DashboardPanel
                data-created-board-highlight={highlightedBoardId === board.id ? "true" : undefined}
                onContextMenu={(event) => {
                  if (!chromePrefs.showAdvancedActions) return;
                  event.preventDefault();
                  setContextMenuState({ boardId: board.id, x: event.clientX, y: event.clientY });
                }}
                className={cn(
                  "dashboard-board-list-card hud-dashboard-row min-w-0 border border-[var(--theme-border)]/70 bg-[var(--theme-panel-strong)]/66 p-4 transition-[background-color,border-color,box-shadow] duration-300 hover:border-cyan-300/30 hover:bg-[var(--theme-panel-strong)]/88 hover:shadow-[0_14px_36px_-30px_rgba(34,211,238,0.46)] focus-within:ring-2 focus-within:ring-[var(--theme-focus)]/60",
                  highlightedBoardId === board.id
                    ? "ring-2 ring-[var(--ui-focus)] bg-[color-mix(in_srgb,var(--ui-focus)_16%,var(--ui-surface-muted))]"
                    : null,
                  selectionMode && selectedIds.includes(board.id) ? "ring-2 ring-emerald-500" : null,
                )}
              >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  {selectionMode ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(board.id)}
                      onChange={() => handleToggleBoardSelection(board.id)}
                      onClick={(event) => event.stopPropagation()}
                      data-testid={`dashboard-board-select-${board.id}`}
                      aria-label={`${board.title} 선택`}
                      className="mt-1 h-4 w-4 rounded border-[var(--ui-border)]"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 text-base font-semibold text-[var(--theme-text)] sm:text-lg">{board.title}</h2>
                    <p className="text-xs text-[var(--theme-text-muted)]">
                      생성일 {new Date(board.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!selectionMode ? (
                    <>
                      <button
                        type="button"
                        data-interactive="true"
                        aria-label={pinnedBoardSet.has(board.id) ? `${board.title} 보드 고정 해제` : `${board.title} 보드 고정`}
                        data-testid={`dashboard-board-pin-toggle-${board.id}`}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleTogglePinned(board.id);
                        }}
                        className="dashboard-board-list-icon-control dashboard-board-list-pin-control inline-flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-sm)] border border-[var(--theme-border)]/75 bg-[var(--theme-surface-2)]/70 text-lg leading-none text-[var(--theme-warning)] transition hover:border-[var(--theme-warning)] hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:translate-y-px"
                      >
                        {pinnedBoardSet.has(board.id) ? "★" : "☆"}
                      </button>
                      <div className="relative" data-interactive="true">
                        <button
                          ref={(node) => {
                            if (node) {
                              menuTriggerRefs.current.set(board.id, node);
                              return;
                            }
                            menuTriggerRefs.current.delete(board.id);
                          }}
                          type="button"
                          aria-label={`${board.title} 보드 메뉴`}
                          aria-expanded={openBoardMenuId === board.id}
                          aria-controls={`dashboard-board-menu-${board.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setOpenBoardMenuId((current) => (current === board.id ? null : board.id));
                          }}
                          className="dashboard-board-list-icon-control flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-[var(--theme-border)]/80 bg-[var(--theme-surface-2)]/92 text-[var(--theme-text)] shadow-sm transition hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:translate-y-px"
                        >
                          <span className="text-lg leading-none">⋯</span>
                        </button>
                        {openBoardMenuId === board.id ? (
                          <div
                            ref={(node) => {
                              if (node) {
                                menuPanelRefs.current.set(board.id, node);
                                return;
                              }
                              menuPanelRefs.current.delete(board.id);
                            }}
                            id={`dashboard-board-menu-${board.id}`}
                            aria-label={`${board.title} 보드 도구`}
                            className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-[var(--theme-border)]/90 bg-[var(--theme-panel-strong)]/98 p-2 text-[var(--theme-text)] shadow-[0_18px_44px_-28px_rgba(6,182,212,0.55)] backdrop-blur"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex flex-col gap-1">
                              <button type="button" data-interactive="true" data-testid={`dashboard-board-rename-open-${board.id}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenBoardMenuId(null); openRenameModal(board.id); }} className="dashboard-board-list-menu-item block w-full min-w-0 rounded-[var(--ui-radius-sm)] px-3 py-2 text-left text-sm text-[var(--theme-text)] transition [overflow-wrap:anywhere] hover:bg-[var(--theme-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] active:translate-y-px">이름 변경</button>
                              <button type="button" data-interactive="true" data-testid={`dashboard-board-copy-link-${board.id}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenBoardMenuId(null); void handleCopyLink(board.id); }} className="dashboard-board-list-menu-item block w-full min-w-0 rounded-[var(--ui-radius-sm)] px-3 py-2 text-left text-sm text-[var(--theme-text)] transition [overflow-wrap:anywhere] hover:bg-[var(--theme-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] active:translate-y-px">링크 복사</button>
                              <button type="button" data-interactive="true" data-testid={`dashboard-board-delete-open-${board.id}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenBoardMenuId(null); openDeleteModal(board.id); }} className="dashboard-board-list-menu-item dashboard-board-list-menu-item-danger block w-full min-w-0 rounded-[var(--ui-radius-sm)] px-3 py-2 text-left text-sm text-red-700 transition [overflow-wrap:anywhere] hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] active:translate-y-px">삭제</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <Link
                        href={`/dashboard/boards/${board.id}/board`}
                        aria-label={`${board.title} 열기`}
                        className={dashboardGlassButtonClass("secondary", "dashboard-board-list-control min-h-12 px-4 text-xs font-black")}
                        onClick={() => setOpenBoardMenuId(null)}
                      >
                        열기
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
              </DashboardPanel>
            </div>
          ))}
        </div>
      )}

      {hasMoreBoards ? (
        <div className="flex justify-center">
          <button
            type="button"
            aria-controls="dashboard-board-list"
            onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            className="dashboard-board-list-control min-w-0 rounded-[var(--ui-radius-sm)] border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)] transition [overflow-wrap:anywhere] hover:bg-[var(--theme-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:translate-y-px"
          >
            더 보기
          </button>
        </div>
      ) : null}

      {deleteState.isOpen ? (
        <DashboardModal title="보드 삭제 확인" onClose={closeDeleteModal}>
          <div data-testid="dashboard-board-delete-modal">
            <h3 className="line-clamp-1 text-base font-semibold text-[var(--theme-text)] sm:text-lg">보드를 삭제할까요?</h3>
            <p className="mt-2 text-sm text-[var(--ui-ink-soft)]">삭제하면 되돌릴 수 없어요.</p>
            {selectedBoard ? (
              <p className="mt-3 text-sm font-semibold text-[var(--ui-ink)]">
                &ldquo;{selectedBoard.title}&rdquo;
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <DashboardButton type="button" onClick={closeDeleteModal} disabled={deleteState.isDeleting}>
                취소
              </DashboardButton>
              <DashboardButton
                type="button"
                onClick={handleDelete}
                disabled={deleteState.isDeleting}
                data-testid="dashboard-board-delete-confirm"
                tone="danger"
                className={cn(deleteState.isDeleting ? "bg-red-300" : null)}
              >
                {deleteState.isDeleting ? "삭제 중…" : "삭제"}
              </DashboardButton>
            </div>
          </div>
        </DashboardModal>
      ) : null}

      {bulkDeleteState.isOpen ? (
        <DashboardModal title="선택한 보드 삭제 확인" onClose={closeBulkDeleteModal}>
          <div data-testid="dashboard-board-bulk-delete-modal">
            <h3 className="line-clamp-1 text-base font-semibold text-[var(--theme-text)] sm:text-lg">선택한 보드를 삭제할까요?</h3>
            <p className="mt-2 text-sm text-[var(--ui-ink-soft)]">총 {selectedBoards.length}개 보드가 삭제됩니다.</p>
            <p className="mt-2 text-sm text-[var(--ui-ink-soft)]">
              {selectedBoards.slice(0, 3).map((board) => board.title).join(", ")}
              {selectedBoards.length > 3 ? " 외" : ""}
            </p>
            {selectedBoards.length > 1 ? (
              <div className="mt-4 space-y-2">
                <label htmlFor="dashboard-bulk-delete-confirmation" className="text-xs font-semibold tracking-[0.08em] text-[var(--ui-ink-soft)]">
                  확인 문구 입력 (삭제)
                </label>
                <input
                  id="dashboard-bulk-delete-confirmation"
                  type="text"
                  value={bulkDeleteState.confirmInput}
                  onChange={(event) => setBulkDeleteState((prev) => ({ ...prev, confirmInput: event.target.value }))}
                  className="w-full rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-sm text-[var(--ui-ink)]"
                />
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <DashboardButton type="button" onClick={closeBulkDeleteModal} disabled={bulkDeleteState.isDeleting}>
                취소
              </DashboardButton>
              <DashboardButton
                type="button"
                tone="danger"
                data-testid="dashboard-board-bulk-delete-confirm"
                onClick={handleBulkDelete}
                disabled={
                  bulkDeleteState.isDeleting ||
                  !isBulkDeleteConfirmationValid(bulkDeleteState.confirmInput, selectedBoards.length)
                }
              >
                {bulkDeleteState.isDeleting ? "삭제 중…" : "삭제"}
              </DashboardButton>
            </div>
          </div>
        </DashboardModal>
      ) : null}

      {contextMenuState ? (
        <ContextMenu
          isOpen={Boolean(contextMenuState)}
          x={contextMenuState.x}
          y={contextMenuState.y}
          className="fixed z-40 min-w-44 rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-white p-1 shadow-lg"
          ariaLabel="보드 컨텍스트 메뉴"
          onClose={() => setContextMenuState(null)}
        >
          {contextMenuActions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={!action.enabled}
              className={cn(
                "dashboard-board-list-menu-item block w-full min-w-0 rounded-[var(--ui-radius-sm)] px-3 py-2 text-left text-sm [overflow-wrap:anywhere] hover:bg-[var(--ui-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] active:translate-y-px",
                action.dangerous ? "dashboard-board-list-menu-item-danger text-red-700 hover:bg-red-50" : null,
                !action.enabled ? "cursor-not-allowed opacity-50" : null,
              )}
              onClick={() => {
                action.run();
                setContextMenuState(null);
              }}
            >
              {action.label}
            </button>
          ))}
        </ContextMenu>
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
          window.location.href = "/dashboard/settings";
        }}
      />

      {renameState.isOpen ? (
        <DashboardModal title="보드 이름 변경" onClose={closeRenameModal}>
          <div data-testid="dashboard-board-rename-modal">
            <h3 className="line-clamp-1 text-base font-semibold text-[var(--theme-text)] sm:text-lg">보드 이름 변경</h3>
            <p className="mt-2 text-sm text-[var(--ui-ink-soft)]">새로운 보드 이름을 입력해주세요.</p>
            <div className="mt-4 space-y-2">
              <label htmlFor="dashboard-rename-title" className="text-xs font-semibold tracking-[0.08em] text-[var(--ui-ink-soft)]">
                보드 제목
              </label>
              <input
                id="dashboard-rename-title"
                type="text"
                value={renameState.titleInput}
                onChange={(event) => setRenameState((prev) => ({ ...prev, titleInput: event.target.value }))}
                className="ui-content-selectable w-full rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-sm text-[var(--ui-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                placeholder="보드 이름을 입력하세요"
              />
              {selectedRenameBoard ? (
                <p className="text-xs text-[var(--theme-text-muted)]">현재 이름: {selectedRenameBoard.title}</p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <DashboardButton type="button" onClick={closeRenameModal} disabled={renameState.isSaving}>
                취소
              </DashboardButton>
              <DashboardButton
                type="button"
                onClick={handleRenameSave}
                disabled={renameState.isSaving}
                data-testid="dashboard-board-rename-save"
                tone="primary"
                className={cn(renameState.isSaving ? "bg-indigo-300" : null)}
              >
                {renameState.isSaving ? "저장 중…" : "저장"}
              </DashboardButton>
            </div>
          </div>
        </DashboardModal>
      ) : null}

      {toasts.length > 0 ? <DashboardToastStack items={toasts} /> : null}
    </div>
  );
}
