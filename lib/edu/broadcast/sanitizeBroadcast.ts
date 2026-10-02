import { sanitizeText } from "@/lib/safety/sanitizeText";

export const BROADCAST_CTA_TYPES = ["generate", "focus", "present", "none"] as const;
export type BroadcastCtaType = (typeof BROADCAST_CTA_TYPES)[number];

export function normalizeBroadcastMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const sanitized = sanitizeText(raw, {
    maxLength: 240,
    maxLines: 2,
    maxConsecutiveNewlines: 1,
    maxConsecutiveSpaces: 2,
  });
  const text = sanitized.text.replace(/\s*\n\s*/g, "\n").trim();
  return text.length > 0 ? text : null;
}

export function normalizeBroadcastCtaType(raw: unknown): BroadcastCtaType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  return (BROADCAST_CTA_TYPES as readonly string[]).includes(value) ? (value as BroadcastCtaType) : null;
}

export function normalizeBroadcastCtaLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const sanitized = sanitizeText(raw, {
    maxLength: 40,
    maxLines: 1,
    maxConsecutiveSpaces: 1,
  });
  const text = sanitized.text.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}
