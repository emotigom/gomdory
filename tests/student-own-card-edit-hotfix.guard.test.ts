import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("student board only wires edit/delete handlers for own cards", () => {
  const source = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");

  assert.match(source, /isOwnGuestCard\(/);
  assert.match(source, /onEdit:\s*isOwnCard \? \(\) => openEdit\(card, column\.key\) : undefined/);
  assert.match(source, /onDelete:\s*isOwnCard \? \(\) => void deleteOwnCard\(card\.id\) : undefined/);
});

test("student edit save patches text and updates local state without touching position/order", () => {
  const source = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const helperSource = source.slice(
    source.indexOf("function updateStudentCardContentInColumns"),
    source.indexOf("export default function"),
  );

  assert.match(source, /method:\s*"PATCH"/);
  assert.match(source, /body:\s*JSON\.stringify\(\{ clientId, text: editText, content: editText, url: editUrl \}\)/);
  assert.match(source, /updateStudentCardContentInColumns/);
  assert.match(source, /pendingContentPatchesRef/);
  assert.match(source, /mergeStudentContentPatches/);
  assert.match(source, /externalUrl:\s*normalizedEditUrl/);
  assert.match(source, /setColumns\(\(currentColumns\) =>/);
  assert.match(source, /setEditing\(null\)/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(helperSource, /filter\(\(attachment\) => attachment\.type !== "external"\)/);
  assert.match(helperSource, /attachments:\s*nextAttachments/);
  assert.doesNotMatch(helperSource, /position:/);
});

test("student edit save button remains readable in enabled and disabled states", () => {
  const source = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const saveClickIndex = source.indexOf("onClick={saveEdit}");
  const saveButtonStart = source.lastIndexOf("<button", saveClickIndex);
  const saveButtonEnd = source.indexOf("</button>", saveClickIndex);
  const saveButton = source.slice(saveButtonStart, saveButtonEnd + "</button>".length);

  assert.ok(saveClickIndex >= 0 && saveButtonStart >= 0 && saveButtonEnd >= 0);
  assert.match(saveButton, /bg-\[var\(--theme-accent\)\]/);
  assert.match(saveButton, /text-\[var\(--theme-accent-text\)\]/);
  assert.match(saveButton, /enabled:hover:bg-\[var\(--theme-accent-strong\)\]/);
  assert.match(saveButton, /disabled:bg-slate-200/);
  assert.match(saveButton, /disabled:text-slate-600/);
  assert.match(saveButton, /disabled:opacity-100/);
  assert.doesNotMatch(saveButton, /disabled:opacity-60/);
});

test("share card PATCH verifies student ownership and only updates card text/link payload", () => {
  const source = read("app", "api", "v1", "share", "[code]", "cards", "[cardId]", "route.ts");
  const payloads = read("lib", "db", "shareCardPayloads.ts");

  assert.match(source, /resolvePublicShareBoard\(code\)/);
  assert.match(source, /getPublicShareWriteGuard\(board\)/);
  assert.match(source, /row\.authorType !== "student"/);
  assert.match(source, /row\.authorClientId !== clientId/);
  assert.match(source, /typeof body\.content === "string"/);
  assert.match(source, /buildShareCardPatchPayload\(/);
  assert.match(
    payloads,
    /export function buildShareCardPatchPayload[\s\S]*return toSnakeKeys\(\{ text, externalAttachments \}\);[\s\S]*\n\}/,
  );
});

test("attachment-only student cards use natural Korean fallback copy", () => {
  const smartLayer = read("app", "s", "[code]", "_components", "StudentGuestBoardSmartLayer.tsx");
  const route = read("app", "api", "v1", "share", "[code]", "cards", "[cardId]", "route.ts");

  assert.match(smartLayer, /getAttachmentOnlyCardText/);
  assert.match(smartLayer, /사진을 올렸어요!/);
  assert.match(smartLayer, /자료를 올렸어요\./);
  assert.doesNotMatch(smartLayer, /text:\s*text \|\| "첨부 파일"/);
  assert.match(route, /fileSummary\.hasImage \? "사진을 올렸어요!" : "자료를 올렸어요\."/);
});
