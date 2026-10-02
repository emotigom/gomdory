import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const source = read("app", "_components", "CardAttachments.tsx");

const genericFileBlock =
  source.match(
    /\{genericFiles\.length > 0 \? \([\s\S]*?\{urlAttachments\.length > 0 \? \(/,
  )?.[0] ?? "";

const urlBlock =
  source.match(
    /\{urlAttachments\.length > 0 \? \([\s\S]*?\{practiceAttachments\.length > 0 \? \(/,
  )?.[0] ?? "";

test("attachment file rows preserve readable structure with theme-token classes", () => {
  assert.match(genericFileBlock, /data-attachment-row="file"/);
  assert.match(genericFileBlock, /data-testid="public-attachment-row"/);
  assert.match(genericFileBlock, /data-public-attachment-row="true"/);
  assert.match(
    genericFileBlock,
    /theme-card-panel flex flex-wrap items-center/,
  );
  assert.match(genericFileBlock, /rounded-md border px-2 py-1\.5 text-xs shadow-sm/);
  assert.match(genericFileBlock, /data-attachment-filename="true"/);
  assert.match(
    genericFileBlock,
    /theme-card-copy min-w-0 flex-1 truncate font-medium/,
  );
  assert.match(
    genericFileBlock,
    /data-attachment-extension-badge="true"/,
  );
  assert.match(
    genericFileBlock,
    /attachment-extension-badge shrink-0 rounded-full px-1\.5 py-0\.5 text-\[10px\] font-semibold/,
  );
  assert.match(
    genericFileBlock,
    /attachment-download-label shrink-0 rounded px-2 py-0\.5 text-\[11px\] font-semibold/,
  );
  assert.match(genericFileBlock, /data-attachment-download="true"/);
  assert.match(
    genericFileBlock,
    /attachment-meta-badge shrink-0 rounded px-1 py-0.5 text-\[10px\] font-semibold/,
  );
  assert.doesNotMatch(
    genericFileBlock,
    /data-attachment-extension-badge="true"[\s\S]{0,200}bg-\[var\(--theme-surface-muted\)\]/,
  );
});

test("image attachments render as previews without hiding extra files", () => {
  const imageBlock =
    source.match(
      /\{imageFiles\.length > 0 \? \([\s\S]*?\{genericFiles\.length > 0 \? \(/,
    )?.[0] ?? "";

  assert.match(imageBlock, /data-attachment-image-grid="true"/);
  assert.match(imageBlock, /data-testid="attachment-image-preview"/);
  assert.match(imageBlock, /data-attachment-row="image"/);
  assert.match(imageBlock, /max-h-\[120px\]/);
  assert.match(imageBlock, /object-cover/);
  assert.match(imageBlock, /onError=\{\(\) => handleImageError\(file\.id\)\}/);
  assert.doesNotMatch(imageBlock, /slice\(0,\s*4\)/);
  assert.match(source, /failedImageIds\.has\(item\.id\) \|\|/);
});

test("guest attachment rows are not faded and do not expose remove controls", () => {
  assert.match(genericFileBlock, /data-attachment-row="file"/);
  assert.match(genericFileBlock, /data-public-attachment-row="true"/);
  assert.match(urlBlock, /data-attachment-row="url"/);
  assert.match(urlBlock, /data-public-attachment-row="true"/);
  assert.doesNotMatch(genericFileBlock, /opacity-(?:30|40|50|60)/);
  assert.doesNotMatch(urlBlock, /opacity-(?:30|40|50|60)/);
  assert.match(genericFileBlock, /\{canRemoveFile \? \(/);
  assert.match(genericFileBlock, /\) : null\}/);
  assert.match(urlBlock, /\{canRemoveUrl \? \(/);
  assert.match(urlBlock, /\) : null\}/);
  assert.doesNotMatch(genericFileBlock, /disabled[\s\S]{0,240}제거/);
  assert.doesNotMatch(urlBlock, /disabled[\s\S]{0,240}제거/);
});

test("teacher remove remains permission gated and accessible", () => {
  assert.match(
    source,
    /const canRemoveFile = mode === "teacher" && Boolean\(onRemoveFile\);/,
  );
  assert.match(
    source,
    /const canRemoveUrl = mode === "teacher" && Boolean\(onRemoveUrl\);/,
  );
  assert.match(genericFileBlock, /onRemoveFile\?\.\(file\.id\)/);
  assert.match(genericFileBlock, /aria-label=\{`\$\{file\.label\} 제거`\}/);
  assert.match(urlBlock, /onRemoveUrl\?\.\(item\.id\)/);
});

test("download controls are visible, labelled, focusable, and long filenames truncate safely", () => {
  assert.match(genericFileBlock, /aria-label=\{`\$\{file\.label\} 다운로드`\}/);
  assert.match(
    genericFileBlock,
    /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-\[var\(--theme-focus\)\] focus-visible:ring-offset-2/,
  );
  assert.match(
    genericFileBlock,
    /theme-card-copy min-w-0 flex-1 truncate font-medium \[overflow-wrap:anywhere\]/,
  );
  assert.match(
    genericFileBlock,
    /attachment-download-label shrink-0 rounded px-2 py-0\.5 text-\[11px\] font-semibold/,
  );
  assert.match(
    genericFileBlock,
    /download=\{\s*isSafeDownloadAttributeHref\(file\.url\) \? "" : undefined\s*\}/,
  );
  assert.match(
    genericFileBlock,
    /target=\{\s*isSafeDownloadAttributeHref\(file\.url\) \? undefined : "_blank"\s*\}/,
  );
  assert.match(
    genericFileBlock,
    /void handleFileChipClick\(event, file\.id, file\.url\)/,
  );
});

test("teacher and guest upload inputs keep multiple file selection enabled", () => {
  const cardForm = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "class",
    "CardForm.tsx",
  );
  const smartLayer = read(
    "app",
    "s",
    "[code]",
    "_components",
    "StudentGuestBoardSmartLayer.tsx",
  );
  const minimal = read(
    "app",
    "s",
    "[code]",
    "_components",
    "StudentBoardMinimal.tsx",
  );
  const composePanel = read("app", "_components", "ComposeCardPanel.tsx");

  for (const renderer of [cardForm, smartLayer, minimal, composePanel]) {
    assert.match(renderer, /type="file"[\s\S]{0,160}?multiple/);
  }
});

test("url attachment labels stay inside narrow student cards", () => {
  assert.match(
    urlBlock,
    /theme-card-copy line-clamp-1 font-medium \[overflow-wrap:anywhere\]/,
  );
});

test("modern public guest board CSS restores dark attachment text under HUD card overrides", () => {
  const globals = read("app", "globals.css");
  const publicHudBlock =
    globals.match(
      /\/\* Modern public guest board skin for \/s\/\[code\][\s\S]*?\[data-public-guest-board="modern-hud"\] \[data-wall-column-runtime="WallColumn-v3"\] button\[aria-label="카드 작성"\]:hover \{[\s\S]*?\n\}/,
    )?.[0] ?? "";
  const attachmentOverrideBlock =
    globals.match(
      /\/\* Public guest card text is light on the HUD surface[\s\S]*?\[data-attachment-download="true"\]:hover \{[\s\S]*?\n\}/,
    )?.[0] ?? "";

  assert.match(publicHudBlock, /\[data-cards-list\] > div > div span/);
  assert.match(publicHudBlock, /background: rgba\(255, 255, 255, 0\.92\)/);
  assert.match(publicHudBlock, /color: #1e293b/);
  assert.doesNotMatch(publicHudBlock, /linear-gradient\(180deg, rgba\(15, 23, 42/);
  assert.match(attachmentOverrideBlock, /\[data-card-attachments-runtime\] \[data-public-attachment-row="true"\]/);
  assert.match(attachmentOverrideBlock, /background: #ffffff/);
  assert.match(attachmentOverrideBlock, /opacity: 1/);
  assert.match(attachmentOverrideBlock, /\[data-attachment-filename="true"\][\s\S]*color: #0f172a !important/);
  assert.match(attachmentOverrideBlock, /\[data-attachment-filename="true"\][\s\S]*-webkit-text-fill-color: #0f172a/);
  assert.match(attachmentOverrideBlock, /\[data-attachment-download="true"\][\s\S]*color: #1e293b !important/);
  assert.match(attachmentOverrideBlock, /\[data-attachment-download="true"\][\s\S]*-webkit-text-fill-color: #1e293b/);
  assert.match(attachmentOverrideBlock, /\[data-attachment-download="true"\]:hover[\s\S]*color: #020617 !important/);
  assert.doesNotMatch(attachmentOverrideBlock, /(?<!border-)color:\s*#(?:f8fafc|e2e8f0|cbd5e1)/);
});

test("attachment extension badges use a dedicated soft badge style", () => {
  const globals = read("app", "globals.css");
  const extensionBadgeBlock =
    globals.match(/\.attachment-extension-badge \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(source, /data-attachment-extension-badge="true"/);
  assert.match(source, /className="attachment-extension-badge/);
  assert.match(extensionBadgeBlock, /--attachment-extension-badge-bg:/);
  assert.match(extensionBadgeBlock, /--attachment-extension-badge-text: var\(--theme-file-badge-text, #334155\)/);
  assert.match(extensionBadgeBlock, /border: 1px solid var\(--attachment-extension-badge-border\)/);
  assert.match(extensionBadgeBlock, /background: var\(--attachment-extension-badge-bg\) !important/);
  assert.match(extensionBadgeBlock, /color: var\(--attachment-extension-badge-text\) !important/);
});

test("/s/[code] public board route renders attachments through StudentBoardMinimal and WallColumn", () => {
  const route = read("app", "s", "[code]", "page.tsx");
  const minimal = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const wallColumn = read("app", "_components", "WallColumn.tsx");

  assert.match(route, /<StudentBoardMinimal \{\.\.\.boardProps\} \/>/);
  assert.match(minimal, /import WallColumn from "@\/app\/_components\/WallColumn"/);
  assert.match(minimal, /role="student"/);
  assert.match(wallColumn, /<CardAttachments\s+[\s\S]*?mode="student"/);
  assert.match(wallColumn, /disabledReason="학생 화면에서는 첨부를 제거할 수 없어요\."/);
});

test("public guest route path preserves attachment data attributes through shared renderer", () => {
  const route = read("app", "s", "[code]", "page.tsx");
  const minimal = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const wallColumn = read("app", "_components", "WallColumn.tsx");

  assert.match(route, /<StudentBoardMinimal \{\.\.\.boardProps\} \/>/);
  assert.match(minimal, /data-public-guest-board="modern-hud"/);
  assert.match(minimal, /data-testid="guest-board-help-pill"/);
  assert.match(minimal, /<WallColumn/);
  assert.match(minimal, /role="student"/);
  assert.match(wallColumn, /<CardAttachments[\s\S]*?mode="student"/);
  assert.match(source, /data-public-attachment-row="true"/);
  assert.match(source, /data-attachment-filename="true"/);
  assert.match(source, /data-attachment-download="true"/);
});

test("guest compose hint and responsive wall scroll guards remain in WallColumn", () => {
  const wallColumn = read("app", "_components", "WallColumn.tsx");
  assert.match(wallColumn, /data-testid="guest-card-compose-hint"/);
  assert.match(wallColumn, /data-testid="guest-card-compose-cta"/);
  assert.match(wallColumn, /첫 카드를 추가해 보세요/);
  assert.match(wallColumn, /const emptyTitle = role === "teacher" \? "첫 카드를 추가해 보세요" : "아직 카드가 없어요"/);
  assert.match(wallColumn, /이 섹션에는 아직 카드가 없습니다/);
  assert.match(wallColumn, /const emptyActionHint\s*=\s*role === "teacher"[\s\S]*?: "첫 카드를 남겨 보세요\."/);
  assert.match(wallColumn, /사진이나 파일도 함께 올릴 수 있어요/);
  assert.match(wallColumn, /const shouldUseInternalScroll = role === "student" \? cards\.length >= 7 : cards\.length >= 5;/);
  assert.match(wallColumn, /minWidth: role === "student" \? Math\.max\(MIN_WALL_WIDTH, 300\) : MIN_WALL_WIDTH/);
  assert.match(wallColumn, /maxWidth: role === "student" \? 360 : undefined/);
  assert.match(wallColumn, /role === "student" \? "space-y-4" : "space-y-3"/);
  assert.match(wallColumn, /overflow-visible/);
  assert.match(wallColumn, /overflow-y-auto/);
  assert.match(wallColumn, /data-scroll="wall-column"/);
  assert.match(wallColumn, /data-wall-id=\{wall\.id\}/);
  assert.match(wallColumn, /data-card-id=\{card\.id\}/);
});

test("read more button is rendered as a visible pill button with test id", () => {
  const collapsible = read("app", "_components", "CollapsibleCardText.tsx");
  assert.match(collapsible, /data-testid="card-read-more-button"/);
  assert.match(collapsible, /rounded-full border border-\[var\(--theme-border-strong\)\] bg-\[var\(--theme-surface-muted\)\]/);
  assert.match(collapsible, /aria-expanded=\{expanded\}/);
  assert.match(collapsible, /aria-controls=\{contentId\}/);
});

test("teacher and guest attachment renderers share filename and download attributes", () => {
  const wallColumn = read("app", "_components", "WallColumn.tsx");

  assert.match(wallColumn, /<CardAttachments[\s\S]*?mode="teacher"/);
  assert.match(wallColumn, /<CardAttachments[\s\S]*?mode="student"/);
  assert.match(source, /data-testid="attachment-filename"[\s\S]*?data-attachment-filename="true"/);
  assert.match(source, /data-testid="attachment-download"[\s\S]*?data-attachment-download="true"/);
});

test("public share and student renderers use the shared readable attachment component", () => {
  const minimal = read(
    "app",
    "s",
    "[code]",
    "_components",
    "StudentBoardMinimal.tsx",
  );
  const shareCard = read(
    "app",
    "s",
    "[code]",
    "grid",
    "_components",
    "ShareCard.tsx",
  );
  const studentTile = read("components", "student", "BoardCardTile.tsx");
  const studentCard = read(
    "components",
    "student",
    "board",
    "StudentBoardCard.tsx",
  );

  for (const renderer of [minimal, shareCard, studentTile, studentCard]) {
    assert.match(renderer, /<CardAttachments/);
  }
  assert.match(minimal, /mode="share"/);
  assert.match(shareCard, /mode="share"/);
  assert.match(studentTile, /mode="student"/);
  assert.match(studentCard, /mode="student"/);
  assert.match(
    source,
    /학생 화면에서는 첨부를 제거할 수 없어요|disabledReason/,
  );
});
