import { digestHex } from "@/lib/crypto/webcrypto";

type EduOpsEventInput = {
  type: string;
  boardId: string;
  codeHash?: string | null;
  shareCode?: string | null;
  requestId?: string | null;
  extra?: Record<string, unknown>;
};

const MAX_EVENTS_PER_MINUTE = 8;
const perMinuteCounts = new Map<string, { minute: number; count: number }>();

const isServer = () => typeof window === "undefined";

const shouldRecord = (key: string, now = Date.now()) => {
  const minute = Math.floor(now / 60000);
  const entry = perMinuteCounts.get(key);
  if (!entry || entry.minute !== minute) {
    perMinuteCounts.set(key, { minute, count: 1 });
    return true;
  }
  if (entry.count >= MAX_EVENTS_PER_MINUTE) {
    return false;
  }
  entry.count += 1;
  return true;
};

const sanitizeExtra = (extra?: Record<string, unknown>) => {
  if (!extra) return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (/share[_]?code/i.test(key)) continue;
    if (value === undefined) continue;
    sanitized[key] = value;
  }
  return sanitized;
};

const resolveLevel = (type: string) =>
  type.includes("fail") || type.includes("error") ? "warn" : "info";

export async function buildEduCodeHash(
  boardId: string,
  shareCode: string,
  options: { length?: number } = {},
): Promise<string | null> {
  if (!boardId || !shareCode) return null;
  try {
    const length = Math.max(8, options.length ?? 12);
    const digest = await digestHex("SHA-256", `${boardId}:${shareCode}`);
    return digest.slice(0, length);
  } catch {
    return null;
  }
}

export async function recordEduEvent(input: EduOpsEventInput): Promise<void> {
  if (!input.boardId || !input.type) return;
  const key = `${input.boardId}:${input.type}`;
  if (!shouldRecord(key)) return;
  const meta = {
    type: input.type,
    boardId: input.boardId,
    codeHash: input.codeHash ?? undefined,
    shareCode: input.shareCode ?? undefined,
    requestId: input.requestId ?? undefined,
    ...(sanitizeExtra(input.extra) ?? {}),
  };
  const level = resolveLevel(input.type);
  if (isServer()) {
    const mod = await import("@/lib/ops/recordEvent").catch(() => null);
    if (!mod) return;
    await mod
      .recordOpsEvent(
        {
          level,
          kind: "edu_project_report",
          request_id: input.requestId ?? null,
          route: "edu_ops",
          status: null,
          duration_ms: null,
          meta,
        },
        { sampleRate: 1, hardLimitPerMinute: 12 },
      )
      .catch(() => {});
    return;
  }
  try {
    console.info(
      JSON.stringify(
        {
          level,
          event: "edu_ops_event",
          ...meta,
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  } catch {
    // fail-open
  }
}
