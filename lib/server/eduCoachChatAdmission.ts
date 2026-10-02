import { readStudentCoachMode, type StudentCoachMode } from "@/lib/env/appConfig";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit, type ApiRateLimitResult } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildEduStudentRateLimitKey, buildEduStudentRouteIdentity } from "@/lib/server/eduAiBackendIdentity";

export type CoachChatBody = { prompt?: string; lessonId?: number | string; shareCode?: string };

type RateLimitClient = Parameters<typeof checkRateLimit>[0];

export type EduCoachChatAdmissionDependencies = {
  readCoachMode: () => StudentCoachMode;
  getRateLimitSubject: (request: Request, anonId: string | null) => Promise<string>;
  createRateLimitClient: () => RateLimitClient;
  checkRateLimit: typeof checkRateLimit;
  recordOpsEvent: typeof recordOpsEvent;
};

export type EduCoachChatAdmissionResult =
  | { kind: "respond"; status: number; payload: Record<string, unknown>; extraHeaders?: Record<string, string> }
  | { kind: "local"; mode: Exclude<StudentCoachMode, "backend">; prompt: string }
  | { kind: "proceed"; prompt: string; lessonId: number | null; shareCode: string | null };

const MAX_PROMPT_LENGTH = 1200;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 20;

const defaultDependencies: EduCoachChatAdmissionDependencies = {
  readCoachMode: readStudentCoachMode,
  getRateLimitSubject,
  createRateLimitClient: () => createSupabaseAdminClient() as unknown as RateLimitClient,
  checkRateLimit,
  recordOpsEvent,
};

const badRequest = (message: string): EduCoachChatAdmissionResult => ({
  kind: "respond",
  status: 400,
  payload: { ok: false, reason: "unknown", message },
});

export async function evaluateEduCoachChatAdmission(
  input: { request: Request; requestId: string; route: string; body: CoachChatBody | null },
  overrides: Partial<EduCoachChatAdmissionDependencies> = {},
): Promise<EduCoachChatAdmissionResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const prompt = typeof input.body?.prompt === "string" ? input.body.prompt.trim() : "";
  const identity = buildEduStudentRouteIdentity({ lessonId: input.body?.lessonId, shareCode: input.body?.shareCode });

  if (!prompt) return badRequest("질문을 먼저 입력해 주세요.");
  if (prompt.length > MAX_PROMPT_LENGTH) return badRequest("질문은 1200자 이내로 입력해 주세요.");

  const coachMode = dependencies.readCoachMode();
  if (coachMode === "disabled" || coachMode === "guide" || coachMode === "template") {
    return { kind: "local", mode: coachMode, prompt };
  }

  try {
    const subject = await dependencies.getRateLimitSubject(input.request, null);
    const limitResult: ApiRateLimitResult = await dependencies.checkRateLimit(dependencies.createRateLimitClient(), {
      key: buildEduStudentRateLimitKey({ prefix: "edu:coach", shareCode: identity.shareCode, subject }),
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      limit: RATE_LIMIT_MAX,
    });
    if (!limitResult.ok) {
      return {
        kind: "respond",
        status: 429,
        payload: { ok: false, code: "EDU_COACH_RATE_LIMITED", message: "잠시 후 다시 시도해주세요." },
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
      payload: { ok: false, code: "EDU_COACH_RATE_LIMIT_UNAVAILABLE", message: "요청을 안전하게 확인하지 못했어요. 잠시 후 다시 시도해 주세요." },
    };
  }

  return {
    kind: "proceed",
    prompt,
    lessonId: identity.lessonId,
    shareCode: identity.shareCode ?? null,
  };
}
