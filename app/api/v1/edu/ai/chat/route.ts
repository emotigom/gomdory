import { getOrCreateRequestId } from "@/lib/http/requestId";
import { evaluateEduAiChatAdmission, type ChatRequestBody } from "@/lib/server/eduAiChatAdmission";
import {
  emitEduAiStudentRouteJsonResponse,
  runEduAiStudentChatRouteService,
} from "@/lib/server/eduAiBackendClient";
import { createEduAiChatResponseHandlers } from "@/lib/server/eduAiChatResponsePolicy";
import { type EduRouteAdapterContext } from "@/lib/server/eduRouteAdapterContracts";
import { readEduRouteJsonBody, runEduRouteAdapter } from "@/lib/server/eduRouteAdapterUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const route = new URL(request.url).pathname;
  const adapterContext: EduRouteAdapterContext = { requestId, route };
  const body = await readEduRouteJsonBody<ChatRequestBody>(request);
  const admission = await evaluateEduAiChatAdmission({ request, requestId, route, body });
  if (admission.kind === "respond") {
    return emitEduAiStudentRouteJsonResponse({ payload: admission.payload, status: admission.status, requestId, extraHeaders: admission.extraHeaders });
  }

  const responseHandlers = createEduAiChatResponseHandlers({ requestId, route });

  return runEduRouteAdapter({
    adapterContext,
    emitResponse: ({ payload, status, requestId, extraHeaders }) =>
      emitEduAiStudentRouteJsonResponse({
        payload,
        status,
        requestId,
        extraHeaders,
      }),
    runDraft: async () =>
      runEduAiStudentChatRouteService({
        route,
        requestId,
        kind: "chat",
        payload: { messages: admission.fullMessages, lessonId: admission.lessonId, shareCode: admission.shareCode },
        handlers: responseHandlers,
      }),
  });
}
