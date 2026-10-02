import { getP2PMaxBytes, type NetworkSaverMode, type NetworkSaverTier } from "./config";
import type { NetsaverMetricsSnapshot } from "./metrics";
import type { ResourceJournalSnapshot } from "./resourceJournal";

export type NetworkSaverRecommendation = {
  mode: NetworkSaverMode;
  tier: NetworkSaverTier;
  p2pAllowlist: string[];
  rampupEnabled: boolean;
  notes: string[];
};

const RECENT_WINDOW_MS = 30 * 60 * 1000;
const META_P2P_HIT_THRESHOLD = 2;
const SHARD_FAIL_THRESHOLD = 2;
const SHARD_TIMEOUT_THRESHOLD_MS = 6_000;
const LEASE_WAIT_THRESHOLD = 2;
const LEASE_WAIT_MS_THRESHOLD = 2_000;

const TOKENIZER_PATTERN = /\/resolve\/main\/.+\/tokenizer\.[^/]+$/i;
const CONFIG_PATTERN = /\/resolve\/main\/.+\/(mlc-chat-config|config)\.json$/i;
const BPE_PATTERN = /\/resolve\/main\/.+\/(vocab\.json|merges\.txt)$/i;
const SMALL_SHARD_PATTERN =
  /\/resolve\/main\/.+\/(params_shard_\d+\.bin|weights_shard_\d+\.bin|shard_\d+\.bin)$/i;
const SMALL_MODEL_SHARD_PATTERN = /\/resolve\/main\/.+\/(model_\d+\.bin|params_\d+\.bin)$/i;
const SHARD_EXCLUDE_PATTERN = /\/resolve\/main\/.+\/(weights|params).*(\d{3,}|gb|large)/i;
const SHARD_BLOCKED_EXTENSION = /\.(safetensors|pt|ckpt)(\?|$)/i;

const isMetaPath = (pathname: string) =>
  TOKENIZER_PATTERN.test(pathname) || CONFIG_PATTERN.test(pathname) || BPE_PATTERN.test(pathname);

const isSmallShardPath = (pathname: string) =>
  SMALL_SHARD_PATTERN.test(pathname) || SMALL_MODEL_SHARD_PATTERN.test(pathname);

const isSmallShardExcluded = (pathname: string) =>
  SHARD_EXCLUDE_PATTERN.test(pathname) || SHARD_BLOCKED_EXTENSION.test(pathname);

const isAllowedPathname = (pathname: string) =>
  pathname.includes("/resolve/main/") || pathname.includes("/libs/");

const resolveAllowlist = (snapshot: ResourceJournalSnapshot | null, tier: NetworkSaverTier) => {
  if (!snapshot || tier === "wasm") return [] as string[];
  const maxBytes =
    tier === "small_shards" ? Math.min(getP2PMaxBytes(), 6 * 1024 * 1024) : getP2PMaxBytes();

  const allow = new Set<string>();
  for (const entry of snapshot.entries) {
    if (!entry.pathname || !isAllowedPathname(entry.pathname)) continue;
    if (entry.rangeRequested) continue;
    if (!entry.lastContentLength || entry.lastContentLength > maxBytes) continue;
    if (entry.count < 2) continue;
    if (entry.kindGuess === "unknown") continue;
    if (isSmallShardExcluded(entry.pathname)) continue;

    const isMeta = isMetaPath(entry.pathname);
    const isSmallShard = isSmallShardPath(entry.pathname);

    if (tier === "meta" && !isMeta) continue;
    if (tier === "small_shards" && !(isMeta || isSmallShard)) continue;

    allow.add(entry.pathname);
  }
  return Array.from(allow);
};

export const buildNetworkSaverRecommendation = (input: {
  journal: ResourceJournalSnapshot | null;
  metrics: NetsaverMetricsSnapshot;
}): NetworkSaverRecommendation => {
  const { journal, metrics } = input;
  const notes: string[] = [];

  const probeRecentFail =
    metrics.p2pProbe.status === "fail" &&
    metrics.p2pProbe.lastAt !== null &&
    Date.now() - metrics.p2pProbe.lastAt < RECENT_WINDOW_MS;

  if (probeRecentFail) {
    notes.push("최근 P2P probe 실패로 lease-only 권장");
    return {
      mode: "lease_only",
      tier: "meta",
      p2pAllowlist: [],
      rampupEnabled: true,
      notes,
    };
  }

  let tier: NetworkSaverTier = "meta";

  const leaseWaitHeavy =
    metrics.lease.waitCount >= LEASE_WAIT_THRESHOLD ||
    metrics.lease.waitMsTotal >= LEASE_WAIT_MS_THRESHOLD;

  const shardStable =
    metrics.shard.p2pFailCount <= SHARD_FAIL_THRESHOLD &&
    metrics.shard.timeoutMsTotal <= SHARD_TIMEOUT_THRESHOLD_MS &&
    !metrics.shard.tier3Disabled;

  if (leaseWaitHeavy && shardStable && metrics.shard.p2pHitCount > 0) {
    tier = "small_shards";
    notes.push("lease 대기와 shard 안정성을 확인해 small_shards 권장");
  } else if (metrics.meta.p2pHitCount >= META_P2P_HIT_THRESHOLD) {
    tier = "meta";
    notes.push("meta P2P 히트가 충분해 meta 권장");
  } else if (metrics.wasm.p2pHitCount >= 1) {
    tier = "wasm";
    notes.push("WASM P2P 히트 확인 → wasm 티어 권장");
  } else {
    notes.push("관측 데이터가 적어 기본 meta 티어 유지");
  }

  if (metrics.shard.tier3Disabled) {
    notes.push("small_shards 비활성화 상태 감지");
  }

  const rampupEnabled = leaseWaitHeavy;
  if (rampupEnabled) {
    notes.push("lease 대기 누적 → ramp-up 활성 권장");
  }

  const allowlist = resolveAllowlist(journal, tier);
  if (allowlist.length === 0) {
    notes.push("allowlist 후보 없음 (range/size/횟수 조건)");
  }

  return {
    mode: "auto",
    tier,
    p2pAllowlist: allowlist,
    rampupEnabled,
    notes,
  };
};
