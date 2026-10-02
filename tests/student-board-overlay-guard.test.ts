import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "app", "s", "[code]", "_components", "StudentBoardMinimal.tsx"),
  "utf8",
);
const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app", "s", "[code]", "page.tsx"),
  "utf8",
);

test("student board background dim layer is decorative and does not block interactions", () => {
  assert.match(source, /shouldRenderBoardDimLayer \? \(/);
  assert.match(source, /data-testid="board-background-dim-layer"/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /className="pointer-events-none absolute inset-0 z-0"/);
  assert.match(source, /data-testid="student-board-background" aria-hidden="true" className="pointer-events-none absolute inset-0 z-0"/);
  assert.match(source, /<main className="relative z-10 flex min-h-0 flex-1 flex-col/);
});

test("student board uses lighter conditional dim policy for wallpaper vs color backgrounds", () => {
  assert.match(source, /const boardDimOpacity = wallpaperUrl \? Number\.parseFloat\(resolvedThemeVars\["--board-bg-dim-opacity"\] \?\? "0\.08"\) : 0;/);
  assert.match(source, /const shouldRenderBoardDimLayer = !isBrightTheme && boardDimOpacity > 0;/);
  assert.match(source, /const boardSurfaceTintClassName = guestViewTheme === "high-contrast"/);
  assert.match(source, /: guestViewTheme === "bright"/);
  assert.match(source, /bg-\[var\(--theme-card\)\]\/12/);
  assert.match(source, /bg-\[var\(--theme-card\)\]\/3/);
  assert.match(source, /\? "bg-transparent"/);
  assert.match(source, /const boardScrollSurfaceClassName = `relative z-10 flex/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /pr-\[max\(1\.5rem,calc\(env\(safe-area-inset-right\)\+1\.5rem\)\)\]/);
  assert.match(source, /lg:pr-\[max\(4rem,calc\(env\(safe-area-inset-right\)\+4rem\)\)\]/);
  assert.match(source, /background: `rgba\(2, 6, 23, \$\{boardDimOpacity\}\)`/);
  assert.match(source, /data-testid="student-board-background"/);
  assert.match(source, /backgroundImage: `url\(\$\{wallpaperUrl\}\)`/);
  assert.match(source, /aria-hidden="true" className="relative z-10 h-px w-4 flex-shrink-0 sm:w-8 lg:w-12"/);
  assert.doesNotMatch(source, /linear-gradient\(to bottom, rgba\(2, 6, 23, var\(--board-bg-dim-opacity/);
  assert.doesNotMatch(source, /shadow-inner shadow-black\/20/);
});

test("student share shell does not add a second wallpaper dim pseudo layer", () => {
  assert.match(routeSource, /data-share-board-wallpaper=\{wallpaperUrl \? "true" : undefined\}/);
  assert.doesNotMatch(routeSource, /\[data-share-board-wallpaper="true"\] \[data-public-guest-board="modern-hud"\]::before/);
  assert.doesNotMatch(routeSource, /--student-board-wallpaper-image/);
  assert.doesNotMatch(routeSource, /linear-gradient\(to bottom, rgba\(2, 6, 23, 0\.36\), rgba\(7, 15, 31, 0\.64\)\)/);
});
