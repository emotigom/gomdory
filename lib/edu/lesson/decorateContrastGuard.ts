import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";

const luminance = (hex: string) => {
  const raw = hex.replace("#", "").trim();
  const normalized = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: string, b: string) => {
  const l1 = luminance(a) + 0.05;
  const l2 = luminance(b) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
};

const reduceSaturation = (hex: string) => {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return hex;
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const channels = [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16));
  const avg = (channels[0] + channels[1] + channels[2]) / 3;
  const toned = channels.map((channel) => Math.round(channel * 0.72 + avg * 0.28));
  return `#${toned.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

export const evaluateDecorateContrastGuard = (plan: DecoratePlanV1) => {
  const adjustedOps = [...plan.ops];
  const contrastWarnings: string[] = [];
  const adjustmentsApplied: string[] = [];
  let score = 1;

  adjustedOps.forEach((op, index) => {
    if (op.op === "set_surface_background") {
      const bg = op.style.mode === "color" ? op.style.color ?? "#ffffff" : op.style.gradientFrom ?? "#ffffff";
      const text = op.style.textColor ?? "#111827";
      if (contrastRatio(bg, text) < 4) {
        contrastWarnings.push("surface_text_low_contrast");
        score -= 0.2;
        adjustedOps[index] = { ...op, style: { ...op.style, textColor: luminance(bg) > 0.52 ? "#111827" : "#ffffff" } };
        adjustmentsApplied.push("surface_text_color_adjusted");
      }
      if (op.style.mode === "gradient" && !op.style.textColor) {
        adjustedOps[index] = { ...op, style: { ...op.style, textColor: "#ffffff" } };
        adjustmentsApplied.push("gradient_text_legibility_enforced");
      }
    }

    if (op.op === "set_button_style") {
      const bg = op.style.background ?? "#2563eb";
      const text = op.style.textColor ?? "#ffffff";
      if (contrastRatio(bg, text) < 4.5) {
        contrastWarnings.push("button_text_low_contrast");
        score -= 0.16;
        adjustedOps[index] = { ...op, style: { ...op.style, textColor: luminance(bg) > 0.52 ? "#111827" : "#ffffff" } };
        adjustmentsApplied.push("button_text_color_adjusted");
      }
      if (op.style.emphasisStrength === "strong" && op.style.shadowLevel === "md") {
        adjustedOps[index] = { ...op, style: { ...op.style, shadowLevel: "sm" } };
        adjustmentsApplied.push("button_emphasis_tightened");
      }
    }

    if (op.op === "set_accent_style" && op.style.accentColor) {
      const tonedAccent = reduceSaturation(op.style.accentColor);
      if (tonedAccent !== op.style.accentColor) {
        adjustedOps[index] = { ...op, style: { ...op.style, accentColor: tonedAccent } };
        adjustmentsApplied.push("accent_saturation_reduced");
        score -= 0.05;
      }
      const text = op.style.textColor ?? "#ffffff";
      if (contrastRatio(tonedAccent, text) < 4.2) {
        adjustedOps[index] = { ...op, style: { ...op.style, textColor: luminance(tonedAccent) > 0.52 ? "#111827" : "#ffffff" } };
        adjustmentsApplied.push("badge_text_color_adjusted");
      }
    }

    if (op.op === "set_text_style" && op.style.textColor) {
      if (contrastRatio(op.style.textColor, "#ffffff") < 3.8 && contrastRatio(op.style.textColor, "#111827") < 3.8) {
        contrastWarnings.push("text_legibility_warning");
        score -= 0.1;
      }
    }
  });

  return {
    adjustedOps,
    contrastWarnings,
    adjustmentsApplied,
    score: Number(Math.max(0, score).toFixed(2)),
    blocked: score < 0.35,
  };
};
