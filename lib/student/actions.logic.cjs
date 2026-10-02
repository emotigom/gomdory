function normalizeActionText(text, maxLength = 200) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function canSend(now, lastSentAt, cooldownMs) {
  if (!lastSentAt) return true;
  return now - lastSentAt >= cooldownMs;
}

function buildActionPayload({ id, type, text, anonId, meta }) {
  const normalizedType = type === "poll" ? "poll_vote" : type;
  const payload = {
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

function parseRateLimitError({ status, payload, now = Date.now() }) {
  if (status !== 429) return null;
  const retryAfterSeconds =
    payload && typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : undefined;
  const retryAfterAt =
    typeof retryAfterSeconds === "number" ? now + retryAfterSeconds * 1000 : null;
  const message =
    typeof retryAfterSeconds === "number"
      ? `잠시 후 다시 시도해주세요 (약 ${retryAfterSeconds}초)`
      : "잠시 후 다시 시도해주세요.";
  return { retryAfterSeconds, retryAfterAt, message };
}

module.exports = {
  normalizeActionText,
  canSend,
  buildActionPayload,
  parseRateLimitError,
};
