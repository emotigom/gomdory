import { NextResponse } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { recordOpsEvent } from "@/lib/ops/recordEvent";


type EduViewHealthResponse =
  | {
      ok: true;
      origin: string;
      visibilityKv: "enabled" | "disabled";
      status: number;
    }
  | {
      ok: false;
      message: string;
    };

const HEALTH_FAILURE_MESSAGE = "상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";

function responseWithRequestId(
  payload: EduViewHealthResponse,
  requestId: string,
  status?: number,
) {
  const response = NextResponse.json(payload, status === undefined ? undefined : { status });
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-gom-request-id", requestId);
  return response;
}

function recordHealthFailure(request: Request, requestId: string, status: number, action: string) {
  void recordOpsEvent(
    {
      level: "error",
      kind: "api_error",
      requestId,
      route: new URL(request.url).pathname,
      status,
      meta: {
        stage: "eduview_health",
        component: "upstream_health",
        action,
      },
    },
    { sampleRate: 1, hardLimitPerMinute: 60 },
  );
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const gomRequestId = request.headers.get("x-gom-request-id")?.trim();
  const resolvedRequestId = gomRequestId || requestId;
  const origin = readEduviewOrigin();
  const url = `${origin.replace(/\/$/, "")}/v1/health/visibility`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-request-id": resolvedRequestId,
        "x-gom-request-id": resolvedRequestId,
      },
    });
    if (response.status === 200) {
      return responseWithRequestId({
        ok: true,
        origin,
        visibilityKv: "enabled",
        status: response.status,
      }, resolvedRequestId);
    }

    if (response.status === 404) {
      return responseWithRequestId({
        ok: true,
        origin,
        visibilityKv: "disabled",
        status: response.status,
      }, resolvedRequestId);
    }

    recordHealthFailure(request, resolvedRequestId, response.status, "upstream_non_canonical_status");
    return responseWithRequestId(
      {
        ok: false,
        message: HEALTH_FAILURE_MESSAGE,
      } satisfies EduViewHealthResponse,
      resolvedRequestId,
      response.status,
    );
  } catch {
    recordHealthFailure(request, resolvedRequestId, 500, "upstream_request_failed");
    return responseWithRequestId(
      {
        ok: false,
        message: HEALTH_FAILURE_MESSAGE,
      } satisfies EduViewHealthResponse,
      resolvedRequestId,
      500,
    );
  }
}
