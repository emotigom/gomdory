import { abort as abortWebLLM, start as startWebLLM } from "@/lib/edu/llm/webllmWorkerBridge";
import { normalizeStudentText } from "@/lib/edu/slots/normalizeStudentText";
import { slotDictionary, type SlotDictionaryKey } from "@/lib/edu/slots/slotDictionary";

export type SlotName =
  | "likes"
  | "keywords"
  | "goal"
  | "profile_name"
  | "profile_slogan"
  | "intro"
  | "title"
  | "lead"
  | "p2.title"
  | "p2.topic"
  | "p2.reason"
  | "p2.cards.1.body"
  | "p2.cards.2.body"
  | "p2.cards.3.body"
  | "p2.timeline.1"
  | "p2.timeline.2"
  | "p2.timeline.3"
  | "p2.highlight.question"
  | "p2.highlight.answer"
  | "p2.name"
  | "p3.title"
  | "p3.subtitle"
  | "p3.result"
  | "p3.projects.1.title"
  | "p3.projects.1.body"
  | "p3.projects.2.title"
  | "p3.projects.2.body"
  | "p3.projects.3.title"
  | "p3.projects.3.body"
  | "p4.title"
  | "p4.summary"
  | "p4.highlight.1"
  | "p4.highlight.2"
  | "p4.profile.name"
  | "p4.profile.line"
  | "p4.agenda.1"
  | "p4.agenda.2"
  | "p4.agenda.3"
  | "p4.agenda.4"
  | "p4.agenda.5"
  | "p4.agenda.6"
  | "unknown";

export interface SlotIntent {
  slot: SlotName;
  value: string | string[];
  confidence: number; // 0~1
  reason?: string; // dev-only
}

const SLOT_NAMES: SlotName[] = [
  "likes",
  "keywords",
  "goal",
  "profile_name",
  "profile_slogan",
  "intro",
  "title",
  "lead",
  "p2.title",
  "p2.topic",
  "p2.reason",
  "p2.cards.1.body",
  "p2.cards.2.body",
  "p2.cards.3.body",
  "p2.timeline.1",
  "p2.timeline.2",
  "p2.timeline.3",
  "p2.highlight.question",
  "p2.highlight.answer",
  "p2.name",
  "p3.title",
  "p3.subtitle",
  "p3.result",
  "p3.projects.1.title",
  "p3.projects.1.body",
  "p3.projects.2.title",
  "p3.projects.2.body",
  "p3.projects.3.title",
  "p3.projects.3.body",
  "p4.title",
  "p4.summary",
  "p4.highlight.1",
  "p4.highlight.2",
  "p4.profile.name",
  "p4.profile.line",
  "p4.agenda.1",
  "p4.agenda.2",
  "p4.agenda.3",
  "p4.agenda.4",
  "p4.agenda.5",
  "p4.agenda.6",
  "unknown",
];

const SLOT_SET = new Set<SlotName>(SLOT_NAMES);
const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 6000;
const CONFIDENCE_THRESHOLD = 0.6;
const MAX_VALUE_LENGTH = 200;
const slotCache = new Map<string, { expiresAt: number; value: SlotIntent }>();

const createRequestId = () => {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoRef = globalThis.crypto as Crypto | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeText = (text: string) => normalizeStudentText(text);

const withReason = (intent: SlotIntent, reason: string): SlotIntent => {
  if (process.env.NODE_ENV === "production") {
    return intent;
  }
  return { ...intent, reason };
};

const unknownIntent = (reason: string, confidence = 0) =>
  withReason({ slot: "unknown", value: "unknown", confidence }, reason);

const coerceLikeValues = (value: unknown): string | string[] | null => {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes(",")) {
      const items = trimmed
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length ? items : trimmed;
    }
    return trimmed;
  }
  if (value == null) return null;
  return String(value).trim();
};

const coerceSingleValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items.join(", ") : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value == null) return null;
  const stringified = String(value).trim();
  return stringified || null;
};

