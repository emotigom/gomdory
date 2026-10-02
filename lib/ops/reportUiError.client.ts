import { apiFetch } from "@/lib/http/apiFetch";
import { getLastRequestId } from "@/lib/http/requestId";
import { routes } from "@/lib/standards/routes";

type UiErrorInput = {
  message: string;
  stack?: string | null;
  route?: string | null;
  userType?: string | null;
  requestId?: string | null;
  digest?: string | null;
  abortReason?: string | null;
  phase?: string | null;
  elapsedMs?: number | null;
  timeoutMs?: number | null;
  usingLocalWebLLM?: boolean | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
  htmlHashBefore?: string | null;
  htmlHashAfterInjection?: string | null;
  startedAt?: number | null;
  snapshotVersion?: string | null;
  committedHtmlHash?: string | null;
  commitTargetKey?: string | null;
  previewRefreshTriggered?: boolean | null;
  previewHtmlHash?: string | null;
  previewMatchesCommitted?: boolean | null;
};

type UiErrorPayload = {
  message: string;
  rawMessage?: string | null;
  stackHash: string | null;
  requestId?: string;
  route?: string | null;
  userType?: string | null;
  userAgentShort: string;
  abortReason?: string | null;
  phase?: string | null;
  elapsedMs?: number | null;
  timeoutMs?: number | null;
  usingLocalWebLLM?: boolean | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
  htmlHashBefore?: string | null;
  htmlHashAfterInjection?: string | null;
  startedAt?: number | null;
  snapshotVersion?: string | null;
  committedHtmlHash?: string | null;
  commitTargetKey?: string | null;
  previewRefreshTriggered?: boolean | null;
  previewHtmlHash?: string | null;
  previewMatchesCommitted?: boolean | null;
};

type AbortMetaPayload = {
  abortReason?: string | null;
  phase?: string | null;
  startedAt?: number | null;
  elapsedMs?: number | null;
  timeoutMs?: number | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
  htmlHashBefore?: string | null;
  htmlHashAfterInjection?: string | null;
  usingLocalWebLLM?: boolean | null;
  snapshotVersion?: string | null;
  committedHtmlHash?: string | null;
  commitTargetKey?: string | null;
  previewRefreshTriggered?: boolean | null;
  previewHtmlHash?: string | null;
  previewMatchesCommitted?: boolean | null;
};

const DEDUPE_WINDOW_MS = 10_000;
const dedupeMap = new Map<string, number>();

const clamp = (value: string, maxLength: number) => (value.length > maxLength ? value.slice(0, maxLength) : value);

const readStoredRequestId = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored =
      window.localStorage?.getItem("gom:lastRequestId") ??
      window.localStorage?.getItem("gom_last_request_id") ??
      null;
    if (!stored) return null;
    const trimmed = stored.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
};

async function createStackHash(stack?: string | null): Promise<string | null> {
  if (!stack) return null;
  if (typeof crypto === "undefined" || !crypto.subtle) return null;

  const trimmed = clamp(stack, 160);
  try {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(trimmed));
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function shouldSkipDuplicate(key: string, now: number) {
  const lastSent = dedupeMap.get(key);
  if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
    return true;
  }

  dedupeMap.set(key, now);
  for (const [entryKey, timestamp] of dedupeMap.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      dedupeMap.delete(entryKey);
    }
  }
  return false;
}

