import { escapeHtml } from "@/lib/edu/templates/utils";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeSlotValue = (value: string) => {
  const normalized = value.replace(/\r\n/g, "\n");
  const parts = normalized.split(/<br\s*\/?>/gi);
  const escaped = parts.map((part) => escapeHtml(part));
  return escaped.join("<br />");
};

export const patchHtmlSlots = (
  html: string,
  updates: Record<string, string>,
): { html: string; changed: boolean; appliedSlots: string[] } => {
  let nextHtml = html;
  let changed = false;
  const appliedSlots: string[] = [];

  for (const [slot, value] of Object.entries(updates)) {
    if (!value?.trim()) continue;
    const regex = new RegExp(
      `(<[^>]*data-slot=["']${escapeRegExp(slot)}["'][^>]*>)([\\s\\S]*?)(</[^>]+>)`,
      "i",
    );
    if (!regex.test(nextHtml)) continue;
    const safeValue = escapeSlotValue(value);
    const patched = nextHtml.replace(regex, `$1${safeValue}$3`);
    if (patched !== nextHtml) {
      nextHtml = patched;
      changed = true;
      appliedSlots.push(slot);
    }
  }

  return { html: nextHtml, changed, appliedSlots };
};
