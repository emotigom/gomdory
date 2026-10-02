import { buildCoachChatSystemPrompt } from "@/lib/edu/prompts";
import { EDU_PROVIDER_TARGET } from "@/lib/edu/providerBoundary";
import { basicPromptFilter } from "@/lib/edu/safety/filter";
import { readStudentAiSafeModeEnabled } from "@/lib/env/appConfig";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit, type ApiRateLimitResult } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildEduStudentRateLimitKey, buildEduStudentRouteIdentity } from "@/lib/server/eduAiBackendIdentity";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatRequestBody = {
  messages?: unknown;
  lessonId?: number | string;
  shareCode?: string;
  anonId?: string | null;
  forceJson?: boolean;
};

type RateLimitClient = Parameters<typeof checkRateLimit>[0];

export type EduAiChatAdmissionResult =
  | {
      kind: "respond";
      status: number;
      payload: Record<string, unknown>;
      extraHeaders?: Record<string, string>;
    }
  | {
      kind: "proceed";
      messages: ChatMessage[];
      fullMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      lessonId: number | null;
      shareCode: string | undefined;
    };

export type EduAiChatAdmissionInput = {
  request: Request;
  requestId: string;
  route: string;
  body: ChatRequestBody | null;
};

export type EduAiChatAdmissionDependencies = {
  readSafeModeEnabled: () => boolean;
  getRateLimitSubject: (request: Request, anonId: string | null) => Promise<string>;
  createRateLimitClient: () => RateLimitClient;
  checkRateLimit: typeof checkRateLimit;
  recordOpsEvent: typeof recordOpsEvent;
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 20;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 20_000;
const CLASS_ASSISTANT_SYSTEM_PROMPT = `
너는 수업 조교다. 아래 규칙을 반드시 지킨다.
- 답은 6줄 이내로 짧게.
- 다음 행동을 2개 이상(버튼/체크리스트 형태) 제안.
- "다시 해보세요" 단독 답변 금지.
- 학생에게 설정/계정/권한 요구 금지.
- 욕설/개인정보 유도 금지.
- 코드가 필요하면 짧은 조각만 제공(스크롤 유발 금지).
`.trim();

const defaultDependencies: EduAiChatAdmissionDependencies = {
  readSafeModeEnabled: readStudentAiSafeModeEnabled,
  getRateLimitSubject,
  createRateLimitClient: () => createSupabaseAdminClient() as unknown as RateLimitClient,
  checkRateLimit,
  recordOpsEvent,
};

export function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const role = record.role;
      const content = typeof record.content === "string" ? record.content : "";
      if ((role === "user" || role === "assistant") && content.trim()) return { role, content } as ChatMessage;
      return null;
    })
    .filter((item): item is ChatMessage => Boolean(item));
}

export function validateMessageLimits(messages: ChatMessage[]) {
  if (messages.length > MAX_MESSAGES) return false;
  let totalChars = 0;
  for (const message of messages) {
    if (message.content.length > MAX_MESSAGE_CHARS) return false;
    totalChars += message.content.length;
    if (totalChars > MAX_TOTAL_CHARS) return false;
  }
  return true;
}

export function buildSafeModeAnswer(text: string) {
  const subject = text.trim().slice(0, 24) || "지금 주제";
  return [
    "지금은 AI 코치가 점검 중이에요.",
    `대신 ${subject}를 바로 꾸밀 수 있게 도와줄게요.`,
    "- 제목을 12자 안팎으로 짧게",
    "- 버튼은 행동 문구로 바꾸기",
    "- 배경은 대비가 큰 색으로 맞추기",
  ].join("\n");
}

const badRequest = (code: string, message: string): EduAiChatAdmissionResult => ({
  kind: "respond",
  status: 400,
  payload: { ok: false, code, message },
});

export async function evaluateEduAiChatAdmission(
  input: EduAiChatAdmissionInput,
  overrides: Partial<EduAiChatAdmissionDependencies> = {},
): Promise<EduAiChatAdmissionResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const messages = normalizeMessages(input.body?.messages);
  const studentRouteIdentity = buildEduStudentRouteIdentity({ lessonId: input.body?.lessonId, shareCode: input.body?.shareCode });
  const normalizedLessonId = studentRouteIdentity.lessonId;
  const normalizedShareCode = studentRouteIdentity.shareCode;

  if (!messages.length) return badRequest("EDU_AI_BAD_REQUEST", "대화 내용을 찾을 수 없어요.");
  if (!validateMessageLimits(messages)) return badRequest("EDU_AI_REQUEST_TOO_LARGE", "요청이 너무 커요. 메시지를 줄여주세요.");

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  if (latestUserMessage) {
    const promptFilter = basicPromptFilter(latestUserMessage);
    if (!promptFilter.ok) return badRequest("EDU_AI_PROMPT_BLOCKED", promptFilter.message);
  }

  if (dependencies.readSafeModeEnabled()) {
    const safeModeAnswer = buildSafeModeAnswer(latestUserMessage);
    return {
      kind: "respond",
      status: 200,
      payload: { ok: true, message: safeModeAnswer, answer: safeModeAnswer, provider: EDU_PROVIDER_TARGET.planCSafeMode },
    };
  }

  const subject = await dependencies.getRateLimitSubject(input.request, input.body?.anonId ?? null);
  try {
    const limitResult: ApiRateLimitResult = await dependencies.checkRateLimit(dependencies.createRateLimitClient(), {
      key: buildEduStudentRateLimitKey({ prefix: "edu:ai", shareCode: normalizedShareCode, subject }),
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      limit: RATE_LIMIT_MAX,
    });
    if (!limitResult.ok) {
      return {
        kind: "respond",
        status: 429,
        payload: { ok: false, code: "EDU_AI_RATE_LIMITED", message: "잠시 후 다시 시도해주세요." },
        extraHeaders: { "Retry-After": `${limitResult.retryAfterSeconds}` },
      };
    }
  } catch {
    void dependencies.recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId: input.requestId,
        route: input.route,
        status: 503,
        meta: { stage: "rate_limit_backend", component: "rate_limit", result: "failed" },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    ).catch(() => undefined);
    return {
      kind: "respond",
      status: 503,
      payload: { ok: false, code: "EDU_AI_RATE_LIMIT_UNAVAILABLE", message: "요청을 안전하게 확인하지 못했어요. 잠시 후 다시 시도해 주세요." },
    };
  }

  return {
    kind: "proceed",
    messages,
    fullMessages: [
      { role: "system", content: CLASS_ASSISTANT_SYSTEM_PROMPT },
      { role: "system", content: buildCoachChatSystemPrompt({ lessonId: normalizedLessonId ?? undefined }) },
      ...(input.body?.forceJson ? [{ role: "system" as const, content: "반드시 JSON만 출력하세요." }] : []),
      ...messages,
    ],
    lessonId: normalizedLessonId,
    shareCode: normalizedShareCode,
  };
}
