"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getConfiguredNetworkSaverMode,
  resolveNetworkSaverMode,
  type NetworkSaverMode,
  getP2PTier,
  getRampupEnabledDefault,
  type NetworkSaverTier,
  getStudentJitterMaxMs,
  getStudentJitterMinMs,
} from "@/lib/edu/netsaver/config";
import { installLeaseOnlyShim, releaseActiveLease } from "@/lib/edu/netsaver/modelFetcherShim";
import { cacheP2PDisabled, isP2PDisabledCached, runP2PProbe } from "@/lib/edu/netsaver/p2pProbe";
import {
  recordNetworkSaverError,
  recordStudentJitterApplied,
  setBoostWindowMetrics,
  setNetworkSaverAllowlistCount,
  setNetworkSaverMode,
  setNetworkSaverTier,
  setShardTier3Disabled,
  setRampupEnabled,
} from "@/lib/edu/netsaver/metrics";
import { installWasmFetchShim } from "@/lib/edu/netsaver/installWasmFetchShim";
import { getWasmAllowlist } from "@/lib/edu/netsaver/wasmAllowlist";
import { WasmSwarm, getActiveWasmSwarm, setActiveWasmSwarm } from "@/lib/edu/netsaver/wasmSwarm";
import { getTier3DisabledState } from "@/lib/edu/netsaver/tier3Guard";
import {
  loadNetworkSaverConfig,
  loadNetworkSaverOverride,
  resolveAllowlistUrls,
  saveDegradedNetworkSaverConfig,
} from "@/lib/edu/netsaver/recommendationConfig";
import { setNetworkPrepStatus, clearNetworkPrepStatus } from "@/lib/edu/netsaver/status";
import { runPrewarm } from "@/lib/edu/netsaver/prewarm";
import {
  recordAutoDowngradeProbeFailure,
  subscribeAutoDowngradeEvents,
} from "@/lib/edu/netsaver/autoDowngrade";
import { loadNetworkSaverCodeOverride } from "@/lib/edu/netsaver/codeConfig";
import {
  hydrateBoostWindowState,
  setQuietModeState,
  subscribeBoostWindowEvents,
  subscribeQuietModeEvents,
  syncQuietModeFromBoost,
  type BoostWindowSnapshot,
} from "@/lib/edu/netsaver/boostWindow";

const TEACHER_FLAG_KEY = "edu:webllm:teacher";
const SKIP_JITTER_KEY = "edu:netsaver:skip-jitter";
const STUDENT_MAX_PEERS = 3;
const TEACHER_MAX_PEERS = 1;
const TEACHER_UPLOAD_LIMIT = 200 * 1024;
const STUDENT_UPLOAD_LIMIT = 450 * 1024;