const parseSlotIntent = (payload: unknown, pageKey: string): SlotIntent | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const slotValue = record.slot;
  const candidateSlots = getPageSlotCandidates(pageKey);
  const candidateSet = new Set(candidateSlots);
  const isSlotAllowed =
    typeof slotValue === "string" && SLOT_SET.has(slotValue as SlotName) && candidateSet.has(slotValue as SlotName);
  const resolvedSlot = isSlotAllowed ? (slotValue as SlotName) : "unknown";

  const confidenceValue = Number(record.confidence);
  const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0.5;

  const slot = resolvedSlot;
  const rawValue = record.value;
  const value = slot === "likes" ? coerceLikeValues(rawValue) : coerceSingleValue(rawValue);
  if (value == null) {
    return unknownIntent("missing_value", confidence);
  }
  const normalizedValue = value;
  const valueLength = Array.isArray(normalizedValue)
    ? normalizedValue.join(", ").length
    : String(normalizedValue).length;
  if (valueLength > MAX_VALUE_LENGTH) {
    return unknownIntent("value_too_long", confidence);
  }

  if (!isSlotAllowed || slot === "unknown") {
    return unknownIntent("unknown_slot", confidence);
  }

  if (slot === "likes") {
    return { slot, value: normalizedValue, confidence };
  }
  return { slot, value: String(normalizedValue), confidence };
};

