import { type DecoratePlanV1, validateDecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import { evaluateDecorateIntentMatch, isBackgroundStyleIntent, type DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";

export type DecoratePlanRecommendedAction = "accept" | "accept_and_enrich" | "fallback" | "reject";

export type DecoratePlanValidationResult = {
  intentMatched: boolean;
  mismatchKinds: string[];
  isSchemaValid: boolean;
  isSemanticallyUseful: boolean;
  repairable: boolean;
  issues: string[];
  qualityHints: string[];
  recommendedAction: DecoratePlanRecommendedAction;
  schemaReason: string | null;
};

const WEAK_OPS = new Set(["tidy_spacing"]);

export const validateDecoratePlan = (input: {
  plan: unknown;
  intent?: DecorateIntentSummary;
  styleIntent?: DecorateStyleIntent;
  source: "server_llm" | "local_llm" | "deterministic" | "cache";
}): DecoratePlanValidationResult & { plan: DecoratePlanV1 | null } => {
  const schema = validateDecoratePlanV1(input.plan);
  if (!schema.ok) {
    return {
      plan: null,
      isSchemaValid: false,
      isSemanticallyUseful: false,
      repairable: false,
      issues: ["schema_invalid"],
      qualityHints: [schema.reason],
      recommendedAction: "reject",
      schemaReason: schema.reason,
      intentMatched: false,
      mismatchKinds: ["schema_invalid"],
    };
  }

  const plan = schema.plan;
  const issues: string[] = [];
  const qualityHints: string[] = [];
  const opKinds = new Set(plan.ops.map((op) => op.op));
  const meaningfulOps = plan.ops.filter((op) => !WEAK_OPS.has(op.op));
  const imageOps = plan.ops.filter((op) => op.op === "insert_media" || op.op === "add_caption");

  if (plan.ops.length === 0) issues.push("empty_ops");
  if (meaningfulOps.length === 0) issues.push("only_low_impact_ops");
  if (plan.summary.trim().length < 8) issues.push("summary_too_short");

  if (input.intent) {
    if (input.intent.imageTargets.length > 0 && imageOps.length === 0) issues.push("image_intent_without_image_op");
    if (input.intent.emphasisTargets.length > 0 && !opKinds.has("emphasize_heading") && !opKinds.has("add_callout_box")) {
      issues.push("emphasis_intent_without_targeted_op");
    }
    if (input.intent.tone.length > 0 && !opKinds.has("emphasize_heading") && !opKinds.has("tidy_spacing")) {
      issues.push("tone_intent_weak_mapping");
    }
    if (input.intent.isAmbiguous && plan.ops.length <= 1) qualityHints.push("ambiguous_prompt_conservative_plan");
  }

  const selectorOnly = plan.ops.length > 0 && plan.ops.every((op) => op.target.kind === "selector");
  if (selectorOnly) qualityHints.push("selector_only_targeting");

  const intentMatch = evaluateDecorateIntentMatch({ styleIntent: input.styleIntent ?? "none", plan });
  if (!intentMatch.intentMatched && isBackgroundStyleIntent(input.styleIntent ?? "none")) {
    issues.push("intent_mismatch_background");
    qualityHints.push(...intentMatch.mismatchKinds);
  }

  const semanticallyUseful = issues.length === 0;
  const repairable = issues.every((issue) =>
    ["summary_too_short", "tone_intent_weak_mapping", "emphasis_intent_without_targeted_op", "only_low_impact_ops", "image_intent_without_image_op"].includes(issue),
  );

  let recommendedAction: DecoratePlanRecommendedAction = "accept";
  if (!semanticallyUseful) {
    if (repairable) {
      recommendedAction = input.source === "server_llm" ? "accept_and_enrich" : "fallback";
    } else {
      recommendedAction = input.source === "deterministic" ? "accept_and_enrich" : "fallback";
    }
  }

  if (issues.includes("empty_ops")) {
    recommendedAction = input.source === "deterministic" ? "accept_and_enrich" : "reject";
  }
  if (issues.includes("intent_mismatch_background")) {
    recommendedAction = input.source === "deterministic" ? "accept_and_enrich" : "fallback";
  }

  return {
    plan,
    isSchemaValid: true,
    isSemanticallyUseful: semanticallyUseful,
    repairable,
    issues,
    qualityHints,
    recommendedAction,
    schemaReason: null,
    intentMatched: intentMatch.intentMatched,
    mismatchKinds: intentMatch.mismatchKinds,
  };
};
