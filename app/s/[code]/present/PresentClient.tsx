"use client";
import LinkifiedText from "@/app/_components/LinkifiedText";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AnchoredMenu from "@/app/_components/AnchoredMenu";
import InlineAlert from "@/app/_components/InlineAlert";
import CardTile from "@/app/_components/CardTile";
import useDismissableLayer from "@/app/_components/useDismissableLayer";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { cn } from "@/app/_components/uiTokens";
import TriagePanel from "@/app/dashboard/boards/[boardId]/class/_components/TriagePanel";
import { getRemainingSeconds } from "@/lib/flow/stepTimer";
import { fetchWithRetry } from "@/lib/http/fetchWithRetry";
import type { FollowState } from "@/lib/present/followState";
import { getCardColorClass } from "@/lib/ui/cardColors";
import { DEFAULT_HUD } from "@/lib/controls/boardControlsDefaults";
import { DEMO_SCENARIO } from "@/lib/onboarding/demoScenario";
import { readDemoStepIndex, writeDemoStepIndex } from "@/lib/onboarding/demoStorage";
import { getLastRequestId } from "@/lib/http/requestId";
import { assertSchemaVersion } from "@/lib/contracts/assertSchemaVersion";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import JoinDock from "@/components/present/JoinDock";
import PresentDemoLayer from "@/components/present/PresentDemoLayer";
import PresentGuideOverlay from "@/components/present/PresentGuideOverlay";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";
import PresentHelpOverlay from "./PresentHelpOverlay";
import type { PresentSnapshot } from "./loadPresentData";
import { usePresentPrefs } from "./usePresentPrefs";
import { usePresentQueue } from "./usePresentQueue";
import { useRecentCards } from "./useRecentCards";
import DemoOverlaySlot from "./_components/DemoOverlaySlot";
import HudControlPanel from "./HudControlPanel";
import { usePresentGuide } from "./usePresentGuide";
import { triageEntriesToItems } from "@/lib/triage/triageItems";

type PresentClientProps = {
  initialSnapshot: PresentSnapshot;
  shareCode: string;
  demoEnabled?: boolean;
};

type ConnectionState = "connecting" | "ready" | "stale" | "reconnecting" | "error";
type PublicQuestion = {
  id: string;
  body: string;
  author: string | null;
  status: string;
  pinned: boolean;
  createdAt: string;
};

const TAG_DISPLAY_LIMIT = 3;
const STALE_AFTER_MS = 12_000;
const ERROR_AFTER_MS = 45_000;
const HELP_REASON_LABELS = {
  too_fast: "속도가 너무 빨라요",
  stuck: "막혔어요",
  tech: "기기/화면 문제",
} as const;
const PULSE_LABELS = {
  1: "1 · 매우 어려움",
  2: "2 · 어려움",
  3: "3 · 보통",
  4: "4 · 이해됨",
  5: "5 · 완전 이해",
} as const;
const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: "연결 중",
  ready: "실시간 연결",
  stale: "업데이트 지연",
  reconnecting: "재연결 중",
  error: "연결 오류",
};

function formatActionPreview(entry: { kind: string; text?: string | null; reason?: string | null; value?: number | null }) {
  if (entry.kind === "question") {
    return entry.text ?? "질문이 도착했습니다.";
  }
  if (entry.kind === "help") {
    return entry.reason && entry.reason in HELP_REASON_LABELS
      ? HELP_REASON_LABELS[entry.reason as keyof typeof HELP_REASON_LABELS]
      : "도움 요청이 도착했습니다.";
  }
  if (entry.kind === "pulse") {
    return entry.value && entry.value in PULSE_LABELS
      ? `이해도 ${PULSE_LABELS[entry.value as keyof typeof PULSE_LABELS]}`
      : "이해도 응답이 도착했습니다.";
  }
  return "요청이 도착했습니다.";
}