const extractSingleJsonObject = (rawText: unknown): Record<string, unknown> | null => {
  if (typeof rawText !== "string") return null;
  const text = rawText.trim();
  if (!text) return null;
  const objects: string[] = [];
  let depth = 0;
  let startIndex: number | null = null;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === "\\") {
        isEscaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && startIndex != null) {
        objects.push(text.slice(startIndex, index + 1));
        startIndex = null;
      }
    }
  }

  if (objects.length === 0) return null;
  const first = objects[0];
  try {
    const parsed = JSON.parse(first);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const PAGE_SLOT_CANDIDATES: Record<string, SlotName[]> = {
  P1: ["keywords", "likes", "goal", "profile_name", "profile_slogan", "intro", "title", "lead", "unknown"],
  P2: [
    "p2.title",
    "p2.topic",
    "p2.reason",
    "p2.cards.1.body",
    "p2.cards.2.body",
    "p2.cards.3.body",
    "p2.timeline.1",
    "p2.timeline.2",
    "p2.timeline.3",
    "p2.highlight.question",
    "p2.highlight.answer",
    "p2.name",
    "unknown",
  ],
  P3: [
    "p3.title",
    "p3.subtitle",
    "p3.result",
    "p3.projects.1.title",
    "p3.projects.1.body",
    "p3.projects.2.title",
    "p3.projects.2.body",
    "p3.projects.3.title",
    "p3.projects.3.body",
    "unknown",
  ],
  P4: [
    "p4.title",
    "p4.summary",
    "p4.highlight.1",
    "p4.highlight.2",
    "p4.profile.name",
    "p4.profile.line",
    "p4.agenda.1",
    "p4.agenda.2",
    "p4.agenda.3",
    "p4.agenda.4",
    "p4.agenda.5",
    "p4.agenda.6",
    "unknown",
  ],
};

const getPageSlotCandidates = (pageKey: string): SlotName[] => {
  const normalizedKey = pageKey.trim().toUpperCase();
  return PAGE_SLOT_CANDIDATES[normalizedKey] ?? SLOT_NAMES;
};

const getSlotDictionary = (pageKey: string) => {
  const normalizedKey = pageKey.trim().toLowerCase();
  const pageDict =
    normalizedKey === "p1" || normalizedKey === "p2" || normalizedKey === "p3" || normalizedKey === "p4"
      ? slotDictionary[normalizedKey as SlotDictionaryKey]
      : undefined;
  const merged = {
    ...slotDictionary.default,
    ...(pageDict ?? {}),
  } as Partial<Record<SlotName, readonly string[]>>;
  return merged;
};

const extractReplaceCandidate = (text: string) => {
  const regex = /(.+?)\s*로\s*(?:바꿔|바꾸|바꿀)/g;
  let match: RegExpExecArray | null;
  let candidate: string | null = null;
  while ((match = regex.exec(text)) !== null) {
    candidate = match[1];
  }
  if (candidate) return candidate.trim();
  const trailingMatch = text.match(/(.+?)\s*로\s*$/);
  return trailingMatch ? trailingMatch[1].trim() : null;
};

const stripKeywords = (text: string, keywords: readonly string[]) => {
  let value = text;
  keywords.forEach((keyword) => {
    if (keyword) {
      value = value.split(keyword).join(" ");
    }
  });
  return value;
};

const cleanValueText = (text: string) => {
  let value = text.replace(/^\s*(을|를|은|는|이|가|도)\s+/g, "");
  value = value.replace(/^\s*(대신|말고|빼고)\s+/g, "");
  value = value.replace(/^\s*[:\-]\s*/g, "");
  value = value.replace(/\s*(으로|로)\s*$/g, "");
  value = value.replace(/\s+/g, " ").trim();
  return value;
};

const extractValueFromText = (text: string, keywords: readonly string[]) => {
  const replaceCandidate = extractReplaceCandidate(text);
  let value = replaceCandidate ?? text;
  value = stripKeywords(value, keywords);
  value = cleanValueText(value);
  return value;
};

const buildDictionaryIntent = (text: string, pageKey: string): SlotIntent | null => {
  const dictionary = getSlotDictionary(pageKey);
  const allowedSlots = getPageSlotCandidates(pageKey);
  for (const slot of allowedSlots) {
    if (slot === "unknown") continue;
    const keywords = dictionary[slot];
    if (!keywords?.length) continue;
    if (keywords.some((keyword) => text.includes(keyword))) {
      const valueText = extractValueFromText(text, keywords);
      if (!valueText) {
        return unknownIntent("dictionary_no_value", 0.2);
      }
      if (slot === "likes") {
        const items = valueText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (!items.length) {
          return unknownIntent("dictionary_no_value", 0.2);
        }
        return withReason({ slot, value: items.length === 1 ? items[0] : items, confidence: 0.9 }, "dictionary_match");
      }
      return withReason({ slot, value: valueText, confidence: 0.9 }, "dictionary_match");
    }
  }
  return null;
};

type FewShotExample = {
  input: string;
  output: SlotIntent;
};

const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: "나의 키워드 성장을 여유로 바꿔줘",
    output: { slot: "keywords", value: "여유", confidence: 0.82 },
  },
  {
    input: "해시태그 성장 대신 여유로 해줘",
    output: { slot: "keywords", value: "여유", confidence: 0.8 },
  },
  {
    input: "키워드를 여유, 웃음, 친구로 바꿔줘",
    output: { slot: "keywords", value: "여유, 웃음, 친구", confidence: 0.83 },
  },
  {
    input: "좋아하는 것은 파란색, 떡볶이, 집이에요",
    output: { slot: "likes", value: ["파란색", "떡볶이", "집"], confidence: 0.88 },
  },
  {
    input: "좋아하는거는 게임이랑 치킨이랑 침대",
    output: { slot: "likes", value: ["게임", "치킨", "침대"], confidence: 0.84 },
  },
  {
    input: "오늘의 목표 발표 잘하기로 바꿔줘",
    output: { slot: "goal", value: "발표 잘하기", confidence: 0.86 },
  },
  {
    input: "목표는 집중하기!",
    output: { slot: "goal", value: "집중하기", confidence: 0.79 },
  },
  {
    input: "이름 돌돌이 말고 돌이로 바꿔줘",
    output: { slot: "profile_name", value: "돌이", confidence: 0.87 },
  },
  {
    input: "관심사 주제를 공룡으로 바꿔줘",
    output: { slot: "p2.topic", value: "공룡", confidence: 0.85 },
  },
  {
    input: "궁금한 질문을 바다는 얼마나 깊을까로 바꿔줘",
    output: { slot: "p2.cards.1.body", value: "바다는 얼마나 깊을까", confidence: 0.83 },
  },
  {
    input: "퀴즈 제목을 공룡 퀴즈로 바꿔줘",
    output: { slot: "p3.title", value: "공룡 퀴즈", confidence: 0.84 },
  },
  {
    input: "그냥 예쁘게 해줘",
    output: { slot: "unknown", value: "unknown", confidence: 0.42 },
  },
];

