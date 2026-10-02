import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { SlotMapSummary } from "@/lib/edu/lesson/slotMap";
import { apiV1Path } from "@/lib/standards/pathTypes";
import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import { buildDecorateServerPayload } from "@/lib/edu/lesson/decorateServerPayload";
import type { DecoratePlanShaping } from "@/lib/edu/lesson/decoratePlanShaper";

export type ServerDecoratePlanRequest = {
  prompt: string;
  snapshotVersion: string;
  slotFingerprint?: string;
  slotHints?: SlotMapSummary;
  changedNodesCount?: number;
  intentSummary?: DecorateIntentSummary;
  priorQualityScore?: number | null;
  lowImpactRisk?: boolean;
  shapedPlan?: DecoratePlanShaping;
  historyConfidence?: number;
  onPayloadBuilt?: (input: { primaryIntent: DecorateIntentSummary["primaryIntent"] | null; confidence: number | null; ambiguous: boolean; includedHintKinds: string[]; stabilityPreference: string | null; historyConfidence: number | null }) => void;
  joinToken?: string;
  signal?: AbortSignal;
};

type DecorateFailureReason =
  | "timeout"
  | "network"
  | "unauthorized"
  | "openai_auth"
  | "openai_capacity"
  | "openai_upstream_5xx"
  | "openai_network"
  | "openai_timeout"
  | "openai_bad_request"
  | "openai_schema_invalid"
  | "route_runtime_error"
  | "route_unknown"
  | "invalid_json"
  | "schema_invalid"
  | "server_not_available"
  | "aborted"
  | `http_${number}`;

export type ServerDecoratePlanResult =
  | {
      ok: true;
      provider: "server_llm" | "cache" | "deterministic_safe";
      plan: DecoratePlanV1;
      latencyMs: number;
      requestId: string;
      status: number;
    }
  | {
      ok: false;
      reason: DecorateFailureReason;
      status?: number;
      latencyMs: number;
      requestId: string;
      rawError?: string;
      diagnostics?: Record<string, unknown>;
    };

const readRequestId = (response: Response) => response.headers.get("x-request-id") ?? crypto.randomUUID();

const mapServerReason = (reason: unknown): DecorateFailureReason | null => {
  if (typeof reason !== "string") return null;
  const allowed: DecorateFailureReason[] = [
    "openai_auth",
    "openai_capacity",
    "openai_upstream_5xx",
    "openai_network",
    "openai_timeout",
    "openai_bad_request",
    "openai_schema_invalid",
    "route_runtime_error",
    "route_unknown",
  ];
  return (allowed as string[]).includes(reason) ? (reason as DecorateFailureReason) : null;
};

export async function requestServerDecoratePlan(input: ServerDecoratePlanRequest): Promise<ServerDecoratePlanResult> {
  const startedAt = Date.now();
  try {
    const built = buildDecorateServerPayload({
      prompt: input.prompt,
      snapshotVersion: input.snapshotVersion,
      slotFingerprint: input.slotFingerprint,
      slotHints: input.slotHints,
      changedNodesCount: input.changedNodesCount,
      intentSummary: input.intentSummary,
      priorQualityScore: input.priorQualityScore,
      lowImpactRisk: input.lowImpactRisk,
      shapedPlan: input.shapedPlan,
      historyConfidence: input.historyConfidence,
    });
    input.onPayloadBuilt?.({
      primaryIntent: built.payload.intentCompact?.primaryIntent ?? null,
      confidence: built.payload.intentCompact?.confidence ?? null,
      ambiguous: built.payload.intentCompact?.ambiguous ?? false,
      includedHintKinds: built.includedHintKinds,
      stabilityPreference: built.payload.shapedContext?.stabilityPreference ?? null,
      historyConfidence: built.payload.shapedContext?.historyConfidence ?? null,
    });
    const endpoint = input.joinToken
      ? `${apiV1Path("edu/decorate/plan")}?jt=${encodeURIComponent(input.joinToken)}`
      : apiV1Path("edu/decorate/plan");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(built.payload),
      credentials: "same-origin",
      signal: input.signal,
    });

    const latencyMs = Math.max(0, Date.now() - startedAt);
    const requestId = readRequestId(response);

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { reason?: unknown; diagnostics?: Record<string, unknown> }
        | null;
      const mapped = mapServerReason(errorPayload?.reason);
      if (mapped) {
        return {
          ok: false,
          reason: mapped,
          status: response.status,
          latencyMs,
          requestId,
          diagnostics: errorPayload?.diagnostics,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: "unauthorized", status: response.status, latencyMs, requestId };
      }
      if (response.status === 404) {
        return { ok: false, reason: "server_not_available", status: response.status, latencyMs, requestId };
      }
      return { ok: false, reason: `http_${response.status}`, status: response.status, latencyMs, requestId, diagnostics: errorPayload?.diagnostics };
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; provider?: "server_llm" | "cache" | "deterministic_safe"; plan?: DecoratePlanV1 }
      | null;
    if (!payload) {
      return { ok: false, reason: "invalid_json", status: response.status, latencyMs, requestId };
    }
    if (!payload.ok || !payload.provider || !payload.plan) {
      return { ok: false, reason: "schema_invalid", status: response.status, latencyMs, requestId };
    }

    return { ok: true, provider: payload.provider, plan: payload.plan, latencyMs, requestId, status: response.status };
  } catch (error) {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const requestId = crypto.randomUUID();
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    const reason = isAbort
      ? input.signal?.aborted && (input.signal.reason as { abortReason?: string } | undefined)?.abortReason === "timeout"
        ? "timeout"
        : "aborted"
      : "network";
    return {
      ok: false,
      reason,
      latencyMs,
      requestId,
      rawError: error instanceof Error ? error.message : String(error),
    };
  }
}
