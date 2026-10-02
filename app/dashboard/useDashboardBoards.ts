"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assertSchemaVersion } from "@/lib/contracts/assertSchemaVersion";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { normalizeBoardSummary, type DashboardBoardSummary } from "@/lib/data/boards";
import {
  publishDashboardInvalidate,
  subscribeDashboardInvalidate,
  type DashboardInvalidateEvent,
} from "@/lib/dashboard/invalidation";
import { useVisibilityGate } from "@/lib/dashboard/visibility";
import { apiFetch } from "@/lib/http/apiFetch";

import { savePresets, type ClassPreset } from "./presets";
import { buildShareLinkInfo, type ShareLinkInfo } from "./shareLinks";
import { pushDashboardToast } from "./useDashboardToast";

type BoardFetchIssue = {
  code: string;
  requestId?: string;
  status?: number;
  unauthorized?: boolean;
  message?: string;
};

type BoardFetchDegraded = {
  reason: string;
  requestId?: string;
};

type BoardFetchResult = {
  boards: DashboardBoardSummary[];
  droppedCount: number;
  issue: BoardFetchIssue | null;
  degraded: BoardFetchDegraded | null;
};

export type DashboardBoardsState = {
  boards: DashboardBoardSummary[];
  pinnedIds: string[];
  ensuredShareLinks: Record<string, ShareLinkInfo | null>;
  status: {
    phase: "idle" | "syncing" | "error";
    lastOkAt?: number;
    lastErrorAt?: number;
    lastErrorMessage?: string;
    pendingCount: number;
  };
};

type LoadState = "loading" | "ready" | "error";

type RecentOpStatus = "pending" | "ok" | "fail";

type RecentOp = {
  id: string;
  label: string;
  status: RecentOpStatus;
  at: number;
};

type SyncState = "synced" | "syncing" | "failed";

type BoardStatus = "idle" | "syncing" | "failed";

type DashboardMutationType = "create" | "delete" | "pin" | "unpin" | "update_meta" | "presets";

type DashboardMutationBase = {
  id: string;
  type: DashboardMutationType;
  startedAt: number;
  rollbackBase: {
    boards: DashboardBoardSummary[];
    pinnedIds: string[];
  };
};

type DashboardMutation =
  | (DashboardMutationBase & {
      type: "create";
      payload: { tempId: string; board: DashboardBoardSummary };
    })
  | (DashboardMutationBase & {
      type: "delete";
      payload: { boardId: string };
    })
  | (DashboardMutationBase & {
      type: "pin" | "unpin";
      payload: { boardId: string };
    })
  | (DashboardMutationBase & {
      type: "update_meta";
      payload: { boardId: string; patch: Partial<DashboardBoardSummary> };
    })
  | (DashboardMutationBase & {
      type: "presets";
      payload: { count: number };
    });

type OptimisticPatch =
  | { id: string; kind: "create"; board: DashboardBoardSummary; ts: number }
  | { id: string; kind: "update"; boardId: string; changes: Partial<DashboardBoardSummary>; ts: number }
  | { id: string; kind: "delete"; boardId: string; ts: number }
  | { id: string; kind: "share"; boardId: string; shareCode?: string | null; ts: number };

type BoardSnapshot = {
  board: DashboardBoardSummary;
  index: number;
};

type CreateBoardPayload = {
  title: string;
  description?: string | null;
  boardViewType?: string | null;
  classId?: string | null;
};

export type CreateBoardResult =
  | { ok: true; board: DashboardBoardSummary }
  | { ok: false; error?: { message?: string; code?: string }; requestId?: string };

type UpdateBoardPayload = {
  boardId: string;
  title: string;
  description?: string | null;
};

type FailedAction =
  | { type: "create"; tempId: string; payload: CreateBoardPayload }
  | { type: "update"; boardId: string; payload: UpdateBoardPayload; snapshot: BoardSnapshot }
  | { type: "delete"; boardId: string; snapshot: BoardSnapshot | null }
  | { type: "share"; boardId: string; shareCode?: string | null };

type UseDashboardBoardsResult = {
  boards: DashboardBoardSummary[];
  pinnedIds: string[];
  ensuredShareLinks: Record<string, ShareLinkInfo>;
  status: DashboardBoardsState["status"];
  statusByBoardId: Record<string, BoardStatus>;
  failedActionsByBoardId: Record<string, FailedAction>;
  droppedCount: number;
  issue: BoardFetchIssue | null;
  degraded: BoardFetchDegraded | null;
  loadState: LoadState;
  syncState: SyncState;
  lastSyncError?: string;
  lastSyncAt?: number;
  lastRefetchAt?: number | null;
  recentOps: RecentOp[];
  invalidationNotice: boolean;
  externalInvalidationPending: boolean;
  inFlightCount: number;
  clearLastError?: () => void;
  loading: boolean;
  revalidate: () => Promise<void>;
  refetch: (options?: { reason?: string; mode?: "manual" | "invalidation" }) => Promise<void>;
  createBoardOptimistic: (payload: CreateBoardPayload) => Promise<CreateBoardResult>;
  deleteBoardOptimistic: (boardId: string) => Promise<void>;
  pinBoardOptimistic: (boardId: string) => Promise<void>;
  unpinBoardOptimistic: (boardId: string) => Promise<void>;
  updateBoardMetaOptimistic: (boardId: string, patch: Partial<DashboardBoardSummary>) => Promise<void>;
  savePresetsOptimistic: (presets: ClassPreset[]) => void;
  commitCreateBoard: (tempId: string, serverBoard: DashboardBoardSummary) => void;
  rollbackCreateBoard: (tempId: string, error?: unknown) => void;
  deleteBoardOptimisticOnly: (boardId: string) => BoardSnapshot | null;
  rollbackDeleteBoard: (snapshot: BoardSnapshot) => void;
  updateBoardOptimisticOnly: (boardId: string, patch: Partial<DashboardBoardSummary>) => BoardSnapshot | null;
  rollbackUpdateBoard: (snapshot: BoardSnapshot) => void;
  ensureShareOptimistic: (boardId: string) => void;
  actions: {
    createBoard: (input: CreateBoardPayload) => Promise<DashboardBoardSummary | null>;
    deleteBoard: (boardId: string) => Promise<void>;
    updateBoard: (input: UpdateBoardPayload) => Promise<void>;
    ensureShare: (boardId: string, shareCode?: string | null) => Promise<ShareLinkInfo | null>;
    retryBoardAction: (boardId: string) => Promise<void>;
    rollbackFailedDelete: (boardId: string) => void;
    pinBoard: (boardId: string) => Promise<void>;
    unpinBoard: (boardId: string) => Promise<void>;
    movePin: (boardId: string, direction: "up" | "down") => void;
    clearBoardFailure: (boardId: string) => void;
    cacheEnsuredShareLink: (info: ShareLinkInfo) => void;
  };
};

type RevalidateScheduleOptions = {
  reason: string;
  fast: boolean;
  source: "external" | "optimistic";
};

const EXTERNAL_EVENT_COALESCE_MS = 2000;

type ExternalInvalidateControllerOptions = {
  scheduleRevalidate: (options: RevalidateScheduleOptions) => void;
  getVisibilityState: () => "visible" | "hidden";
  onPendingChange?: (pending: boolean) => void;
  onInvalidateVisible?: () => void;
};

export type ExternalInvalidateController = {
  handleEvent: (event: DashboardInvalidateEvent) => void;
  handleVisibilityChange: () => void;
  isPending: () => boolean;
};