const buildSystemPrompt = () =>
  [
    "너는 초등학생 문장을 slot/value로 분류하는 분류기다.",
    "HTML/CSS/JS 출력 금지.",
    "출력은 반드시 JSON 한 줄.",
    "slot은 제공된 enum 중 하나만 선택한다.",
    "불확실하면 slot=unknown.",
    "confidence는 보수적으로 판단한다.",
  ].join(" ");

const buildFewShotMessages = () =>
  FEW_SHOT_EXAMPLES.flatMap((example) => [
    { role: "user" as const, content: example.input },
    {
      role: "assistant" as const,
      content: JSON.stringify({
        slot: example.output.slot,
        value: example.output.value,
        confidence: example.output.confidence,
      }),
    },
  ]);

const buildUserPrompt = (text: string, pageKey: string) => {
  const slotCandidates = getPageSlotCandidates(pageKey);
  return [
    "아래 학생 말에서 바꾸려는 영역(slot)과 값(value)을 추출해.",
    "출력은 반드시 한 줄 JSON 한 덩어리만. 불필요한 텍스트나 설명 금지.",
    "JSON 스키마: {\"slot\": string, \"value\": string|array, \"confidence\": number}",
    "value 규칙: slot이 likes면 쉼표/나열을 배열로 만들 수 있고, 그 외는 문자열.",
    "value가 불명확하면 slot=unknown 또는 value=\"unknown\"으로.",
    "",
    `pageKey: ${pageKey}`,
    `현재 페이지에서 바꿀 수 있는 slot 목록: ${slotCandidates.join(", ")}`,
    "",
    "[학생 말]",
    text,
  ].join("\n");
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["slot", "value", "confidence"],
  properties: {
    slot: { type: "string", enum: SLOT_NAMES },
    value: {
      anyOf: [
        { type: "string" },
        {
          type: "array",
          items: { type: "string" },
        },
      ],
    },
    confidence: { type: "number" },
  },
};

export async function inferSlotFromText(args: {
  text: string;
  pageKey: "P1" | "P2" | "P3" | "P4" | string;
  abortSignal?: AbortSignal;
}): Promise<SlotIntent> {
  const normalized = normalizeText(args.text);
  if (!normalized) {
    return unknownIntent("empty_text");
  }

  const cacheKey = `${args.pageKey}:${normalized}`;
  const cached = slotCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached) {
    slotCache.delete(cacheKey);
  }

  const dictionaryIntent = buildDictionaryIntent(normalized, args.pageKey);
  if (dictionaryIntent) {
    slotCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: dictionaryIntent });
    return dictionaryIntent;
  }

  const requestId = createRequestId();
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abortHandler = () => abortWebLLM(requestId);
  controller.signal.addEventListener("abort", abortHandler);

  const externalAbortHandler = () => controller.abort();
  if (args.abortSignal) {
    if (args.abortSignal.aborted) {
      controller.abort();
    } else {
      args.abortSignal.addEventListener("abort", externalAbortHandler);
    }
  }

  let intent: SlotIntent | null = null;
  try {
    if (controller.signal.aborted) {
      return unknownIntent("aborted");
    }

    const response = await startWebLLM(requestId, {
      kind: "generateJson",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...buildFewShotMessages(),
        { role: "user", content: buildUserPrompt(normalized, args.pageKey) },
      ],
      temperature: 0.2,
      timeoutMs: TIMEOUT_MS,
      engineTimeoutMs: TIMEOUT_MS,
      schema: responseSchema,
    });

    if (response.type !== "result" || response.kind !== "generateJson" || !response.result.ok) {
      return unknownIntent("llm_unavailable");
    }

    const parsedPayload = extractSingleJsonObject(response.result.rawText);
    if (!parsedPayload) {
      return unknownIntent("invalid_json_payload");
    }

    intent = parseSlotIntent(parsedPayload, args.pageKey);
    if (!intent) {
      return unknownIntent("invalid_payload");
    }
  } finally {
    controller.signal.removeEventListener("abort", abortHandler);
    if (args.abortSignal) {
      args.abortSignal.removeEventListener("abort", externalAbortHandler);
    }
    globalThis.clearTimeout(timeoutId);
  }

  if (intent.confidence < CONFIDENCE_THRESHOLD) {
    return unknownIntent("low_confidence", intent.confidence);
  }

  slotCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: intent });
  return intent;
}