export default function PresentClient({ initialSnapshot, shareCode, demoEnabled = false }: PresentClientProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(initialSnapshot.selectedWallId);
  const [activeCardId, setActiveCardId] = useState<string | null>(initialSnapshot.cards[0]?.id ?? null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(
    initialSnapshot.fetchedAt ? new Date(initialSnapshot.fetchedAt) : new Date(),
  );
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullscreenUnsupported, setFullscreenUnsupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false,
  );
  const toolsEnabled = initialSnapshot.board.toolsEnabled;
  const canQuestions = hasToolEnabled(toolsEnabled, "questions");
  const canPolls = hasToolEnabled(toolsEnabled, "polls");
  const canPulse = hasToolEnabled(toolsEnabled, "pulse");
  const canPresence = hasToolEnabled(toolsEnabled, "presence");
  const { data: liveSnapshot, presence, status: liveStatus } = useLiveSync({
    mode: "viewer",
    shareCode,
    presence: canPresence ? { mode: "observer" } : undefined,
  });
  const [isTeacher, setIsTeacher] = useState(false);
  const { data: teacherSnapshot, publish: publishTeacher } = useLiveSync({
    mode: "teacher",
    boardId: isTeacher ? initialSnapshot.board.id : undefined,
    enableLiveSync: isTeacher,
  });
  const [demoStepIndex, setDemoStepIndex] = useState(() => readDemoStepIndex(initialSnapshot.board.id) ?? 0);
  const [triageOpen, setTriageOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pinnedQuestion, setPinnedQuestion] = useState<PublicQuestion | null>(null);
  const lastPinnedUpdateRef = useRef<number | null>(null);
  const [followPausedUntil, setFollowPausedUntil] = useState<number | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [lastFollowAppliedAt, setLastFollowAppliedAt] = useState<number>(0);
  const [presenceHighlight, setPresenceHighlight] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [joinDockExpandSignal, setJoinDockExpandSignal] = useState(0);
  const [demoVisible, setDemoVisible] = useState(false);
  const [demoOptOut, setDemoOptOut] = useState(false);
  const [lastLiveRequestId, setLastLiveRequestId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const followPollRef = useRef<number | null>(null);
  const fetchingRef = useRef(false);
  const followFetchingRef = useRef(false);
  const followResumeTimeoutRef = useRef<number | null>(null);
  const latestFollowStateRef = useRef<FollowState | null>(null);
  const lastPresenceCountRef = useRef<number | null>(null);
  const demoDelayRef = useRef<number | null>(null);
  const recentCards = useRecentCards(initialSnapshot);
  const presentQueue = usePresentQueue(shareCode);
  const { popNext, removeFromQueue, togglePanel, queuedIds, addToQueue } = presentQueue;
  const { clearRecent, toggleRecentOnly, isFresh } = recentCards;
  const {
    theme,
    cycleTheme,
    setTheme,
    zoom,
    adjustZoom,
    resetZoom,
    showHints,
    toggleHints,
    setShowHints,
    cardSize,
    setCardSize,
    focusMode,
    toggleFocusMode,
    safeMode,
    toggleSafeMode,
    applyProjectorPreset,
  } = usePresentPrefs(shareCode);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [projectorPresetPersist, setProjectorPresetPersist] = useState(false);
  const optionsLayerRef = useRef<HTMLDivElement | null>(null);
  const optionsAnchorRef = useRef<HTMLButtonElement | null>(null);
  const demoSteps = DEMO_SCENARIO.steps;
  const demoOptOutKey = useMemo(() => `presentDemoOptOut:${shareCode}`, [shareCode]);
  const presenceCount = canPresence ? presence?.activeCount ?? 0 : 0;
  const { open: guideOpen, dismiss: handleGuideDismiss, reopen: handleGuideReopen } = usePresentGuide(shareCode);

  const handleDemoNext = useCallback(() => {
    const nextIndex = Math.min(demoStepIndex + 1, Math.max(demoSteps.length - 1, 0));
    setDemoStepIndex(nextIndex);
    writeDemoStepIndex(initialSnapshot.board.id, nextIndex);
    if (isTeacher) {
      void publishTeacher({ demoStepIndex: nextIndex, ts: Date.now() });
    }
  }, [demoStepIndex, demoSteps.length, initialSnapshot.board.id, isTeacher, publishTeacher]);

  const selectedWall = useMemo(
    () => snapshot.walls.find((wall) => wall.id === selectedWallId) ?? null,
    [snapshot.walls, selectedWallId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDemoOptOut(window.localStorage.getItem(demoOptOutKey) === "1");
  }, [demoOptOutKey]);

  useEffect(() => {
    setLastLiveRequestId(getLastRequestId());
  }, [liveStatus]);

  const orderedCards = useMemo(() => snapshot.cards, [snapshot.cards]);
  const orderedCardsRef = useRef(orderedCards);

  const refreshPinned = useCallback(async () => {
    if (!canQuestions) return;
    try {
      const response = await fetch(apiV1Path(`s/${shareCode}/questions`), { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { pinned: PublicQuestion | null } }
        | { ok: false }
        | null;
      if (!response.ok || !payload || payload.ok !== true) return;
      setPinnedQuestion(payload.data.pinned ?? null);
    } catch {
      // ignore transient errors
    }
  }, [canQuestions, shareCode]);

  useDismissableLayer({
    isOpen: optionsOpen,
    setIsOpen: setOptionsOpen,
    layerRef: optionsLayerRef,
    anchorRef: optionsAnchorRef,
  });

  useEffect(() => {
    let active = true;
    const loadRole = async () => {
      try {
        const response = await fetch(apiV1Path(`boards/${initialSnapshot.board.id}/me/role`), {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; role?: string } | null;
        if (!active) return;
        setIsTeacher(Boolean(payload?.ok && payload.role && payload.role !== "viewer"));
      } catch {
        if (active) {
          setIsTeacher(false);
        }
      }
    };
    void loadRole();
    return () => {
      active = false;
    };
  }, [initialSnapshot.board.id]);

  useEffect(() => {
    if (!demoEnabled) return;
    const nextIndex =
      typeof liveSnapshot?.demoStepIndex === "number"
        ? liveSnapshot.demoStepIndex
        : typeof teacherSnapshot?.demoStepIndex === "number"
          ? teacherSnapshot.demoStepIndex
          : null;
    if (typeof nextIndex === "number" && nextIndex !== demoStepIndex) {
      setDemoStepIndex(nextIndex);
      writeDemoStepIndex(initialSnapshot.board.id, nextIndex);
    }
  }, [demoEnabled, demoStepIndex, initialSnapshot.board.id, liveSnapshot?.demoStepIndex, teacherSnapshot?.demoStepIndex]);

  const handleGuideExpandJoinDock = useCallback(() => {
    setJoinDockExpandSignal((prev) => prev + 1);
    handleGuideDismiss();
  }, [handleGuideDismiss]);

  const handleDemoOptOut = useCallback(() => {
    setDemoVisible(false);
    setDemoOptOut(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(demoOptOutKey, "1");
    }
  }, [demoOptOutKey]);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastSuccessAt) {
      setConnectionState("connecting");
      return;
    }
    const age = now - lastSuccessAt.getTime();
    const recentError = lastErrorAt ? now - lastErrorAt : null;

    if (recentError !== null && recentError > ERROR_AFTER_MS && age > ERROR_AFTER_MS) {
      setConnectionState("error");
      return;
    }
    if (recentError !== null && recentError <= ERROR_AFTER_MS) {
      setConnectionState("reconnecting");
      return;
    }
    if (age > STALE_AFTER_MS) {
      setConnectionState("stale");
      return;
    }
    setConnectionState("ready");
  }, [lastErrorAt, lastSuccessAt, now]);

  useEffect(() => {
    orderedCardsRef.current = orderedCards;
  }, [orderedCards]);

  useEffect(() => {
    const count = presenceCount ?? null;
    if (count === null) return;
    if (lastPresenceCountRef.current !== null && count > lastPresenceCountRef.current) {
      setPresenceHighlight(true);
      const timer = window.setTimeout(() => setPresenceHighlight(false), 900);
      lastPresenceCountRef.current = count;
      return () => window.clearTimeout(timer);
    }
    lastPresenceCountRef.current = count;
    return undefined;
  }, [presenceCount]);

  useEffect(() => {
    if (!canQuestions) {
      setPinnedQuestion(null);
      return;
    }
    void refreshPinned();
  }, [canQuestions, refreshPinned]);

  useEffect(() => {
    if (!canQuestions) {
      setPinnedQuestion(null);
      return;
    }
    const updatedAt = liveSnapshot?.pinnedQuestionUpdatedAt ?? null;
    if (updatedAt && updatedAt !== lastPinnedUpdateRef.current) {
      lastPinnedUpdateRef.current = updatedAt;
      if (liveSnapshot?.pinnedQuestionId === null) {
        setPinnedQuestion(null);
        return;
      }
      void refreshPinned();
    }
  }, [canQuestions, liveSnapshot?.pinnedQuestionId, liveSnapshot?.pinnedQuestionUpdatedAt, refreshPinned]);

  useEffect(() => {
    if (orderedCards.length === 0) {
      setActiveCardId(null);
      setFocusedCardId(null);
      return;
    }
    if (!activeCardId || !orderedCards.some((card) => card.id === activeCardId)) {
      setActiveCardId(orderedCards[0]?.id ?? null);
    }
    if (focusedCardId && !orderedCards.some((card) => card.id === focusedCardId)) {
      setFocusedCardId(orderedCards[0]?.id ?? null);
    }
  }, [activeCardId, focusedCardId, orderedCards]);

  const updateUrlWithWall = useCallback(
    (wallId: string | null) => {
      const url = new URL(window.location.href);
      if (wallId) {
        url.searchParams.set("wall", wallId);
      } else {
        url.searchParams.delete("wall");
      }
      router.replace(`${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`);
    },
    [router],
  );

  const markFollowOverride = useCallback(() => {
    const resumeAt = Date.now() + 30_000;
    setFollowPausedUntil(resumeAt);
    if (followResumeTimeoutRef.current) {
      clearTimeout(followResumeTimeoutRef.current);
    }
    followResumeTimeoutRef.current = window.setTimeout(() => {
      setFollowPausedUntil(null);
    }, 30_000);
  }, []);

  const applySnapshot = useCallback(
    (next: PresentSnapshot) => {
      setLastSuccessAt(new Date(next.fetchedAt));
      setLastErrorAt(null);
      recentCards.registerSnapshot(next);
      setSelectedWallId(next.selectedWallId);
      setSnapshot((prev) => {
        if (prev.version === next.version && prev.selectedWallId === next.selectedWallId) {
          return prev;
        }
        return next;
      });
    },
    [recentCards],
  );

  const refreshSnapshot = useCallback(
    async (wallId?: string | null) => {
      if (fetchingRef.current) return;

      const wallParam = wallId ?? selectedWallId;
      const search = wallParam ? `?wall=${wallParam}` : "";

      try {
        fetchingRef.current = true;
        const response = await fetchWithRetry(apiV1Path(`share/${shareCode}/present${search}`), undefined, {
          retries: 2,
          baseDelayMs: 400,
        });
        if (!response.ok) {
          throw new Error("네트워크 오류");
        }
        const data = (await response.json()) as
          | (PresentSnapshot & { schemaVersion?: unknown; requestId?: string })
          | { ok: false; requestId?: string };
        if ("ok" in data && data.ok === false) {
          throw new Error("데이터를 불러오지 못했습니다.");
        }
        const responseRequestId =
          response.headers.get("x-request-id") ??
          response.headers.get("x-gom-request-id") ??
          ("requestId" in data ? data.requestId : undefined);
        assertSchemaVersion(data?.schemaVersion, SCHEMA_VERSIONS.sharePresent, {
          endpoint: apiV1Path(`share/${shareCode}/present${search}`),
          requestId: responseRequestId ?? undefined,
        });
        applySnapshot(data as PresentSnapshot);
      } catch (error) {
        console.error("present refresh failed", error);
        setLastErrorAt(Date.now());
      } finally {
        fetchingRef.current = false;
      }
    },
    [applySnapshot, selectedWallId, shareCode],
  );

  const applyFollowState = useCallback(
    async (state: FollowState, options?: { allowRefresh?: boolean }) => {
      latestFollowStateRef.current = state;
      if (followPausedUntil && followPausedUntil > Date.now()) {
        return;
      }

      const targetWallId = state.wallId ?? null;
      const needsWallChange = targetWallId !== selectedWallId;

      if (needsWallChange && options?.allowRefresh !== false) {
        setSelectedWallId(targetWallId);
        updateUrlWithWall(targetWallId);
        await refreshSnapshot(targetWallId);
        window.setTimeout(() => {
          const pending = latestFollowStateRef.current;
          if (pending && pending.updatedAt === state.updatedAt) {
            void applyFollowState(pending, { allowRefresh: false });
          }
        }, 0);
        return;
      }

      const targetExists = state.focusedCardId
        ? orderedCardsRef.current.some((card) => card.id === state.focusedCardId)
        : true;

      if (state.mode === "focus" && state.focusedCardId) {
        if (!targetExists && options?.allowRefresh !== false) {
          await refreshSnapshot(targetWallId ?? selectedWallId);
          window.setTimeout(() => {
            const pending = latestFollowStateRef.current;
            if (pending && pending.updatedAt === state.updatedAt) {
              void applyFollowState(pending, { allowRefresh: false });
            }
          }, 0);
          return;
        }
        if (!targetExists && options?.allowRefresh === false) {
          setFocusedCardId(null);
          setLastFollowAppliedAt(state.updatedAt);
          return;
        }
        setActiveCardId(state.focusedCardId);
        setFocusedCardId(state.focusedCardId);
      } else {
        setFocusedCardId(null);
      }

      setLastFollowAppliedAt(state.updatedAt);
      setFollowError(null);
    },
    [followPausedUntil, refreshSnapshot, selectedWallId, updateUrlWithWall],
  );

  const resumeFollow = useCallback(() => {
    if (followResumeTimeoutRef.current) {
      clearTimeout(followResumeTimeoutRef.current);
      followResumeTimeoutRef.current = null;
    }
    setFollowPausedUntil(null);
    const latest = latestFollowStateRef.current;
    if (latest) {
      void applyFollowState(latest);
    }
  }, [applyFollowState]);

  const fetchFollowState = useCallback(async () => {
    if (followFetchingRef.current) return;
    followFetchingRef.current = true;

    try {
      const response = await fetch(
        apiV1Path(`share/present-state?boardId=${initialSnapshot.board.id}&code=${shareCode}`),
        { cache: "no-store" },
      );
      const data = (await response.json()) as { ok: boolean; state?: FollowState | null; message?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "발표 상태를 불러오지 못했습니다.");
      }
      if (!data.state) {
        return;
      }
      const latestKnown = Math.max(lastFollowAppliedAt, latestFollowStateRef.current?.updatedAt ?? 0);
      if (data.state.updatedAt <= latestKnown) {
        latestFollowStateRef.current = data.state;
        return;
      }
      await applyFollowState(data.state);
    } catch (error) {
      console.error("present follow fetch failed", error);
      setFollowError("발표 따라가기 상태를 불러오지 못했습니다.");
    } finally {
      followFetchingRef.current = false;
    }
  }, [applyFollowState, initialSnapshot.board.id, lastFollowAppliedAt, shareCode]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      void refreshSnapshot();
    }, 4000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    followPollRef.current = window.setInterval(() => {
      void fetchFollowState();
    }, 1500);

    return () => {
      if (followPollRef.current) {
        clearInterval(followPollRef.current);
      }
    };
  }, [fetchFollowState]);

  useEffect(() => {
    if (followPausedUntil) {
      return;
    }
    const latest = latestFollowStateRef.current;
    if (latest && latest.updatedAt > lastFollowAppliedAt) {
      void applyFollowState(latest);
    }
  }, [applyFollowState, followPausedUntil, lastFollowAppliedAt]);

  useEffect(
    () => () => {
      if (followResumeTimeoutRef.current) {
        clearTimeout(followResumeTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (focusMode) {
      root.dataset.presentFocusMode = "true";
    } else {
      delete root.dataset.presentFocusMode;
    }
    if (safeMode) {
      root.dataset.presentSafeMode = "true";
    } else {
      delete root.dataset.presentSafeMode;
    }

    return () => {
      delete root.dataset.presentFocusMode;
      delete root.dataset.presentSafeMode;
    };
  }, [focusMode, safeMode]);

  const moveSelection = useCallback(
    (delta: number) => {
      markFollowOverride();
      if (orderedCards.length === 0) return;
      const currentIndex = activeCardId
        ? orderedCards.findIndex((card) => card.id === activeCardId)
        : 0;
      const nextIndex = Math.min(Math.max(currentIndex + delta, 0), orderedCards.length - 1);
      const nextCardId = orderedCards[nextIndex]?.id ?? null;
      if (nextCardId) {
        setActiveCardId(nextCardId);
        if (focusedCardId) {
          setFocusedCardId(nextCardId);
        }
      }
    },
    [activeCardId, focusedCardId, markFollowOverride, orderedCards],
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenEnabled) {
      setFullscreenUnsupported(true);
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen();
  }, []);

  const isEditableElement = (element: Element | null) => {
    if (!element || !(element instanceof HTMLElement)) return false;
    const tagName = element.tagName;
    return element.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (isEditableElement(target) || isEditableElement(document.activeElement)) return;

      if (guideOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          handleGuideDismiss();
        }
        return;
      }

      if (helpOpen) {
        if (event.key === "Escape" || event.key === "?") {
          event.preventDefault();
          setHelpOpen(false);
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          adjustZoom(0.05);
          return;
        }
        if (event.key === "-" || event.key === "_") {
          event.preventDefault();
          adjustZoom(-0.05);
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          resetZoom();
          return;
        }
      }

      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      if (event.key.toLowerCase() === "m" && event.shiftKey) {
        event.preventDefault();
        toggleSafeMode();
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (event.key.toLowerCase() === "p" && event.shiftKey) {
        event.preventDefault();
        applyProjectorPreset({ persist: projectorPresetPersist });
        return;
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        if (event.shiftKey) {
          setTheme("contrast");
        } else {
          cycleTheme();
        }
        return;
      }

      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        togglePanel();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        if (event.shiftKey) {
          event.preventDefault();
          clearRecent();
        } else {
          event.preventDefault();
          toggleRecentOnly();
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "g":
          markFollowOverride();
          setFocusedCardId(null);
          break;
        case "enter":
          if (!focusedCardId && activeCardId) {
            markFollowOverride();
            setFocusedCardId(activeCardId);
          }
          break;
        case "escape":
          markFollowOverride();
          setFocusedCardId(null);
          break;
        case "n":
        case "arrowright":
        case "k":
          event.preventDefault();
          {
            const next = popNext();
            if (next) {
              markFollowOverride();
              setActiveCardId(next.cardId);
              setFocusedCardId(next.cardId);
              if (next.cardId === focusedCardId) {
                setFeedback(null);
              }
            } else {
              moveSelection(1);
            }
          }
          break;
        case "arrowleft":
        case "j":
          event.preventDefault();
          moveSelection(-1);
          break;
        case "a":
          if (focusedCardId) {
            event.preventDefault();
            markFollowOverride();
            if (queuedIds.has(focusedCardId)) {
              removeFromQueue(focusedCardId);
              setFeedback("큐에서 제거되었습니다.");
            } else {
              const focusCard = orderedCardsRef.current.find((card) => card.id === focusedCardId);
              addToQueue(focusedCardId, focusCard?.wallId);
              setFeedback("현재 카드가 큐에 추가되었습니다.");
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardId,
    focusedCardId,
    markFollowOverride,
    moveSelection,
    addToQueue,
    popNext,
    queuedIds,
    removeFromQueue,
    togglePanel,
    clearRecent,
    toggleRecentOnly,
    toggleFullscreen,
    adjustZoom,
    resetZoom,
    setTheme,
    cycleTheme,
    toggleFocusMode,
    toggleSafeMode,
    helpOpen,
    applyProjectorPreset,
    projectorPresetPersist,
    guideOpen,
    handleGuideDismiss,
  ]);

  const handleCardClick = useCallback(
    (cardId: string) => {
      markFollowOverride();
      setActiveCardId(cardId);
      setFocusedCardId(cardId);
    },
    [markFollowOverride],
  );

  const visibleCards = useMemo(
    () => (recentCards.showRecentOnly ? orderedCards.filter((card) => recentCards.recentIds.has(card.id)) : orderedCards),
    [orderedCards, recentCards.recentIds, recentCards.showRecentOnly],
  );

  const selectedCard = useMemo(() => {
    if (!focusedCardId) return null;
    return orderedCards.find((card) => card.id === focusedCardId) ?? null;
  }, [focusedCardId, orderedCards]);

  const isContrastTheme = theme === "contrast";
  const isDarkTheme = theme === "dark";
  const quietChrome = focusMode || safeMode;
  const wrapperClass = isContrastTheme
    ? "bg-black text-white"
    : quietChrome
      ? "bg-neutral-950 text-white"
      : isDarkTheme
        ? "bg-gradient-to-b from-gray-950 via-gray-900 to-black text-slate-50"
        : "bg-gradient-to-b from-slate-950 via-slate-900 to-gray-950 text-white";
  const surfaceClass = isContrastTheme
    ? "border border-white/50 bg-white/10 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
    : quietChrome
      ? "border border-white/10 bg-white/5"
      : "border border-white/10 bg-white/5 backdrop-blur";
  const menuSurfaceClass = isContrastTheme
    ? "border border-white/60 bg-black/90 shadow-[0_0_0_2px_rgba(255,255,255,0.45)]"
    : quietChrome
      ? "border border-white/10 bg-neutral-950/95 shadow-lg"
      : "border border-white/15 bg-slate-900/90 shadow-xl";
  const mutedTextClass = isContrastTheme ? "text-gray-100" : "text-gray-300";
  const pillBaseClass = isContrastTheme
    ? "border border-white/50 bg-white/10 text-white"
    : "border border-white/15 bg-white/10 text-white";
  const controlButtonClass = isContrastTheme
    ? "border-white/70 bg-white/10 hover:border-white focus-visible:ring-white/60"
    : quietChrome
      ? "border-white/15 bg-white/10 hover:border-white/40 focus-visible:ring-white/30"
      : "border-white/20 bg-white/10 hover:border-white/40 focus-visible:ring-white/30";
  const quietLabelClass = isContrastTheme ? "text-gray-100" : "text-gray-200";
  const accentBadgeClass = isContrastTheme
    ? "border border-white/70 bg-white/20 text-white"
    : quietChrome
      ? "border border-white/15 bg-white/10 text-white"
      : "border border-white/20 bg-white/10 text-white";
  const activeCardBorderClass = isContrastTheme
    ? "border-2 border-cyan-300 shadow-[0_0_0_3px_rgba(0,0,0,0.65)]"
    : quietChrome
      ? "border border-white/50 shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
      : "border-white/70";
  const idleCardBorderClass = isContrastTheme
    ? "border border-white/30 hover:border-white/70"
    : quietChrome
      ? "border border-white/10 hover:border-white/30"
      : "border-white/10 hover:border-white/40";
  const overlayBackground = isContrastTheme || quietChrome ? "bg-black/90" : "bg-black/80";
  const newBadgeClass = isContrastTheme
    ? "bg-amber-300 text-black shadow-[0_0_0_2px_#000]"
    : quietChrome
      ? "bg-amber-400 text-black shadow-sm"
      : "bg-sky-600 text-white shadow-sm";
  const queuedBadgeClass = isContrastTheme
    ? "bg-cyan-300 text-black shadow-[0_0_0_2px_#000]"
    : quietChrome
      ? "bg-emerald-300 text-black shadow-sm"
      : "bg-emerald-600 text-white shadow-sm";

  const followPaused = Boolean(followPausedUntil && followPausedUntil > Date.now());
  const followStatusBadge = followPaused ? (
    <button
      type="button"
      onClick={resumeFollow}
      className={`flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 ${
        isContrastTheme
          ? "border border-orange-200 bg-orange-300 text-black shadow-[0_0_0_2px_#000]"
          : quietChrome
            ? "border border-orange-200/80 bg-orange-400/20 text-orange-50 hover:border-orange-100"
            : "border border-orange-300 bg-orange-100 text-orange-800 hover:border-orange-400 hover:bg-orange-200"
      }`}
    >
      따라가기 일시 해제
      <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-800">30초 후 재개</span>
    </button>
  ) : lastFollowAppliedAt > 0 ? (
    <span
      className={`flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-bold ${
        isContrastTheme
          ? "border border-cyan-200 bg-cyan-300 text-black shadow-[0_0_0_2px_#000]"
          : quietChrome
            ? "border border-indigo-200/60 bg-indigo-500/25 text-indigo-50"
            : "border border-indigo-300/60 bg-indigo-500/15 text-indigo-100"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-cyan-300" />
      따라가기 동기화 중
    </span>
  ) : null;

  const handleWallChange = async (nextWallId: string) => {
    markFollowOverride();
    const normalized = nextWallId || null;
    setSelectedWallId(normalized);
    updateUrlWithWall(normalized);
    await refreshSnapshot(normalized);
  };

  const handleAddToQueue = (cardId: string, wallId?: string | null) => {
    presentQueue.addToQueue(cardId, wallId);
    setFeedback("큐에 추가했습니다.");
    window.setTimeout(() => setFeedback(null), 1500);
  };

  const handleOpenQueueCard = (cardId: string) => {
    markFollowOverride();
    setActiveCardId(cardId);
    setFocusedCardId(cardId);
  };

  const recentMinutes = 5;
  const cardScale = cardSize === "compact" ? 0.9 : cardSize === "large" ? 1.18 : 1;
  const effectiveZoom = zoom * cardScale;
  const zoomPercent = Math.round(effectiveZoom * 100);
  const cardPadding = `${16 * effectiveZoom}px`;
  const cardFontSize = `${zoomPercent}%`;
  const gridGap = `${Math.max(14, (focusMode ? 20 : 16) * effectiveZoom)}px`;
  const shareLink = useMemo(() => `/s/${shareCode}`, [shareCode]);
  const hintsVisible = showHints && !focusMode && !safeMode;
  const lastUpdatedText =
    lastSuccessAt?.toLocaleTimeString("ko-KR", { hour12: false, minute: "2-digit", second: "2-digit" }) ?? "—";
  const followBadgeVisible = followPaused || (!quietChrome && lastFollowAppliedAt > 0);
  const queueCount = presentQueue.queue.length;
  const stageLabel = liveSnapshot?.label ?? "현재 단계 없음";
  const stageStep =
    typeof liveSnapshot?.stepIndex === "number" ? `${liveSnapshot.stepIndex + 1} 단계` : null;
  const stageTarget =
    liveSnapshot?.target === "present"
      ? "발표"
      : liveSnapshot?.target === "share"
        ? "학생"
        : liveSnapshot?.target === "class"
          ? "수업"
          : null;
  const pulseSnapshot = canPulse ? liveSnapshot?.pulse ?? null : null;
  const pulseTotal =
    (pulseSnapshot?.ok ?? 0) + (pulseSnapshot?.unsure ?? 0) + (pulseSnapshot?.help ?? 0);
  const pollSnapshot = canPolls ? liveSnapshot?.poll ?? null : null;
  const pollCounts = pollSnapshot?.counts ?? {};
  const pollTotal =
    pollSnapshot?.total ??
    Object.values(pollCounts).reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
  const pollOptionsSorted = pollSnapshot
    ? [...pollSnapshot.options].sort(
        (a, b) => (pollCounts[b.id] ?? 0) - (pollCounts[a.id] ?? 0),
      )
    : [];
  const pollDisplayOptions = pollOptionsSorted.slice(0, 3);
  const pollHasMore = pollOptionsSorted.length > pollDisplayOptions.length;
  const pollStatusLabel = pollSnapshot
    ? pollSnapshot.open
      ? "진행 중"
      : "종료됨"
    : null;
  const currentStep = liveSnapshot?.currentStep ?? null;
  const remainingSeconds =
    currentStep && typeof currentStep.seconds === "number" && currentStep.seconds > 0
      ? getRemainingSeconds(
          {
            startedAt: currentStep.startedAt,
            seconds: currentStep.seconds,
            paused: currentStep.paused,
            pausedAt: currentStep.pausedAt,
          },
          now,
        )
      : null;
  const presenceTop = canPresence ? presence?.activeTop ?? [] : [];
  const actionSummary = liveSnapshot?.studentActions ?? null;
  const actionCounts = actionSummary?.counts ?? { question: 0, help: 0, pulse: 0 };
  const filteredActionCounts = {
    question: canQuestions ? actionCounts.question : 0,
    help: canQuestions ? actionCounts.help : 0,
    pulse: canPulse ? actionCounts.pulse : 0,
  };
  const pulseAverage =
    actionSummary?.pulse && actionSummary.pulse.count > 0 ? actionSummary.pulse.average : null;
  const pulseAverageLabel = pulseAverage ? pulseAverage.toFixed(1) : "—";
  const pinnedCount = useMemo(() => snapshot.cards.filter((card) => card.isPinned).length, [snapshot.cards]);
  const recentActivityCount =
    filteredActionCounts.question + filteredActionCounts.help + filteredActionCounts.pulse;
  const recentActions = (actionSummary?.recent ?? []).filter((entry) => {
    if ((entry.kind === "question" || entry.kind === "help") && !canQuestions) return false;
    if (entry.kind === "pulse" && !canPulse) return false;
    return true;
  });
  const recentPreview = recentActions.slice(0, 3);
  const hasFreshActions = recentActions.some((entry) => now - entry.createdAt < 60_000);
  const triagePendingCount =
    teacherSnapshot?.studentActionTriage?.actions.filter((entry) => entry.status === "pending").length ?? 0;
  const triageEntries = useMemo(
    () =>
      teacherSnapshot?.studentActionTriage?.actions ??
      liveSnapshot?.studentActionTriage?.actions ??
      [],
    [teacherSnapshot?.studentActionTriage?.actions, liveSnapshot?.studentActionTriage?.actions],
  );
  const triageItems = useMemo(
    () => triageEntriesToItems(triageEntries, initialSnapshot.board.id),
    [initialSnapshot.board.id, triageEntries],
  );
  const triageSummary = useMemo(() => {
    return triageItems.reduce(
      (acc, item) => {
        if (item.status === "pending") acc.pending += 1;
        if (item.status === "approved") acc.approved += 1;
        if (item.pinned) acc.pinned += 1;
        return acc;
      },
      { pending: 0, approved: 0, pinned: 0 },
    );
  }, [triageItems]);
  const pinnedTriageItems = useMemo(
    () => triageItems.filter((item) => item.status === "approved" && item.pinned).slice(0, 3),
    [triageItems],
  );
  const hud = liveSnapshot?.controls?.hud ?? DEFAULT_HUD;
  const showRoster = hud.showRoster && canPresence;
  const showPulse = hud.showPulse && canPulse;
  const showPoll = canPolls;
  const showPinned = hud.showPinned && canQuestions;
  const actionTileCount = (canQuestions ? 2 : 0) + (showPulse ? 1 : 0);
  const actionGridClass =
    actionTileCount >= 3 ? "grid-cols-3" : actionTileCount === 2 ? "grid-cols-2" : "grid-cols-1";
  const connectionTone =
    connectionState === "ready" ? "ok" : connectionState === "stale" ? "warn" : connectionState === "error" ? "error" : "warn";
  const connectionBadgeClass =
    connectionTone === "ok"
      ? isContrastTheme
        ? "border border-emerald-200 bg-emerald-300 text-black shadow-[0_0_0_2px_#000]"
        : "border border-emerald-200/70 bg-emerald-500/15 text-emerald-50"
      : connectionTone === "error"
        ? isContrastTheme
          ? "border border-rose-200 bg-rose-300 text-black shadow-[0_0_0_2px_#000]"
          : "border border-rose-300/70 bg-rose-500/20 text-rose-50"
        : isContrastTheme
          ? "border border-amber-200 bg-amber-300 text-black shadow-[0_0_0_2px_#000]"
          : "border border-amber-300/70 bg-amber-500/20 text-amber-50";
  const connectionOverlay =
    connectionState === "ready"
      ? null
      : {
          title:
            connectionState === "connecting"
              ? "발표 화면 연결 중..."
              : connectionState === "stale"
                ? "업데이트가 잠시 멈췄어요."
                : connectionState === "error"
                  ? "연결이 끊겼습니다."
                  : "재연결 중입니다.",
          description:
            connectionState === "error"
              ? "네트워크를 확인한 뒤 새로고침해 주세요."
              : "마지막 화면은 유지되며 자동으로 다시 연결을 시도합니다.",
        };

  useEffect(() => {
    if (demoDelayRef.current) {
      window.clearTimeout(demoDelayRef.current);
      demoDelayRef.current = null;
    }
    if (demoOptOut || liveStatus !== "live") {
      setDemoVisible(false);
      return;
    }
    if (presenceCount === 0 && recentActivityCount === 0) {
      demoDelayRef.current = window.setTimeout(() => {
        setDemoVisible(true);
      }, 5000);
    } else {
      setDemoVisible(false);
    }
    return () => {
      if (demoDelayRef.current) {
        window.clearTimeout(demoDelayRef.current);
        demoDelayRef.current = null;
      }
    };
  }, [demoOptOut, liveStatus, presenceCount, recentActivityCount]);

  return (
    <div
      className={`min-h-screen pb-10 ${wrapperClass}`}
      data-present-root="true"
      data-present-theme={theme}
      data-present-focus={focusMode ? "on" : "off"}
      data-present-safe={safeMode ? "on" : "off"}
    >
      <DemoOverlaySlot
        demoEnabled={demoEnabled}
        steps={demoSteps}
        stepIndex={demoStepIndex}
        onNext={handleDemoNext}
        canAdvance={isTeacher}
      />
      {canPresence ? (
        <JoinDock shareCode={shareCode} presenceCount={presenceCount} expandSignal={joinDockExpandSignal} />
      ) : null}
      <PresentDemoLayer visible={demoVisible} onOptOut={handleDemoOptOut} />
      {connectionOverlay ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center px-4 pb-6 md:items-start md:pt-24">
          <div className="pointer-events-auto w-full max-w-xl rounded-3xl border border-white/20 bg-black/70 px-6 py-5 text-white shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-lg font-semibold">{connectionOverlay.title}</p>
                <p className="text-sm text-white/70">{connectionOverlay.description}</p>
              </div>
              {connectionState === "error" ? (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-white/90"
                >
                  새로고침
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl space-y-5 px-3 pt-2 md:px-6 lg:px-8">
        <div className={`sticky top-3 z-30 rounded-2xl border px-4 py-3 shadow-xl ${surfaceClass}`}>
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            {liveStatus === "live" ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white">
                {canPresence ? (
                  <span className="rounded-full bg-white/10 px-3 py-1">학생 {presenceCount}명</span>
                ) : null}
                <span className="rounded-full bg-white/10 px-3 py-1">요청 {recentActivityCount}</span>
                <span className="rounded-full bg-white/10 px-3 py-1">고정 {pinnedCount}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white">
                <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  연결중...
                </span>
                {lastLiveRequestId ? <span className="text-white/70">requestId: {lastLiveRequestId}</span> : null}
              </div>
            )}
            <button
              type="button"
              onClick={handleGuideReopen}
              className="ml-auto h-10 rounded-xl border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              다시 보기
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${mutedTextClass}`}>발표 리모컨</p>
                  <h1 className="truncate text-xl font-semibold leading-tight sm:text-2xl">{snapshot.board.title}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${accentBadgeClass}`}>코드 {shareCode}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                      {selectedWall ? selectedWall.title : "모든 벽 보기"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={safeMode}
                  aria-label={safeMode ? "Safe Mode 끄기" : "Safe Mode 켜기"}
                  onClick={() => toggleSafeMode()}
                  className={`h-11 rounded-xl px-3 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    safeMode
                      ? "border border-emerald-300 bg-emerald-500/25"
                      : "border border-white/20 bg-white/5 hover:border-white/40"
                  }`}
                >
                  Safe {safeMode ? "ON" : "OFF"}
                </button>
              </div>
              {showRoster ? (
                <div
                  className={`rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-white transition ${
                    presenceHighlight ? "scale-[1.02] shadow-[0_0_0_2px_rgba(148,163,184,0.4)]" : ""
                  }`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${mutedTextClass}`}>참여중</p>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="text-3xl font-semibold leading-none">{presenceCount}</span>
                    <span className="text-sm font-semibold text-white/80">명</span>
                  </div>
                  {presenceTop.length > 0 ? (
                    <p className="mt-1 text-xs text-white/80">Top {presenceTop.join(" · ")}</p>
                  ) : (
                    <p className="mt-1 text-xs text-white/60">닉네임은 선택 입력</p>
                  )}
                </div>
              ) : null}
              <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${mutedTextClass}`}>새 요청</p>
                  {hasFreshActions ? (
                    <span className="flex items-center gap-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-100">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
                      최근 1분
                    </span>
                  ) : null}
                </div>
                {actionTileCount > 0 ? (
                  <div className={`mt-2 grid gap-2 text-xs font-semibold text-white/80 ${actionGridClass}`}>
                    {canQuestions ? (
                      <div className="rounded-xl bg-white/10 px-2 py-2 text-center">
                        <p className="text-[11px] text-white/60">질문</p>
                        <p className="text-lg font-semibold text-white">{filteredActionCounts.question}</p>
                      </div>
                    ) : null}
                    {canQuestions ? (
                      <div className="rounded-xl bg-white/10 px-2 py-2 text-center">
                        <p className="text-[11px] text-white/60">도움</p>
                        <p className="text-lg font-semibold text-white">{filteredActionCounts.help}</p>
                      </div>
                    ) : null}
                    {showPulse ? (
                      <div className="rounded-xl bg-white/10 px-2 py-2 text-center">
                        <p className="text-[11px] text-white/60">이해도 평균</p>
                        <p className="text-lg font-semibold text-white">{pulseAverageLabel}</p>
                        <p className="text-[10px] text-white/50">{filteredActionCounts.pulse}회</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/60">활성화된 요청 도구가 없습니다.</p>
                )}
                {recentPreview.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-white/80">
                    {recentPreview.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2">
                        <span className="text-white/60">
                          {entry.kind === "question" ? "Q" : entry.kind === "help" ? "H" : "P"}
                        </span>
                        <span className="line-clamp-1">{formatActionPreview(entry)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/60">최근 요청이 없습니다.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["default", "contrast", "dark"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    onClick={() => setTheme(value)}
                    className={`h-11 flex-1 min-w-[96px] rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                      theme === value
                        ? "border-white bg-white text-gray-900"
                        : "border-white/20 bg-white/5 text-white hover:border-white/50"
                    }`}
                  >
                    {value === "default" ? "밝음" : value === "contrast" ? "고대비" : "어두움"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 font-semibold" aria-live="polite">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  최근 업데이트 {lastUpdatedText}
                </span>
                <span className={cn("flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold", connectionBadgeClass)} aria-live="polite">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      connectionTone === "ok" ? "bg-emerald-300" : connectionTone === "error" ? "bg-rose-300" : "bg-amber-400",
                    )}
                  />
                  {CONNECTION_LABELS[connectionState]}
                </span>
                {followBadgeVisible ? followStatusBadge : null}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${mutedTextClass}`}>제어</p>
                <button
                  type="button"
                  aria-label="발표 큐 열기"
                  onClick={presentQueue.togglePanel}
                  className="flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  큐 (Q)
                  {queueCount > 0 ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-900">
                      {queueCount}
                    </span>
                  ) : null}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["compact", "default", "large"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={cardSize === size}
                    onClick={() => setCardSize(size)}
                    className={`h-11 flex-1 min-w-[90px] rounded-xl border text-sm font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                      cardSize === size
                        ? "border-white bg-white text-gray-900"
                        : "border-white/20 bg-white/5 text-white hover:border-white/50"
                    }`}
                  >
                    {size === "compact" ? "작게" : size === "default" ? "기본" : "크게"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-1 items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-sm">
                  <button
                    type="button"
                    aria-label="줌 축소"
                    onClick={() => adjustZoom(-0.05)}
                    className="h-10 rounded-lg px-3 text-lg font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    -
                  </button>
                  <div className="min-w-[72px] text-center text-sm font-semibold text-white">{zoomPercent}%</div>
                  <button
                    type="button"
                    aria-label="줌 확대"
                    onClick={() => adjustZoom(0.05)}
                    className="h-10 rounded-lg px-3 text-lg font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label="줌 리셋"
                    onClick={resetZoom}
                    className="h-10 rounded-lg px-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    100%
                  </button>
                </div>
                <button
                  type="button"
                  aria-pressed={focusMode}
                  onClick={() => toggleFocusMode()}
                  className={`h-11 rounded-xl px-3 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    focusMode
                      ? "border border-cyan-200 bg-cyan-500/25 text-cyan-50"
                      : "border border-white/20 bg-white/10 hover:border-white/40"
                  }`}
                >
                  집중 모드 {focusMode ? "ON" : "OFF"}
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${mutedTextClass}`}>공유 · 프리셋</p>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className={`h-11 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${controlButtonClass}`}
                >
                  단축키 (?)
                </button>
                <button
                  type="button"
                  onClick={handleGuideReopen}
                  className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  가이드 다시 보기
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-11 flex-1 items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white/90">
                  <span>공유 코드</span>
                  <span className="text-lg">{shareCode}</span>
                </div>
                <a
                  href={shareLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  학생 링크
                </a>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`h-11 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${controlButtonClass}`}
                >
                  {isFullscreen ? "전체화면 종료 (F)" : "전체화면 (F)"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    applyProjectorPreset({
                      persist: projectorPresetPersist,
                      zoomTarget: Math.min(1.25, Math.max(effectiveZoom, 1.18)),
                    })
                  }
                  className="h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  프로젝터 최적 (Shift+P)
                </button>
                <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/40 bg-black/30 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    checked={projectorPresetPersist}
                    onChange={(event) => setProjectorPresetPersist(event.target.checked)}
                  />
                  <span>기본값으로 저장</span>
                </label>
                {isTeacher ? (
                  <button
                    type="button"
                    onClick={() => setTriageOpen(true)}
                    className="relative h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    교사용 패널
                    {triagePendingCount > 0 ? (
                      <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-2 text-xs font-semibold text-white">
                        {triagePendingCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                <div className="relative ml-auto" data-interactive="true">
                  <button
                    ref={optionsAnchorRef}
                    type="button"
                    aria-expanded={optionsOpen}
                    aria-haspopup="true"
                    onClick={() => setOptionsOpen((prev) => !prev)}
                    className="h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    보기 옵션
                  </button>
                  <AnchoredMenu
                    open={optionsOpen}
                    anchorRef={optionsAnchorRef}
                    menuRef={optionsLayerRef}
                    align="right"
                    role="dialog"
                    className={`w-80 rounded-2xl p-3 ${menuSurfaceClass}`}
                  >
                    <div className="flex flex-col gap-3 text-sm text-white">
                        {snapshot.walls.length > 1 ? (
                          <label className="space-y-1">
                            <span className={`block text-xs ${quietLabelClass}`}>벽 선택</span>
                            <select
                              className="w-full rounded-lg border border-white/15 bg-gray-950/70 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                              value={selectedWallId ?? ""}
                              onChange={(event) => void handleWallChange(event.target.value)}
                            >
                              <option value="">전체 보기</option>
                              {snapshot.walls.map((wall) => (
                                <option key={wall.id} value={wall.id}>
                                  {wall.title}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <div className="flex flex-col gap-2 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-white">최근 카드</p>
                              <p className={quietLabelClass}>최근 {recentMinutes}분 신규 {recentCards.recentCount}개</p>
                            </div>
                            <button
                              type="button"
                              onClick={recentCards.toggleRecentOnly}
                              className="rounded-full border border-sky-300/60 bg-sky-500/20 px-3 py-1 text-[11px] font-semibold text-sky-50 transition hover:border-sky-200"
                            >
                              {recentCards.showRecentOnly ? "전체 보기 (R)" : "신규만 (R)"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={clearRecent}
                            className="self-start rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-white/40"
                          >
                            최근 표시 초기화 (Shift+R)
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={quietLabelClass}>힌트 배지</span>
                          <button
                            type="button"
                            onClick={() => setShowHints(!showHints)}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-white/40"
                          >
                            {showHints ? "숨기기" : "보이기"}
                          </button>
                        </div>
                      </div>
                  </AnchoredMenu>
                </div>
              </div>
            </section>
          </div>
          {hintsVisible ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/80">
              <span className={`rounded-full px-3 py-1 font-semibold ${pillBaseClass}`}>
                T : 테마 순환 · Shift+T : 고대비
              </span>
              <span className={`rounded-full px-3 py-1 font-semibold ${pillBaseClass}`}>
                Ctrl/⌘ + + / - / 0 : 줌 조절
              </span>
              <span className={`rounded-full px-3 py-1 font-semibold ${pillBaseClass}`}>? : 단축키 도움말</span>
              <button
                type="button"
                onClick={toggleHints}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-semibold text-white transition hover:border-white/40"
              >
                힌트 숨기기
              </button>
            </div>
          ) : null}
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">현재 단계</p>
              <p className="mt-2 text-2xl font-semibold sm:text-3xl">{stageLabel}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-white/70">
                {stageStep ? <span className="rounded-full border border-white/20 px-3 py-1">{stageStep}</span> : null}
                {stageTarget ? <span className="rounded-full border border-white/20 px-3 py-1">대상: {stageTarget}</span> : null}
              </div>
            </div>
            {showPinned ? (
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white/70">
                핀된 질문
              </div>
            ) : null}
          </div>
          {currentStep?.title ? (
            <p className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">{currentStep.title}</p>
          ) : null}
          {currentStep?.prompt ? (
            <p className="mt-4 whitespace-pre-line text-2xl leading-relaxed text-white/90 sm:text-3xl">
              {currentStep.prompt}
            </p>
          ) : null}
          {remainingSeconds !== null ? (
            <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-3xl font-semibold">
              <span className="text-sm uppercase tracking-[0.2em] text-white/70">남은 시간</span>
              <span>
                {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                {String(remainingSeconds % 60).padStart(2, "0")}
              </span>
            </div>
          ) : null}
          {(triageSummary.pending + triageSummary.approved + triageSummary.pinned > 0 || pinnedTriageItems.length > 0) ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-white/70">
                <span className="uppercase tracking-[0.18em] text-white/60">Triage HUD</span>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">대기 {triageSummary.pending}</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">승인 {triageSummary.approved}</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">핀 {triageSummary.pinned}</span>
                </div>
              </div>
              {pinnedTriageItems.length ? (
                <ul className="mt-3 space-y-2">
                  {pinnedTriageItems.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">
                            {item.kind === "question" ? "질문" : "도움 요청"}
                          </p>
                          <p className="text-lg font-semibold leading-snug text-white/90">{item.text}</p>
                        </div>
                        <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                          📌
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/60">핀된 질문이 아직 없습니다.</p>
              )}
            </div>
          ) : null}
          {(showPulse || showPoll) && (pulseSnapshot || pollSnapshot) ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pulseSnapshot ? (
                <div className="rounded-2xl border border-cyan-200/40 bg-cyan-500/10 p-4">
                  <div className="flex items-center justify-between gap-2 text-sm font-semibold text-cyan-50">
                    <span>Pulse</span>
                    <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-bold text-white">
                      총 {pulseTotal}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(["ok", "unsure", "help"] as const).map((kind) => {
                      const count = pulseSnapshot?.[kind] ?? 0;
                      const label = kind === "ok" ? "이해" : kind === "unsure" ? "애매" : "도움";
                      const percent = pulseTotal > 0 ? Math.round((count / pulseTotal) * 100) : 0;
                      return (
                        <div key={kind} className="space-y-1 text-xs text-white/90">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{label}</span>
                            <span className="text-white/70">{percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/20">
                            <div
                              className="h-2 rounded-full bg-cyan-300"
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {pollSnapshot ? (
                <div className="rounded-2xl border border-amber-200/40 bg-amber-500/10 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-100">Quick Poll</p>
                      <p className="text-lg font-semibold leading-tight text-amber-50">{pollSnapshot.question}</p>
                    </div>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white">
                      {pollStatusLabel}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {pollDisplayOptions.map((option) => {
                      const count = pollCounts[option.id] ?? 0;
                      const percent = pollTotal > 0 ? Math.round((count / pollTotal) * 100) : 0;
                      return (
                        <div key={option.id} className="space-y-1 rounded-xl bg-white/10 p-3 text-xs text-white">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{option.label}</span>
                            <span className="text-white/70">{count}표 · {percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/15">
                            <div
                              className="h-2 rounded-full bg-amber-300"
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {pollHasMore ? (
                      <p className="text-[11px] font-semibold text-amber-50/80">
                        상위 3개 옵션만 표시 중 · 총 {pollSnapshot.options.length}개
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {showPinned ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-6">
              {pinnedQuestion ? (
                <div className="space-y-2">
                  <p className="text-2xl font-semibold leading-relaxed sm:text-3xl">
                    “{pinnedQuestion.body}”
                  </p>
                  {pinnedQuestion.author ? (
                    <p className="text-sm text-white/70">- {pinnedQuestion.author}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-lg text-white/60 sm:text-xl">지금은 질문이 없습니다.</p>
              )}
            </div>
          ) : null}
        </section>

        {liveStatus === "live" && presenceCount === 0 && recentActivityCount === 0 && !demoVisible ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-lg font-semibold text-white/85">
            학생이 gkrry.com에서 코드를 입력하면 바로 시작됩니다. 오른쪽 Join Dock을 켜두세요.
          </div>
        ) : null}

        {connectionState === "reconnecting" || connectionState === "stale" ? (
          <InlineAlert
            tone="warning"
            title={connectionState === "stale" ? "업데이트가 지연되고 있습니다." : "재연결 중입니다."}
            description="기존 화면은 유지되며 자동으로 다시 연결을 시도합니다."
            className="bg-amber-500/10 text-amber-50"
          />
        ) : null}
        {connectionState === "error" ? (
          <InlineAlert
            tone="warning"
            title="연결이 끊겼습니다."
            description="네트워크를 확인한 뒤 새로고침해 주세요."
            className="bg-rose-500/10 text-rose-50"
          />
        ) : null}
        {followError ? (
          <InlineAlert
            tone="warning"
            title="따라가기 상태 동기화가 지연되고 있습니다."
            description={followError}
            className="bg-orange-500/10 text-orange-50"
            action={
              <button
                type="button"
                onClick={() => {
                  setFollowError(null);
                  void fetchFollowState();
                }}
                className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-100 transition hover:border-orange-300 hover:text-white"
              >
                다시 시도
              </button>
            }
          />
        ) : null}

        {feedback ? (
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-lg">
            {feedback}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: gridGap }}>
          {visibleCards.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-lg font-semibold text-gray-200">
              아직 카드가 없습니다. 잠시 후 자동으로 새 카드가 반영됩니다.
            </div>
          ) : (
            visibleCards.map((card) => {
            const isActive = card.id === activeCardId;
            const tagLimit = quietChrome ? 2 : TAG_DISPLAY_LIMIT;
            const visibleTags = (card.tags ?? []).slice(0, tagLimit);
            const extraTags = Math.max((card.tags?.length ?? 0) - tagLimit, 0);
            const isRecent = recentCards.recentIds.has(card.id);
            const isFreshCard = isFresh(card.id);
            const isQueued = presentQueue.queuedIds.has(card.id);
            const queueActionLabel = quietChrome ? "+ 큐" : "+ 발표 큐";

            return (
              <CardTile
                key={card.id}
                as="div"
                interactive
                variant="present"
                selected={isActive || isFreshCard}
                subdued={!isActive}
                calm={quietChrome}
                onClick={() => handleCardClick(card.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleCardClick(card.id);
                  }
                }}
                className={`h-full text-left ${isContrastTheme ? "focus-visible:ring-white/40 focus-visible:ring-offset-black" : "focus-visible:ring-white/40 focus-visible:ring-offset-slate-900/40"} ${isActive ? activeCardBorderClass : idleCardBorderClass} ${getCardColorClass(card.cardColorToken)}`}
                style={{ fontSize: cardFontSize, padding: cardPadding }}
              >
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  {isRecent ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${newBadgeClass}`}>
                      NEW
                      {isFreshCard ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : null}
                    </span>
                  ) : null}
                  {isQueued ? (
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${queuedBadgeClass}`}>
                      Queued
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToQueue(card.id, card.wallId);
                      }}
                      className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-gray-800 transition hover:bg-white"
                    >
                      {queueActionLabel}
                    </button>
                  )}
                </div>
                <div className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-gray-700">
                  <span className="truncate rounded-full bg-white/70 px-2 py-1 text-[11px] text-gray-800">
                    {card.wallTitle}
                  </span>
                  <div className="flex items-center gap-2">
                    {card.isFeatured ? (
                      <span className="rounded-full bg-purple-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm">
                        대표
                      </span>
                    ) : null}
                    {card.isPinned ? (
                      <span className="rounded-full bg-amber-500 px-2 py-1 text-[11px] font-bold text-white shadow-sm">
                        고정
                      </span>
                    ) : null}
                    {card.attachmentsCount > 0 && !quietChrome ? (
                      <span className="rounded-full bg-gray-900 px-2 py-1 text-[11px] font-semibold text-gray-100">
                        첨부 {card.attachmentsCount}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="w-full whitespace-pre-wrap text-[21px] font-semibold leading-8 text-gray-900">
                  {card.authorName ? <span className="mr-2 text-base text-gray-700">{card.authorName}:</span> : null}
                  <LinkifiedText text={card.text} compact linkClassName="text-blue-700 hover:text-blue-800 focus-visible:ring-blue-500 focus-visible:ring-offset-white" />
                </p>
                {(card.tags?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full bg-gray-900/80 px-3 py-1 text-xs font-semibold text-white"
                        style={{ borderColor: tag.color ?? undefined, borderWidth: 1 }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {extraTags > 0 ? (
                      <span className="rounded-full bg-gray-900/60 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                        +{extraTags}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <span className="text-xs font-medium text-gray-700">
                  {new Date(card.createdAt).toLocaleString("ko-KR", {
                    hour12: false,
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </CardTile>
            );
          })
        )}
      </div>

      {focusedCardId && selectedCard ? (
        <div className={`fixed inset-0 z-40 ${overlayBackground} backdrop-blur-sm`}>
          <div className="relative mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto px-4 py-8">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-200">{selectedCard.wallTitle}</p>
                <h2 className="text-3xl font-bold text-white leading-tight">{selectedCard.text}</h2>
                {selectedCard.authorName ? (
                  <p className="text-sm text-gray-300">작성자: {selectedCard.authorName}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (presentQueue.queuedIds.has(selectedCard.id)) {
                      presentQueue.removeFromQueue(selectedCard.id);
                      setFeedback("큐에서 제거되었습니다.");
                    } else {
                      presentQueue.addToQueue(selectedCard.id, selectedCard.wallId);
                      setFeedback("현재 카드가 큐에 추가되었습니다.");
                    }
                  }}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    presentQueue.queuedIds.has(selectedCard.id)
                      ? "border-emerald-300 bg-emerald-500/20 text-emerald-50 hover:border-emerald-200"
                      : "border-white/20 bg-white/10 text-white hover:border-white/40"
                  }`}
                >
                  {presentQueue.queuedIds.has(selectedCard.id) ? "큐에서 제거" : "큐에 추가 (A)"}
                </button>
                <button
                  type="button"
                  onClick={() => moveSelection(-1)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  이전 (←/j)
                </button>
                <button
                  type="button"
                  onClick={() => moveSelection(1)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  다음 (→/k)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markFollowOverride();
                    setFocusedCardId(null);
                  }}
                  className="rounded-full border border-white/30 bg-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/60"
                >
                  닫기 (Esc)
                </button>
              </div>
            </div>

            {(selectedCard.tags?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {selectedCard.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                    style={{ borderColor: tag.color ?? undefined }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}

            {selectedCard.attachmentsCount > 0 ? (
              <div className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-gray-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">첨부 {selectedCard.attachmentsCount}</span>
                  <span>파일 및 링크</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-100">
                  {selectedCard.files.map((file) => (
                    <li key={file.id}>
                      <a
                        className="text-indigo-200 underline underline-offset-4 transition hover:text-indigo-100"
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.filename}
                      </a>
                    </li>
                  ))}
                  {selectedCard.externalAttachments.map((attachment, index) => (
                    <li key={`${attachment.filename}-${index}`}>
                      {attachment.downloadPath ? (
                        <a
                          href={attachment.downloadPath}
                          className="text-indigo-200 underline underline-offset-4 transition hover:text-indigo-100"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {attachment.filename}
                        </a>
                      ) : (
                        <span>{attachment.filename}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {fullscreenUnsupported ? (
        <InlineAlert
          tone="info"
          title="브라우저에서 전체화면을 지원하지 않습니다."
          description="필요하다면 브라우저 설정에서 전체화면을 허용해주세요."
          className="bg-white/5 text-white"
        />
      ) : null}

      <div
        className={`fixed inset-y-4 right-4 z-30 flex w-full max-w-md flex-col gap-3 rounded-2xl p-4 shadow-xl transition duration-200 ${
          isContrastTheme ? "border border-white/30 bg-black/90" : "border border-white/15 bg-gray-900/90 backdrop-blur"
        } ${presentQueue.panelOpen ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-gray-300">발표 큐</p>
            <p className="text-lg font-semibold text-white">총 {presentQueue.queue.length}개</p>
          </div>
          <button
            type="button"
            onClick={presentQueue.togglePanel}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40"
          >
            닫기 (Q)
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-200">
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">N / → : 다음 열기</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">↑ ↓ : 순서 변경</span>
        </div>
        {presentQueue.queue.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-gray-300">
            큐에 추가된 카드가 없습니다. 카드의 “+ 발표 큐” 버튼을 눌러 추가하세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {presentQueue.queue.map((entry) => {
              const card = orderedCards.find((c) => c.id === entry.cardId);
              return (
                <li
                  key={`${entry.cardId}-${entry.addedAt}`}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-xs text-gray-200">{card?.wallTitle ?? "알 수 없음"}</p>
                      <p className="line-clamp-1 text-base font-semibold">{card?.text ?? entry.cardId}</p>
                      {(card?.tags?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {card?.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold"
                              style={{ border: `1px solid ${tag.color ?? "rgba(255,255,255,0.3)"}` }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          presentQueue.moveUp(entry.cardId);
                        }}
                        className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white transition hover:border-white/30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          presentQueue.moveDown(entry.cardId);
                        }}
                        className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white transition hover:border-white/30"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenQueueCard(entry.cardId)}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40"
                    >
                      열기
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => presentQueue.removeFromQueue(entry.cardId)}
                        className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white transition hover:border-white/40"
                      >
                        삭제
                      </button>
                      <span className="text-[11px] text-gray-300">
                        {new Date(entry.addedAt).toLocaleTimeString("ko-KR", { hour12: false })}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {presentQueue.queue.length > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const next = presentQueue.popNext();
                if (next) {
                  handleOpenQueueCard(next.cardId);
                }
              }}
              className="flex-1 rounded-lg border border-emerald-300 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:border-emerald-200"
            >
              다음 카드 열기 (N)
            </button>
            <button
              type="button"
              onClick={presentQueue.clearQueue}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/40"
            >
              전체 비우기
            </button>
          </div>
        ) : null}
      </div>

      {triageOpen && isTeacher ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setTriageOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">교사용 패널</p>
                <p className="text-xs text-gray-500">질문/도움요청 처리</p>
              </div>
              <button
                type="button"
                onClick={() => setTriageOpen(false)}
                className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pt-4">
              <TriagePanel
                boardId={initialSnapshot.board.id}
                liveEntries={teacherSnapshot?.studentActionTriage?.actions ?? liveSnapshot?.studentActionTriage?.actions ?? null}
              />
            </div>
          </div>
        </div>
      ) : null}

      {focusMode && isTeacher ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex w-full justify-center p-3 sm:inset-y-0 sm:right-0 sm:bottom-auto sm:justify-end sm:p-4 sm:max-w-[460px]">
          <div className="pointer-events-auto w-full sm:max-w-[440px]">
            <HudControlPanel boardId={initialSnapshot.board.id} toolsEnabled={toolsEnabled} />
          </div>
        </div>
      ) : null}

      <PresentHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} theme={theme} />
      <PresentGuideOverlay
        open={guideOpen}
        shareCode={shareCode}
        onClose={handleGuideDismiss}
        onRequestExpandJoinDock={handleGuideExpandJoinDock}
      />
    </div>
  </div>
  );
}
