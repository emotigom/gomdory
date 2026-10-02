import {
  type DecorateRouteAdapterContext,
  emitEduDecorateRouteJsonResponse,
  runEduDecoratePlanRouteService,
} from "@/lib/edu/lesson/serverDecoratePlanRouteHandler";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const route = new URL(request.url).pathname;
  const adapterContext: DecorateRouteAdapterContext = { requestId, route };
  try {
    return await runEduDecoratePlanRouteService(request, {}, adapterContext);
  } catch (error) {
    console.error("decorate_plan_route_unhandled", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return emitEduDecorateRouteJsonResponse({
      payload: {
        ok: false,
        code: "EDU_DECORATE_INTERNAL_ERROR",
        message: "요청 처리 중 오류가 발생했어요.",
      },
      status: 500,
      requestId,
    });
  }
}
