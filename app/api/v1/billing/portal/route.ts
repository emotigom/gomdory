export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateEntitlementRow } from "@/lib/billing/entitlements";
import { requireStripeBillingConfig } from "@/lib/billing/config";
import { createBillingPortalSession } from "@/lib/billing/stripeClient";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { getRuntimeEnv } from "@/lib/server/runtimeEnv";

async function handlePost(_request: NextRequest, _context: unknown, ops: WithOpsContext) {
  try {
    const env = requireStripeBillingConfig(getRuntimeEnv() as Record<string, string | undefined>, {
      requireWebhook: false,
    });
    if (!env.enabled) {
      return jsonError("billing_disabled", "결제 설정이 아직 준비되지 않았습니다.", 503, { requestId: ops.requestId });
    }

    const { user } = await requireUserApi();
    const entitlement = await getOrCreateEntitlementRow(user.id);
    if (!entitlement.stripe_customer_id) {
      return jsonError("portal_unavailable", "Stripe 고객 정보가 없습니다.", 400, { requestId: ops.requestId });
    }

    const session = await createBillingPortalSession({
      customerId: entitlement.stripe_customer_id,
      returnUrl: env.portalReturnUrl,
    });

    return jsonOk({ url: session.url, requestId: ops.requestId });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    const disabled =
      error instanceof Error &&
      (error.message === "billing_disabled" || error.message.startsWith("missing_env"));
    const status = unauthorized ? 401 : disabled ? 503 : 502;
    const code = unauthorized ? "unauthorized" : disabled ? "billing_disabled" : "portal_failed";
    return jsonError(code, "결제 포털을 열지 못했습니다.", status, { requestId: ops.requestId });
  }
}

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