export function createExternalInvalidateController(
  options: ExternalInvalidateControllerOptions,
): ExternalInvalidateController {
  let pending = false;
  const lastEventByType = new Map<DashboardInvalidateEvent["type"], number>();

  const setPending = (next: boolean) => {
    if (pending === next) return;
    pending = next;
    options.onPendingChange?.(pending);
  };

  const shouldCoalesce = (event: DashboardInvalidateEvent) => {
    const lastTs = lastEventByType.get(event.type) ?? null;
    if (lastTs !== null && event.ts - lastTs < EXTERNAL_EVENT_COALESCE_MS) {
      lastEventByType.set(event.type, Math.max(lastTs, event.ts));
      return true;
    }
    lastEventByType.set(event.type, event.ts);
    return false;
  };

  const triggerRevalidate = () => {
    options.onInvalidateVisible?.();
    options.scheduleRevalidate({ reason: "broadcast", fast: true, source: "external" });
  };

  return {
    handleEvent: (event) => {
      if (shouldCoalesce(event)) return;
      if (options.getVisibilityState() !== "visible") {
        setPending(true);
        return;
      }
      setPending(false);
      triggerRevalidate();
    },
    handleVisibilityChange: () => {
      if (!pending) return;
      if (options.getVisibilityState() !== "visible") return;
      setPending(false);
      triggerRevalidate();
    },
    isPending: () => pending,
  };
}

function shortMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message.split("\n")[0] ?? fallback;
  }
  if (typeof error === "string") return error;
  return fallback;
}

async function fetchBoards(signal?: AbortSignal): Promise<BoardFetchResult> {
  try {
    const response = await fetch(apiV1Path("dashboard/boards"), { cache: "no-store", signal });

    let payload: unknown = null;
    let parsedJson = false;

    try {
      payload = await response.clone().json();
      parsedJson = true;
    } catch {
      payload = null;
    }

    const code =
      payload && typeof payload === "object" && payload
        ? ("code" in payload && typeof payload.code === "string" ? payload.code : undefined)
        : undefined;
    const requestId =
      payload && typeof payload === "object" && payload
        ? ("requestId" in payload && typeof payload.requestId === "string"
            ? payload.requestId
            : undefined)
        : undefined;
    const message =
      payload && typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : undefined;

    const headerRequestId = response.headers.get("x-request-id") ?? undefined;
    const degraded =
      payload && typeof payload === "object" && payload && "degraded" in payload && payload.degraded === true;
    const degradedReason =
      payload && typeof payload === "object" && payload && "degradedReason" in payload && typeof payload.degradedReason === "string"
        ? payload.degradedReason
        : undefined;
    const resolvedRequestId = requestId ?? headerRequestId;
    if (response.ok) {
      const schemaVersion =
        payload && typeof payload === "object" && payload && "schemaVersion" in payload
          ? (payload as { schemaVersion?: unknown }).schemaVersion
          : undefined;
      assertSchemaVersion(schemaVersion, SCHEMA_VERSIONS.dashboardBoards, {
        endpoint: apiV1Path("dashboard/boards"),
        requestId: resolvedRequestId,
      });
    }

    if (response.ok && payload && typeof payload === "object" && "boards" in payload) {
      const items = Array.isArray((payload as { boards: unknown[] }).boards)
        ? (payload as { boards: unknown[] }).boards
        : [];
      const normalized = items.map((item) => normalizeBoardSummary(item));
      const boards = normalized.filter(
        (board): board is NonNullable<typeof board> => Boolean(board?.boardId),
      );
      const droppedCount = normalized.filter((board) => !board).length;
      return {
        boards,
        droppedCount,
        issue: null,
        degraded: degraded
          ? {
              reason: degradedReason ?? "unknown_degraded",
              requestId: resolvedRequestId,
            }
          : null,
      };
    }

    if (response.status === 401) {
      const issue: BoardFetchIssue = {
        code: code ?? "unauthorized",
        requestId,
        status: response.status,
        unauthorized: true,
        message,
      };
      logFetchFailure(issue);
      return { boards: [], droppedCount: 0, issue, degraded: null };
    }

    if (!parsedJson) {
      const issue: BoardFetchIssue = { code: "non_json_response", status: response.status };
      logFetchFailure(issue);
      return { boards: [], droppedCount: 0, issue, degraded: null };
    }

    const issue: BoardFetchIssue = {
      code: code ?? "unknown_error",
      requestId,
      status: response.status,
      message,
    };
    logFetchFailure(issue);
    return { boards: [], droppedCount: 0, issue, degraded: null };
  } catch (error) {
    const issue: BoardFetchIssue = { code: "network_error", message: shortMessage(error, "network_error") };
    logFetchFailure(issue, error instanceof Error ? error.message : String(error));
    return { boards: [], droppedCount: 0, issue, degraded: null };
  }
}

function logFetchFailure(issue: BoardFetchIssue, message?: string) {
  console.error(
    JSON.stringify(
      {
        level: "error",
        stage: "dashboard_boards_fetch_failed",
        code: issue.code,
        requestId: issue.requestId,
        status: issue.status,
        message: message ?? issue.message,
      },
      (_key, value) => (value === undefined ? undefined : value),
    ),
  );
}

const REVALIDATE_COOLDOWN_MS = 240;
const REFETCH_THROTTLE_MS = 2000;
const REFETCH_DEBOUNCE_MS = 350;
const FAST_REVALIDATE_MAX_DELAY_MS = 50;
const NORMAL_REVALIDATE_MIN_DELAY_MS = 600;
const NORMAL_REVALIDATE_MAX_DELAY_MS = 1200;
const RECENT_OPS_LIMIT = 20;
const OFFLINE_TOAST_COOLDOWN_MS = 6000;
const ERROR_TOAST_COOLDOWN_MS = 5000;
const PIN_STORAGE_KEY = "dashboardPins";

export function shouldThrottleRefetch(lastRefetchAt: number | null, now: number): boolean {
  return lastRefetchAt !== null && now - lastRefetchAt < REFETCH_THROTTLE_MS;
}

export function applyOptimisticPatches(
  serverBoards: DashboardBoardSummary[],
  patches: OptimisticPatch[],
): DashboardBoardSummary[] {
  let next = [...serverBoards];

  for (const patch of patches) {
    if (patch.kind === "create") {
      next = [patch.board, ...next.filter((board) => board.boardId !== patch.board.boardId)];
      continue;
    }

    if (patch.kind === "delete") {
      next = next.filter((board) => board.boardId !== patch.boardId);
      continue;
    }

    if (patch.kind === "update") {
      next = next.map((board) =>
        board.boardId === patch.boardId ? { ...board, ...patch.changes } : board,
      );
      continue;
    }

    if (patch.kind === "share") {
      next = next.map((board) =>
        board.boardId === patch.boardId
          ? {
              ...board,
              ...(patch.shareCode !== undefined ? { shareCode: patch.shareCode } : {}),
              ...(patch.shareCode !== undefined ? { shareEnabled: Boolean(patch.shareCode) } : {}),
            }
          : board,
      );
    }
  }

  return next;
}

export function applyDashboardMutations(
  base: Pick<DashboardBoardsState, "boards" | "pinnedIds">,
  mutations: DashboardMutation[],
): Pick<DashboardBoardsState, "boards" | "pinnedIds"> {
  let nextBoards = [...base.boards];
  let nextPinned = [...base.pinnedIds];

  for (const mutation of mutations) {
    if (mutation.type === "create") {
      const board = mutation.payload.board;
      nextBoards = [board, ...nextBoards.filter((item) => item.boardId !== board.boardId)];
      continue;
    }

    if (mutation.type === "delete") {
      nextBoards = nextBoards.filter((board) => board.boardId !== mutation.payload.boardId);
      nextPinned = nextPinned.filter((id) => id !== mutation.payload.boardId);
      continue;
    }

    if (mutation.type === "update_meta") {
      nextBoards = nextBoards.map((board) =>
        board.boardId === mutation.payload.boardId ? { ...board, ...mutation.payload.patch } : board,
      );
      continue;
    }

    if (mutation.type === "pin") {
      if (!nextPinned.includes(mutation.payload.boardId)) {
        nextPinned = [mutation.payload.boardId, ...nextPinned];
      }
      continue;
    }

    if (mutation.type === "unpin") {
      nextPinned = nextPinned.filter((id) => id !== mutation.payload.boardId);
    }
    if (mutation.type === "presets") {
      continue;
    }
  }

  return { boards: nextBoards, pinnedIds: nextPinned };
}

function readPinnedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

function persistPinnedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export function useDashboardBoards(): UseDashboardBoardsResult {
  const [boards, setBoards] = useState<DashboardBoardSummary[]>([]);
  const boardsRef = useRef<DashboardBoardSummary[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedIds());
  const pinnedIdsRef = useRef<string[]>(readPinnedIds());
  const [ensuredShareLinks, setEnsuredShareLinks] = useState<Record<string, ShareLinkInfo>>({});
  const [status, setStatus] = useState<DashboardBoardsState["status"]>({
    phase: "idle",
    pendingCount: 0,
  });
  const [statusByBoardId, setStatusByBoardId] = useState<Record<string, BoardStatus>>({});
  const statusByBoardIdRef = useRef<Record<string, BoardStatus>>({});
  const [failedActionsByBoardId, setFailedActionsByBoardId] = useState<Record<string, FailedAction>>({});
  const failedActionsRef = useRef<Record<string, FailedAction>>({});
  const [inFlightCount, setInFlightCount] = useState(0);
  const [droppedCount, setDroppedCount] = useState(0);
  const [issue, setIssue] = useState<BoardFetchIssue | null>(null);
  const [degraded, setDegraded] = useState<BoardFetchDegraded | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [lastSyncError, setLastSyncError] = useState<string | undefined>(undefined);
  const [lastSyncAt, setLastSyncAt] = useState<number | undefined>(undefined);
  const [lastRefetchAt, setLastRefetchAt] = useState<number | null>(null);
  const [recentOps, setRecentOps] = useState<RecentOp[]>([]);
  const [invalidationNotice, setInvalidationNotice] = useState(false);
  const [externalInvalidationPending, setExternalInvalidationPending] = useState(false);
  const externalInvalidationPendingRef = useRef(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const fetchInFlight = useRef<AbortController | null>(null);
  const revalidatePromiseRef = useRef<Promise<void> | null>(null);
  const cooldownRef = useRef<number | null>(null);
  const offlineToastAtRef = useRef<number | null>(null);
  const lastRefetchAtRef = useRef<number | null>(null);
  const invalidationTimerRef = useRef<number | null>(null);
  const scheduledRefetchRef = useRef<number | null>(null);
  const debouncedRefetchRef = useRef<number | null>(null);
  const debouncedReasonRef = useRef<string | null>(null);
  const queuedRefetchRef = useRef<string | null>(null);
  const errorToastAtRef = useRef<number | null>(null);
  const pendingReasonRef = useRef<string | null>(null);
  const pendingMutationRefetchRef = useRef<number | null>(null);
  const scheduledRevalidateRef = useRef<number | null>(null);
  const scheduledRevalidateOptionsRef = useRef<RevalidateScheduleOptions | null>(null);
  const revalidatePendingRef = useRef(false);
  const baseSnapshotRef = useRef<Pick<DashboardBoardsState, "boards" | "pinnedIds">>({
    boards: [],
    pinnedIds: readPinnedIds(),
  });
  const pendingMutationsRef = useRef<DashboardMutation[]>([]);
  const { visible, online, pendingInvalidationRef, markPending, clearPending } = useVisibilityGate();

  const setBoardsState = useCallback((nextBoards: DashboardBoardSummary[]) => {
    setBoards(nextBoards);
    boardsRef.current = nextBoards;
  }, []);

  const setPinnedIdsState = useCallback((nextIds: string[]) => {
    setPinnedIds(nextIds);
    pinnedIdsRef.current = nextIds;
    persistPinnedIds(nextIds);
  }, []);

  const updatePinnedIds = useCallback((updater: (current: string[]) => string[]) => {
    setPinnedIds((current) => {
      const next = updater(current);
      pinnedIdsRef.current = next;
      persistPinnedIds(next);
      if (pendingMutationsRef.current.length === 0) {
        baseSnapshotRef.current = {
          ...baseSnapshotRef.current,
          pinnedIds: next,
        };
      }
      return next;
    });
  }, []);

  const updateBoards = useCallback(
    (updater: DashboardBoardSummary[] | ((prev: DashboardBoardSummary[]) => DashboardBoardSummary[])) => {
      setBoards((current) => {
        const next =
          typeof updater === "function"
            ? (updater as (c: DashboardBoardSummary[]) => DashboardBoardSummary[])(current)
            : updater;
        boardsRef.current = next;
        return next;
      });
    },
    [],
  );

  const applyPendingMutations = useCallback(
    (mutations: DashboardMutation[] = pendingMutationsRef.current) => {
      const derived = applyDashboardMutations(baseSnapshotRef.current, mutations);
      setBoardsState(derived.boards);
      setPinnedIdsState(derived.pinnedIds);
    },
    [setBoardsState, setPinnedIdsState],
  );

  const commitBaseSnapshot = useCallback(
    (
      updater: (
        base: Pick<DashboardBoardsState, "boards" | "pinnedIds">,
      ) => Pick<DashboardBoardsState, "boards" | "pinnedIds">,
    ) => {
      baseSnapshotRef.current = updater(baseSnapshotRef.current);
      applyPendingMutations();
    },
    [applyPendingMutations],
  );

  const updateStatus = useCallback((boardId: string, status: BoardStatus) => {
    setStatusByBoardId((current) => {
      if (status === "idle") {
        if (!current[boardId]) return current;
        const next = { ...current };
        delete next[boardId];
        return next;
      }
      if (current[boardId] === status) return current;
      return { ...current, [boardId]: status };
    });
  }, []);

  const updateFailedAction = useCallback((boardId: string, action: FailedAction | null) => {
    setFailedActionsByBoardId((current) => {
      if (!action) {
        if (!current[boardId]) return current;
        const next = { ...current };
        delete next[boardId];
        return next;
      }
      return { ...current, [boardId]: action };
    });
  }, []);

  useEffect(() => {
    statusByBoardIdRef.current = statusByBoardId;
  }, [statusByBoardId]);

  useEffect(() => {
    failedActionsRef.current = failedActionsByBoardId;
  }, [failedActionsByBoardId]);

  const appendRecentOp = useCallback((entry: RecentOp) => {
    setRecentOps((current) => [entry, ...current].slice(0, RECENT_OPS_LIMIT));
  }, []);

  const updateRecentOpStatus = useCallback((id: string, status: RecentOpStatus) => {
    setRecentOps((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
    );
  }, []);

  const isOffline = useCallback(() => {
    if (typeof window === "undefined") return false;
    return navigator.onLine === false;
  }, []);

  const notifyOffline = useCallback((message: string) => {
    const now = Date.now();
    if (!offlineToastAtRef.current || now - offlineToastAtRef.current > OFFLINE_TOAST_COOLDOWN_MS) {
      offlineToastAtRef.current = now;
      pushDashboardToast({ title: message });
    }
  }, []);

  const notifySyncFailure = useCallback((title: string, error: unknown) => {
    const now = Date.now();
    const message = shortMessage(error, title);
    setLastSyncError(message);
    if (!errorToastAtRef.current || now - errorToastAtRef.current > ERROR_TOAST_COOLDOWN_MS) {
      errorToastAtRef.current = now;
      pushDashboardToast({ title, description: message });
    }
  }, []);

  const incrementInFlight = useCallback(() => {
    setInFlightCount((current) => current + 1);
  }, []);

  const decrementInFlight = useCallback(() => {
    setInFlightCount((current) => (current > 0 ? current - 1 : 0));
  }, []);

  const finishCooldown = useCallback(() => {
    if (cooldownRef.current) {
      window.clearTimeout(cooldownRef.current);
      cooldownRef.current = null;
    }
  }, []);

  const revalidate = useCallback(async () => {
    if (isOffline()) {
      notifyOffline("오프라인 상태예요. 온라인이 되면 자동 동기화할게요.");
      return Promise.resolve();
    }

    if (revalidatePromiseRef.current) {
      return revalidatePromiseRef.current;
    }

    if (cooldownRef.current) {
      return revalidatePromiseRef.current ?? Promise.resolve();
    }

    finishCooldown();

    if (fetchInFlight.current) {
      fetchInFlight.current.abort();
    }

    const controller = new AbortController();
    fetchInFlight.current = controller;

    const promise = (async () => {
      setIsRevalidating(true);
      const result = await fetchBoards(controller.signal);

      if (!controller.signal.aborted) {
        commitBaseSnapshot((base) => ({
          boards: result.boards,
          pinnedIds: base.pinnedIds,
        }));
        setDroppedCount(result.droppedCount);
        setIssue(result.issue);
        setDegraded(result.issue ? null : result.degraded);
        setLoadState(result.issue ? "error" : "ready");
        if (result.issue) {
          setLastSyncError(result.issue.message ?? result.issue.code);
          setStatus((current) => ({
            ...current,
            phase: "error",
            lastErrorAt: Date.now(),
            lastErrorMessage: result.issue?.message ?? result.issue?.code,
          }));
        } else {
          setLastSyncError(undefined);
          setLastSyncAt(Date.now());
          setStatus((current) => ({
            ...current,
            phase: current.pendingCount > 0 ? "syncing" : "idle",
            lastOkAt: Date.now(),
            lastErrorMessage: undefined,
          }));
        }
        fetchInFlight.current = null;
      }
    })().finally(() => {
      setIsRevalidating(false);
      revalidatePromiseRef.current = null;
      cooldownRef.current = window.setTimeout(() => {
        cooldownRef.current = null;
      }, REVALIDATE_COOLDOWN_MS);
    });

    revalidatePromiseRef.current = promise;
    return promise;
  }, [commitBaseSnapshot, finishCooldown, isOffline, notifyOffline]);

  const refetchNow = useCallback(async () => {
    const now = Date.now();
    if (shouldThrottleRefetch(lastRefetchAtRef.current, now)) {
      return;
    }
    lastRefetchAtRef.current = now;
    setLastRefetchAt(now);
    await revalidate();
  }, [revalidate]);

  const showInvalidationNotice = useCallback(() => {
    setInvalidationNotice(true);
    if (invalidationTimerRef.current) {
      window.clearTimeout(invalidationTimerRef.current);
    }
    invalidationTimerRef.current = window.setTimeout(() => {
      invalidationTimerRef.current = null;
      setInvalidationNotice(false);
    }, 1000);
  }, []);

  const scheduleThrottledRefetch = useCallback(
    (reason: string, now: number) => {
      pendingInvalidationRef.current = true;
      pendingReasonRef.current = reason;
      showInvalidationNotice();

      const remaining =
        lastRefetchAtRef.current === null
          ? 0
          : Math.max(0, REFETCH_THROTTLE_MS - (now - lastRefetchAtRef.current));
      const delay = Math.max(1000, remaining);

      if (scheduledRefetchRef.current) return;
      scheduledRefetchRef.current = window.setTimeout(() => {
        scheduledRefetchRef.current = null;
        const nextReason = pendingReasonRef.current ?? reason;
        pendingReasonRef.current = null;
        const nowVisible = typeof document === "undefined" ? true : document.visibilityState === "visible";
        const nowOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
        if (!nowVisible || !nowOnline) {
          pendingInvalidationRef.current = true;
          pendingReasonRef.current = nextReason;
          return;
        }
        pendingInvalidationRef.current = false;
        void refetchNow();
      }, delay);
    },
    [pendingInvalidationRef, refetchNow, showInvalidationNotice],
  );

  const performRefetch = useCallback(
    (reason: string) => {
      const now = Date.now();
      if (shouldThrottleRefetch(lastRefetchAtRef.current, now)) {
        scheduleThrottledRefetch(reason, now);
        return;
      }
      pendingReasonRef.current = null;
      clearPending();
      void refetchNow();
    },
    [clearPending, refetchNow, scheduleThrottledRefetch],
  );

  const scheduleDebouncedRefetch = useCallback(
    (reason: string) => {
      debouncedReasonRef.current = reason;
      if (debouncedRefetchRef.current) return;
      debouncedRefetchRef.current = window.setTimeout(() => {
        debouncedRefetchRef.current = null;
        const nextReason = debouncedReasonRef.current ?? reason;
        debouncedReasonRef.current = null;
        performRefetch(nextReason);
      }, REFETCH_DEBOUNCE_MS);
    },
    [performRefetch],
  );

  const requestRefetch = useCallback(
    (reason: string) => {
      if (!visible || !online) {
        pendingReasonRef.current = reason;
        markPending();
        return;
      }
      scheduleDebouncedRefetch(reason);
    },
    [markPending, online, scheduleDebouncedRefetch, visible],
  );

  const refetch = useCallback(
    async (options?: { reason?: string; mode?: "manual" | "invalidation" }) => {
      const reason = options?.reason ?? "manual";
      if (options?.mode === "invalidation" && inFlightCount > 0) {
        queuedRefetchRef.current = reason;
        pendingReasonRef.current = reason;
        markPending();
        return;
      }
      requestRefetch(reason);
    },
    [inFlightCount, markPending, requestRefetch],
  );

  const scheduleDelayedRefetch = useCallback(
    (delayMs: number, reason: string) => {
      if (pendingMutationRefetchRef.current) {
        window.clearTimeout(pendingMutationRefetchRef.current);
      }
      pendingMutationRefetchRef.current = window.setTimeout(() => {
        pendingMutationRefetchRef.current = null;
        requestRefetch(reason);
      }, delayMs);
    },
    [requestRefetch],
  );

  const mergeRevalidateOptions = useCallback(
    (next: RevalidateScheduleOptions) => {
      const existing = scheduledRevalidateOptionsRef.current;
      if (!existing) return next;
      return {
        reason: next.reason,
        fast: existing.fast || next.fast,
        source: existing.source === "external" || next.source === "external" ? "external" : "optimistic",
      } satisfies RevalidateScheduleOptions;
    },
    [],
  );

  const pickRevalidateDelay = useCallback((fast: boolean) => {
    if (fast) {
      return Math.floor(Math.random() * (FAST_REVALIDATE_MAX_DELAY_MS + 1));
    }
    const range = NORMAL_REVALIDATE_MAX_DELAY_MS - NORMAL_REVALIDATE_MIN_DELAY_MS;
    return NORMAL_REVALIDATE_MIN_DELAY_MS + Math.floor(Math.random() * (range + 1));
  }, []);

  const scheduleRevalidate = useCallback(
    (options?: Partial<RevalidateScheduleOptions>) => {
      const normalized: RevalidateScheduleOptions = {
        reason: options?.reason ?? "optimistic",
        fast: options?.fast ?? false,
        source: options?.source ?? "optimistic",
      };

      if (revalidatePromiseRef.current) {
        revalidatePendingRef.current = true;
        scheduledRevalidateOptionsRef.current = mergeRevalidateOptions(normalized);
        return;
      }

      if (scheduledRevalidateRef.current) {
        scheduledRevalidateOptionsRef.current = mergeRevalidateOptions(normalized);
        return;
      }

      scheduledRevalidateOptionsRef.current = normalized;
      scheduledRevalidateRef.current = window.setTimeout(() => {
        scheduledRevalidateRef.current = null;
        const nextOptions = scheduledRevalidateOptionsRef.current ?? normalized;
        scheduledRevalidateOptionsRef.current = null;
        if (revalidatePromiseRef.current) {
          revalidatePendingRef.current = true;
          scheduledRevalidateOptionsRef.current = nextOptions;
          return;
        }
        if (nextOptions.source === "external") {
          const nowVisible = typeof document === "undefined" ? true : document.visibilityState === "visible";
          if (!nowVisible) {
            externalInvalidationPendingRef.current = true;
            setExternalInvalidationPending(true);
            return;
          }
        }
        void revalidate();
      }, pickRevalidateDelay(normalized.fast));
    },
    [mergeRevalidateOptions, pickRevalidateDelay, revalidate],
  );

  useEffect(() => {
    if (isRevalidating) return;
    if (!revalidatePendingRef.current) return;
    revalidatePendingRef.current = false;
    const nextOptions = scheduledRevalidateOptionsRef.current ?? {
      reason: "pending",
      fast: true,
      source: "external",
    };
    scheduledRevalidateOptionsRef.current = null;
    scheduleRevalidate(nextOptions);
  }, [isRevalidating, scheduleRevalidate]);

  const externalInvalidateControllerRef = useRef<ExternalInvalidateController | null>(null);
  if (!externalInvalidateControllerRef.current) {
    externalInvalidateControllerRef.current = createExternalInvalidateController({
      scheduleRevalidate,
      getVisibilityState: () =>
        typeof document === "undefined" ? "visible" : (document.visibilityState as "visible" | "hidden"),
      onPendingChange: (pending) => {
        externalInvalidationPendingRef.current = pending;
        setExternalInvalidationPending(pending);
      },
      onInvalidateVisible: () => {
        if (pendingMutationsRef.current.length > 0) return;
        showInvalidationNotice();
      },
    });
  }

  useEffect(() => {
    const controller = externalInvalidateControllerRef.current;
    if (!controller) return () => {};
    const unsubscribe = subscribeDashboardInvalidate((event) => {
      controller.handleEvent(event);
    });
    const handleVisibility = () => {
      controller.handleVisibilityChange();
      if (
        externalInvalidationPendingRef.current &&
        (typeof document === "undefined" ? true : document.visibilityState === "visible")
      ) {
        externalInvalidationPendingRef.current = false;
        setExternalInvalidationPending(false);
        scheduleRevalidate({ reason: "broadcast", fast: true, source: "external" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scheduleRevalidate]);

  const beginMutation = useCallback(
    <T extends DashboardMutation>(
      mutation: Omit<T, "startedAt" | "rollbackBase">,
    ) => {
      const entry = {
        ...mutation,
        startedAt: Date.now(),
        rollbackBase: {
          boards: [...baseSnapshotRef.current.boards],
          pinnedIds: [...baseSnapshotRef.current.pinnedIds],
        },
      } as T;
      pendingMutationsRef.current = [...pendingMutationsRef.current, entry];
      setStatus((current) => ({
        ...current,
        phase: "syncing",
        pendingCount: current.pendingCount + 1,
      }));
      applyPendingMutations(pendingMutationsRef.current);
      return entry;
    },
    [applyPendingMutations],
  );

  const finishMutationSuccess = useCallback(
    (
      mutationId: string,
      commitBase: (
        base: Pick<DashboardBoardsState, "boards" | "pinnedIds">,
      ) => Pick<DashboardBoardsState, "boards" | "pinnedIds">,
    ) => {
      pendingMutationsRef.current = pendingMutationsRef.current.filter((mutation) => mutation.id !== mutationId);
      commitBaseSnapshot(commitBase);
      setStatus((current) => {
        const nextCount = Math.max(0, current.pendingCount - 1);
        return {
          ...current,
          pendingCount: nextCount,
          phase: nextCount > 0 ? "syncing" : "idle",
          lastOkAt: Date.now(),
          lastErrorMessage: undefined,
        };
      });
    },
    [commitBaseSnapshot],
  );

  const finishMutationFailure = useCallback(
    (mutationId: string, message: string) => {
      pendingMutationsRef.current = pendingMutationsRef.current.filter((mutation) => mutation.id !== mutationId);
      applyPendingMutations(pendingMutationsRef.current);
      setStatus((current) => ({
        ...current,
        pendingCount: Math.max(0, current.pendingCount - 1),
        phase: "error",
        lastErrorAt: Date.now(),
        lastErrorMessage: message,
      }));
    },
    [applyPendingMutations],
  );

  useEffect(() => {
    void revalidate();

    return () => {
      finishCooldown();
      if (fetchInFlight.current) {
        fetchInFlight.current.abort();
      }
    };
  }, [finishCooldown, revalidate]);

  useEffect(() => {
    if (!visible || !online) return;
    if (inFlightCount > 0) return;
    if (!pendingInvalidationRef.current) return;
    const reason = pendingReasonRef.current ?? "became_visible";
    pendingReasonRef.current = null;
    clearPending();
    requestRefetch(reason);
  }, [clearPending, inFlightCount, online, pendingInvalidationRef, requestRefetch, visible]);

  useEffect(() => {
    if (inFlightCount > 0) return;
    if (!queuedRefetchRef.current) return;
    const reason = queuedRefetchRef.current;
    queuedRefetchRef.current = null;
    if (visible && online) {
      pendingReasonRef.current = null;
      clearPending();
    }
    requestRefetch(reason);
  }, [clearPending, inFlightCount, online, requestRefetch, visible]);

  useEffect(() => {
    return () => {
      if (invalidationTimerRef.current) {
        window.clearTimeout(invalidationTimerRef.current);
        invalidationTimerRef.current = null;
      }
      if (scheduledRefetchRef.current) {
        window.clearTimeout(scheduledRefetchRef.current);
        scheduledRefetchRef.current = null;
      }
      if (debouncedRefetchRef.current) {
        window.clearTimeout(debouncedRefetchRef.current);
        debouncedRefetchRef.current = null;
      }
      if (pendingMutationRefetchRef.current) {
        window.clearTimeout(pendingMutationRefetchRef.current);
        pendingMutationRefetchRef.current = null;
      }
      if (scheduledRevalidateRef.current) {
        window.clearTimeout(scheduledRevalidateRef.current);
        scheduledRevalidateRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (boards.length === 0) return;
    const boardIds = boards
      .map((board) => board.boardId)
      .filter((id): id is string => Boolean(id));
    updatePinnedIds((current) => {
      const deduped = current.filter((id) => boardIds.includes(id));
      return deduped;
    });
  }, [boards, updatePinnedIds]);

  useEffect(() => {
    setEnsuredShareLinks((current) => {
      if (Object.keys(current).length === 0) return current;
      const next: Record<string, ShareLinkInfo> = {};
      boards.forEach((board) => {
        if (board.boardId && current[board.boardId]) {
          next[board.boardId] = current[board.boardId];
        }
      });
      return next;
    });
  }, [boards]);

  useEffect(() => {
    setStatusByBoardId((current) => {
      if (Object.keys(current).length === 0) return current;
      const activeIds = new Set(boards.map((board) => board.boardId).filter(Boolean));
      const next: Record<string, BoardStatus> = {};
      let changed = false;
      Object.entries(current).forEach(([boardId, status]) => {
        if (activeIds.has(boardId)) {
          next[boardId] = status;
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [boards]);

  const clearLastError = useCallback(() => {
    setLastSyncError(undefined);
    setStatus((current) => ({
      ...current,
      phase: current.pendingCount > 0 ? "syncing" : "idle",
      lastErrorMessage: undefined,
    }));
  }, []);

  const syncState = useMemo<SyncState>(() => {
    if (status.phase === "error" || lastSyncError) return "failed";
    if (status.pendingCount > 0 || inFlightCount > 0 || isRevalidating) return "syncing";
    return "synced";
  }, [inFlightCount, isRevalidating, lastSyncError, status.pendingCount, status.phase]);

  const commitCreateBoard = useCallback(
    (tempId: string, serverBoard: DashboardBoardSummary) => {
      updateBoards((current) => {
        const next = [...current];
        const index = next.findIndex((board) => board.boardId === tempId);
        if (index >= 0) {
          next[index] = serverBoard;
        } else {
          next.unshift(serverBoard);
        }
        return next;
      });
      updateStatus(tempId, "idle");
      if (serverBoard.boardId) {
        updateStatus(serverBoard.boardId, "idle");
      }
      updateFailedAction(tempId, null);
      if (serverBoard.boardId) {
        updateFailedAction(serverBoard.boardId, null);
      }
    },
    [updateBoards, updateFailedAction, updateStatus],
  );

  const rollbackCreateBoard = useCallback(
    (tempId: string, error?: unknown) => {
      updateStatus(tempId, "failed");
      if (error) {
        setLastSyncError(shortMessage(error, "보드 생성에 실패했습니다."));
      }
    },
    [setLastSyncError, updateStatus],
  );

  const deleteBoardOptimisticOnly = useCallback(
    (boardId: string) => {
      const currentBoards = boardsRef.current;
      const index = currentBoards.findIndex((board) => board.boardId === boardId);
      if (index === -1) return null;
      const snapshot = { board: currentBoards[index], index } satisfies BoardSnapshot;
      updateBoards((current) => current.filter((board) => board.boardId !== boardId));
      updateStatus(boardId, "syncing");
      updateFailedAction(boardId, { type: "delete", boardId, snapshot });
      incrementInFlight();
      return snapshot;
    },
    [incrementInFlight, updateBoards, updateFailedAction, updateStatus],
  );

  const rollbackDeleteBoard = useCallback((snapshot: BoardSnapshot) => {
    updateBoards((current) => {
      if (current.some((board) => board.boardId === snapshot.board.boardId)) return current;
      const next = [...current];
      const index = Math.min(Math.max(snapshot.index, 0), next.length);
      next.splice(index, 0, snapshot.board);
      return next;
    });
  }, [updateBoards]);

  const updateBoardOptimisticOnly = useCallback(
    (boardId: string, patch: Partial<DashboardBoardSummary>) => {
      const currentBoards = boardsRef.current;
      const index = currentBoards.findIndex((board) => board.boardId === boardId);
      if (index === -1) return null;
      const snapshot = { board: currentBoards[index], index } satisfies BoardSnapshot;
      updateBoards((current) =>
        current.map((board) => (board.boardId === boardId ? { ...board, ...patch } : board)),
      );
      updateStatus(boardId, "syncing");
      incrementInFlight();
      return snapshot;
    },
    [incrementInFlight, updateBoards, updateStatus],
  );

  const rollbackUpdateBoard = useCallback(
    (snapshot: BoardSnapshot) => {
      updateBoards((current) =>
        current.map((board) => (board.boardId === snapshot.board.boardId ? snapshot.board : board)),
      );
    },
    [updateBoards],
  );

  const ensureShareOptimistic = useCallback(
    (boardId: string) => {
      updateStatus(boardId, "syncing");
      incrementInFlight();
    },
    [incrementInFlight, updateStatus],
  );

  const movePin = useCallback((boardId: string, direction: "up" | "down") => {
    updatePinnedIds((current) => {
      const index = current.indexOf(boardId);
      if (index === -1) return current;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }, [updatePinnedIds]);

  const clearBoardFailure = useCallback(
    (boardId: string) => {
      updateStatus(boardId, "idle");
      updateFailedAction(boardId, null);
    },
    [updateFailedAction, updateStatus],
  );

  const cacheEnsuredShareLink = useCallback((info: ShareLinkInfo) => {
    setEnsuredShareLinks((current) => ({ ...current, [info.boardId]: info }));
  }, []);

  const performCreateBoard = useCallback(
    async (input: CreateBoardPayload, options?: { tempId?: string }) => {
      if (isOffline()) {
        const message = "오프라인 상태라 변경을 저장할 수 없어요. 온라인에서 다시 시도해 주세요.";
        notifyOffline(message);
        throw new Error(message);
      }
      const normalizedTitle = input.title.trim();
      const tempId = options?.tempId ?? `temp:${crypto.randomUUID()}`;
      const optimisticBoard: DashboardBoardSummary = {
        boardId: tempId,
        title: normalizedTitle || "새 보드",
        description: input.description ?? null,
        created_at: new Date().toISOString(),
        board_view_type: input.boardViewType === "wall" ? "wall" : "grid",
        // @ts-expect-error - optimistic flag for UI only
        __optimistic: true,
      };
      const mutation = beginMutation({
        id: crypto.randomUUID(),
        type: "create",
        payload: { tempId, board: optimisticBoard },
      });
      updateStatus(tempId, "syncing");
      updateFailedAction(tempId, { type: "create", tempId, payload: input });
      incrementInFlight();

      const opId = crypto.randomUUID();
      appendRecentOp({ id: opId, label: "보드 생성", status: "pending", at: Date.now() });

      try {
        const response = await apiFetch(apiV1Path("dashboard/boards"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: normalizedTitle,
            description: input.description ?? null,
            boardViewType: input.boardViewType ?? "grid",
            classId: input.classId ?? null,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              board?: unknown;
              code?: string;
              message?: string;
              error?: { code?: string; message?: string } | string;
              requestId?: string;
            }
          | null;

        const requestId =
          payload && typeof payload === "object" && typeof payload.requestId === "string"
            ? payload.requestId
            : undefined;

        if (!response.ok || payload?.ok === false) {
          const nestedError =
            payload && typeof payload === "object" && payload.error && typeof payload.error === "object"
              ? payload.error
              : null;
          const message =
            payload && typeof payload === "object" && typeof payload.message === "string"
              ? payload.message
              : nestedError && typeof nestedError.message === "string"
                ? nestedError.message
                : payload && typeof payload === "object" && typeof payload.error === "string"
                  ? payload.error
                : "보드 생성에 실패했습니다.";
          const code =
            payload && typeof payload === "object" && typeof payload.code === "string"
              ? payload.code
              : nestedError && typeof nestedError.code === "string"
                ? nestedError.code
              : undefined;
          const error = new Error(message) as Error & { requestId?: string; code?: string };
          error.requestId = requestId;
          error.code = code;
          throw error;
        }

        const normalizedBoard = normalizeBoardSummary(payload?.board) ?? null;
        if (!normalizedBoard) {
          const error = new Error("보드 정보를 불러오지 못했습니다.") as Error & {
            requestId?: string;
            code?: string;
          };
          error.requestId = requestId;
          throw error;
        }

        finishMutationSuccess(mutation.id, (base) => ({
          ...base,
          boards: [
            normalizedBoard,
            ...base.boards.filter(
              (board) => board.boardId !== tempId && board.boardId !== normalizedBoard.boardId,
            ),
          ],
        }));
        updateRecentOpStatus(opId, "ok");
        updateStatus(tempId, "idle");
        if (normalizedBoard.boardId) {
          updateStatus(normalizedBoard.boardId, "idle");
          updateFailedAction(normalizedBoard.boardId, null);
        }
        updateFailedAction(tempId, null);
        setLastSyncError(undefined);
        setLastSyncAt(Date.now());
        publishDashboardInvalidate({
          type: "boards_changed",
          reason: "created",
          ts: Date.now(),
        });
        scheduleRevalidate();
        return normalizedBoard;
      } catch (error) {
        const message = shortMessage(error, "보드 생성에 실패했습니다.");
        const requestId =
          typeof error === "object" && error && "requestId" in error && typeof error.requestId === "string"
            ? error.requestId
            : undefined;
        const code =
          typeof error === "object" && error && "code" in error && typeof error.code === "string"
            ? error.code
            : undefined;
        finishMutationFailure(mutation.id, message);
        updateRecentOpStatus(opId, "fail");
        updateStatus(tempId, "failed");
        updateFailedAction(tempId, { type: "create", tempId, payload: input });
        notifySyncFailure("보드 생성 실패 — 네트워크/권한을 확인하세요", error);
        const finalError = new Error(message) as Error & { requestId?: string; code?: string };
        finalError.requestId = requestId;
        finalError.code = code;
        throw finalError;
      } finally {
        decrementInFlight();
      }
    },
    [
      appendRecentOp,
      beginMutation,
      decrementInFlight,
      finishMutationFailure,
      finishMutationSuccess,
      incrementInFlight,
      isOffline,
      notifyOffline,
      notifySyncFailure,
      scheduleRevalidate,
      updateFailedAction,
      updateRecentOpStatus,
      updateStatus,
    ],
  );

  const createBoard = useCallback(
    async (input: CreateBoardPayload) => performCreateBoard(input),
    [performCreateBoard],
  );

  const deleteBoardMutation = useCallback(
    async (boardId: string) => {
      if (isOffline()) {
        const message = "오프라인 상태라 변경을 저장할 수 없어요. 온라인에서 다시 시도해 주세요.";
        notifyOffline(message);
        throw new Error(message);
      }
      const targetId = boardId.trim();
      if (!targetId) {
        throw new Error("보드 ID가 올바르지 않습니다.");
      }
      const mutation = beginMutation({
        id: crypto.randomUUID(),
        type: "delete",
        payload: { boardId: targetId },
      });
      const snapshot = deleteBoardOptimisticOnly(targetId);
      if (!snapshot) {
        updateStatus(targetId, "syncing");
        updateFailedAction(targetId, { type: "delete", boardId: targetId, snapshot: null });
        incrementInFlight();
      }

      const opId = crypto.randomUUID();
      appendRecentOp({ id: opId, label: "보드 삭제", status: "pending", at: Date.now() });

      try {
        const response = await apiFetch(apiV1Path(`dashboard/boards/${targetId}`), { method: "DELETE" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | {
                error?: { message?: string } | string;
                message?: string;
              }
            | null;
          const nestedError =
            payload && typeof payload === "object" && payload.error && typeof payload.error === "object"
              ? payload.error
              : null;
          const message =
            payload && typeof payload === "object" && typeof payload.error === "string"
              ? payload.error
              : nestedError && typeof nestedError.message === "string"
                ? nestedError.message
                : payload && typeof payload === "object" && typeof payload.message === "string"
                  ? payload.message
                  : "보드를 삭제하지 못했습니다.";
          throw new Error(message);
        }

        finishMutationSuccess(mutation.id, (base) => ({
          ...base,
          boards: base.boards.filter((board) => board.boardId !== targetId),
          pinnedIds: base.pinnedIds.filter((id) => id !== targetId),
        }));
        updateRecentOpStatus(opId, "ok");
        updateStatus(targetId, "idle");
        updateFailedAction(targetId, null);
        setLastSyncError(undefined);
        setLastSyncAt(Date.now());
        publishDashboardInvalidate({
          type: "boards_changed",
          reason: "deleted",
          ts: Date.now(),
        });
        scheduleRevalidate();
      } catch (error) {
        const message = shortMessage(error, "삭제에 실패했습니다.");
        finishMutationFailure(mutation.id, message);
        if (snapshot) {
          rollbackDeleteBoard(snapshot);
        }
        updateRecentOpStatus(opId, "fail");
        updateStatus(targetId, "failed");
        updateFailedAction(targetId, { type: "delete", boardId: targetId, snapshot });
        notifySyncFailure("삭제 실패 — 다시 시도하세요", error);
        throw new Error(message);
      } finally {
        decrementInFlight();
      }
    },
    [
      appendRecentOp,
      beginMutation,
      decrementInFlight,
      deleteBoardOptimisticOnly,
      finishMutationFailure,
      finishMutationSuccess,
      incrementInFlight,
      isOffline,
      notifyOffline,
      notifySyncFailure,
      rollbackDeleteBoard,
      scheduleRevalidate,
      updateFailedAction,
      updateRecentOpStatus,
      updateStatus,
    ],
  );

  const updateBoardMutation = useCallback(
    async (input: UpdateBoardPayload) => {
      if (isOffline()) {
        notifyOffline("오프라인 상태라 변경을 저장할 수 없어요. 온라인에서 다시 시도해 주세요.");
        return Promise.resolve();
      }
      const normalizedTitle = input.title.trim();
      if (!normalizedTitle) return;
      const targetId = input.boardId.trim();

      const mutation = beginMutation({
        id: crypto.randomUUID(),
        type: "update_meta",
        payload: { boardId: targetId, patch: { title: normalizedTitle, description: input.description ?? null } },
      });
      const snapshot = updateBoardOptimisticOnly(targetId, {
        title: normalizedTitle,
        description: input.description ?? null,
      });
      if (!snapshot) {
        finishMutationFailure(mutation.id, "수정할 보드를 찾지 못했습니다.");
        return Promise.resolve();
      }

      const opId = crypto.randomUUID();
      appendRecentOp({ id: opId, label: "보드 수정", status: "pending", at: Date.now() });

      try {
        const response = await apiFetch(apiV1Path(`dashboard/boards/${targetId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: normalizedTitle, description: input.description ?? null }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              board?: unknown;
              error?: string;
            }
          | null;

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "보드를 수정하지 못했습니다.";
          throw new Error(message);
        }

        const normalized = normalizeBoardSummary(payload?.board) ?? null;
        finishMutationSuccess(mutation.id, (base) => ({
          ...base,
          boards: base.boards.map((board) =>
            board.boardId === targetId ? { ...board, ...(normalized ?? {}) } : board,
          ),
        }));
        updateRecentOpStatus(opId, "ok");
        updateStatus(targetId, "idle");
        updateFailedAction(targetId, null);
        setLastSyncError(undefined);
        setLastSyncAt(Date.now());
        publishDashboardInvalidate({
          type: "boards_changed",
          reason: "updated",
          ts: Date.now(),
        });
        scheduleRevalidate();
      } catch (error) {
        finishMutationFailure(mutation.id, shortMessage(error, "보드 수정에 실패했습니다."));
        rollbackUpdateBoard(snapshot);
        updateRecentOpStatus(opId, "fail");
        updateStatus(targetId, "failed");
        updateFailedAction(targetId, { type: "update", boardId: targetId, payload: input, snapshot });
        notifySyncFailure("보드 수정 실패 — 다시 시도하세요", error);
      } finally {
        decrementInFlight();
      }
    },
    [
      appendRecentOp,
      beginMutation,
      decrementInFlight,
      finishMutationFailure,
      finishMutationSuccess,
      isOffline,
      notifyOffline,
      notifySyncFailure,
      rollbackUpdateBoard,
      scheduleRevalidate,
      updateFailedAction,
      updateRecentOpStatus,
      updateStatus,
      updateBoardOptimisticOnly,
    ],
  );

  const createBoardOptimistic = useCallback(
    async (input: CreateBoardPayload): Promise<CreateBoardResult> => {
      try {
        const board = await performCreateBoard(input);
        return { ok: true, board };
      } catch (error) {
        const message = shortMessage(error, "보드를 생성하지 못했습니다.");
        const requestId =
          typeof error === "object" && error && "requestId" in error && typeof error.requestId === "string"
            ? error.requestId
            : undefined;
        const code =
          typeof error === "object" && error && "code" in error && typeof error.code === "string"
            ? error.code
            : undefined;
        return { ok: false, error: { message, code }, requestId };
      }
    },
    [performCreateBoard],
  );

  const deleteBoardOptimistic = useCallback(
    async (boardId: string) => deleteBoardMutation(boardId),
    [deleteBoardMutation],
  );

  const updateBoardMetaOptimistic = useCallback(
    async (boardId: string, patch: Partial<DashboardBoardSummary>) => {
      if (!boardId) return;
      const current = boardsRef.current.find((board) => board.boardId === boardId);
      if (!current) return;
      const title = typeof patch.title === "string" ? patch.title : current.title;
      const description =
        patch.description === undefined ? current.description ?? null : patch.description ?? null;
      await updateBoardMutation({ boardId, title, description });
    },
    [updateBoardMutation],
  );

  const pinBoardOptimistic = useCallback(
    async (boardId: string) => {
      if (!boardId) return;
      const mutation = beginMutation({
        id: crypto.randomUUID(),
        type: "pin",
        payload: { boardId },
      });
      finishMutationSuccess(mutation.id, (base) => ({
        ...base,
        pinnedIds: base.pinnedIds.includes(boardId) ? base.pinnedIds : [boardId, ...base.pinnedIds],
      }));
    },
    [beginMutation, finishMutationSuccess],
  );

  const unpinBoardOptimistic = useCallback(
    async (boardId: string) => {
      if (!boardId) return;
      const mutation = beginMutation({
        id: crypto.randomUUID(),
        type: "unpin",
        payload: { boardId },
      });
      finishMutationSuccess(mutation.id, (base) => ({
        ...base,
        pinnedIds: base.pinnedIds.filter((id) => id !== boardId),
      }));
    },
    [beginMutation, finishMutationSuccess],
  );

  const savePresetsOptimistic = useCallback(
    (presets: ClassPreset[]) => {
      savePresets(presets);
      const mutation = beginMutation({
        id: crypto.randomUUID(),
        type: "presets",
        payload: { count: presets.length },
      });
      finishMutationSuccess(mutation.id, (base) => base);
      publishDashboardInvalidate({
        type: "presets_changed",
        reason: "updated",
        ts: Date.now(),
      });
      scheduleRevalidate();
    },
    [beginMutation, finishMutationSuccess, scheduleRevalidate],
  );

  const ensureShare = useCallback(
    async (boardId: string, shareCode?: string | null) => {
      if (!boardId) return null;
      if (shareCode) {
        const info = buildShareLinkInfo(boardId, shareCode);
        setEnsuredShareLinks((current) => ({ ...current, [boardId]: info }));
        return info;
      }
      if (isOffline()) {
        notifyOffline("오프라인 상태라 변경을 저장할 수 없어요. 온라인에서 다시 시도해 주세요.");
        return null;
      }

      ensureShareOptimistic(boardId);
      const opId = crypto.randomUUID();
      appendRecentOp({ id: opId, label: "공유 준비", status: "pending", at: Date.now() });

      try {
        const response = await apiFetch(apiV1Path(`boards/${boardId}/share/ensure`), { method: "POST" });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok: true;
              boardId: string;
              code: string;
              shareUrl: string;
              presentUrl: string;
            }
          | { ok?: false; message?: string }
          | null;

        if (!response.ok || !payload || payload.ok !== true || !payload.code) {
          const message =
            payload && "message" in payload && payload.message
              ? payload.message
              : "공유 링크를 준비하지 못했습니다.";
          throw new Error(message);
        }

        updateRecentOpStatus(opId, "ok");
        updateStatus(boardId, "idle");
        updateFailedAction(boardId, null);
        setLastSyncError(undefined);
        setLastSyncAt(Date.now());
        commitBaseSnapshot((base) => ({
          ...base,
          boards: base.boards.map((board) =>
            board.boardId === boardId
              ? { ...board, shareCode: payload.code, shareEnabled: true }
              : board,
          ),
        }));
        const shareInfo = {
          boardId: payload.boardId,
          code: payload.code,
          shareUrl: payload.shareUrl,
          presentUrl: payload.presentUrl,
        } satisfies ShareLinkInfo;
        setEnsuredShareLinks((current) => ({ ...current, [boardId]: shareInfo }));
        publishDashboardInvalidate({
          type: "share_links_changed",
          reason: "ensured",
          ts: Date.now(),
        });
        scheduleDelayedRefetch(3500, "share_ensured");
        return shareInfo;
      } catch (error) {
        updateRecentOpStatus(opId, "fail");
        updateStatus(boardId, "failed");
        updateFailedAction(boardId, { type: "share", boardId, shareCode });
        notifySyncFailure("공유 링크 준비 실패 — 다시 시도하세요", error);
        return null;
      } finally {
        decrementInFlight();
      }
    },
    [
      appendRecentOp,
      commitBaseSnapshot,
      decrementInFlight,
      ensureShareOptimistic,
      isOffline,
      notifyOffline,
      notifySyncFailure,
      scheduleDelayedRefetch,
      updateFailedAction,
      updateRecentOpStatus,
      updateStatus,
    ],
  );

  const retryBoardAction = useCallback(
    async (boardId: string) => {
      const action = failedActionsRef.current[boardId];
      if (!action) return;
      updateStatus(boardId, "syncing");
      if (action.type === "create") {
        updateFailedAction(boardId, { ...action, tempId: action.tempId });
        await performCreateBoard(action.payload, { tempId: action.tempId });
        return;
      }
      if (action.type === "update") {
        updateFailedAction(boardId, action);
        await updateBoardMutation(action.payload);
        return;
      }
      if (action.type === "delete") {
        await deleteBoardMutation(action.boardId);
        return;
      }
      if (action.type === "share") {
        await ensureShare(action.boardId, action.shareCode ?? null);
      }
    },
    [deleteBoardMutation, ensureShare, performCreateBoard, updateBoardMutation, updateFailedAction, updateStatus],
  );

  const rollbackFailedDelete = useCallback(
    (boardId: string) => {
      const action = failedActionsRef.current[boardId];
      if (!action || action.type !== "delete") return;
      if (action.snapshot) {
        rollbackDeleteBoard(action.snapshot);
      }
      clearBoardFailure(boardId);
    },
    [clearBoardFailure, rollbackDeleteBoard],
  );

  const value = useMemo(
    () => ({
      boards,
      pinnedIds,
      ensuredShareLinks,
      externalInvalidationPending,
      status,
      statusByBoardId,
      failedActionsByBoardId,
      droppedCount,
      issue,
      degraded,
      loadState,
      syncState,
      lastSyncError,
      lastSyncAt,
      lastRefetchAt,
      recentOps,
      invalidationNotice,
      inFlightCount,
      clearLastError,
      loading: loadState === "loading",
      refetch,
      revalidate,
      createBoardOptimistic,
      deleteBoardOptimistic,
      pinBoardOptimistic,
      unpinBoardOptimistic,
      updateBoardMetaOptimistic,
      savePresetsOptimistic,
      commitCreateBoard,
      rollbackCreateBoard,
      deleteBoardOptimisticOnly,
      rollbackDeleteBoard,
      updateBoardOptimisticOnly,
      rollbackUpdateBoard,
      ensureShareOptimistic,
      actions: {
        createBoard,
        deleteBoard: deleteBoardMutation,
        updateBoard: updateBoardMutation,
        ensureShare,
        retryBoardAction,
        rollbackFailedDelete,
        pinBoard: pinBoardOptimistic,
        unpinBoard: unpinBoardOptimistic,
        movePin,
        clearBoardFailure,
        cacheEnsuredShareLink,
      },
    }),
    [
      boards,
      cacheEnsuredShareLink,
      clearBoardFailure,
      clearLastError,
      commitCreateBoard,
      createBoard,
      createBoardOptimistic,
      deleteBoardOptimistic,
      pinBoardOptimistic,
      unpinBoardOptimistic,
      updateBoardMetaOptimistic,
      savePresetsOptimistic,
      deleteBoardMutation,
      deleteBoardOptimisticOnly,
      droppedCount,
      ensureShare,
      ensureShareOptimistic,
      ensuredShareLinks,
      externalInvalidationPending,
      failedActionsByBoardId,
      inFlightCount,
      invalidationNotice,
      issue,
      degraded,
      lastRefetchAt,
      lastSyncAt,
      lastSyncError,
      loadState,
      movePin,
      pinnedIds,
      recentOps,
      refetch,
      revalidate,
      retryBoardAction,
      rollbackCreateBoard,
      rollbackDeleteBoard,
      rollbackFailedDelete,
      rollbackUpdateBoard,
      status,
      statusByBoardId,
      syncState,
      updateBoardMutation,
      updateBoardOptimisticOnly,
    ],
  );

  return value;
}

export type {
  BoardFetchIssue,
  BoardSnapshot,
  BoardStatus,
  DashboardBoardSummary,
  FailedAction,
  OptimisticPatch,
  RecentOp,
};
