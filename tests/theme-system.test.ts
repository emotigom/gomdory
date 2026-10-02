import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_THEME, GOM_THEMES, isThemeId, THEMES } from '@/lib/theme/theme';
import { normalizeStoredGomTheme } from '@/lib/theme/themes';
import { hudAssets } from '@/lib/theme/hudAssets';

const requiredThemeIds = [
  'gomdory-studio',
  'classroom-ivory',
  'minimal-hud',
  'high-contrast-light',
  'high-contrast-dark',
  'projector',
  'color-safe',
] as const;

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('theme-system: default theme is gomdory-studio and all classroom ids are valid', () => {
  assert.equal(DEFAULT_THEME, 'gomdory-studio');
  assert.deepEqual(THEMES, requiredThemeIds);
  for (const id of requiredThemeIds) assert.equal(isThemeId(id), true);
  assert.equal(isThemeId('hud'), false);
});

test('theme-system: registry defines required semantic tokens for every theme', () => {
  const requiredTokens = [
    '--theme-bg', '--theme-bg-elevated', '--theme-surface', '--theme-surface-muted', '--theme-card', '--theme-card-muted',
    '--theme-text', '--theme-text-muted', '--theme-text-subtle', '--theme-border', '--theme-border-strong', '--theme-accent',
    '--theme-accent-strong', '--theme-accent-text', '--theme-success', '--theme-warning', '--theme-danger', '--theme-focus',
    '--theme-shadow', '--theme-code-bg', '--theme-code-text', '--theme-console-bg', '--theme-console-text',
  ] as const;
  for (const id of requiredThemeIds) {
    for (const token of requiredTokens) assert.ok(GOM_THEMES[id].tokens[token], `${id} missing ${token}`);
  }
});

test('theme-system: high contrast and projector themes expose readability variables', () => {
  assert.equal(GOM_THEMES['high-contrast-light'].tokens['--theme-text'], '#000000');
  assert.equal(GOM_THEMES['high-contrast-light'].tokens['--theme-border-strong'], '#000000');
  assert.equal(GOM_THEMES['high-contrast-dark'].tokens['--theme-text'], '#ffffff');
  assert.equal(GOM_THEMES['high-contrast-dark'].tokens['--theme-focus'], '#fde047');
  assert.notEqual(GOM_THEMES.projector.tokens['--theme-font-scale'], '1');
  assert.notEqual(GOM_THEMES.projector.tokens['--theme-control-height'], '2.75rem');
});

test('theme-system: ThemeProvider applies data-gom-theme and persists localStorage preference safely', () => {
  const provider = source('app/_components/ThemeProvider.tsx');
  const registry = source('lib/theme/themes.ts');
  assert.match(provider, /setAttribute\("data-gom-theme", theme\)/);
  assert.match(provider, /setAttribute\("data-theme", getLegacyDataTheme\(theme\)\)/);
  assert.match(registry, /try[\s\S]*localStorage\.getItem/);
  assert.match(registry, /try[\s\S]*localStorage\.setItem/);
  assert.match(registry, /GOM_THEME_STORAGE_KEY = "gom\.theme\.v2"/);
  assert.match(registry, /GOM_THEME_LEGACY_STORAGE_KEY = "gom\.theme"/);
});

test('theme-system: legacy HUD preferences migrate to the canonical minimal-hud id', () => {
  assert.equal(normalizeStoredGomTheme('hud'), 'minimal-hud');
  assert.equal(normalizeStoredGomTheme('minimal-hud'), 'minimal-hud');
  assert.equal(normalizeStoredGomTheme('classic'), 'classroom-ivory');
  assert.equal(normalizeStoredGomTheme('unknown-theme'), null);

  const registry = source('lib/theme/themes.ts');
  assert.match(registry, /localStorage\.setItem\(GOM_THEME_STORAGE_KEY, migratedTheme\)/);
  assert.doesNotMatch(registry, /legacyValue === "minimal-hud"[^\n]*DEFAULT_GOM_THEME/);
});

test('theme-system: theme selector labels remain localized and accessible', () => {
  const selector = source('components/theme/ThemeSelector.tsx');
  for (const label of ['곰도리 작업실', '아이보리', 'OLD · 오리지널 HUD', '고대비 밝게', '고대비 어둡게', '프로젝터', '색약 안전']) {
    assert.match(source('lib/theme/themes.ts'), new RegExp(label));
  }
  assert.match(selector, /<select/);
  assert.match(selector, /aria-label=\{label\}/);
});

