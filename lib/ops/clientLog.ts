import { apiFetch } from "@/lib/http/apiFetch";
import { getLastRequestId } from "@/lib/http/requestId";
import { routes } from "@/lib/standards/routes";

type UiErrorPayload = {
  message: string;
  stack?: string | null;
  route?: string | null;
  requestId?: string | null;
};

const OPS_LOG_ENDPOINT = routes.api.v1("ops", "log");

export async function sendUiError(payload: UiErrorPayload) {
  try {
    const requestId = payload.requestId ?? getLastRequestId();
    await apiFetch(OPS_LOG_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: "error",
        route: payload.route ?? window.location.pathname,
        message: payload.message,
        stack: payload.stack,
        requestId: requestId ?? undefined,
      }),
    });
  } catch (error) {
    console.warn("[ops] ui-error send failed", error);
  }
}
