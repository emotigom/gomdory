"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { start as startWebLLM } from "@/lib/edu/llm/webllmWorkerBridge";
import type { LocalWebLLMDiagnostics } from "@/lib/edu/llm/webllmWorkerTypes";
import {
  getGeneratorOverrideFlags,
  setGeneratorOverrideFlags,
} from "@/lib/edu/llm/diagnostics";
import {
  getWebllmModelIds,
  getWebllmPaths,
  getWebllmPathsForModelId,
} from "@/lib/edu/llm/webllmConfig";
import { hashRoomCodeShort } from "@/lib/edu/netsaver/hash";
import type { NetworkSaverTier } from "@/lib/edu/netsaver/config";
import {
  getNetworkSaverMetricsSnapshot,
  setShardTier3Disabled,
} from "@/lib/edu/netsaver/metrics";
import { releaseActiveLease } from "@/lib/edu/netsaver/modelFetcherShim";
import { runP2PProbe } from "@/lib/edu/netsaver/p2pProbe";
import { subscribeAutoDowngradeEvents } from "@/lib/edu/netsaver/autoDowngrade";
import {
  buildNetworkSaverRecommendation,
  type NetworkSaverRecommendation,
} from "@/lib/edu/netsaver/recommendation";
import {
  clearNetworkSaverConfig,
  loadNetworkSaverConfig,
  saveNetworkSaverConfig,
  type NetworkSaverStoredConfig,
} from "@/lib/edu/netsaver/recommendationConfig";
import {
  clearNetworkSaverCodeOverride,
  loadNetworkSaverCodeOverride,
  saveNetworkSaverCodeOverride,
  type NetworkSaverCodeOverride,
} from "@/lib/edu/netsaver/codeConfig";
import { getResourceJournalSnapshot } from "@/lib/edu/netsaver/resourceJournal";
import { setTier3Disabled } from "@/lib/edu/netsaver/tier3Guard";
import { runPrewarm, type PrewarmProgress } from "@/lib/edu/netsaver/prewarm";
import { getActiveWasmSwarm } from "@/lib/edu/netsaver/wasmSwarm";
import { rearmBoostWindow } from "@/lib/edu/netsaver/boostWindow";
import { disableEpidemicForRoom } from "@/lib/edu/netsaver/epidemicControl";

const TEACHER_FLAG_KEY = "edu:webllm:teacher";
const SKIP_JITTER_KEY = "edu:netsaver:skip-jitter";
const CHAT_RESET_EVENT = "edu:chat-reset";
const devToolsEnabled = process.env.NODE_ENV !== "production";

type CheckState = {
  status: "idle" | "loading" | "ok" | "error";
  message?: string;
};

type PrewarmState = {
  status: "idle" | "running" | "done" | "aborted";
  progress: PrewarmProgress | null;
  okCount: number;
  failCount: number;
  lastError: string | null;
};

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const formatTime = (value: number | null) =>
  value ? new Date(value).toLocaleTimeString() : "-";

const formatRemaining = (until?: number | null) => {
  if (!until) return "-";
  const remainingMs = until - Date.now();
  if (remainingMs <= 0) return "만료됨";
  const remainingMin = Math.ceil(remainingMs / 60000);
  return `${remainingMin}분`;
};

const buildEmptyDiagnostics = (): LocalWebLLMDiagnostics => {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  return {
    coach: {
      modelId: null,
      loaded: false,
      lastSuccessAt: null,
    },
    generator: {
      modelId: null,
      primaryLoaded: false,
      fallbackLoaded: false,
      lastSuccessAt: null,
    },
    modelIds: {
      primary: primaryModelId,
      fallback: fallbackModelId ?? null,
    },
    loadedModelIds: [],
    lastRequestDurations: {
      coachMs: null,
      generatorMs: null,
    },
    recentCounts: {
      coachStallAborts: 0,
      generatorTimeouts: 0,
      fallbackUsed: 0,
      insuranceTemplateApplied: 0,
      engineResets: 0,
    },
    lastError: null,
  };
};

export default function TeacherDebugPanel() {
  if (!devToolsEnabled) return null;

  return <TeacherDebugPanelInner />;
}

