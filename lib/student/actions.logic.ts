type ActionPayloadInput = {
  id?: string | null;
  type: string;
  text?: string | null;
  anonId?: string | null;
  meta?: Record<string, unknown> | null;
};

type RateLimitPayload = {
  retryAfterSeconds?: number;
};

export function normalizeActionText(text: string | null | undefined, maxLength = 200): string {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function canSend(now: number, lastSentAt: number | null, cooldownMs: number): boolean {
  if (!lastSentAt) return true;
  return now - lastSentAt >= cooldownMs;
}

export function buildActionPayload({ id, type, text, anonId, meta }: ActionPayloadInput) {
  const normalizedType = type === "poll" ? "poll_vote" : type;
  const payload: Record<string, unknown> = {
    id: id ?? undefined,
    type: normalizedType,
    anonId: anonId ?? undefined,
  };

  const normalizedMeta = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};

  if (normalizedType === "question") {
    const normalizedText = normalizeActionText(text);
    if (normalizedText) {
      payload.text = normalizedText;
    }
  }

  if (normalizedType === "help") {
    if (typeof normalizedMeta.reason === "string") {
      payload.reason = normalizedMeta.reason;
    }
  }

  if (normalizedType === "pulse") {
    if (typeof normalizedMeta.value === "number") {
      payload.pulseValue = normalizedMeta.value;
    }
  }

  if (normalizedType === "poll_vote") {
    if (typeof normalizedMeta.pollId === "string") {
      payload.pollId = normalizedMeta.pollId;
    }
    if (typeof normalizedMeta.optionId === "string") {
      payload.optionId = normalizedMeta.optionId;
    }
  }

  return payload;
}

export function parseRateLimitError({
  status,
  payload,
  now = Date.now(),
}: {
  status: number;
  payload?: RateLimitPayload | null;
  now?: number;
}) {
  if (status !== 429) return null;
  const retryAfterSeconds = typeof payload?.retryAfterSeconds === "number" ? payload.retryAfterSeconds : undefined;
  const retryAfterAt =
    typeof retryAfterSeconds === "number" ? now + retryAfterSeconds * 1000 : null;
  const message =
    typeof retryAfterSeconds === "number"
      ? `잠시 후 다시 시도해주세요 (약 ${retryAfterSeconds}초)`
      : "잠시 후 다시 시도해주세요.";
  return { retryAfterSeconds, retryAfterAt, message };
}
