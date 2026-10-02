import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const { token } = (await request.json()) as { token?: string };
    const ip =
      request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const userAgent = request.headers.get("user-agent");
    const cfRay = request.headers.get("cf-ray");

    if (!token) {
      return jsonErrorWithRequestId(
        "TURNSTILE_VERIFICATION_FAILED",
        "turnstile token missing",
        requestId,
        400,
      );
    }

    const result = await verifyTurnstileTokenWithTelemetry(token, {
      requestId,
      route: "/api/turnstile/verify",
      action: "turnstile_api",
      originHost: origin,
      refererHost: referer,
      ip,
      userAgent,
      cfRay,
    });

    if (!result.ok) {
      const headers = new Headers();
      headers.set("x-request-id", requestId);
      headers.set("x-gom-request-id", requestId);
      return Response.json(
        {
          ok: false,
          code: "TURNSTILE_FAILED",
          message: result.userMessage,
          requestId: result.requestId,
          retryable: result.retryable,
          hint: result.hint,
        },
        { status: 400, headers },
      );
    }

    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonErrorWithRequestId("INTERNAL_ERROR", message, requestId, 500);
  }
}
