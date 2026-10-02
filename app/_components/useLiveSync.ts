"use client";
import { apiPath } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBoardBus } from "@/app/dashboard/sessionBus";
import type { FlowStepActions } from "@/app/dashboard/flows";
import type { ReactionSnapshot, QuickPollState, SpotlightState } from "@/lib/data/engagement";
import type { BoardControlsPublic } from "@/lib/types/boardControls";
import type { StudentActionSummary, StudentActionTriageState, StudentHudSettings } from "@/lib/types/studentActions";
import { apiFetch } from "@/lib/http/apiFetch";

import { routes } from "@/lib/standards/routes";

export type LiveSnapshot = {
  boardId: string;
  activeSessionId?: string | null;
  activeSessionStartedAt?: string | null;
  flowId?: string;
  stepId?: string;
  stepIndex?: number;
  label?: string;
  target?: "class" | "share" | "present";
  safe?: boolean;
  focus?: boolean;
  pinnedQuestionId?: string | null;
  pinnedQuestionUpdatedAt?: number | null;
  qnaOpen?: boolean;
  qnaEndsAt?: number | null;
  qnaPrompt?: string | null;
  presenceNudgeAt?: number | null;
  pulse?: {
    ok: number;
    unsure: number;
    help: number;
    updatedAt: number;
  };
  poll?: {
    id: string;
    open: boolean;
    endsAt?: number | null;
    question: string;
    options: { id: string; label: string }[];
    counts?: Record<string, number>;
    total?: number;
    updatedAt: number;
  };
  currentStep?: {
    flowId: string;
    stepIndex: number;
    stepId: string;
    title?: string;
    prompt?: string;
    startedAt: number;
    seconds?: number;
    actions?: FlowStepActions;
    actionsApplied?: boolean;
    paused?: boolean;
    pausedAt?: number;
  };
  reactions?: ReactionSnapshot;
  quickPoll?: QuickPollState | null;
  spotlight?: SpotlightState;
  studentActions?: StudentActionSummary;
  studentActionTriage?: StudentActionTriageState;
  studentHudSettings?: StudentHudSettings;
  controls?: BoardControlsPublic | null;
  demoStepIndex?: number;
  ts: number;
  version?: number;
};

type LiveStatus = "idle" | "live" | "degraded" | "offline" | "paused";

export type PresenceSummary = {
  activeCount: number;
  activeTop: string[];
  activeList: { name: string; lastSeenAt: string }[];
  updatedAt: number;
};

type SessionSnapshotPayload = {
  presenceCount?: number;
  activePollId?: string | null;
  pulseCount?: number;
  openQuestionsCount?: number;
};

type LiveSyncOptions = {
  mode: "teacher" | "viewer";
  boardId?: string;
  shareCode?: string;
  enableLiveSync?: boolean;
  presence?: {
    mode: "student" | "observer";
    displayName?: string | null;
    activeWithinSeconds?: number;
  };
};

const VISIBLE_INTERVAL_RANGE: [number, number] = [1000, 1500];
const HIDDEN_INTERVAL_RANGE: [number, number] = [3000, 5000];
const PRESENCE_STUDENT_RANGE: [number, number] = [8000, 12000];
const PRESENCE_OBSERVER_RANGE: [number, number] = [5000, 8000];
const LIVE_FAILURE_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
const CIRCUIT_BREAKER_FAILURE_LIMIT = 6;
const CIRCUIT_BREAKER_TIME_LIMIT_MS = 60_000;

function randomBetween([min, max]: [number, number]) {
  return Math.floor(min + Math.random() * (max - min));
}

function getNextInterval() {
  if (typeof document === "undefined") return VISIBLE_INTERVAL_RANGE[0];
  const range = document.visibilityState === "hidden" ? HIDDEN_INTERVAL_RANGE : VISIBLE_INTERVAL_RANGE;
  return randomBetween(range);
}

