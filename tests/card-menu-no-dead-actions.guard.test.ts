import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const cardMoreMenuPath = path.join(
  process.cwd(),
  "app",
  "dashboard",
  "boards",
  "[boardId]",
  "CardMoreMenu.tsx",
);

const normalizeLabel = (inner: string): string =>
  inner
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isDisabledButton = (attrs: string) => /\bdisabled\s*=\s*\{?\s*(true|disable\w*)/.test(attrs);

const hasActionableAttrs = (tag: string, attrs: string) => {
  if (/\bonClick\s*=/.test(attrs) || /\bonSelect\s*=/.test(attrs)) return true;
  if (tag === "a") return /\bhref\s*=/.test(attrs);
  if (/\btype\s*=\s*["']submit["']/.test(attrs)) return true;
  return false;
};

test("CardMoreMenu enabled menu actions are wired", () => {
  const source = fs.readFileSync(cardMoreMenuPath, "utf8");
  const offenders: string[] = [];

  const menuItemRegex = /<(button|a)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null = null;

  while ((match = menuItemRegex.exec(source))) {
    const [raw, tag, attrs, inner] = match;
    const label = normalizeLabel(inner);

    if (!label) continue;
    if (label === "선택됨") continue;
    if (/\(\s*준비 중\s*\)/.test(label) || /준비 중/.test(label)) continue;

    const line = source.slice(0, match.index).split("\n").length;
    const localContext = source.slice(Math.max(0, match.index - 220), match.index + raw.length + 220);
    const wrappedByServerActionForm = /<form[^>]*\saction\s*=\s*\{[^}]+Action\}/.test(localContext);

    if (isDisabledButton(attrs)) continue;
    if (hasActionableAttrs(tag, attrs)) continue;
    if (wrappedByServerActionForm && tag === "button") continue;

    offenders.push(`${line}: <${tag}> ${label}`);
  }

  assert.equal(
    offenders.length,
    0,
    `Found enabled CardMoreMenu items without actions. Disable them and append \"준비 중\" if unimplemented.\n${offenders.join("\n")}`,
  );
});

test("CardMoreMenu background color action is enabled and wired", () => {
  const source = fs.readFileSync(cardMoreMenuPath, "utf8");

  assert.match(source, /<form\s+key=\{option\.token\}\s+action=\{setCardColorTokenAction\}>/);
  assert.match(source, /<button[\s\S]*?type="submit"[\s\S]*?disabled=\{disableStatus\}/);
  assert.match(source, /statusLabel\(option\.label\)/);
});
