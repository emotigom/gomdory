import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { resolveCheckoutSuccessUrl, resolveStripePriceId } from "@/lib/billing/checkoutPolicy";
import { requireStripeBillingConfig } from "@/lib/billing/config";
import { createCheckoutSession } from "@/lib/billing/stripeClient";
import { logAudit } from "@/lib/data/audit";
import { type WithOpsContext } from "@/lib/ops/withOps";
import { getRuntimeEnv } from "@/lib/server/runtimeEnv";

type CheckoutBody = {
  interval?: "month" | "year";
  returnTo?: string;
};

type CheckoutDeps = {
  requireStripeBillingConfigFn?: typeof requireStripeBillingConfig;
  requireUserApiFn?: typeof requireUserApi;
  createCheckoutSessionFn?: typeof createCheckoutSession;
  logAuditFn?: typeof logAudit;
  getRuntimeEnvFn?: typeof getRuntimeEnv;
};

export async function handlePost(
  request: NextRequest,
  _context: unknown,
  ops: WithOpsContext,
  deps?: CheckoutDeps,
) {
  try {
    const env = (deps?.requireStripeBillingConfigFn ?? requireStripeBillingConfig)(
      (deps?.getRuntimeEnvFn ?? getRuntimeEnv)() as Record<string, string | undefined>,
      {
        requireWebhook: false,
      },
    );
    if (!env.enabled) {
      return jsonError("billing_disabled", "결제 설정이 아직 준비되지 않았습니다.", 503, { requestId: ops.requestId });
    }

    const { user } = await (deps?.requireUserApiFn ?? requireUserApi)();
    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    const interval = body.interval === "year" ? "year" : "month";
    const priceId = resolveStripePriceId(interval, env);
    if (!priceId) {
      return jsonError("billing_price_unavailable", "선택한 결제 주기는 현재 준비되지 않았습니다.", 503, {
        requestId: ops.requestId,
        interval,
      });
    }

    const successUrl = resolveCheckoutSuccessUrl(body.returnTo, env.successUrl);
    const cancelUrl = env.cancelUrl;

    const session = await (deps?.createCheckoutSessionFn ?? createCheckoutSession)({
      mode: "subscription",
      priceId,
      customerEmail: user.email,
      metadata: { userId: user.id },
      successUrl,
      cancelUrl,
    });

    void (deps?.logAuditFn ?? logAudit)({
      action: "checkout_started",
      targetType: "billing",
      targetId: user.id,
      meta: { interval, priceId, requestId: ops.requestId },
    });

    return jsonOk({ url: session.url, requestId: ops.requestId });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    const disabled =
      error instanceof Error &&
      (error.message === "billing_disabled" || error.message.startsWith("missing_env"));
    const status = unauthorized ? 401 : disabled ? 503 : 502;
    const code = unauthorized ? "unauthorized" : disabled ? "billing_disabled" : "checkout_failed";
    return jsonError(code, "결제 세션을 생성하지 못했습니다.", status, { requestId: ops.requestId });
  }
}