export function useLiveSync({
  mode,
  boardId,
  shareCode,
  enableLiveSync = true,
  presence,
}: LiveSyncOptions) {
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [presenceSummary, setPresenceSummary] = useState<PresenceSummary | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<LiveStatus>("idle");
  const [presenceSelfName, setPresenceSelfName] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionStartedAt, setActiveSessionStartedAt] = useState<string | null>(null);
  const failureCountRef = useRef(0);
  const firstFailureAtRef = useRef<number | null>(null);
  const latestVersionRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);
  const visibilityPausedRef = useRef(false);
  const disabledRef = useRef(false);
  const presenceFailureRef = useRef(0);
  const circuitOpenRef = useRef(false);
  const manualRetryRef = useRef<(() => void) | null>(null);
  const presencePollingRef = useRef<number | null>(null);
  const snapshotPayloadRef = useRef<SessionSnapshotPayload | null>(null);
  const sessionSnapshotTimerRef = useRef<number | null>(null);
  const presenceMode = presence?.mode ?? null;
  const presenceDisplayName = presence?.displayName ?? null;
  const presenceActiveWithinSeconds =
    typeof presence?.activeWithinSeconds === "number" ? presence.activeWithinSeconds : null;

  const canPoll = useMemo(() => {
    if (mode === "teacher") return Boolean(boardId);
    return Boolean(shareCode);
  }, [mode, boardId, shareCode]);

  const canPresencePoll = useMemo(() => {
    if (!presenceMode) return false;
    if (presenceMode === "student") {
      return Boolean(shareCode);
    }
    if (mode === "teacher") {
      return Boolean(boardId);
    }
    return Boolean(shareCode);
  }, [boardId, mode, presenceMode, shareCode]);

  const publishToBus = useCallback(
    (snapshot: LiveSnapshot) => {
      if (!boardId) return;
      if (!snapshot.flowId || !snapshot.stepId || typeof snapshot.stepIndex !== "number") return;
      if (!snapshot.label || !snapshot.target) return;
      createBoardBus(boardId).publish({
        type: "FLOW_RUN",
        boardId,
        flowId: snapshot.flowId,
        stepId: snapshot.stepId,
        stepIndex: snapshot.stepIndex,
        target: snapshot.target,
        label: snapshot.label,
        currentStep: snapshot.currentStep,
        ts: snapshot.ts,
      });
    },
    [boardId],
  );

  useEffect(() => {
    if (!enableLiveSync || !canPoll || disabledRef.current) return;

    let aborted = false;

    const isVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

    const clearTimer = () => {
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };

    const scheduleNext = (delay: number) => {
      clearTimer();
      if (!isVisible()) {
        visibilityPausedRef.current = true;
        return;
      }
      pollingRef.current = window.setTimeout(poll, delay);
    };

    const resetFailures = () => {
      failureCountRef.current = 0;
      firstFailureAtRef.current = null;
      circuitOpenRef.current = false;
    };

    const openCircuit = () => {
      circuitOpenRef.current = true;
      clearTimer();
      setStatus("paused");
    };

    const poll = async () => {
      if (aborted || disabledRef.current || circuitOpenRef.current) return;
      if (!isVisible()) {
        visibilityPausedRef.current = true;
        return;
      }
      try {
        const endpoint =
          mode === "teacher"
            ? routes.api.boards.byId(boardId ?? "", "live")
            : routes.api.v1("s", shareCode ?? "", "live");
        const response = await apiFetch(endpoint, { cache: "no-store" });
        if (response.status === 501) {
          disabledRef.current = true;
          setStatus("offline");
          return;
        }
        if (response.status === 404) {
          resetFailures();
          setStatus("idle");
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | {
              ok: true;
              data:
                | { snapshot?: LiveSnapshot | null; version?: number; activeSessionId?: string | null; activeSessionStartedAt?: string | null }
                | LiveSnapshot
                | null;
            }
          | { ok: false }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error("live_sync_failed");
        }

        const dataPayload = payload.data as
          | {
              snapshot?: LiveSnapshot | null;
              version?: number;
              activeSessionId?: string | null;
              activeSessionStartedAt?: string | null;
            }
          | LiveSnapshot
          | null;
        let nextSnapshot: LiveSnapshot | null = null;
        let version: number | null = null;
        let nextSessionId: string | null | undefined = undefined;
        let nextSessionStartedAt: string | null | undefined = undefined;

        if (dataPayload && typeof dataPayload === "object" && "snapshot" in dataPayload) {
          nextSnapshot = dataPayload.snapshot ?? null;
          version = typeof dataPayload.version === "number" ? dataPayload.version : null;
          nextSessionId =
            typeof dataPayload.activeSessionId === "string" || dataPayload.activeSessionId === null
              ? (dataPayload.activeSessionId ?? null)
              : null;
          nextSessionStartedAt =
            typeof dataPayload.activeSessionStartedAt === "string" || dataPayload.activeSessionStartedAt === null
              ? (dataPayload.activeSessionStartedAt ?? null)
              : (dataPayload.snapshot?.activeSessionStartedAt ?? null);
        } else if (dataPayload && typeof dataPayload === "object") {
          const snapshot = dataPayload as LiveSnapshot;
          nextSnapshot = snapshot;
          version = typeof snapshot.version === "number" ? snapshot.version : null;
          nextSessionId =
            typeof snapshot.activeSessionId === "string" || snapshot.activeSessionId === null
              ? (snapshot.activeSessionId ?? null)
              : null;
          nextSessionStartedAt =
            typeof snapshot.activeSessionStartedAt === "string" || snapshot.activeSessionStartedAt === null
              ? (snapshot.activeSessionStartedAt ?? null)
              : null;
        } else {
          nextSnapshot = null;
        }

        if (nextSnapshot) {
          nextSnapshot.version = version ?? nextSnapshot.version;
          if (boardId) {
            nextSnapshot.boardId = boardId;
          }
        }

        const incomingVersion = version ?? nextSnapshot?.version ?? null;
        if (incomingVersion !== null) {
          if (latestVersionRef.current === null || incomingVersion > latestVersionRef.current) {
            latestVersionRef.current = incomingVersion;
            if (nextSnapshot) {
              setData(nextSnapshot);
              publishToBus(nextSnapshot);
            }
          }
        } else if (nextSnapshot) {
          setData(nextSnapshot);
          publishToBus(nextSnapshot);
        }

        if (nextSessionId !== undefined) {
          setActiveSessionId(nextSessionId);
        }
        if (nextSessionStartedAt !== undefined) {
          setActiveSessionStartedAt(nextSessionStartedAt);
        }

        resetFailures();
        setStatus("live");
        scheduleNext(getNextInterval());
      } catch {
        const now = Date.now();
        failureCountRef.current += 1;
        if (firstFailureAtRef.current === null) {
          firstFailureAtRef.current = now;
        }
        const elapsed = firstFailureAtRef.current ? now - firstFailureAtRef.current : 0;
        if (failureCountRef.current >= CIRCUIT_BREAKER_FAILURE_LIMIT || elapsed >= CIRCUIT_BREAKER_TIME_LIMIT_MS) {
          openCircuit();
          return;
        }
        setStatus(failureCountRef.current >= 3 ? "offline" : "degraded");
        const backoffIndex = Math.min(failureCountRef.current - 1, LIVE_FAILURE_BACKOFF_MS.length - 1);
        scheduleNext(LIVE_FAILURE_BACKOFF_MS[backoffIndex]);
        return;
      }
    };

    manualRetryRef.current = () => {
      if (disabledRef.current) return;
      resetFailures();
      setStatus("degraded");
      visibilityPausedRef.current = false;
      void poll();
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        visibilityPausedRef.current = false;
        if (!circuitOpenRef.current && !disabledRef.current) {
          void poll();
        }
      } else {
        clearTimer();
        visibilityPausedRef.current = true;
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    void poll();

    return () => {
      aborted = true;
      clearTimer();
      manualRetryRef.current = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [boardId, canPoll, enableLiveSync, mode, publishToBus, shareCode]);
  useEffect(() => {
    snapshotPayloadRef.current = {
      presenceCount: presenceSummary?.activeCount ?? undefined,
      activePollId: data?.poll?.open ? data.poll.id : null,
      pulseCount: data?.pulse
        ? (data.pulse.ok ?? 0) + (data.pulse.unsure ?? 0) + (data.pulse.help ?? 0)
        : undefined,
    };
  }, [data?.poll, data?.pulse, presenceSummary?.activeCount]);

  useEffect(() => {
    if (sessionSnapshotTimerRef.current) {
      window.clearInterval(sessionSnapshotTimerRef.current);
      sessionSnapshotTimerRef.current = null;
    }
    if (mode !== "teacher" || !boardId || !activeSessionId || !enableLiveSync) return;

    const sendSnapshot = async () => {
      const payload = snapshotPayloadRef.current ?? {};
      if (!payload || Object.keys(payload).length === 0) return;
      try {
        await apiFetch(routes.api.boards.byId(boardId, "sessions", activeSessionId, "events"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "snapshot", payload }),
        });
      } catch {
        // ignore transient errors
      }
    };

    void sendSnapshot();
    sessionSnapshotTimerRef.current = window.setInterval(() => {
      void sendSnapshot();
    }, 25_000);

    return () => {
      if (sessionSnapshotTimerRef.current) {
        window.clearInterval(sessionSnapshotTimerRef.current);
        sessionSnapshotTimerRef.current = null;
      }
    };
  }, [activeSessionId, boardId, enableLiveSync, mode]);

  const performPresenceRequest = useCallback(async () => {
    if (!presenceMode || !canPresencePoll) return null;

    try {
      const isStudent = presenceMode === "student";
      const endpointBase =
        mode === "teacher"
          ? boardId
            ? routes.api.boards.byId(boardId, "presence")
            : null
          : shareCode
            ? routes.api.v1("s", shareCode, "presence")
            : null;

      if (!endpointBase) return null;

      const endpoint = new URL(endpointBase, window.location.origin);
      if (!isStudent && typeof presenceActiveWithinSeconds === "number") {
        endpoint.searchParams.set("activeWithinSeconds", String(presenceActiveWithinSeconds));
      }

      const path = apiPath(`${endpoint.pathname}${endpoint.search}`);

      const response = await apiFetch(path, {
        method: isStudent ? "POST" : "GET",
        headers: isStudent ? { "Content-Type": "application/json" } : undefined,
        body: isStudent
          ? JSON.stringify(
              typeof presenceDisplayName === "string"
                ? { displayName: presenceDisplayName }
                : {},
            )
          : undefined,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; activeCount: number; activeTop?: string[]; activeList?: { name: string; lastSeenAt: string }[]; displayNameEffective?: string | null }
        | { ok: false }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error("presence_failed");
      }

      if (isStudent) {
        setPresenceSummary({
          activeCount: payload.activeCount ?? 0,
          activeTop: [],
          activeList: [],
          updatedAt: Date.now(),
        });
        if (typeof payload.displayNameEffective === "string") {
          setPresenceSelfName(payload.displayNameEffective);
        }
      } else {
        setPresenceSummary({
          activeCount: payload.activeCount ?? 0,
          activeTop: payload.activeTop ?? [],
          activeList: payload.activeList ?? [],
          updatedAt: Date.now(),
        });
      }

      presenceFailureRef.current = 0;
      setPresenceStatus("live");
      return payload;
    } catch {
      presenceFailureRef.current += 1;
      setPresenceStatus(presenceFailureRef.current >= 3 ? "offline" : "degraded");
      return null;
    }
  }, [
    boardId,
    canPresencePoll,
    mode,
    presenceActiveWithinSeconds,
    presenceDisplayName,
    presenceMode,
    shareCode,
  ]);

  useEffect(() => {
    if (!presenceMode || !canPresencePoll) return;
    let aborted = false;
    const range = presenceMode === "student" ? PRESENCE_STUDENT_RANGE : PRESENCE_OBSERVER_RANGE;

    const pollPresence = async () => {
      if (aborted) return;
      await performPresenceRequest();
      if (!aborted) {
        presencePollingRef.current = window.setTimeout(pollPresence, randomBetween(range));
      }
    };

    presencePollingRef.current = window.setTimeout(pollPresence, 0);

    return () => {
      aborted = true;
      if (presencePollingRef.current) {
        window.clearTimeout(presencePollingRef.current);
      }
    };
  }, [canPresencePoll, performPresenceRequest, presenceMode]);

  const refreshPresence = useCallback(async () => performPresenceRequest(), [performPresenceRequest]);

  const resetPresence = useCallback(async () => {
    if (!presenceMode || presenceMode !== "observer") return false;
    if (mode !== "teacher" || !boardId) return false;
    try {
      const response = await apiFetch(routes.api.boards.byId(boardId, "presence"), { method: "DELETE" });
      if (!response.ok) {
        throw new Error("reset_failed");
      }
      await performPresenceRequest();
      return true;
    } catch {
      return false;
    }
  }, [boardId, mode, performPresenceRequest, presenceMode]);

  const retryLive = useCallback(() => {
    manualRetryRef.current?.();
  }, []);

  const publish = useCallback(
    async (patch: Partial<LiveSnapshot>) => {
      if (mode !== "teacher" || !boardId) return null;

      const nextTs = typeof patch.ts === "number" ? patch.ts : Date.now();
      const optimistic: LiveSnapshot = {
        ...(data ?? { boardId, ts: nextTs }),
        ...patch,
        boardId,
        ts: nextTs,
      };

      setData(optimistic);
      if (typeof optimistic.version === "number") {
        latestVersionRef.current = optimistic.version;
      }
      publishToBus(optimistic);

      try {
        if (activeSessionId) {
          const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
          const stepPayload: Record<string, unknown> = {};
          if (typeof patch.stepId === "string") stepPayload.stepId = patch.stepId;
          if (typeof patch.label === "string") stepPayload.label = patch.label;
          if (typeof patch.stepIndex === "number") stepPayload.index = patch.stepIndex;
          if (Object.keys(stepPayload).length > 0) {
            events.push({ type: "step_changed", payload: stepPayload });
          }

          if (typeof patch.qnaOpen === "boolean" || patch.qnaPrompt !== undefined) {
            const qaPayload: Record<string, unknown> = {
              open: typeof patch.qnaOpen === "boolean" ? patch.qnaOpen : (data?.qnaOpen ?? false),
            };
            if (typeof patch.qnaPrompt === "string" || patch.qnaPrompt === null) {
              qaPayload.prompt = patch.qnaPrompt;
            }
            events.push({ type: "qa_window_changed", payload: qaPayload });
          }

          if (typeof patch.presenceNudgeAt === "number") {
            events.push({ type: "nudge_sent", payload: { message: "참여 체크 요청" } });
          }

          await Promise.all(
            events.map((event) =>
              apiFetch(routes.api.boards.byId(boardId, "sessions", activeSessionId, "events"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(event),
              }),
            ),
          );
        }

        const response = await apiFetch(routes.api.boards.byId(boardId, "live"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patch }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { snapshot: LiveSnapshot; version: number } }
          | { ok: false }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error("live_sync_failed");
        }

        const nextSnapshot = { ...payload.data.snapshot, version: payload.data.version };
        setData(nextSnapshot);
        latestVersionRef.current = payload.data.version;
        publishToBus(nextSnapshot);
        setStatus("live");
        return nextSnapshot;
      } catch {
        failureCountRef.current += 1;
        setStatus(failureCountRef.current >= 3 ? "offline" : "degraded");
        return null;
      }
    },
    [activeSessionId, boardId, data, mode, publishToBus],
  );

  return {
    data,
    status,
    retryLive,
    publish,
    presence: presenceSummary,
    presenceStatus,
    presenceSelfName,
    refreshPresence,
    resetPresence,
    activeSessionId,
    activeSessionStartedAt,
  };
}
