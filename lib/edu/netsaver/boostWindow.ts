import { getEduBoardId } from "@/lib/edu/storage";
import { buildEduCodeHash, recordEduEvent } from "@/lib/edu/opsEvent";
import { hashRoomCodeShort } from "./hash";
import { recordBoostRearm, setBoostWindowMetrics, setQuietModeEnabled } from "./metrics";

export type BoostWindowState = {
  startAt: number;
  durationMs: number;
  quietAfter: boolean;
  quietEnteredAt: number | null;
  rearmCount: number;
  lastRearmAt: number | null;
  rearmWindowStartAt: number | null;
  rearmWindowCount: number;
  rearmBlockedUntil: number | null;
};

export type BoostWindowSnapshot = {
  state: BoostWindowState;
  active: boolean;
  quietMode: boolean;
  remainingMs: number;
  endsAt: number;
};

export type BoostRearmResult =
  | { ok: true; snapshot: BoostWindowSnapshot }
  | { ok: false; reason: "cooldown" | "blocked" | "unavailable"; retryAfterMs?: number };

type BoostWindowEvent = {
  code: string;
  snapshot: BoostWindowSnapshot;
  reason: "init" | "update" | "quiet" | "rearm";
};

type QuietModeEvent = {
  code: string;
  enabled: boolean;
  enteredAt: number | null;
  reason: "sync" | "explicit";
};

const STORAGE_PREFIX = "edu:netsaver:boost:";
const DEFAULT_DURATION_MS = 120_000;
const REARM_COOLDOWN_MS = 60_000;
const REARM_WINDOW_MS = 5 * 60_000;
const REARM_MAX_COUNT = 3;
const REARM_BLOCK_MS = 5 * 60_000;

const BOOST_EVENT = "edu:netsaver:boost-change";
const QUIET_EVENT = "edu:netsaver:quiet-change";

const runtimeState = new Map<string, BoostWindowState>();
const quietState = new Map<string, { enabled: boolean; enteredAt: number | null }>();
const codeHashByCode = new Map<string, string>();

const buildKey = (codeHash: string) => `${STORAGE_PREFIX}${codeHash}`;

const resolveCodeHash = async (code: string) => {
  if (typeof window === "undefined") return null;
  const hash = await hashRoomCodeShort(code, 8);
  if (!hash || hash === "-") return null;
  codeHashByCode.set(code, hash);
  return hash;
};

const readStoredState = (codeHash: string): Partial<BoostWindowState> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildKey(codeHash));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<BoostWindowState>;
  } catch {
    return null;
  }
};

const persistState = (code: string, state: BoostWindowState) => {
  const codeHash = codeHashByCode.get(code);
  if (!codeHash || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildKey(codeHash), JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
};

const normalizeState = (
  partial: Partial<BoostWindowState> | null,
  overrides: { startAt?: number; durationMs?: number; quietAfter?: boolean },
): BoostWindowState => {
  const startAt = partial?.startAt ?? overrides.startAt ?? Date.now();
  const durationMs = Math.max(1_000, overrides.durationMs ?? partial?.durationMs ?? DEFAULT_DURATION_MS);
  const quietAfter = overrides.quietAfter ?? partial?.quietAfter ?? true;
  return {
    startAt,
    durationMs,
    quietAfter,
    quietEnteredAt: partial?.quietEnteredAt ?? null,
    rearmCount: partial?.rearmCount ?? 0,
    lastRearmAt: partial?.lastRearmAt ?? null,
    rearmWindowStartAt: partial?.rearmWindowStartAt ?? null,
    rearmWindowCount: partial?.rearmWindowCount ?? 0,
    rearmBlockedUntil: partial?.rearmBlockedUntil ?? null,
  };
};

const emitBoostEvent = (event: BoostWindowEvent) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOST_EVENT, { detail: event }));
};

const emitQuietEvent = (event: QuietModeEvent) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(QUIET_EVENT, { detail: event }));
};

const computeSnapshot = (state: BoostWindowState, now = Date.now()): BoostWindowSnapshot => {
  const endsAt = state.startAt + state.durationMs;
  const remainingMs = Math.max(0, endsAt - now);
  const active = now < endsAt;
  const quietMode = state.quietAfter && !active;
  return {
    state,
    active,
    quietMode,
    remainingMs,
    endsAt,
  };
};

const getEduContext = async (code: string) => {
  const boardId = getEduBoardId(code);
  if (!boardId) return null;
  const codeHash = await buildEduCodeHash(boardId, code);
  return { boardId, codeHash };
};

const recordBoostStart = async (code: string, mode: string) => {
  const context = await getEduContext(code);
  if (!context) return;
  await recordEduEvent({
    type: "netsaver_boost_start",
    boardId: context.boardId,
    codeHash: context.codeHash,
    extra: { mode },
  });
};

const recordBoostEnd = async (code: string, mode: string) => {
  const context = await getEduContext(code);
  if (!context) return;
  await recordEduEvent({
    type: "netsaver_boost_end",
    boardId: context.boardId,
    codeHash: context.codeHash,
    extra: { mode },
  });
};

