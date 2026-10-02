export type DecorateTargetV1 =
  | { kind: "slot"; slot: "image_primary" | "image_any" | "heading_primary" | "text_any" | "section_any" }
  | { kind: "selector"; selector: string };

export type DecorateOpV1 =
  | {
      op: "insert_media";
      target: Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "image_primary" | "image_any" };
      media: { kind: "cat_placeholder" | "generic_placeholder" };
      style: { prominence: "high" | "medium"; caption: boolean };
    }
  | {
      op: "add_caption";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "image_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      text: string;
    }
  | {
      op: "emphasize_heading";
      target: Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "heading_primary" };
      tone: "cute" | "bold" | "clean";
    }
  | {
      op: "add_callout_box";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "section_any" | "text_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      text: string;
    }
  | {
      op: "tidy_spacing";
      target: Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "section_any" };
      level: "sm" | "md";
    }
  | {
      op: "set_surface_background";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "section_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        mode: "color" | "gradient";
        color?: string;
        gradientFrom?: string;
        gradientTo?: string;
        textColor?: string;
      };
    }
  | {
      op: "set_surface_tone";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "section_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        background?: string;
        textColor?: string;
        borderColor?: string;
        radiusLevel?: "sm" | "md" | "lg";
        shadowLevel?: "none" | "sm" | "md";
        spacingToneHint?: "compact" | "balanced" | "airy";
      };
    }
  | {
      op: "set_text_style";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "heading_primary" | "text_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        textColor?: string;
        contrastAdjust?: "auto" | "boost";
      };
    }
  | {
      op: "set_text_emphasis";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "heading_primary" | "text_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        emphasisStrength: "subtle" | "medium" | "strong";
      };
    }
  | {
      op: "set_accent_style";
      target: Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        accentColor?: string;
        textColor?: string;
        borderColor?: string;
        emphasisStrength?: "subtle" | "medium" | "strong";
      };
    }
  | {
      op: "set_button_style";
      target: Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        background?: string;
        textColor?: string;
        borderColor?: string;
        radiusLevel?: "sm" | "md" | "lg";
        shadowLevel?: "none" | "sm" | "md";
        emphasisStrength?: "subtle" | "medium" | "strong";
      };
    }
  | {
      op: "set_card_style";
      target: Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        background?: string;
        borderColor?: string;
        radiusLevel?: "sm" | "md" | "lg";
        shadowLevel?: "none" | "sm" | "md";
      };
    }
  | {
      op: "set_section_style";
      target:
        | (Extract<DecorateTargetV1, { kind: "slot" }> & { slot: "section_any" })
        | Extract<DecorateTargetV1, { kind: "selector" }>;
      style: {
        background?: string;
        borderColor?: string;
        spacingToneHint?: "compact" | "balanced" | "airy";
      };
    };

export type DecoratePlanV1 = {
  version: 1;
  summary: string;
  ops: DecorateOpV1[];
};

const FORBIDDEN_SELECTOR_TOKENS = /(script|onerror|onload|on[a-z]+\s*=|javascript:|<|>|\{|\}|@import)/i;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

