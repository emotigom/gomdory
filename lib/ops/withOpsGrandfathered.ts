export type GrandfatheredWithOpsCategory =
  | "response-shape-sensitive"
  | "telemetry-sensitive"
  | "route-specific-complexity";

export type GrandfatheredWithOpsDisposition =
  | "hold-for-now"
  | "candidate-after-proof";

export type GrandfatheredWithOpsException = {
  path: string;
  category: GrandfatheredWithOpsCategory;
  disposition: GrandfatheredWithOpsDisposition;
  keepReason: string;
  migrationPrerequisite: string;
  doNotCopy: string;
};

const APP_API_V1_ROOT = ["app", "api", "v1"].join("/");
const routeFile = (routePath: string) =>
  `${APP_API_V1_ROOT}/${routePath}/route.ts`;

/**
 * Remaining non-ops `withOps` imports are an explicit compatibility registry, not a starter kit.
 *
 * Canonical guidance for new generic routes:
 * - `withRequestContext` owns request-id/header plumbing.
 * - `operationalRoute` owns shared request-aware response shaping.
 * - `withOps` is only for route contracts that truly need ops telemetry/error reporting.
 *
 * This list exists so contributors can tell which legacy routes are intentionally kept,
 * why they remain grandfathered, and which proof is still missing before any tiny follow-up
 * migration should be considered. The disposition stays hold-first: `candidate-after-proof` still means
 * "do not migrate yet" until its route-specific prerequisite has been satisfied.
 */