test('theme-system: root layout ships studio default before hydration', () => {
  const layout = source('app/layout.tsx');
  assert.match(layout, /<html[^>]*data-gom-theme="gomdory-studio"/);
  assert.match(layout, /<html[^>]*data-theme="classic"/);
});

test('theme-system: globals define data-gom-theme tokens and reduced visual effects', () => {
  const css = source('app/globals.css');
  for (const id of requiredThemeIds) assert.match(css, new RegExp(`data-gom-theme="${id}"`));
  assert.match(css, /--theme-console-bg/);
  assert.match(css, /--theme-backdrop-blur/);
  assert.match(css, /prefers-reduced-motion[\s\S]*data-gom-theme/);
});

test('theme-system: student lesson workspace uses theme variables and selector including ivory option', () => {
  const workspace = source('app/s/[code]/_components/StudentLessonWorkspace.tsx');

  assert.equal(GOM_THEMES['classroom-ivory'].label, '아이보리');
  assert.equal(GOM_THEMES['classroom-ivory'].shortLabel, '아이보리');
  assert.doesNotMatch(source('lib/theme/themes.ts'), /label:\s*\"기본\"/);
  assert.match(workspace, /ThemeSelector/);
  assert.match(workspace, /data-testid="student-lesson-workspace"/);
  assert.match(workspace, /bg-\[var\(--theme-bg\)\]/);
  assert.doesNotMatch(workspace, /bg-slate-950|text-slate-100|border-cyan-300/);
});

test('theme-system: activity workspaces use theme variables for cards, code, and console', () => {
  for (const file of [
    'components/lesson-activities/StudentActivityPanel.tsx',
    'components/lesson-activities/AiBingoActivity.tsx',
    'components/lesson-activities/AiJudgmentSortActivity.tsx',
    'components/lesson-activities/CodingActivityWorkspace.tsx',
  ]) {
    const component = source(file);
    assert.match(component, /var\(--theme-/);
    assert.doesNotMatch(component, /bg-slate-950|text-slate-100|border-cyan-300/);
  }
  assert.match(source('components/lesson-activities/PythonStudioLiteActivity.tsx'), /theme-console-block|--theme-console/);
  assert.match(source('components/lesson-activities/PythonStudioLiteActivity.tsx'), /theme-code-block|--theme-code/);
});

test('theme-system: web studio uses theme variables and keeps iframe sandbox unchanged', () => {
  const web = source('components/lesson-activities/WebCodingLiteActivity.tsx');
  assert.match(web, /var\(--theme-/);
  assert.match(web, /sandbox="allow-scripts"/);
  assert.doesNotMatch(web, /allow-same-origin/);
});

test('theme-system: CardAttachments readable in classroom ivory', () => {
  const cardAttachments = source('app/_components/CardAttachments.tsx');
  assert.match(cardAttachments, /data-public-attachment-row="true"/);
  assert.match(cardAttachments, /theme-card-copy/);
  assert.match(cardAttachments, /theme-card-panel/);
});

test('theme-system: all hud asset manifest paths use canonical public prefix', () => {
  const flatten = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object') return [];
    return Object.values(value as Record<string, unknown>).flatMap(flatten);
  };

  const paths = flatten(hudAssets);
  assert.ok(paths.length > 0);
  for (const assetPath of paths) {
    assert.match(assetPath, /^https:\/\/assets\.gomdory\.com\/assets\/hud\//);
  }
});

test('theme-system: theme-aware skeleton primitives are defined for hud and classic compatibility', () => {
  const css = source('app/globals.css');
  assert.match(css, /\.theme-skeleton/);
  assert.match(css, /html\[data-theme="hud"\] \.theme-skeleton/);
  assert.match(css, /html\[data-theme="classic"\] \.theme-skeleton/);
  assert.match(css, /prefers-reduced-motion[\s\S]*theme-skeleton-shimmer/);
});

test('theme-system: dashboard loading uses theme-aware skeleton classes', () => {
  const loading = source('app/dashboard/loading.tsx');
  assert.match(loading, /theme-skeleton/);
  assert.match(loading, /theme-skeleton-shell/);
  assert.doesNotMatch(loading, /bg-white|bg-stone|bg-neutral|bg-zinc-100|bg-slate-100|bg-gray|bg-slate|animate-pulse/);
});
