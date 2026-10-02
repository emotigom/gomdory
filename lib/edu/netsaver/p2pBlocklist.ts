const BLOCKLIST_TTL_MS = 30 * 60 * 1000;

type BlocklistEntry = {
  expiresAt: number;
  reason?: string;
};

const buildKey = (code: string) => `edu:netsaver:blocklist:${code}`;

const readBlocklist = (code: string) => {
  if (typeof window === "undefined") return new Map<string, BlocklistEntry>();
  try {
    const raw = window.localStorage.getItem(buildKey(code));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, BlocklistEntry>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
};

const writeBlocklist = (code: string, entries: Map<string, BlocklistEntry>) => {
  if (typeof window === "undefined") return;
  const payload: Record<string, BlocklistEntry> = {};
  for (const [url, entry] of entries) {
    payload[url] = entry;
  }
  try {
    window.localStorage.setItem(buildKey(code), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

export const isP2PBlocked = (code: string, url: string) => {
  const entries = readBlocklist(code);
  const entry = entries.get(url);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    entries.delete(url);
    writeBlocklist(code, entries);
    return false;
  }
  return true;
};

export const blockP2PUrl = (code: string, url: string, reason?: string) => {
  const entries = readBlocklist(code);
  entries.set(url, { expiresAt: Date.now() + BLOCKLIST_TTL_MS, reason });
  writeBlocklist(code, entries);
};

export const countP2PBlocklistEntries = (code: string) => {
  const entries = readBlocklist(code);
  const now = Date.now();
  let count = 0;
  for (const [url, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(url);
    } else {
      count += 1;
    }
  }
  writeBlocklist(code, entries);
  return count;
};