function parseAbortMetaMessage(message: string): AbortMetaPayload | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as AbortMetaPayload | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function reportUiError(input: UiErrorInput) {
  try {
    const requestId =
      input.requestId ?? getLastRequestId() ?? readStoredRequestId() ?? undefined;
    const stackHash = await createStackHash(input.stack ?? null);
    const route = input.route ?? null;
    const dedupeKey = `${input.message}::${stackHash ?? "none"}::${route ?? ""}`;
    const now = Date.now();

    if (shouldSkipDuplicate(dedupeKey, now)) {
      return;
    }

    const userAgentShort =
      typeof navigator !== "undefined" ? clamp(navigator.userAgent ?? "", 200) : "";

    const parsedMessageMeta = parseAbortMetaMessage(input.message);
    const payload: UiErrorPayload = {
      message: parsedMessageMeta ? "abort_meta" : input.message,
      rawMessage: input.message,
      stackHash,
      requestId,
      route,
      userType: input.userType ?? null,
      userAgentShort,
      abortReason: input.abortReason ?? parsedMessageMeta?.abortReason ?? null,
      phase: input.phase ?? parsedMessageMeta?.phase ?? null,
      elapsedMs:
        typeof input.elapsedMs === "number"
          ? Math.max(0, Math.round(input.elapsedMs))
          : typeof parsedMessageMeta?.elapsedMs === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.elapsedMs))
            : typeof parsedMessageMeta?.startedAt === "number"
              ? Math.max(0, Date.now() - Math.round(parsedMessageMeta.startedAt))
              : null,
      timeoutMs:
        typeof input.timeoutMs === "number"
          ? Math.max(0, Math.round(input.timeoutMs))
          : typeof parsedMessageMeta?.timeoutMs === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.timeoutMs))
            : null,
      usingLocalWebLLM:
        typeof input.usingLocalWebLLM === "boolean"
          ? input.usingLocalWebLLM
          : typeof parsedMessageMeta?.usingLocalWebLLM === "boolean"
            ? parsedMessageMeta.usingLocalWebLLM
            : null,
      modelId: input.modelId ?? parsedMessageMeta?.modelId ?? null,
      stage: input.stage ?? parsedMessageMeta?.stage ?? null,
      retryCount:
        typeof input.retryCount === "number"
          ? Math.max(0, Math.round(input.retryCount))
          : typeof parsedMessageMeta?.retryCount === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.retryCount))
            : null,
      slotCandidatesCount:
        typeof input.slotCandidatesCount === "number"
          ? Math.max(0, Math.round(input.slotCandidatesCount))
          : typeof parsedMessageMeta?.slotCandidatesCount === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.slotCandidatesCount))
            : null,
      selectedSlotId: input.selectedSlotId ?? parsedMessageMeta?.selectedSlotId ?? null,
      selectedSelector: input.selectedSelector ?? parsedMessageMeta?.selectedSelector ?? null,
      slotResolveSource: input.slotResolveSource ?? parsedMessageMeta?.slotResolveSource ?? null,
      htmlHashBefore: input.htmlHashBefore ?? parsedMessageMeta?.htmlHashBefore ?? null,
      htmlHashAfterInjection: input.htmlHashAfterInjection ?? parsedMessageMeta?.htmlHashAfterInjection ?? null,
      startedAt:
        typeof input.startedAt === "number"
          ? Math.max(0, Math.round(input.startedAt))
          : typeof parsedMessageMeta?.startedAt === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.startedAt))
            : null,
      snapshotVersion: input.snapshotVersion ?? parsedMessageMeta?.snapshotVersion ?? null,
      committedHtmlHash: input.committedHtmlHash ?? parsedMessageMeta?.committedHtmlHash ?? null,
      commitTargetKey: input.commitTargetKey ?? parsedMessageMeta?.commitTargetKey ?? null,
      previewRefreshTriggered:
        typeof input.previewRefreshTriggered === "boolean"
          ? input.previewRefreshTriggered
          : typeof parsedMessageMeta?.previewRefreshTriggered === "boolean"
            ? parsedMessageMeta.previewRefreshTriggered
            : null,
      previewHtmlHash: input.previewHtmlHash ?? parsedMessageMeta?.previewHtmlHash ?? null,
      previewMatchesCommitted:
        typeof input.previewMatchesCommitted === "boolean"
          ? input.previewMatchesCommitted
          : typeof parsedMessageMeta?.previewMatchesCommitted === "boolean"
            ? parsedMessageMeta.previewMatchesCommitted
            : null,
    };

    await apiFetch(routes.api.ops.uiError(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return;
  }
}