export const GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS: readonly GrandfatheredWithOpsException[] =
  [
    {
      path: routeFile("billing/portal"),
      category: "response-shape-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Portal session creation mixes Stripe-disabled, auth, and customer-state branches that already depend on stable legacy error envelopes.",
      migrationPrerequisite:
        "Keep current wrapper until focused portal route coverage proves Stripe-disabled, auth-failure, and requestId-bearing error envelopes together.",
      doNotCopy:
        "Do not copy external-provider flow routes into new withOps callsites just because they return JSON.",
    },
    {
      path: routeFile("billing/redeem"),
      category: "response-shape-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "License redemption normalizes multiple user-facing error codes, so response-shape drift would be harder to spot without focused route coverage.",
      migrationPrerequisite:
        "Keep current wrapper until route tests lock requestId-bearing invalid/unauthorized/redeem-failed payload fanout before any adapter swap.",
      doNotCopy:
        "Do not treat user-facing error-code fanout as a reason to default to withOps in fresh routes.",
    },
    {
      path: routeFile("billing/upgrade-intent"),
      category: "telemetry-sensitive",
      disposition: "candidate-after-proof",
      keepReason:
        "The handler is mechanically small, but it couples request success with audit logging, so migration should preserve telemetry timing and request-id semantics together.",
      migrationPrerequisite:
        "Add a focused upgrade-intent route test that proves invalid-context, unauthorized, success, and audit-triggered requestId behavior before migrating.",
      doNotCopy:
        "Do not copy audit-only routes into new withOps usage unless the route contract truly requires ops telemetry/error reporting.",
    },
    {
      path: routeFile("billing/checkout"),
      category: "response-shape-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Checkout creation combines runtime config validation, auth, return-url normalization, and Stripe session setup behind established JSON error semantics.",
      migrationPrerequisite:
        "Keep current wrapper until focused checkout coverage locks config/auth/session failure envelopes plus requestId/header behavior.",
      doNotCopy:
        "Do not treat payment-session setup as evidence that new JSON handlers should start in withOps.",
    },
    {
      path: routeFile("billing/license/create"),
      category: "telemetry-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Admin license creation already couples request handling with audit trails and privileged access checks, so telemetry preservation matters more than wrapper churn here.",
      migrationPrerequisite:
        "Keep current wrapper until admin-create route tests pin privileged access, audit side effects, and requestId/error envelope behavior together.",
      doNotCopy:
        "Do not copy admin mutation routes into new withOps imports when requestContext + operationalRoute already covers the response contract.",
    },
    {
      path: routeFile("billing/institution/request"),
      category: "telemetry-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Institution purchase intake combines user data sanitization, Supabase writes, and audit logging, so keeping the current wrapper avoids mixing observability cleanup with data-entry behavior.",
      migrationPrerequisite:
        "Keep current wrapper until focused intake coverage proves sanitized write failures and audit/requestId behavior without broadening this slice.",
      doNotCopy:
        "Do not copy sanitized form-ingest routes into new withOps usage unless ops telemetry is part of the contract.",
    },
    {
      path: routeFile("billing/upgrade-request"),
      category: "telemetry-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Upgrade-request intake already stores request metadata and rate-limit outcomes; preserving current request-id and telemetry behavior is safer than opportunistic wrapper churn.",
      migrationPrerequisite:
        "Keep current wrapper until rate-limit, metadata-write, and requestId-bearing response coverage exists for the full intake path.",
      doNotCopy:
        "Do not copy rate-limited intake routes into new withOps usage by default.",
    },
    {
      path: routeFile("storage/usage"),
      category: "telemetry-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Storage usage intentionally reports soft-failure payloads while the route-local respond helper records diagnostics, so migration should be paired with explicit route coverage.",
      migrationPrerequisite:
        "Keep current wrapper until route tests lock soft-failure payloads, headers, and diagnostic side effects for storage usage.",
      doNotCopy:
        "Do not copy soft-fail diagnostic routes into new withOps imports; prefer canonical requestContext plumbing first.",
    },
    {
      path: routeFile("storage/refresh"),
      category: "telemetry-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Refresh throttling, timeout handling, and route-local response instrumentation make this more observability-sensitive than its thin JSON shape suggests.",
      migrationPrerequisite:
        "Keep current wrapper until throttling, timeout, and diagnostic-response coverage is explicit for storage refresh.",
      doNotCopy:
        "Do not treat throttled maintenance endpoints as new-route withOps precedent.",
    },
    {
      path: routeFile("storage/quota"),
      category: "telemetry-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Quota writes are admin-key gated and rely on route-local diagnostic responses, so telemetry-preserving cleanup should wait for a dedicated slice.",
      migrationPrerequisite:
        "Keep current wrapper until admin-key, diagnostic-response, and write-failure coverage exists for quota updates.",
      doNotCopy:
        "Do not copy admin-key maintenance routes into new non-ops withOps imports.",
    },
    {
      path: routeFile("coupons/redeem"),
      category: "response-shape-sensitive",
      disposition: "hold-for-now",
      keepReason:
        "Coupon redemption normalizes RPC result variants into legacy request-id-bearing payloads that are easy for clients to depend on implicitly.",
      migrationPrerequisite:
        "Keep current wrapper until focused redeem-route tests pin each RPC variant and requestId-bearing error envelope before any migration.",
      doNotCopy:
        "Do not use RPC-backed JSON mutation routes as justification for new generic withOps usage.",
    },
    {
      path: routeFile("sessions/[sessionId]/controls"),
      category: "response-shape-sensitive",
      disposition: "candidate-after-proof",
      keepReason:
        "Session controls is relatively small, but it still hand-shapes NextResponse payloads and permission errors without a dedicated migration proof test.",
      migrationPrerequisite:
        "Add a focused session-controls route test that covers invalid params, unauthorized/forbidden branches, invalid body, and success payload/requestId headers before migrating.",
      doNotCopy:
        "Do not copy small board-control routes into new withOps imports when requestContext + operationalRoute would be clearer.",
    },
    {
      path: routeFile("boards/[boardId]/live"),
      category: "route-specific-complexity",
      disposition: "hold-for-now",
      keepReason:
        "The live board route mixes board-role checks, timeouts, snapshot shaping, mutations, and extra ops events; it deserves an isolated migration later, not wrapper churn in this pass.",
      migrationPrerequisite:
        "Keep current wrapper until an isolated live-route slice can verify auth, snapshot shaping, mutation fanout, and extra ops events together.",
      doNotCopy:
        "Do not copy complex collaboration routes into new withOps usage; they are explicit exceptions.",
    },
    {
      path: routeFile("boards/[boardId]/ownership-requests"),
      category: "route-specific-complexity",
      disposition: "candidate-after-proof",
      keepReason:
        "The GET route is smaller than the board mutation handlers, but it still depends on board-access gating and a legacy object-return path that should be migrated deliberately.",
      migrationPrerequisite:
        "Add a focused ownership-requests GET test that proves invalid board id, auth/forbidden, query failure, and successful item mapping before migrating.",
      doNotCopy:
        "Do not treat board-access list routes as acceptable new withOps precedent.",
    },
    {
      path: routeFile("boards/[boardId]/triage"),
      category: "route-specific-complexity",
      disposition: "candidate-after-proof",
      keepReason:
        "Triage listing is read-only, but it still sits inside the broader live-session moderation seam and should move only with focused boundary coverage.",
      migrationPrerequisite:
        "Add a focused triage-list route test that proves board access, status filtering, limit clamping, and requestId-bearing responses before migrating.",
      doNotCopy: "Do not copy moderation/list routes into new withOps usage.",
    },
    {
      path: routeFile(
        "boards/[boardId]/ownership-requests/[requestId]/approve",
      ),
      category: "route-specific-complexity",
      disposition: "hold-for-now",
      keepReason:
        "Approval mutates multiple records and emits explicit ops events, so any wrapper change should be bundled with targeted behavior and telemetry verification.",
      migrationPrerequisite:
        "Keep current wrapper until approval-route tests cover multi-write success/failure plus emitted ops events and requestId behavior together.",
      doNotCopy:
        "Do not copy multi-write approval flows into new withOps imports; they remain grandfathered exceptions.",
    },
    {
      path: routeFile("boards/[boardId]/triage/[id]"),
      category: "route-specific-complexity",
      disposition: "hold-for-now",
      keepReason:
        "Per-item triage actions coordinate live-session state, append events, and audits, which makes them poor candidates for opportunistic wrapper cleanup.",
      migrationPrerequisite:
        "Keep current wrapper until per-item triage mutation coverage proves live-session writes, audit/events, and requestId/error semantics together.",
      doNotCopy:
        "Do not copy live-session mutation routes into new non-ops withOps imports.",
    },
  ] as const;

export const GRANDFATHERED_NON_OPS_WITH_OPS_ROUTE_PATHS =
  GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS.map((entry) => entry.path);

export function getGrandfatheredWithOpsException(path: string) {
  return GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS.find(
    (entry) => entry.path === path,
  );
}

export function formatGrandfatheredWithOpsExceptionSummary() {
  return GRANDFATHERED_NON_OPS_WITH_OPS_EXCEPTIONS.map(
    (entry) =>
      `- ${entry.path} [${entry.category}; ${entry.disposition}]\n  keep: ${entry.keepReason}\n  prerequisite: ${entry.migrationPrerequisite}\n  do-not-copy: ${entry.doNotCopy}`,
  ).join("\n");
}
