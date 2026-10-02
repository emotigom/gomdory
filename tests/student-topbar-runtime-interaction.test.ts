import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "_components", "HoverExpandBar.tsx"), "utf8");

test("hover topbar open mode differentiates hover and pinned behavior", () => {
  assert.match(source, /useState<"closed" \| "hover" \| "pinned">\("closed"\)/);
  assert.match(source, /setOpenMode\(\(prev\) => \(prev === "closed" \? "pinned" : "closed"\)\)/);
  assert.match(source, /if \(openMode === "pinned"\) return;/);
  assert.match(source, /, 220\)/);
});

test("floating panel is portal-based fixed layer and outside click excludes panelRef", () => {
  assert.match(source, /createPortal\(/);
  assert.match(source, /document\.body/);

  const portalClassMatch = source.match(
    /createPortal\([\s\S]*?className=\{cn\(\s*"([^"]*)"/,
  );

  assert.ok(
    portalClassMatch,
    "expected portal container to remain a fixed z-[1100] layer",
  );

  const portalClasses = new Set(
    portalClassMatch[1].split(/\s+/).filter(Boolean),
  );

  for (const className of ["pointer-events-none", "fixed", "z-[1100]"]) {
    assert.equal(
      portalClasses.has(className),
      true,
      `expected portal container class: ${className}`,
    );
  }

  const visiblePanelClassMatch = source.match(
    /createPortal\([\s\S]*?className=\{cn\([\s\S]*?className=\{cn\(\s*"([^"]*)"/,
  );

  assert.ok(visiblePanelClassMatch, "expected visible panel class to be present");

  const visiblePanelClasses = new Set(
    visiblePanelClassMatch[1].split(/\s+/).filter(Boolean),
  );

  assert.equal(
    visiblePanelClasses.has("pointer-events-auto"),
    true,
    "expected visible panel to accept pointer events",
  );

  assert.ok(
    source.indexOf(portalClassMatch[1]) < source.indexOf(visiblePanelClassMatch[1]),
    "expected the portal container to precede the visible panel",
  );
  assert.match(source, /const insidePanel = panelRef\.current\?\.contains\(event\.target\)/);
  assert.match(source, /if \(!insideRoot && !insidePanel\)/);
  assert.match(source, /top = Math\.round\(rect\.bottom \+ 2\)/);
});
