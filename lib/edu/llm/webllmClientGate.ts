import type { EduFeatureFlags } from "@/lib/edu/featureFlags";
import { resolveWebllmBootstrapPlan } from "@/lib/edu/llm/webllmBootstrapPlan";

export type WebllmHealthGate = {
  ok: boolean;
  hardDisabled: boolean;
};

type ResolveWebllmClientGateInput = {
  featureFlags: EduFeatureFlags;
  baseEnabled: boolean;
  entryBlocked: boolean;
  health?: WebllmHealthGate | null;
};

export type ResolveWebllmClientGateResult = {
  effectiveEnabled: boolean;
  downloadAllowed: boolean;
  disabled: boolean;
  authRequired: boolean;
  joinTokenSessionAllowed: boolean;
};

export const resolveWebllmClientGate = (
  input: ResolveWebllmClientGateInput,
): ResolveWebllmClientGateResult => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: input.featureFlags,
    hasRequiredEnv: true,
    entryBlocked: input.entryBlocked,
    health: input.health,
    baseEnabledOverride: input.baseEnabled,
  });

  return {
    effectiveEnabled: plan.effectiveEnabled,
    downloadAllowed: plan.downloadAllowed,
    disabled: !plan.effectiveEnabled,
    authRequired: plan.authRequired,
    joinTokenSessionAllowed: plan.joinTokenSessionAllowed,
  };
};