function TeacherDebugPanelInner() {
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [diagnostics, setDiagnostics] = useState(buildEmptyDiagnostics());
  const [generatorOverrides, setGeneratorOverrides] = useState(getGeneratorOverrideFlags());
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
  const [modelCheck, setModelCheck] = useState<CheckState>({ status: "idle" });
  const [wasmPrimaryCheck, setWasmPrimaryCheck] = useState<CheckState>({ status: "idle" });
  const [wasmFallbackCheck, setWasmFallbackCheck] = useState<CheckState>({ status: "idle" });
  const [netsaverMetrics, setNetsaverMetrics] = useState(getNetworkSaverMetricsSnapshot());
  const [roomHash, setRoomHash] = useState<string>("-");
  const [probeState, setProbeState] = useState<CheckState>({ status: "idle" });
  const [resourceJournal, setResourceJournal] = useState<Awaited<
    ReturnType<typeof getResourceJournalSnapshot>
  > | null>(null);
  const [recommendation, setRecommendation] = useState<NetworkSaverRecommendation | null>(null);
  const [storedConfig, setStoredConfig] = useState<NetworkSaverStoredConfig | null>(null);
  const [storedConfigHash, setStoredConfigHash] = useState<string | null>(null);
  const [codeOverride, setCodeOverride] = useState<NetworkSaverCodeOverride | null>(null);
  const [codeOverrideHash, setCodeOverrideHash] = useState<string | null>(null);
  const [autoPilotTier, setAutoPilotTier] = useState<NetworkSaverTier>("wasm");
  const [autoPilotNotice, setAutoPilotNotice] = useState<string | null>(null);
  const [prewarmConfig, setPrewarmConfig] = useState({
    includeWasm: true,
    includeMeta: true,
    includeSmallShards: false,
  });
  const [prewarmState, setPrewarmState] = useState<PrewarmState>({
    status: "idle",
    progress: null,
    okCount: 0,
    failCount: 0,
    lastError: null,
  });

  const refreshDiagnostics = useCallback(async () => {
    const requestId = `diagnostics-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await startWebLLM(requestId, { kind: "diagnostics" });
    if (response.type === "result" && response.kind === "diagnostics") {
      setDiagnostics(response.result);
    }
  }, []);
  const [skipJitter, setSkipJitter] = useState(false);
  const [boostNotice, setBoostNotice] = useState<string | null>(null);
  const [epidemicNotice, setEpidemicNotice] = useState<string | null>(null);
  const [boostInFlight, setBoostInFlight] = useState(false);
  const prewarmAbortRef = useRef<AbortController | null>(null);

  const resourcePaths = useMemo(() => {
    try {
      const primary = getWebllmPaths();
      const fallback = primary.fallbackModelId
        ? getWebllmPathsForModelId(primary.fallbackModelId)
        : null;
      return { ok: true as const, primary, fallback };
    } catch (error) {
      const message = error instanceof Error ? error.message : "환경 설정 오류";
      return { ok: false as const, message };
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const teacherFromQuery = params.get("teacher") === "1";
      if (teacherFromQuery) {
        window.localStorage.setItem(TEACHER_FLAG_KEY, "1");
      }
      const stored = window.localStorage.getItem(TEACHER_FLAG_KEY) === "1";
      setIsTeacherMode(teacherFromQuery || stored);
      setSkipJitter(window.localStorage.getItem(SKIP_JITTER_KEY) === "1");
    } catch {
      setIsTeacherMode(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey && event.code === "KeyD")) return;
      event.preventDefault();
      setIsTeacherMode((prev) => {
        const next = !prev;
        try {
          if (next) {
            window.localStorage.setItem(TEACHER_FLAG_KEY, "1");
          } else {
            window.localStorage.removeItem(TEACHER_FLAG_KEY);
          }
        } catch {
          // ignore storage failures
        }
        return next;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isTeacherMode) return;
    void refreshDiagnostics();
    const intervalId = window.setInterval(() => {
      void refreshDiagnostics();
      setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [isTeacherMode, refreshDiagnostics]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const unsubscribe = subscribeAutoDowngradeEvents((event) => {
      setAutoPilotNotice(
        `자동 강등됨: ${event.reason} (30분 후 재시도 가능)`,
      );
      window.setTimeout(() => setAutoPilotNotice(null), 10_000);
    });
    return () => unsubscribe();
  }, [isTeacherMode]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setRoomHash("-");
      return;
    }
    void hashRoomCodeShort(code).then(setRoomHash).catch(() => setRoomHash("-"));
  }, [isTeacherMode]);

  useEffect(() => {
    if (codeOverride?.tier) {
      setAutoPilotTier(codeOverride.tier);
    }
  }, [codeOverride?.tier]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setResourceJournal(null);
      setRecommendation(null);
      setStoredConfig(null);
      setStoredConfigHash(null);
      setCodeOverride(null);
      setCodeOverrideHash(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const snapshot = await getResourceJournalSnapshot(code);
      if (cancelled) return;
      setResourceJournal(snapshot);
      const metricsSnapshot = getNetworkSaverMetricsSnapshot();
      setRecommendation(
        buildNetworkSaverRecommendation({
          journal: snapshot,
          metrics: metricsSnapshot,
        }),
      );
      const loaded = await loadNetworkSaverConfig(code);
      if (cancelled) return;
      setStoredConfig(loaded?.config ?? null);
      setStoredConfigHash(loaded?.codeHash ?? snapshot?.codeHash ?? null);
      const loadedOverride = await loadNetworkSaverCodeOverride(code);
      if (cancelled) return;
      setCodeOverride(loadedOverride?.override ?? null);
      setCodeOverrideHash(loadedOverride?.codeHash ?? null);
    };
    void refresh();
    const intervalId = window.setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isTeacherMode]);

  const handleOverrideToggle = useCallback(
    (key: "forceFallback" | "forceTemplate") => {
      const next = { ...generatorOverrides, [key]: !generatorOverrides[key] };
      setGeneratorOverrides(next);
      setGeneratorOverrideFlags(next);
    },
    [generatorOverrides],
  );

  const handleResetCoach = useCallback(async () => {
    const requestId = `reset-coach-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await startWebLLM(requestId, { kind: "reset", scope: "coach" });
    await refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleResetChat = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("대화를 초기화할까요?");
    if (!ok) return;
    window.dispatchEvent(new CustomEvent(CHAT_RESET_EVENT));
  }, []);

  const runCheck = useCallback(async (url: string, setter: (state: CheckState) => void) => {
    if (!url) return;
    setter({ status: "loading" });
    try {
      const response = await fetchWithTimeout(url, 4500);
      if (!response.ok) {
        setter({ status: "error", message: `HTTP ${response.status}` });
        return;
      }
      setter({ status: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청 실패";
      setter({ status: "error", message });
    }
  }, []);

  const handleQuickResourceCheck = useCallback(() => {
    if (!resourcePaths.ok) {
      const errorState = { status: "error" as const, message: resourcePaths.message };
      setModelCheck(errorState);
      setWasmPrimaryCheck(errorState);
      setWasmFallbackCheck(errorState);
      setLastCheckAt(Date.now());
      return;
    }
    const modelUrl = `${resourcePaths.primary.modelUrl}mlc-chat-config.json`;
    void runCheck(modelUrl, setModelCheck);
    void runCheck(resourcePaths.primary.wasmUrl, setWasmPrimaryCheck);
    if (resourcePaths.fallback?.wasmUrl) {
      void runCheck(resourcePaths.fallback.wasmUrl, setWasmFallbackCheck);
    } else {
      setWasmFallbackCheck({ status: "idle" });
    }
    setLastCheckAt(Date.now());
  }, [resourcePaths, runCheck]);

  const handleProbeP2P = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    setProbeState({ status: "loading" });
    try {
      const result = await runP2PProbe(code);
      setProbeState(result.ok ? { status: "ok" } : { status: "error", message: result.reason });
    } catch (error) {
      const message = error instanceof Error ? error.message : "probe_failed";
      setProbeState({ status: "error", message });
    }
    setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
  }, []);

  const handleReleaseLease = useCallback(async () => {
    await releaseActiveLease();
    setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
  }, []);

  const handleBoostRearm = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    if (boostInFlight) return;
    setBoostInFlight(true);
    const result = await rearmBoostWindow(code, 30_000);
    setBoostInFlight(false);
    if (result.ok) {
      setBoostNotice("부스트 30초 재가동됨");
      setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
      window.setTimeout(() => setBoostNotice(null), 6_000);
      return;
    }
    if (result.reason === "cooldown") {
      const seconds = result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : 60;
      setBoostNotice(`쿨다운 중: ${seconds}초 후 재시도 가능`);
    } else if (result.reason === "blocked") {
      const minutes = result.retryAfterMs ? Math.ceil(result.retryAfterMs / 60000) : 5;
      setBoostNotice(`재가동이 잦아 ${minutes}분 동안 비활성화됨`);
    } else {
      setBoostNotice("부스트 재가동 실패");
    }
    window.setTimeout(() => setBoostNotice(null), 8_000);
  }, [boostInFlight]);

  const handleDisableTier3 = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    setTier3Disabled(code, "manual_disable");
    setShardTier3Disabled(true, "manual_disable");
    setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
  }, []);

  const handleAutoPilotSave = useCallback(
    async (mode: "auto" | "lease_only") => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) return;
      setAutoPilotNotice(null);
      if (mode === "auto") {
        setProbeState({ status: "loading" });
        const result = await runP2PProbe(code);
        if (!result.ok) {
          const disabledUntil = Date.now() + 30 * 60 * 1000;
          const saved = await saveNetworkSaverCodeOverride(code, {
            mode: "lease_only",
            tier: autoPilotTier,
            disabledUntil,
            reason: "probe_fail",
          });
          setCodeOverride(saved?.override ?? null);
          setCodeOverrideHash(saved?.codeHash ?? null);
          setProbeState({ status: "error", message: result.reason ?? "fail" });
          setAutoPilotNotice("이 학교에서는 P2P가 차단된 것 같아요. 30분 뒤 다시 시도 가능");
          return;
        }
        setProbeState({ status: "ok" });
      }
      const saved = await saveNetworkSaverCodeOverride(code, {
        mode,
        tier: autoPilotTier,
      });
      setCodeOverride(saved?.override ?? null);
      setCodeOverrideHash(saved?.codeHash ?? null);
      setAutoPilotNotice(mode === "auto" ? "AUTO 활성됨" : "AUTO 끔 (lease_only)");
    },
    [autoPilotTier],
  );

  const handleAutoPilotReset = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    await clearNetworkSaverCodeOverride(code);
    setCodeOverride(null);
    setAutoPilotNotice("설정 초기화됨");
  }, []);

  const handleAutoPilotPersist = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const saved = await saveNetworkSaverCodeOverride(code, {
      mode: codeOverride?.mode ?? "lease_only",
      tier: autoPilotTier,
      disabledUntil: codeOverride?.disabledUntil,
      reason: codeOverride?.reason,
    });
    setCodeOverride(saved?.override ?? null);
    setCodeOverrideHash(saved?.codeHash ?? null);
    setAutoPilotNotice("설정 저장됨 (7일)");
  }, [autoPilotTier, codeOverride]);

  const handleApplyRecommendation = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code || !recommendation) return;
    const saved = await saveNetworkSaverConfig(code, {
      mode: recommendation.mode,
      tier: recommendation.tier,
      allowlist: recommendation.p2pAllowlist,
    });
    setStoredConfig(saved?.config ?? null);
    setStoredConfigHash(saved?.codeHash ?? null);
  }, [recommendation]);

  const handleResetRecommendation = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    await clearNetworkSaverConfig(code);
    setStoredConfig(null);
  }, []);

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const snapshot = await getResourceJournalSnapshot(code);
    const metricsSnapshot = getNetworkSaverMetricsSnapshot();
    const computedRecommendation = buildNetworkSaverRecommendation({
      journal: snapshot,
      metrics: metricsSnapshot,
    });
    const payload = {
      exportedAt: new Date().toISOString(),
      netsaver: {
        codeHash: snapshot?.codeHash ?? storedConfigHash ?? "-",
        metrics: metricsSnapshot,
        recommendation: computedRecommendation,
        journal: snapshot,
        storedConfig: storedConfig ?? null,
        codeOverride: codeOverride
          ? {
              codeHash: codeOverrideHash ?? snapshot?.codeHash ?? "-",
              override: codeOverride,
            }
          : null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `netsaver-recommendation-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [codeOverride, codeOverrideHash, storedConfig, storedConfigHash]);

  const handlePrewarmStop = useCallback(() => {
    prewarmAbortRef.current?.abort();
    prewarmAbortRef.current = null;
  }, []);

  const seedLiteAutoMode = storedConfig?.mode === "auto";

  const handlePrewarm = useCallback(
    async (seedLiteRequested = false) => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code || prewarmState.status === "running") return;
      setPrewarmState({
        status: "running",
        progress: { index: 0, total: 0, resource: null },
        okCount: 0,
        failCount: 0,
        lastError: null,
      });
      const controller = new AbortController();
      prewarmAbortRef.current = controller;
      const result = await runPrewarm(
        {
          code,
          tier: netsaverMetrics.tier,
          includeWasm: prewarmConfig.includeWasm,
          includeMeta: prewarmConfig.includeMeta,
          includeSmallShards: prewarmConfig.includeSmallShards,
          seedLite: { autoMode: seedLiteRequested && seedLiteAutoMode },
        },
        (progress) => setPrewarmState((prev) => ({ ...prev, progress })),
        controller.signal,
      );
      if (controller.signal.aborted) {
        setPrewarmState((prev) => ({
          ...prev,
          status: "aborted",
          lastError: "중단됨",
        }));
        prewarmAbortRef.current = null;
        return;
      }
      setPrewarmState((prev) => ({
        ...prev,
        status: "done",
        okCount: result.okCount,
        failCount: result.failCount,
        lastError: result.lastError,
      }));
      prewarmAbortRef.current = null;
    },
    [netsaverMetrics.tier, prewarmConfig, prewarmState.status, seedLiteAutoMode],
  );

  const handleSeedLiteStop = useCallback(() => {
    handlePrewarmStop();
    const swarm = getActiveWasmSwarm();
    swarm?.stopSeedLite("manual_stop", { disconnectPeers: true, downgrade: false });
    setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
  }, [handlePrewarmStop]);

  const handleSkipJitterToggle = useCallback(() => {
    setSkipJitter((prev) => {
      const next = !prev;
      try {
        if (next) {
          window.localStorage.setItem(SKIP_JITTER_KEY, "1");
        } else {
          window.localStorage.removeItem(SKIP_JITTER_KEY);
        }
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  const handleDisableEpidemic = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const disabledUntil = await disableEpidemicForRoom(code);
    if (disabledUntil) {
      setEpidemicNotice("이 반에서 30분 끔");
      setNetsaverMetrics(getNetworkSaverMetricsSnapshot());
    } else {
      setEpidemicNotice("코드 해시 실패");
    }
    window.setTimeout(() => setEpidemicNotice(null), 8_000);
  }, []);

  const handleReprobe = useCallback(() => {
    void handleProbeP2P();
  }, [handleProbeP2P]);

  if (!isTeacherMode) return null;

  const recentCounts = diagnostics.recentCounts;
  const prewarmSummary =
    prewarmState.status === "running"
      ? "수업 준비 중…"
      : prewarmState.status === "aborted"
        ? "중단됨"
        : prewarmState.failCount === 0 && prewarmState.okCount > 0
          ? "수업 시작 준비 완료"
          : prewarmState.okCount > 0
            ? "일부 실패(그래도 진행 가능)"
            : "대기 중";
  const seedLiteReady = seedLiteAutoMode && netsaverMetrics.p2pProbe.status === "pass";
  const seedLiteMetrics = netsaverMetrics.seedLite;
  const boostMetrics = netsaverMetrics.boost;
  const epidemicMetrics = netsaverMetrics.epidemic;
  const epidemicDisabled =
    !!epidemicMetrics.disabledUntil && epidemicMetrics.disabledUntil > Date.now();
  const p2pDiagnostics = {
    status: netsaverMetrics.p2pProbe.status,
    connectedPeers: netsaverMetrics.p2p.connectionCount,
    peerCount: netsaverMetrics.p2p.connectionCount,
    originLeaseActive: netsaverMetrics.lease.active,
    lastProbeAt: netsaverMetrics.p2pProbe.lastAt,
    recentCounts: {
      p2pHitCount: netsaverMetrics.p2p.recent5m,
      originFetchCount: netsaverMetrics.origin.recent5m,
      leaseWaitCount: netsaverMetrics.lease.waitRecent5m,
    },
  };
  const boostEndsAt =
    boostMetrics.startAt && boostMetrics.durationMs
      ? boostMetrics.startAt + boostMetrics.durationMs
      : null;
  const boostRemainingMs = boostEndsAt ? Math.max(0, boostEndsAt - Date.now()) : null;
  const boostActive = boostRemainingMs !== null && boostRemainingMs > 0;
  const boostStatus = boostActive
    ? "active"
    : netsaverMetrics.quietMode.enabled
      ? "quiet"
      : "idle";
  const boostStatusLabel = boostActive
    ? `부스트 중(남은 시간: ${Math.max(1, Math.ceil((boostRemainingMs ?? 0) / 1000))}초)`
    : "조용 모드";
  const autoPilotMode = codeOverride?.mode ?? "lease_only";
  const autoPilotDisabled =
    !!codeOverride?.disabledUntil && codeOverride.disabledUntil > Date.now();
  const teacherModeLabel = autoPilotMode === "auto" ? "AUTO(파일럿)" : "LEASE 전용";
  const boostButtonDisabled = boostInFlight || autoPilotMode !== "auto" || autoPilotDisabled;

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[90vw] space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 text-[11px] text-slate-600 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">Teacher Debug / Recovery</p>
          <p className="mt-1 text-[10px] text-slate-400">
            Ctrl + Shift + D로 숨김/표시
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetChat}
            aria-label="Reset chat"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-white text-[13px] text-rose-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
          >
            <span aria-hidden="true">♻️</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTeacherMode(false)}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
          >
            닫기
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">NETSAVER 상태</p>
        <div className="grid gap-1 text-[11px] text-slate-600">
          <p>모드: {teacherModeLabel}</p>
          <p>상태: {boostStatusLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleBoostRearm()}
          disabled={boostButtonDisabled}
          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          부스트 30초
        </button>
        {boostNotice ? (
          <p className="text-[10px] font-semibold text-amber-600">{boostNotice}</p>
        ) : null}
        {autoPilotDisabled ? (
          <p className="text-[10px] text-amber-500">자동 파일럿이 30분 쉬는 중</p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">모델 상태</p>
        <div className="grid gap-1">
          <p>coach model: {diagnostics.coach.modelId ?? "-"}</p>
          <p>generator model: {diagnostics.generator.modelId ?? "-"}</p>
          <p>primary model: {diagnostics.modelIds.primary}</p>
          <p>fallback model: {diagnostics.modelIds.fallback ?? "-"}</p>
        </div>
        <div className="mt-2 grid gap-1">
          <p>last success (coach): {formatTime(diagnostics.coach.lastSuccessAt)}</p>
          <p>last success (generator): {formatTime(diagnostics.generator.lastSuccessAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m coach stall {recentCounts.coachStallAborts}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m generator timeout {recentCounts.generatorTimeouts}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m fallback {recentCounts.fallbackUsed}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m insurance {recentCounts.insuranceTemplateApplied}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m engine reset {recentCounts.engineResets}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m p2p hit {p2pDiagnostics.recentCounts.p2pHitCount}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m origin fetch {p2pDiagnostics.recentCounts.originFetchCount}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">
          5m lease wait {p2pDiagnostics.recentCounts.leaseWaitCount}
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">Network Saver</p>
        <div className="grid gap-1 text-[10px] text-slate-500">
          <p>mode: {netsaverMetrics.mode}</p>
          <p>tier: {netsaverMetrics.tier}</p>
          <p>WASM P2P: {netsaverMetrics.wasm.p2pEnabled ? "enabled" : "disabled"}</p>
          <p>allowlist: {netsaverMetrics.allowlistCount}</p>
          <p>room hash: {roomHash}</p>
          <p>
            p2p probe: {netsaverMetrics.p2pProbe.status} @{" "}
            {netsaverMetrics.p2pProbe.lastAt ? formatTime(netsaverMetrics.p2pProbe.lastAt) : "-"}
          </p>
          <p>p2p connections: {netsaverMetrics.p2p.connectionCount}</p>
          <p>lease active: {netsaverMetrics.lease.active ? "yes" : "no"}</p>
          <p>lease wait: {netsaverMetrics.lease.waitCount}</p>
          <p>lease bypass: {netsaverMetrics.lease.bypassCount}</p>
          <p className="pt-1 text-[10px] font-semibold text-slate-600">Ramp-Up</p>
          <p>
            rampup window remaining:{" "}
            {netsaverMetrics.rampup.windowRemainingMs !== null
              ? `${Math.round(netsaverMetrics.rampup.windowRemainingMs / 1000)}s`
              : "-"}
          </p>
          <p>rampup last slot: {netsaverMetrics.rampup.lastSlot ?? "-"}</p>
          <p>
            rampup wait total/max-hit: {Math.round(netsaverMetrics.rampup.waitMsTotal)}ms/
            {netsaverMetrics.rampup.maxWaitHitCount}
          </p>
          <p className="pt-1 text-[10px] font-semibold text-slate-600">Boost</p>
          <p>boost status: {boostStatus}</p>
          <p>
            boost remaining:{" "}
            {boostActive && boostRemainingMs !== null
              ? `${Math.ceil(boostRemainingMs / 1000)}s`
              : "-"}
          </p>
          <p>
            quiet entered:{" "}
            {boostMetrics.quietEnteredAt ? formatTime(boostMetrics.quietEnteredAt) : "-"}
          </p>
          <p>boost rearm: {boostMetrics.rearmCount}</p>
          <p>quiet p2p skipped: {netsaverMetrics.quietMode.p2pSkippedCount}</p>
          <p>origin downloads (5m): {netsaverMetrics.origin.recent5m}</p>
          <p>
            wasm p2p hit/origin: {netsaverMetrics.wasm.p2pHitCount}/
            {netsaverMetrics.wasm.originFetchCount}
          </p>
          <p>
            wasm bytes p2p/origin: {Math.round(netsaverMetrics.wasm.bytesFromPeers / 1024)}KB/
            {Math.round(netsaverMetrics.wasm.bytesFromOrigin / 1024)}KB
          </p>
          <p>wasm lease wait/bypass: {netsaverMetrics.wasm.leaseWaitCount}/{netsaverMetrics.wasm.leaseBypassCount}</p>
          <p>
            meta p2p hit/origin: {netsaverMetrics.meta.p2pHitCount}/{netsaverMetrics.meta.originFetchCount}
          </p>
          <p>
            meta bytes p2p/origin: {Math.round(netsaverMetrics.meta.bytesFromPeers / 1024)}KB/
            {Math.round(netsaverMetrics.meta.bytesFromOrigin / 1024)}KB
          </p>
          <p>
            shard p2p hit/origin: {netsaverMetrics.shard.p2pHitCount}/
            {netsaverMetrics.shard.originFetchCount}
          </p>
          <p>
            shard bytes p2p/origin: {Math.round(netsaverMetrics.shard.bytesFromPeers / 1024)}KB/
            {Math.round(netsaverMetrics.shard.bytesFromOrigin / 1024)}KB
          </p>
          <p>
            tier3 disabled: {netsaverMetrics.shard.tier3Disabled ? "yes" : "no"}
            {netsaverMetrics.shard.tier3DisabledReason
              ? ` (${netsaverMetrics.shard.tier3DisabledReason})`
              : ""}
          </p>
          <p>shard blocklist: {netsaverMetrics.shard.blocklistCount}</p>
          <p>
            meta files: tokenizer.json {netsaverMetrics.meta.byFilename["tokenizer.json"]} / tokenizer.model{" "}
            {netsaverMetrics.meta.byFilename["tokenizer.model"]} / config.json{" "}
            {netsaverMetrics.meta.byFilename["config.json"]}
          </p>
          <p>range bypass: {netsaverMetrics.rangeBypassCount}</p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={handleProbeP2P}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          >
            P2P 재프로브 ({probeState.status})
          </button>
          <button
            type="button"
            onClick={() => void handleBoostRearm()}
            disabled={boostButtonDisabled}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            부스트 30초
          </button>
          <button
            type="button"
            onClick={() => void handleReleaseLease()}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          >
            lease release
          </button>
          <button
            type="button"
            onClick={handleDisableTier3}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
          >
            Tier3 끄기 (30m)
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">AUTO 파일럿(이 반만)</p>
        <div className="grid gap-1 text-[10px] text-slate-500">
          <p>
            mode: {autoPilotMode} / tier: {codeOverride?.tier ?? autoPilotTier}
          </p>
          <p>
            disabledUntil: {autoPilotDisabled ? formatRemaining(codeOverride?.disabledUntil) : "-"}
          </p>
          <p>code hash: {codeOverrideHash ?? resourceJournal?.codeHash ?? "-"}</p>
          {codeOverride?.reason ? <p>reason: {codeOverride.reason}</p> : null}
          {autoPilotNotice ? (
            <p className="text-[10px] font-semibold text-amber-600">{autoPilotNotice}</p>
          ) : null}
        </div>
        <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px]">
          <span className="font-semibold text-slate-600">tier</span>
          <select
            value={autoPilotTier}
            onChange={(event) => setAutoPilotTier(event.target.value as NetworkSaverTier)}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
          >
            <option value="wasm">wasm</option>
            <option value="meta">meta</option>
            <option value="small_shards">small_shards</option>
          </select>
        </label>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => void handleAutoPilotSave("auto")}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          >
            이 반 AUTO 켜기 (tier={autoPilotTier})
          </button>
          <button
            type="button"
            onClick={() => void handleAutoPilotSave("lease_only")}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
          >
            이 반 AUTO 끄기(lease_only로 복귀)
          </button>
          <button
            type="button"
            onClick={() => void handleAutoPilotPersist()}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-600"
          >
            설정 저장(7일)
          </button>
          <button
            type="button"
            onClick={() => void handleAutoPilotReset()}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">Prewarm (수업 준비)</p>
        <div className="grid gap-1 text-[10px] text-slate-500">
          <p>{prewarmSummary}</p>
          <p>
            진행: {prewarmState.progress?.index ?? 0}/{prewarmState.progress?.total ?? 0}
          </p>
          <p>
            파일:{" "}
            {prewarmState.progress?.resource?.pathname
              ? prewarmState.progress.resource.pathname
              : "-"}
          </p>
          <p>
            결과: 성공 {prewarmState.okCount} / 실패 {prewarmState.failCount}
          </p>
          <p>마지막 오류: {prewarmState.lastError ?? "-"}</p>
          {seedLiteAutoMode ? (
            <>
              <p className="pt-1 text-[10px] font-semibold text-slate-600">
                Seed-lite 확산
              </p>
              <p>seed-lite: {seedLiteMetrics.enabled ? "enabled" : "disabled"}</p>
              <p>p2p probe: {netsaverMetrics.p2pProbe.status}</p>
              <p>connected peers (teacher): {netsaverMetrics.p2p.connectionCount}</p>
              <p>have broadcast: {seedLiteMetrics.haveBroadcastCount}</p>
              <p>
                bytes sent (recent):{" "}
                {Math.round(seedLiteMetrics.bytesSentRecent5m / 1024)}KB
              </p>
              <p>want served: {seedLiteMetrics.wantServedCount}</p>
              <p>stop reason: {seedLiteMetrics.stopReason ?? "-"}</p>
            </>
          ) : null}
        </div>
        <div className="grid gap-2">
          {seedLiteAutoMode ? (
            <>
              <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px]">
                <span className="font-semibold text-slate-600">Seed-lite 확산 활성</span>
                <input type="checkbox" checked={seedLiteMetrics.enabled} readOnly disabled />
              </label>
              <button
                type="button"
                onClick={() => void handlePrewarm(true)}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
                disabled={!seedLiteReady || prewarmState.status === "running"}
              >
                Seed-lite 시작 (Prewarm+broadcast)
              </button>
              <button
                type="button"
                onClick={handleSeedLiteStop}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
                disabled={!seedLiteMetrics.enabled}
              >
                Seed-lite 중단
              </button>
              <button
                type="button"
                onClick={handlePrewarmStop}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
                disabled={prewarmState.status !== "running"}
              >
                프리워밍 중단
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handlePrewarm()}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
              >
                프리워밍 시작 {prewarmState.status === "running" ? "(진행 중)" : ""}
              </button>
              <button
                type="button"
                onClick={handlePrewarmStop}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
                disabled={prewarmState.status !== "running"}
              >
                프리워밍 중단
              </button>
            </>
          )}
          <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px]">
            <span className="font-semibold text-slate-600">WASM (필수)</span>
            <input
              type="checkbox"
              checked={prewarmConfig.includeWasm}
              onChange={() =>
                setPrewarmConfig((prev) => ({ ...prev, includeWasm: !prev.includeWasm }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px]">
            <span className="font-semibold text-slate-600">config/tokenizer (권장)</span>
            <input
              type="checkbox"
              checked={prewarmConfig.includeMeta}
              onChange={() =>
                setPrewarmConfig((prev) => ({ ...prev, includeMeta: !prev.includeMeta }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px]">
            <span className="font-semibold text-slate-600">shards (무거움)</span>
            <input
              type="checkbox"
              checked={prewarmConfig.includeSmallShards}
              onChange={() =>
                setPrewarmConfig((prev) => ({
                  ...prev,
                  includeSmallShards: !prev.includeSmallShards,
                }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px]">
            <span className="font-semibold text-slate-600">학생 지연 건너뛰기</span>
            <input type="checkbox" checked={skipJitter} onChange={handleSkipJitterToggle} />
          </label>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">Epidemic 확산</p>
        <div className="grid gap-1 text-[10px] text-slate-500">
          <p>enabled: {epidemicMetrics.enabled ? "yes" : "no"}</p>
          <p>seed eligible (local): {epidemicMetrics.seedEligible ? "yes" : "no"}</p>
          <p>offers sent/accepted: {epidemicMetrics.offersSent}/{epidemicMetrics.offersAccepted}</p>
          <p>want served: {epidemicMetrics.wantServedCount}</p>
          <p>bytes sent: {Math.round(epidemicMetrics.bytesSent / 1024)}KB</p>
          <p>
            disabledUntil: {epidemicDisabled ? formatRemaining(epidemicMetrics.disabledUntil) : "-"}
          </p>
          {epidemicNotice ? (
            <p className="text-[10px] font-semibold text-amber-600">{epidemicNotice}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={handleDisableEpidemic}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
          >
            이 반에서 30분 끄기
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">Network Saver 추천</p>
        <div className="grid gap-1 text-[10px] text-slate-500">
          <p>현재 적용: {netsaverMetrics.mode}/{netsaverMetrics.tier}</p>
          <p>현재 allowlist: {netsaverMetrics.allowlistCount}</p>
          <p>
            추천: {recommendation?.mode ?? "-"} / {recommendation?.tier ?? "-"} (
            {recommendation?.p2pAllowlist.length ?? 0}개)
          </p>
          <p>추천 rampup: {recommendation?.rampupEnabled ? "on" : "off"}</p>
          <p>code hash: {resourceJournal?.codeHash ?? storedConfigHash ?? "-"}</p>
          {recommendation?.notes.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-slate-400">
              {recommendation.notes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[10px] text-slate-400">추천 근거 없음</p>
          )}
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => void handleApplyRecommendation()}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          >
            추천 적용(이 반에 저장)
          </button>
          <button
            type="button"
            onClick={() => void handleResetRecommendation()}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
          >
            추천 초기화
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-600"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <p className="text-[11px] font-semibold text-slate-700">최근 오류</p>
        <p className="text-[10px] text-slate-500">
          {diagnostics.lastError
            ? `${diagnostics.lastError.scope} · ${diagnostics.lastError.message}`
            : "최근 오류 없음"}
        </p>
        <p className="text-[10px] text-slate-400">
          code: {diagnostics.lastError?.code ?? "-"} / time:{" "}
          {diagnostics.lastError ? formatTime(diagnostics.lastError.at) : "-"}
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void handleResetCoach()}
          className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
        >
          Reset Coach Engine
        </button>
        <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
          <span className="font-semibold">Generator fallback 강제</span>
          <input
            type="checkbox"
            checked={generatorOverrides.forceFallback}
            onChange={() => handleOverrideToggle("forceFallback")}
          />
        </label>
        <label className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
          <span className="font-semibold">보험 템플릿 강제</span>
          <input
            type="checkbox"
            checked={generatorOverrides.forceTemplate}
            onChange={() => handleOverrideToggle("forceTemplate")}
          />
        </label>
        <button
          type="button"
          onClick={handleQuickResourceCheck}
          className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
        >
          리소스 재검사
        </button>
        <button
          type="button"
          onClick={handleReprobe}
          className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
        >
          P2P 재프로브
        </button>
      </div>

      <div className="space-y-1 text-[10px] text-slate-500">
        <p>p2p: {p2pDiagnostics.status}</p>
        <p>
          peers: {p2pDiagnostics.connectedPeers}/{p2pDiagnostics.peerCount}
        </p>
        <p>origin lease: {p2pDiagnostics.originLeaseActive ? "active" : "idle"}</p>
        <p>p2p last probe: {p2pDiagnostics.lastProbeAt ? formatTime(p2pDiagnostics.lastProbeAt) : "-"}</p>
        {resourcePaths.ok ? (
          <>
            <p>model config: {modelCheck.status}</p>
            <p>wasm primary: {wasmPrimaryCheck.status}</p>
            <p>wasm fallback: {wasmFallbackCheck.status}</p>
          </>
        ) : (
          <p>리소스 경로 오류: {resourcePaths.message}</p>
        )}
        <p>last check: {lastCheckAt ? formatTime(lastCheckAt) : "-"}</p>
      </div>
    </aside>
  );
}
