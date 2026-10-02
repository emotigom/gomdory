import {
  type EduRouteJsonResponseInput,
  type RunEduRouteAdapterInput,
} from "@/lib/server/eduRouteAdapterContracts";

// [boundary role]
// This file is utility-only for route adapters.
// - Consumes contracts from `eduRouteAdapterContracts`.
// - Must not absorb backend/provider orchestration from `eduAiBackendClient`.
// - Route-local naming wrappers may delegate to these helpers for compatibility.

// [shared utility] canonical JSON response emitter used by student route adapters.
export function emitEduRouteJsonResponse(input: EduRouteJsonResponseInput) {
  const headers = new Headers(input.extraHeaders);
  headers.set("content-type", "application/json");
  headers.set("x-request-id", input.requestId);
  headers.set("x-gom-request-id", input.requestId);
  return Response.json({ ...input.payload, requestId: input.requestId }, { status: input.status, headers });
}

// [shared utility] route adapter runner: execute service draft then emit via
// shared emitter or route-local emitter wrapper.
export async function runEduRouteAdapter(input: RunEduRouteAdapterInput) {
  const requestId = input.adapterContext?.requestId ?? input.requestId;
  if (!requestId) {
    throw new Error("runEduRouteAdapter requires requestId or adapterContext.requestId");
  }
  const draft = await input.runDraft();
  const emitResponse = input.emitResponse ?? emitEduRouteJsonResponse;
  return emitResponse({
    payload: draft.payload,
    status: draft.status,
    requestId,
    extraHeaders: draft.extraHeaders,
  });
}

export async function readEduRouteJsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}
