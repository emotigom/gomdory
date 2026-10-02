export type P2PStatus = "idle" | "enabled" | "disabled";

export type P2PDiagnostics = {
  status: P2PStatus;
  peerCount: number;
  connectedPeers: number;
  originLeaseActive: boolean;
  recentCounts: {
    p2pHitCount: number;
    originFetchCount: number;
    leaseWaitCount: number;
  };
  lastProbeAt: number | null;
};

const RECENT_WINDOW_MS = 5 * 60 * 1000;

const diagnostics: P2PDiagnostics = {
  status: "idle",
  peerCount: 0,
  connectedPeers: 0,
  originLeaseActive: false,
  recentCounts: {
    p2pHitCount: 0,
    originFetchCount: 0,
    leaseWaitCount: 0,
  },
  lastProbeAt: null,
};

const recentEvents: Record<keyof P2PDiagnostics["recentCounts"], number[]> = {
  p2pHitCount: [],
  originFetchCount: [],
  leaseWaitCount: [],
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function getRecentCount(key: keyof P2PDiagnostics["recentCounts"]) {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  const filtered = recentEvents[key].filter((timestamp) => timestamp >= cutoff);
  recentEvents[key] = filtered;
  return filtered.length;
}

export function getP2PDiagnostics() {
  return {
    ...diagnostics,
    recentCounts: {
      p2pHitCount: getRecentCount("p2pHitCount"),
      originFetchCount: getRecentCount("originFetchCount"),
      leaseWaitCount: getRecentCount("leaseWaitCount"),
    },
  };
}

export function subscribeP2PDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setP2PDiagnostics(partial: Partial<P2PDiagnostics>) {
  Object.assign(diagnostics, partial);
  notify();
}

export function incrementP2PCount(
  key: keyof P2PDiagnostics["recentCounts"],
  amount = 1,
) {
  for (let i = 0; i < amount; i += 1) {
    recentEvents[key].push(Date.now());
  }
  notify();
}

export function setP2PStatus(status: P2PStatus, lastProbeAt?: number | null) {
  diagnostics.status = status;
  if (lastProbeAt !== undefined) {
    diagnostics.lastProbeAt = lastProbeAt;
  }
  notify();
}

export function setP2PPeerCounts(peerCount: number, connectedPeers: number) {
  diagnostics.peerCount = peerCount;
  diagnostics.connectedPeers = connectedPeers;
  notify();
}

export function setOriginLeaseActive(active: boolean) {
  diagnostics.originLeaseActive = active;
  notify();
}
