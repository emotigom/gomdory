import {
  DEFAULT_CODE_OVERRIDE_TTL_MS,
  loadNetworkSaverCodeOverride,
  saveNetworkSaverCodeOverride,
  type NetworkSaverCodeOverride,
} from "./codeConfig";
import { getEduBoardId } from "@/lib/edu/storage";
import { buildEduCodeHash, recordEduEvent } from "@/lib/edu/opsEvent";

export type AutoDowngradeReason = "probe_fail" | "p2p_fail" | "timeout";

export type AutoDowngradeEvent = {
  codeHash: string;
  reason: AutoDowngradeReason;
  disabledUntil: number;
  occurredAt: number;
};

type AutoDowngradeState = {
  consecutiveFails: number;
  timeoutMs: number;
  rapidDisconnects: number;
  lastConnectedAt: number | null;
};

const AUTO_DOWNGRADE_TTL_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_FAILS = 2;
const TIMEOUT_BUDGET_MS = 6_000;
const RAPID_DISCONNECT_MS = 2_000;
const MAX_RAPID_DISCONNECTS = 2;

const stateByCode = new Map<string, AutoDowngradeState>();
const listeners = new Set<(event: AutoDowngradeEvent) => void>();

const getState = (code: string) => {
  const existing = stateByCode.get(code);
  if (existing) return existing;
  const state: AutoDowngradeState = {
    consecutiveFails: 0,
    timeoutMs: 0,
    rapidDisconnects: 0,
    lastConnectedAt: null,
  };
  stateByCode.set(code, state);
  return state;
};

const emit = (event: AutoDowngradeEvent) => {
  listeners.forEach((listener) => listener(event));
};

const shouldDowngradeOverride = (override: NetworkSaverCodeOverride | null) => {
  if (!override) return false;
  if (override.mode !== "auto") return false;
  if (override.disabledUntil && override.disabledUntil > Date.now()) return false;
  return true;
};

const applyAutoDowngrade = async (code: string, reason: AutoDowngradeReason) => {
  const loaded = await loadNetworkSaverCodeOverride(code);
  if (!loaded?.override || !shouldDowngradeOverride(loaded.override)) return null;
  const disabledUntil = Date.now() + AUTO_DOWNGRADE_TTL_MS;
  const ttlMs = loaded.override.ttlMs ?? DEFAULT_CODE_OVERRIDE_TTL_MS;
  const saved = await saveNetworkSaverCodeOverride(
    code,
    {
      mode: "lease_only",
      tier: loaded.override.tier,
      disabledUntil,
      reason,
    },
    ttlMs,
  );
  if (!saved) return null;
  const event: AutoDowngradeEvent = {
    codeHash: saved.codeHash,
    reason,
    disabledUntil,
    occurredAt: Date.now(),
  };
  emit(event);
  const boardId = getEduBoardId(code);
  if (boardId) {
    const codeHash = await buildEduCodeHash(boardId, code);
    void recordEduEvent({
      type: "netsaver_auto_downgrade",
      boardId,
      codeHash: codeHash ?? saved.codeHash,
      extra: { reason },
    });
  }
  return event;
};

export const subscribeAutoDowngradeEvents = (handler: (event: AutoDowngradeEvent) => void) => {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
};

export const recordAutoDowngradeProbeFailure = async (
  code: string,
  reason: AutoDowngradeReason,
) => {
  return await applyAutoDowngrade(code, reason);
};

export const recordAutoDowngradeWasmSuccess = (code: string) => {
  const state = getState(code);
  state.consecutiveFails = 0;
  state.timeoutMs = 0;
  state.rapidDisconnects = 0;
};

export const recordAutoDowngradeWasmFailure = async (
  code: string,
  options?: { timeoutMs?: number },
) => {
  const state = getState(code);
  state.consecutiveFails += 1;
  if (options?.timeoutMs) {
    state.timeoutMs += options.timeoutMs;
  }
  if (state.timeoutMs >= TIMEOUT_BUDGET_MS) {
    return await applyAutoDowngrade(code, "timeout");
  }
  if (state.consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
    return await applyAutoDowngrade(code, "p2p_fail");
  }
  return null;
};

export const recordAutoDowngradePeerConnected = (code: string) => {
  const state = getState(code);
  state.lastConnectedAt = Date.now();
};

export const recordAutoDowngradePeerDisconnected = async (
  code: string,
  connectedForMs: number | null,
) => {
  const state = getState(code);
  state.lastConnectedAt = null;
  if (!connectedForMs || connectedForMs > RAPID_DISCONNECT_MS) {
    state.rapidDisconnects = 0;
    return null;
  }
  state.rapidDisconnects += 1;
  if (state.rapidDisconnects >= MAX_RAPID_DISCONNECTS) {
    return await applyAutoDowngrade(code, "p2p_fail");
  }
  return null;
};