const validateSelector = (selector: unknown): selector is string => {
  if (typeof selector !== "string") return false;
  const trimmed = selector.trim();
  if (!trimmed || trimmed.length > 180) return false;
  if (FORBIDDEN_SELECTOR_TOKENS.test(trimmed)) return false;
  return /^[#.:\[\]\-_=\s\w>'"(),+~*]+$/.test(trimmed);
};

const validateTarget = (target: unknown): target is DecorateTargetV1 => {
  if (!isPlainObject(target) || !hasOnlyKeys(target, ["kind", "slot", "selector"])) return false;
  if (target.kind === "slot") {
    return (
      typeof target.slot === "string" &&
      ["image_primary", "image_any", "heading_primary", "text_any", "section_any"].includes(target.slot)
    );
  }
  if (target.kind === "selector") return validateSelector(target.selector);
  return false;
};

const validateNoExternalUrl = (value: unknown) => {
  if (typeof value !== "string") return true;
  return !/^https?:\/\//i.test(value) && !/^\/\//.test(value) && !/javascript:/i.test(value);
};

export function validateDecoratePlanV1(input: unknown): { ok: true; plan: DecoratePlanV1 } | { ok: false; reason: string } {
  if (!isPlainObject(input) || !hasOnlyKeys(input, ["version", "summary", "ops"])) {
    return { ok: false, reason: "invalid_plan_shape" };
  }
  if (input.version !== 1) return { ok: false, reason: "invalid_plan_version" };
  if (typeof input.summary !== "string" || input.summary.trim().length === 0 || input.summary.length > 300) {
    return { ok: false, reason: "invalid_plan_summary" };
  }
  if (!Array.isArray(input.ops)) return { ok: false, reason: "invalid_plan_ops" };

  const ops: DecorateOpV1[] = [];
  for (const entry of input.ops) {
    if (!isPlainObject(entry) || typeof entry.op !== "string") return { ok: false, reason: "invalid_op_shape" };
    if (!validateTarget(entry.target)) return { ok: false, reason: `invalid_target_${entry.op}` };
    switch (entry.op) {
      case "insert_media": {
        if (!hasOnlyKeys(entry, ["op", "target", "media", "style"])) return { ok: false, reason: "unknown_field_insert_media" };
        if (entry.target.kind !== "slot" || !["image_primary", "image_any"].includes(entry.target.slot)) {
          return { ok: false, reason: "invalid_target_insert_media" };
        }
        if (!isPlainObject(entry.media) || !hasOnlyKeys(entry.media, ["kind"])) return { ok: false, reason: "invalid_media" };
        if (!["cat_placeholder", "generic_placeholder"].includes(String(entry.media.kind))) {
          return { ok: false, reason: "invalid_media_kind" };
        }
        if (!isPlainObject(entry.style) || !hasOnlyKeys(entry.style, ["prominence", "caption"])) {
          return { ok: false, reason: "invalid_media_style" };
        }
        if (!["high", "medium"].includes(String(entry.style.prominence)) || typeof entry.style.caption !== "boolean") {
          return { ok: false, reason: "invalid_media_style_values" };
        }
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "add_caption": {
        if (!hasOnlyKeys(entry, ["op", "target", "text"])) return { ok: false, reason: "unknown_field_add_caption" };
        if (typeof entry.text !== "string" || entry.text.trim().length === 0 || entry.text.length > 300) {
          return { ok: false, reason: "invalid_caption_text" };
        }
        if (
          !((entry.target.kind === "slot" && entry.target.slot === "image_any") ||
            (entry.target.kind === "selector" && validateSelector(entry.target.selector)))
        ) {
          return { ok: false, reason: "invalid_target_add_caption" };
        }
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "emphasize_heading": {
        if (!hasOnlyKeys(entry, ["op", "target", "tone"])) return { ok: false, reason: "unknown_field_emphasize_heading" };
        if (entry.target.kind !== "slot" || entry.target.slot !== "heading_primary") {
          return { ok: false, reason: "invalid_target_emphasize_heading" };
        }
        if (!["cute", "bold", "clean"].includes(String(entry.tone))) return { ok: false, reason: "invalid_heading_tone" };
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "add_callout_box": {
        if (!hasOnlyKeys(entry, ["op", "target", "text"])) return { ok: false, reason: "unknown_field_add_callout_box" };
        if (typeof entry.text !== "string" || entry.text.trim().length === 0 || entry.text.length > 500) {
          return { ok: false, reason: "invalid_callout_text" };
        }
        if (
          !(
            (entry.target.kind === "slot" && ["section_any", "text_any"].includes(entry.target.slot)) ||
            (entry.target.kind === "selector" && validateSelector(entry.target.selector))
          )
        ) {
          return { ok: false, reason: "invalid_target_add_callout_box" };
        }
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "tidy_spacing": {
        if (!hasOnlyKeys(entry, ["op", "target", "level"])) return { ok: false, reason: "unknown_field_tidy_spacing" };
        if (entry.target.kind !== "slot" || entry.target.slot !== "section_any") {
          return { ok: false, reason: "invalid_target_tidy_spacing" };
        }
        if (!["sm", "md"].includes(String(entry.level))) return { ok: false, reason: "invalid_spacing_level" };
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "set_surface_background": {
        if (!hasOnlyKeys(entry, ["op", "target", "style"])) return { ok: false, reason: "unknown_field_set_surface_background" };
        if (
          !(
            (entry.target.kind === "slot" && entry.target.slot === "section_any") ||
            (entry.target.kind === "selector" && validateSelector(entry.target.selector))
          )
        ) {
          return { ok: false, reason: "invalid_target_set_surface_background" };
        }
        if (!isPlainObject(entry.style) || !hasOnlyKeys(entry.style, ["mode", "color", "gradientFrom", "gradientTo", "textColor"])) {
          return { ok: false, reason: "invalid_style_set_surface_background" };
        }
        if (!["color", "gradient"].includes(String(entry.style.mode))) return { ok: false, reason: "invalid_surface_background_mode" };
        if (entry.style.mode === "color" && typeof entry.style.color !== "string") return { ok: false, reason: "invalid_surface_background_color" };
        if (entry.style.mode === "gradient" && (typeof entry.style.gradientFrom !== "string" || typeof entry.style.gradientTo !== "string")) {
          return { ok: false, reason: "invalid_surface_background_gradient" };
        }
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "set_surface_tone": {
        if (!hasOnlyKeys(entry, ["op", "target", "style"])) return { ok: false, reason: "unknown_field_set_surface_tone" };
        if (!isPlainObject(entry.style)) return { ok: false, reason: "invalid_style_set_surface_tone" };
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "set_text_style": {
        if (!hasOnlyKeys(entry, ["op", "target", "style"])) return { ok: false, reason: "unknown_field_set_text_style" };
        if (!isPlainObject(entry.style)) return { ok: false, reason: "invalid_style_set_text_style" };
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "set_text_emphasis": {
        if (!hasOnlyKeys(entry, ["op", "target", "style"])) return { ok: false, reason: "unknown_field_set_text_emphasis" };
        if (!isPlainObject(entry.style) || !["subtle", "medium", "strong"].includes(String(entry.style.emphasisStrength))) {
          return { ok: false, reason: "invalid_style_set_text_emphasis" };
        }
        ops.push(entry as DecorateOpV1);
        break;
      }
      case "set_accent_style":
      case "set_button_style":
      case "set_card_style":
      case "set_section_style": {
        if (!hasOnlyKeys(entry, ["op", "target", "style"])) return { ok: false, reason: `unknown_field_${entry.op}` };
        if (!isPlainObject(entry.style)) return { ok: false, reason: `invalid_style_${entry.op}` };
        ops.push(entry as DecorateOpV1);
        break;
      }
      default:
        return { ok: false, reason: "unknown_op" };
    }

    if (!validateNoExternalUrl((entry as { src?: unknown }).src)) return { ok: false, reason: "external_url_disallowed" };
  }

  return {
    ok: true,
    plan: {
      version: 1,
      summary: input.summary.trim(),
      ops,
    },
  };
}
