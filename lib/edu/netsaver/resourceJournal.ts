import { readWebllmEnv } from "../llm/webllmConfig";
import { hashRoomCodeShort } from "./hash";

export type ResourceJournalKind = "wasm" | "meta" | "small_shard" | "unknown";
export type ResourceJournalSource = "origin" | "p2p" | "cache";

export type ResourceJournalEntry = {
  pathname: string;
  count: number;
  lastStatus: number | null;
  lastContentLength: number | null;
  lastContentType: string | null;
  lastDurationMs: number | null;
  rangeRequested: boolean;
  lastAt: number;
  kindGuess: ResourceJournalKind;
  source: ResourceJournalSource;
};

export type ResourceJournalSnapshot = {
  codeHash: string;
  updatedAt: number;
  entries: ResourceJournalEntry[];
};

const STORAGE_PREFIX = "edu:netsaver:resource-journal:";
const MAX_ENTRIES = 200;
const STALE_MS = 30 * 60 * 1000;

const buildKey = (codeHash: string) => `${STORAGE_PREFIX}${codeHash}`;

const resolveAllowedHosts = () => {
  const env = readWebllmEnv();
  const hosts = new Set<string>(["models.gomdory.com"]);
  if (env.modelBase) {
    try {
      hosts.add(new URL(env.modelBase).host);
    } catch {
      // ignore invalid base
    }
  }
  return hosts;
};

const isAllowedUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.href);
    const hosts = resolveAllowedHosts();
    return hosts.has(parsed.host);
  } catch {
    return false;
  }
};

const normalizePathname = (url: string) => {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.pathname || "/";
  } catch {
    return null;
  }
};

const TOKENIZER_PATTERN = /\/resolve\/main\/.+\/tokenizer\.[^/]+$/i;
const CONFIG_PATTERN = /\/resolve\/main\/.+\/(mlc-chat-config|config)\.json$/i;
const BPE_PATTERN = /\/resolve\/main\/.+\/(vocab\.json|merges\.txt)$/i;
const SMALL_SHARD_PATTERN =
  /\/resolve\/main\/.+\/(params_shard_\d+\.bin|weights_shard_\d+\.bin|shard_\d+\.bin)$/i;
const SMALL_MODEL_SHARD_PATTERN = /\/resolve\/main\/.+\/(model_\d+\.bin|params_\d+\.bin)$/i;

const guessKindFromPath = (pathname: string): ResourceJournalKind => {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".wasm")) return "wasm";
  if (TOKENIZER_PATTERN.test(lower) || CONFIG_PATTERN.test(lower) || BPE_PATTERN.test(lower)) {
    return "meta";
  }
  if (SMALL_SHARD_PATTERN.test(lower) || SMALL_MODEL_SHARD_PATTERN.test(lower)) {
    return "small_shard";
  }
  return "unknown";
};

type ResourceJournalState = {
  version: 1;
  updatedAt: number;
  entries: Record<string, ResourceJournalEntry>;
};

const readState = (key: string): ResourceJournalState => {
  if (typeof window === "undefined") {
    return { version: 1, updatedAt: Date.now(), entries: {} };
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { version: 1, updatedAt: Date.now(), entries: {} };
    const parsed = JSON.parse(raw) as ResourceJournalState;
    if (!parsed?.entries) return { version: 1, updatedAt: Date.now(), entries: {} };
    return parsed;
  } catch {
    return { version: 1, updatedAt: Date.now(), entries: {} };
  }
};

const writeState = (key: string, state: ResourceJournalState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
};

const pruneEntries = (entries: Record<string, ResourceJournalEntry>, now: number) => {
  const cutoff = now - STALE_MS;
  for (const [pathname, entry] of Object.entries(entries)) {
    if (entry.lastAt < cutoff) {
      delete entries[pathname];
    }
  }
  const keys = Object.keys(entries);
  if (keys.length <= MAX_ENTRIES) return;
  const sorted = keys
    .map((pathname) => ({ pathname, lastAt: entries[pathname]?.lastAt ?? 0 }))
    .sort((a, b) => a.lastAt - b.lastAt);
  const removeCount = sorted.length - MAX_ENTRIES;
  for (let i = 0; i < removeCount; i += 1) {
    const target = sorted[i];
    if (target) delete entries[target.pathname];
  }
};

const resolveCodeHash = async (code: string) => {
  const hash = await hashRoomCodeShort(code, 8);
  if (!hash || hash === "-") return null;
  return hash;
};

export const recordResourceJournalEntry = async (input: {
  code: string;
  url: string;
  source: ResourceJournalSource;
  status?: number | null;
  contentLength?: number | null;
  contentType?: string | null;
  durationMs?: number | null;
  rangeRequested?: boolean;
  kindGuess?: ResourceJournalKind;
}) => {
  if (typeof window === "undefined") return;
  if (!isAllowedUrl(input.url)) return;
  const pathname = normalizePathname(input.url);
  if (!pathname) return;
  const codeHash = await resolveCodeHash(input.code);
  if (!codeHash) return;
  const key = buildKey(codeHash);
  const now = Date.now();
  const state = readState(key);
  const existing = state.entries[pathname];
  const nextEntry: ResourceJournalEntry = {
    pathname,
    count: existing ? existing.count + 1 : 1,
    lastStatus: input.status ?? existing?.lastStatus ?? null,
    lastContentLength: input.contentLength ?? existing?.lastContentLength ?? null,
    lastContentType: input.contentType ?? existing?.lastContentType ?? null,
    lastDurationMs: input.durationMs ?? existing?.lastDurationMs ?? null,
    rangeRequested: input.rangeRequested ?? existing?.rangeRequested ?? false,
    lastAt: now,
    kindGuess: input.kindGuess ?? existing?.kindGuess ?? guessKindFromPath(pathname),
    source: input.source,
  };
  state.entries[pathname] = nextEntry;
  state.updatedAt = now;
  pruneEntries(state.entries, now);
  writeState(key, state);
};

export const getResourceJournalSnapshot = async (code: string): Promise<ResourceJournalSnapshot | null> => {
  if (typeof window === "undefined") return null;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return null;
  const key = buildKey(codeHash);
  const state = readState(key);
  pruneEntries(state.entries, Date.now());
  writeState(key, state);
  return {
    codeHash,
    updatedAt: state.updatedAt,
    entries: Object.values(state.entries),
  };
};

export const clearResourceJournal = async (code: string) => {
  if (typeof window === "undefined") return;
  const codeHash = await resolveCodeHash(code);
  if (!codeHash) return;
  try {
    window.localStorage.removeItem(buildKey(codeHash));
  } catch {
    // ignore storage failures
  }
};