export const hydrateBoostWindowState = async (
  code: string,
  overrides: { startAt?: number; durationMs?: number; quietAfter?: boolean } = {},
) => {
  const codeHash = await resolveCodeHash(code);
  const stored = codeHash ? readStoredState(codeHash) : null;
  const next = normalizeState(stored, overrides);
  runtimeState.set(code, next);
  persistState(code, next);
  const snapshot = computeSnapshot(next);
  setBoostWindowMetrics({
    startAt: next.startAt,
    durationMs: next.durationMs,
    quietEnteredAt: next.quietEnteredAt,
    rearmCount: next.rearmCount,
    lastRearmAt: next.lastRearmAt,
  });
  if (!stored && snapshot.active) {
    void recordBoostStart(code, "auto");
  }
  emitBoostEvent({ code, snapshot, reason: stored ? "update" : "init" });
  return snapshot;
};

export const getBoostWindowSnapshot = (code: string, now = Date.now()) => {
  const state = runtimeState.get(code);
  if (!state) return null;
  return computeSnapshot(state, now);
};

export const getQuietModeState = (code: string) => quietState.get(code) ?? null;

export const setQuietModeState = (
  code: string,
  enabled: boolean,
  enteredAt: number | null,
  reason: QuietModeEvent["reason"] = "explicit",
) => {
  quietState.set(code, { enabled, enteredAt });
  setQuietModeEnabled(enabled, enteredAt);
  emitQuietEvent({ code, enabled, enteredAt, reason });
};

export const syncQuietModeFromBoost = (code: string, now = Date.now()) => {
  const snapshot = getBoostWindowSnapshot(code, now);
  if (!snapshot) return { enabled: false, changed: false };
  if (!snapshot.quietMode) {
    const existing = quietState.get(code);
    if (existing?.enabled) {
      setQuietModeState(code, false, null, "sync");
      return { enabled: false, changed: true };
    }
    return { enabled: false, changed: false };
  }
  const existing = quietState.get(code);
  if (!existing?.enabled) {
    const nextEnteredAt = snapshot.state.quietEnteredAt ?? now;
    const state = runtimeState.get(code);
    if (state && !state.quietEnteredAt) {
      state.quietEnteredAt = nextEnteredAt;
      runtimeState.set(code, state);
      persistState(code, state);
      setBoostWindowMetrics({
        startAt: state.startAt,
        durationMs: state.durationMs,
        quietEnteredAt: state.quietEnteredAt,
        rearmCount: state.rearmCount,
        lastRearmAt: state.lastRearmAt,
      });
    }
    setQuietModeState(code, true, nextEnteredAt, "sync");
    void recordBoostEnd(code, "auto");
    emitBoostEvent({ code, snapshot: computeSnapshot(state ?? snapshot.state, now), reason: "quiet" });
    return { enabled: true, changed: true };
  }
  return { enabled: true, changed: false };
};

export const subscribeBoostWindowEvents = (handler: (event: BoostWindowEvent) => void) => {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<BoostWindowEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(BOOST_EVENT, listener);
  return () => window.removeEventListener(BOOST_EVENT, listener);
};

export const subscribeQuietModeEvents = (handler: (event: QuietModeEvent) => void) => {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<QuietModeEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(QUIET_EVENT, listener);
  return () => window.removeEventListener(QUIET_EVENT, listener);
};

export const rearmBoostWindow = async (
  code: string,
  durationMs = 30_000,
): Promise<BoostRearmResult> => {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unavailable" };
  }
  const snapshot = runtimeState.get(code) ?? (await hydrateBoostWindowState(code));
  if (!snapshot) {
    return { ok: false, reason: "unavailable" };
  }
  const now = Date.now();
  const state = runtimeState.get(code);
  if (!state) return { ok: false, reason: "unavailable" };
  if (state.rearmBlockedUntil && now < state.rearmBlockedUntil) {
    return {
      ok: false,
      reason: "blocked",
      retryAfterMs: state.rearmBlockedUntil - now,
    };
  }
  if (state.lastRearmAt && now - state.lastRearmAt < REARM_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterMs: REARM_COOLDOWN_MS - (now - state.lastRearmAt),
    };
  }
  if (!state.rearmWindowStartAt || now - state.rearmWindowStartAt > REARM_WINDOW_MS) {
    state.rearmWindowStartAt = now;
    state.rearmWindowCount = 0;
  }
  state.rearmWindowCount += 1;
  if (state.rearmWindowCount > REARM_MAX_COUNT) {
    state.rearmBlockedUntil = now + REARM_BLOCK_MS;
    persistState(code, state);
    return {
      ok: false,
      reason: "blocked",
      retryAfterMs: REARM_BLOCK_MS,
    };
  }
  state.startAt = now;
  state.durationMs = Math.max(5_000, durationMs);
  state.quietAfter = true;
  state.quietEnteredAt = null;
  state.rearmCount += 1;
  state.lastRearmAt = now;
  runtimeState.set(code, state);
  persistState(code, state);
  recordBoostRearm();
  setBoostWindowMetrics({
    startAt: state.startAt,
    durationMs: state.durationMs,
    quietEnteredAt: state.quietEnteredAt,
    rearmCount: state.rearmCount,
    lastRearmAt: state.lastRearmAt,
  });
  setQuietModeState(code, false, null, "explicit");
  const nextSnapshot = computeSnapshot(state, now);
  emitBoostEvent({ code, snapshot: nextSnapshot, reason: "rearm" });
  void recordBoostStart(code, "manual");
  return { ok: true, snapshot: nextSnapshot };
};