export default function P2PBootstrap() {
  const searchParams = useSearchParams();
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const tierRef = useRef<NetworkSaverTier>(getP2PTier());
  const rampupRef = useRef<boolean>(getRampupEnabledDefault());
  const boostTimerRef = useRef<number | null>(null);
  const quietModeRef = useRef<boolean>(false);
  const baseP2PEnabledRef = useRef<boolean>(false);
  const boostSnapshotRef = useRef<BoostWindowSnapshot | null>(null);
  const modeRef = useRef<NetworkSaverMode>("lease_only");

  const roomCode = useMemo(() => {
    const raw = searchParams.get("code");
    return raw ? raw.trim() : null;
  }, [searchParams]);
  const teacherFromQuery = useMemo(() => searchParams.get("teacher") === "1", [searchParams]);

  useEffect(() => {
    if (!roomCode) return;
    setActiveCode(roomCode);
  }, [roomCode]);

  useEffect(() => {
    if (!activeCode || typeof window === "undefined") return;

    let cancelled = false;
    const isTeacher =
      teacherFromQuery || window.localStorage.getItem(TEACHER_FLAG_KEY) === "1";
    if (teacherFromQuery) {
      try {
        window.localStorage.setItem(TEACHER_FLAG_KEY, "1");
      } catch {
        // ignore storage failures
      }
    }
    const skipJitter = window.localStorage.getItem(SKIP_JITTER_KEY) === "1";

    const updateFetchShims = (p2pEnabled: boolean, quietMode: boolean) => {
      installLeaseOnlyShim(activeCode, { tier: tierRef.current, rampupEnabled: rampupRef.current, quietMode });
      installWasmFetchShim(activeCode, {
        p2pEnabled,
        tier: tierRef.current,
        rampupEnabled: rampupRef.current,
        quietMode,
      });
    };

    const stopSwarmForQuiet = () => {
      const swarm = getActiveWasmSwarm();
      if (!swarm) return;
      if (swarm.isSeedLiteEnabled()) {
        swarm.stopSeedLite("quiet_mode", { disconnectPeers: true, downgrade: false });
        return;
      }
      swarm.stop();
    };

    const startSwarmIfNeeded = async () => {
      const swarm = getActiveWasmSwarm();
      if (!swarm) return;
      if (swarm.getStatus() === "idle") {
        await swarm.start();
      }
    };

    const enableP2PAfterProbe = async () => {
      if (cancelled) return false;
      if (baseP2PEnabledRef.current) return true;
      try {
        const result = await runP2PProbe(activeCode);
        if (!result.ok) {
          recordNetworkSaverError("P2P_PROBE", result.reason ?? "probe_failed");
          cacheP2PDisabled(activeCode);
          void saveDegradedNetworkSaverConfig(activeCode);
          setNetworkSaverMode("lease_only");
          return false;
        }
        baseP2PEnabledRef.current = true;
        await startSwarmIfNeeded();
        updateFetchShims(true, false);
        setNetworkSaverMode("p2p");
        if (isTeacher) {
          const seedLiteAllowed = modeRef.current === "auto" && (boostSnapshotRef.current?.active ?? false);
          void runPrewarm({
            code: activeCode,
            tier: tierRef.current,
            includeWasm: true,
            includeMeta: true,
            includeSmallShards: false,
            seedLite: { autoMode: seedLiteAllowed },
          });
        }
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "probe_failed";
        recordNetworkSaverError("P2P_PROBE", message);
        cacheP2PDisabled(activeCode);
        void saveDegradedNetworkSaverConfig(activeCode);
        setNetworkSaverMode("lease_only");
        return false;
      }
    };

    const applyQuietMode = async (quietMode: boolean, enteredAt?: number | null) => {
      if (quietModeRef.current === quietMode) return;
      quietModeRef.current = quietMode;
      setQuietModeState(activeCode, quietMode, quietMode ? enteredAt ?? Date.now() : null);
      if (quietMode) {
        stopSwarmForQuiet();
        updateFetchShims(false, true);
        return;
      }
      updateFetchShims(baseP2PEnabledRef.current, false);
      if (baseP2PEnabledRef.current) {
        await startSwarmIfNeeded();
      }
    };

    const scheduleBoostTimer = (snapshot: BoostWindowSnapshot | null) => {
      if (boostTimerRef.current) {
        window.clearTimeout(boostTimerRef.current);
        boostTimerRef.current = null;
      }
      if (!snapshot || !snapshot.active || !snapshot.state.quietAfter) return;
      boostTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        syncQuietModeFromBoost(activeCode);
      }, snapshot.remainingMs + 50);
    };

    const handleBoostSnapshot = async (snapshot: BoostWindowSnapshot | null) => {
      boostSnapshotRef.current = snapshot;
      scheduleBoostTimer(snapshot);
      const quietEnteredAt = snapshot?.state.quietEnteredAt ?? null;
      await applyQuietMode(snapshot?.quietMode ?? false, quietEnteredAt);
    };

    const unsubscribeBoost = subscribeBoostWindowEvents((event) => {
      if (event.code !== activeCode) return;
      if (modeRef.current !== "auto") return;
      void handleBoostSnapshot(event.snapshot);
      if (event.reason === "rearm") {
        void enableP2PAfterProbe();
      }
    });

    const unsubscribeQuiet = subscribeQuietModeEvents((event) => {
      if (event.code !== activeCode) return;
      void applyQuietMode(event.enabled, event.enteredAt);
    });

    const unsubscribe = subscribeAutoDowngradeEvents((event) => {
      if (event.codeHash && !cancelled) {
        const swarm = getActiveWasmSwarm();
        swarm?.stop();
        setActiveWasmSwarm(null);
        updateFetchShims(false, quietModeRef.current);
        modeRef.current = "lease_only";
        baseP2PEnabledRef.current = false;
        setNetworkSaverMode("lease_only");
      }
    });

    const bootstrap = async () => {
      if (!isTeacher) {
        setNetworkPrepStatus("preparing", { reason: "bootstrap", ttlMs: 8000 });
      }
      const minJitter = Math.max(0, getStudentJitterMinMs());
      const maxJitter = Math.max(minJitter, getStudentJitterMaxMs());
      const jitterMs =
        isTeacher || skipJitter
          ? 0
          : Math.floor(minJitter + Math.random() * (maxJitter - minJitter + 1));
      if (!isTeacher) {
        recordStudentJitterApplied(jitterMs);
      }
      if (jitterMs > 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), jitterMs);
        });
      }

      const overrideConfig = isTeacher ? loadNetworkSaverOverride() : null;
      const codeOverride = await loadNetworkSaverCodeOverride(activeCode);
      const storedConfig = await loadNetworkSaverConfig(activeCode);
      const baseMode: NetworkSaverMode = resolveNetworkSaverMode(
        getConfiguredNetworkSaverMode(),
        isTeacher,
      );
      const configuredTier = getP2PTier();
      const defaultRampupEnabled = getRampupEnabledDefault();
      let mode: NetworkSaverMode = baseMode;
      let tier: NetworkSaverTier = configuredTier;
      let recommendedAllowlist: string[] = [];
      let rampupEnabled = defaultRampupEnabled;

      if (overrideConfig) {
        mode = resolveNetworkSaverMode(overrideConfig.mode, isTeacher);
        tier = overrideConfig.tier;
        recommendedAllowlist = overrideConfig.allowlist ?? [];
        if (overrideConfig.rampupEnabled !== undefined) {
          rampupEnabled = overrideConfig.rampupEnabled;
        }
      } else if (storedConfig?.config) {
        mode = resolveNetworkSaverMode(storedConfig.config.mode, isTeacher);
        tier = storedConfig.config.tier;
        recommendedAllowlist = storedConfig.config.allowlist ?? [];
        if (storedConfig.config.rampupEnabled !== undefined) {
          rampupEnabled = storedConfig.config.rampupEnabled;
        }
      }
      if (
        codeOverride?.override &&
        (!codeOverride.override.disabledUntil || codeOverride.override.disabledUntil <= Date.now())
      ) {
        mode = resolveNetworkSaverMode(codeOverride.override.mode, isTeacher);
        tier = codeOverride.override.tier;
      }

      const tier3State = getTier3DisabledState(activeCode);
      if (tier === "small_shards" && tier3State.disabled) {
        tier = "meta";
      }
      setNetworkSaverTier(tier);
      setShardTier3Disabled(tier3State.disabled, tier3State.reason ?? null);
      setRampupEnabled(rampupEnabled);
      tierRef.current = tier;
      rampupRef.current = rampupEnabled;
      modeRef.current = mode;
      baseP2PEnabledRef.current = false;

      const wasmAllowlist = new Set<string>([
        ...getWasmAllowlist(),
        ...resolveAllowlistUrls(recommendedAllowlist),
      ]);
      setNetworkSaverAllowlistCount(wasmAllowlist.size);

      if (mode === "off") {
        setNetworkSaverMode("off");
        clearNetworkPrepStatus();
        return;
      }

      const boostEnabled = mode === "auto";
      const boostSnapshot = boostEnabled
        ? await hydrateBoostWindowState(activeCode, { durationMs: 120000, quietAfter: true })
        : null;
      if (!boostEnabled) {
        setBoostWindowMetrics({
          startAt: null,
          durationMs: 0,
          quietEnteredAt: null,
          rearmCount: 0,
          lastRearmAt: null,
        });
        setQuietModeState(activeCode, false, null);
      }
      boostSnapshotRef.current = boostSnapshot;
      const quietSync = boostEnabled ? syncQuietModeFromBoost(activeCode) : { enabled: false };
      const quietMode = quietSync.enabled || boostSnapshot?.quietMode || false;

      installLeaseOnlyShim(activeCode, { tier, rampupEnabled, quietMode });
      setNetworkSaverMode("lease_only");
      const maxPeers = isTeacher ? TEACHER_MAX_PEERS : STUDENT_MAX_PEERS;
      const swarm = new WasmSwarm({
        roomCode: activeCode,
        role: isTeacher ? "teacher" : "student",
        maxPeers,
        teacherUploadLimitBps: TEACHER_UPLOAD_LIMIT,
        studentUploadLimitBps: STUDENT_UPLOAD_LIMIT,
        allowlist: wasmAllowlist,
      });
      setActiveWasmSwarm(swarm);
      installWasmFetchShim(activeCode, { p2pEnabled: false, tier, rampupEnabled, quietMode });
      scheduleBoostTimer(boostSnapshot);
      await applyQuietMode(quietMode, boostSnapshot?.state.quietEnteredAt ?? null);

      if (mode === "lease_only") {
        if (isTeacher) {
          void runPrewarm({
            code: activeCode,
            tier,
            includeWasm: true,
            includeMeta: true,
            includeSmallShards: false,
            seedLite: { autoMode: false },
          });
        }
        clearNetworkPrepStatus();
        return;
      }

      if (mode === "force_p2p" && !isTeacher) {
        mode = "auto";
      }

      if (
        mode !== "force_p2p" &&
        (isP2PDisabledCached(activeCode) ||
          (codeOverride?.override?.disabledUntil &&
            codeOverride.override.disabledUntil > Date.now()))
      ) {
        setNetworkSaverMode("lease_only");
        baseP2PEnabledRef.current = false;
        if (isTeacher) {
          void runPrewarm({
            code: activeCode,
            tier,
            includeWasm: true,
            includeMeta: true,
            includeSmallShards: false,
            seedLite: { autoMode: false },
          });
        }
        clearNetworkPrepStatus();
        return;
      }

      if (mode === "auto" && quietMode) {
        clearNetworkPrepStatus();
        return;
      }

      let probeResult: { ok: boolean; reason?: string } | null = null;
      try {
        probeResult = await runP2PProbe(activeCode);
      } catch (error) {
        const message = error instanceof Error ? error.message : "probe_failed";
        recordNetworkSaverError("P2P_PROBE", message);
        cacheP2PDisabled(activeCode);
        void saveDegradedNetworkSaverConfig(activeCode);
        if (codeOverride?.override?.mode === "auto") {
          await recordAutoDowngradeProbeFailure(activeCode, "probe_fail");
        }
        setNetworkSaverMode("lease_only");
        clearNetworkPrepStatus();
        return;
      }
      if (cancelled) return;

      if (probeResult.ok) {
        await swarm.start();
        baseP2PEnabledRef.current = true;
        installWasmFetchShim(activeCode, { p2pEnabled: true, tier, rampupEnabled, quietMode: false });
        setNetworkSaverMode("p2p");
        if (isTeacher) {
          const seedLiteAllowed = mode === "auto" && (boostSnapshotRef.current?.active ?? false);
          void runPrewarm({
            code: activeCode,
            tier,
            includeWasm: true,
            includeMeta: true,
            includeSmallShards: false,
            seedLite: { autoMode: seedLiteAllowed },
          });
        }
        clearNetworkPrepStatus();
        return;
      }

      if (mode !== "force_p2p") {
        cacheP2PDisabled(activeCode);
      }
      void saveDegradedNetworkSaverConfig(activeCode);
      setNetworkSaverMode("lease_only");
      baseP2PEnabledRef.current = false;
      recordNetworkSaverError("P2P_PROBE", probeResult.reason ?? "probe_failed");
      if (codeOverride?.override?.mode === "auto") {
        await recordAutoDowngradeProbeFailure(activeCode, "probe_fail");
      }
      if (isTeacher) {
        void runPrewarm({
          code: activeCode,
          tier,
          includeWasm: true,
          includeMeta: true,
          includeSmallShards: false,
          seedLite: { autoMode: false },
        });
      }
      clearNetworkPrepStatus();
    };
    const handleReprobe = () => {
      void bootstrap();
    };
    void bootstrap();
    window.addEventListener("edu:p2p:reprobe", handleReprobe as EventListener);

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeBoost();
      unsubscribeQuiet();
      window.removeEventListener("edu:p2p:reprobe", handleReprobe as EventListener);
      if (boostTimerRef.current) {
        window.clearTimeout(boostTimerRef.current);
        boostTimerRef.current = null;
      }
      const swarm = getActiveWasmSwarm();
      swarm?.stop();
      setActiveWasmSwarm(null);
      void releaseActiveLease();
      clearNetworkPrepStatus();
    };
  }, [activeCode, teacherFromQuery]);

  return null;
}
