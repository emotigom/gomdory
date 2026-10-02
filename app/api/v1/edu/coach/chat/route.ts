import { getOrCreateRequestId } from "@/lib/http/requestId";
import { evaluateEduCoachChatAdmission, type CoachChatBody } from "@/lib/server/eduCoachChatAdmission";
import {
  emitEduAiStudentRouteJsonResponse,
  runEduAiStudentChatRouteService,
} from "@/lib/server/eduAiBackendClient";
import { createEduCoachChatResponseHandlers } from "@/lib/server/eduCoachChatResponsePolicy";
import { type EduRouteAdapterContext } from "@/lib/server/eduRouteAdapterContracts";
import { readEduRouteJsonBody, runEduRouteAdapter } from "@/lib/server/eduRouteAdapterUtils";
import { EDU_PROVIDER_TARGET } from "@/lib/edu/providerBoundary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const buildTemplateCoachAnswer = (prompt: string) => {
  const normalized = prompt.toLowerCase();
  const topic =
    normalized.includes("bts") || normalized.includes("케이팝")
      ? "K-POP 팬 페이지"
      : normalized.includes("게임")
        ? "게임 소개 페이지"
        : normalized.includes("카페") || normalized.includes("맛집")
          ? "카페/맛집 소개 페이지"
          : "학생 프로젝트 페이지";

  const mood =
    normalized.includes("귀엽") || normalized.includes("파스텔")
      ? "파스텔 톤 + 둥근 버튼"
      : normalized.includes("심플")
        ? "화이트/그레이 중심 미니멀"
        : "강조색 1개 + 깔끔한 대비";

  return [
    `좋아요! ${topic}로 바로 시작해볼게요.`,
    "• 추천 섹션: 히어로 / 소개 / 하이라이트 카드 3개",
    `• 추천 제목: \"${prompt.trim().slice(0, 28) || "나만의 주제"} 한눈에 보기\"`,
    "• 추천 버튼 문구: \"지금 둘러보기\"",
    `• 추천 색감: ${mood}`,
    "• 추천 이미지 키워드: poster, stage, spotlight, collage",
    "제목·배경·버튼 중 하나를 먼저 바꿔보면 가장 빨라요.",
  ].join("\n");
};

const buildGuideAnswer = () =>
  "지금은 AI 코치가 점검 중이에요. 대신 바로 적용할 수 있는 가이드를 줄게요.\n1) 제목을 한 줄로 짧게\n2) 버튼 문구를 행동형으로\n3) 배경색 대비를 크게";

const buildCoachModeSuccessPayload = (answer: string, provider: string) => ({
  ok: true,
  answer,
  provider,
});

const buildCoachBackendProxyPayload = (input: { prompt: string; lessonId: number | null; shareCode: string | null }) => ({
  prompt: input.prompt,
  lessonId: input.lessonId,
  shareCode: input.shareCode,
});

const emitCoachModeSuccessResponse = ({
  answer,
  provider,
  requestId,
}: {
  answer: string;
  provider: string;
  requestId: string;
}) =>
  emitEduAiStudentRouteJsonResponse({
    payload: buildCoachModeSuccessPayload(answer, provider),
    status: 200,
    requestId,
  });

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const route = new URL(request.url).pathname;
  const adapterContext: EduRouteAdapterContext = { requestId, route };
  const body = await readEduRouteJsonBody<CoachChatBody>(request);
  const admission = await evaluateEduCoachChatAdmission({ request, requestId, route, body });
  if (admission.kind === "respond") {
    return emitEduAiStudentRouteJsonResponse({ payload: admission.payload, status: admission.status, requestId, extraHeaders: admission.extraHeaders });
  }
  if (admission.kind === "local") {
    if (admission.mode === "disabled") {
      return emitCoachModeSuccessResponse({
        answer: "지금은 AI 코치가 잠시 점검 중이에요. 대신 AI 꾸미기에서 제목/배경/버튼 중 하나를 먼저 바꿔보세요.",
        provider: EDU_PROVIDER_TARGET.planCSafeMode,
        requestId,
      });
    }
    if (admission.mode === "guide") {
      return emitCoachModeSuccessResponse({
        answer: buildGuideAnswer(),
        provider: EDU_PROVIDER_TARGET.planCSafeMode,
        requestId,
      });
    }
    return emitCoachModeSuccessResponse({
      answer: buildTemplateCoachAnswer(admission.prompt),
      provider: EDU_PROVIDER_TARGET.planCTemplate,
      requestId,
    });
  }

  const responseHandlers = createEduCoachChatResponseHandlers({ requestId, route });

  return runEduRouteAdapter({
    adapterContext,
    emitResponse: ({ payload, status, requestId, extraHeaders }) => emitEduAiStudentRouteJsonResponse({ payload, status, requestId, extraHeaders }),
    runDraft: async () =>
      runEduAiStudentChatRouteService({
        route,
        requestId,
        kind: "coach",
        payload: buildCoachBackendProxyPayload({ prompt: admission.prompt, lessonId: admission.lessonId, shareCode: admission.shareCode }),
        handlers: responseHandlers,
      }),
  });
}
