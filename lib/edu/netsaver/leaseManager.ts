import { acquireLease, releaseLease, renewLease } from "./leaseClient";
import { getLeaseRenewMs, getLeaseTtlMs } from "./config";
import {
  recordLeaseAcquired,
  recordLeaseBypass,
  recordLeaseWait,
  setLeaseActive,
  recordNetworkSaverError,
} from "./metrics";
import { clearNetworkPrepStatus, setNetworkPrepStatus } from "./status";

type LeaseState = {
  leaseId: string;
  expiresAt: number;
};

type LeaseWaitCallbacks = {
  onWait?: (waitMs: number) => void;
  onBypass?: () => void;
};

let activeLease: LeaseState | null = null;
let leaseRenewing = false;
let lastRelevantFetchAt = 0;
let leaseReleaseTimer: number | null = null;
let lastRenewAt = 0;
let activeRoomCode: string | null = null;

const LEASE_IDLE_RELEASE_MS = 10_000;

const waitMs = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const scheduleLeaseRelease = async () => {
  if (leaseReleaseTimer) {
    window.clearTimeout(leaseReleaseTimer);
  }
  leaseReleaseTimer = window.setTimeout(() => {
    const idleFor = Date.now() - lastRelevantFetchAt;
    if (idleFor >= LEASE_IDLE_RELEASE_MS) {
      void releaseActiveLease();
    }
  }, LEASE_IDLE_RELEASE_MS + 200);
};

export const markLeaseRelevantFetch = () => {
  lastRelevantFetchAt = Date.now();
  scheduleLeaseRelease();
};

export const ensureLease = async (
  code: string,
  maxWaitMs: number,
  callbacks?: LeaseWaitCallbacks,
) => {
  activeRoomCode = code;
  if (activeLease && activeLease.expiresAt > Date.now()) {
    return true;
  }
  if (activeLease && activeLease.expiresAt <= Date.now()) {
    activeLease = null;
    setLeaseActive(false);
  }
  const startedAt = performance.now();
  while (performance.now() - startedAt < maxWaitMs) {
    const result = await acquireLease(code);
    if (result.ok && result.leaseId) {
      activeLease = {
        leaseId: result.leaseId,
        expiresAt: Date.now() + getLeaseTtlMs(),
      };
      lastRenewAt = Date.now();
      recordLeaseAcquired();
      setLeaseActive(true);
      clearNetworkPrepStatus();
      return true;
    }
    const retryAfterMs = result.retryAfterMs ?? 400;
    const waitTime = Math.min(retryAfterMs, maxWaitMs - (performance.now() - startedAt));
    recordLeaseWait(waitTime);
    callbacks?.onWait?.(waitTime);
    setNetworkPrepStatus("waiting", { reason: "lease_wait", ttlMs: waitTime });
    if (waitTime <= 0) break;
    await waitMs(waitTime);
  }
  recordLeaseBypass();
  callbacks?.onBypass?.();
  setNetworkPrepStatus("fallback", { reason: "lease_bypass", ttlMs: 4000 });
  recordNetworkSaverError("LEASE_BYPASS", "lease wait exceeded");
  return false;
};

export const maybeRenewLease = async (code: string) => {
  if (!activeLease || leaseRenewing) return;
  const renewMs = getLeaseRenewMs();
  const now = Date.now();
  if (now - lastRenewAt < renewMs) return;
  leaseRenewing = true;
  try {
    const ok = await renewLease(code, activeLease.leaseId);
    if (ok) {
      activeLease.expiresAt = Date.now() + getLeaseTtlMs();
      lastRenewAt = Date.now();
      setLeaseActive(true);
    }
  } finally {
    leaseRenewing = false;
  }
};

export const releaseActiveLease = async () => {
  if (!activeLease || !activeRoomCode) return;
  const leaseId = activeLease.leaseId;
  activeLease = null;
  setLeaseActive(false);
  await releaseLease(activeRoomCode, leaseId);
};

export const clearLeaseState = () => {
  activeLease = null;
  activeRoomCode = null;
  if (leaseReleaseTimer) {
    window.clearTimeout(leaseReleaseTimer);
    leaseReleaseTimer = null;
  }
};
