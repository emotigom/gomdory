import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legalPages = [
  'app/(marketing)/legal/privacy/page.tsx',
  'app/(marketing)/legal/terms/page.tsx',
  'app/(marketing)/legal/child-safety/page.tsx',
  'app/(marketing)/legal/ai-privacy/page.tsx',
  'app/(marketing)/legal/security/page.tsx',
  'app/(marketing)/legal/accessibility/page.tsx',
  'app/(marketing)/legal/certification-readiness/page.tsx',
  'app/(marketing)/edu/compliance/privacy-data/page.tsx',
];

const learning = fs.readFileSync('app/(marketing)/edu/compliance/learning-support-software/page.tsx', 'utf8');
const footer = fs.readFileSync('app/(marketing)/_components/MarketingFooter.tsx', 'utf8');
const nav = fs.readFileSync('app/(marketing)/_components/MarketingNav.tsx', 'utf8');
const school = fs.readFileSync('app/(marketing)/school/page.tsx', 'utf8');
const pricing = fs.readFileSync('app/(marketing)/pricing/page.tsx', 'utf8');
const contact = fs.readFileSync('app/(marketing)/contact/page.tsx', 'utf8');
const shell = fs.readFileSync('app/(marketing)/_components/LegalPageShell.tsx', 'utf8');
const styles = fs.readFileSync('app/globals.css', 'utf8');

const publicLegalRoutes = [
  ['/legal/privacy', 'app/(marketing)/legal/privacy/page.tsx'],
  ['/legal/terms', 'app/(marketing)/legal/terms/page.tsx'],
  ['/legal/child-safety', 'app/(marketing)/legal/child-safety/page.tsx'],
  ['/legal/ai-privacy', 'app/(marketing)/legal/ai-privacy/page.tsx'],
  ['/legal/security', 'app/(marketing)/legal/security/page.tsx'],
  ['/legal/accessibility', 'app/(marketing)/legal/accessibility/page.tsx'],
  ['/legal/certification-readiness', 'app/(marketing)/legal/certification-readiness/page.tsx'],
  ['/edu/compliance/learning-support-software', 'app/(marketing)/edu/compliance/learning-support-software/page.tsx'],
  ['/edu/compliance/privacy-data', 'app/(marketing)/edu/compliance/privacy-data/page.tsx'],
  ['/docs/contact', 'app/docs/contact/page.tsx'],
  ['/policy', 'app/(marketing)/policy/page.tsx'],
];

test('learning-support page contains required copy and links', () => {
  ['메인으로 돌아가기','학습지원 SW 기준 안내','학생 별도 회원가입','학생의 이메일','구글 계정','전화번호','개인정보처리방침','아동·청소년 보호 안내','AI 개인정보 보호 안내'].forEach((k) => assert.ok(learning.includes(k), k));
});

test('learning-support page excludes unsupported claims', () => {
  ['교육부 인증','에듀집 승인','공식 통과','심의 완료','인증 획득'].forEach((k) => assert.ok(!learning.includes(k), k));
});

test('legal/compliance pages use readable shell navigation and avoid low-contrast header classes', () => {
  ['← 메인으로 돌아가기','학교 검토나 개인정보 확인이 필요하신가요?','개인정보처리방침 보기','문의하기'].forEach((k) => assert.ok(shell.includes(k), k));
  assert.ok(!shell.includes('text-white/40'), 'text-white/40 should not appear in shared shell');

  for (const page of legalPages) {
    const source = fs.readFileSync(page, 'utf8');
    assert.ok(!source.includes('text-white/40'), `${page} must avoid text-white/40 body style`);
  }

  const learningHeader = learning.split('rounded-xl border border-amber-200')[0];
  assert.ok(!learningHeader.includes('text-slate-900'), 'learning page dark header area should not use text-slate-900');
  assert.ok(!learningHeader.includes('text-gray-900'), 'learning page dark header area should not use text-gray-900');
});

test('public legal/compliance/support route links stay internal and routable', () => {
  const publicSurfaces = [footer, nav, school, pricing, contact].join('\n');
  ['/legal/privacy', '/legal/terms', '/legal/child-safety', '/legal/ai-privacy', '/edu/compliance/learning-support-software'].forEach((route) => {
    assert.ok(publicSurfaces.includes(route), route);
  });
  assert.ok(footer.includes('policyLinks.map(([label, href]) =>'));
  assert.ok(footer.includes('href={href}'));

  for (const [route, filePath] of publicLegalRoutes) {
    assert.ok(route.startsWith('/'), route);
    assert.ok(fs.existsSync(filePath), filePath);
  }

  ['github.com/gkrry', 'gom-clean/blob/main/docs'].forEach((forbidden) => {
    assert.ok(!publicSurfaces.includes(forbidden), forbidden);
  });
});

test('legal interaction polish uses legal-only scope', () => {
  assert.ok(shell.includes('data-legal-interaction-scope'));
  assert.ok(learning.includes('data-legal-interaction-scope'));
  ['.legal-control', '.legal-link-card', '.legal-text-link'].forEach((selector) => {
    assert.ok(styles.includes(`[data-legal-interaction-scope] ${selector}`), selector);
  });
  assert.ok(!styles.includes('[data-legal-interaction-scope] a {'));
  assert.ok(!styles.includes('[data-legal-interaction-scope] button {'));
  assert.ok(styles.includes('@media (hover: hover) and (pointer: fine)'));
});

test('shared legal shell follows semantic theme foreground owners', () => {
  assert.ok(
    shell.includes('bg-[var(--theme-bg)] py-14 text-[var(--theme-text)]'),
    'shared legal shell must bind root foreground to the active theme',
  );

  [
    'text-[var(--theme-text)]',
    'text-[var(--theme-text-muted)]',
    'text-[var(--theme-text-subtle)]',
    'bg-[var(--theme-card)]',
    'bg-[var(--theme-surface-muted)]',
    'border-[var(--theme-border)]',
    'legal-control-theme',
  ].forEach((token) => assert.ok(shell.includes(token), token));

  [
    'text-white',
    'text-slate-200',
    'text-slate-300',
    'border-white/15',
    'bg-white/5',
    'bg-cyan-950/30',
    'text-cyan-100',
  ].forEach((legacyClass) => {
    assert.ok(
      !shell.includes(legacyClass),
      `shared legal shell must not retain dark-background-only class: ${legacyClass}`,
    );
  });

  const textLinkHover =
    styles.match(
      /\[data-legal-interaction-scope\] \.legal-text-link:hover\s*\{([^}]*)\}/,
    )?.[1] ?? '';

  assert.ok(
    textLinkHover.includes('text-decoration-line: underline;'),
    'legal text links should retain the underline hover affordance',
  );
  assert.ok(
    !/\bcolor\s*:/.test(textLinkHover),
    'legal text-link hover must not replace the semantic foreground color',
  );

  const themeControlHover =
    styles.match(
      /\[data-legal-interaction-scope\] \.legal-control-theme[^{]*:hover\s*\{([^}]*)\}/,
    )?.[1] ?? '';

  assert.ok(
    themeControlHover.includes('border-color: var(--theme-border-strong);'),
    'theme legal controls should own a semantic hover border',
  );
  assert.ok(
    themeControlHover.includes('background-color: var(--theme-card);'),
    'theme legal controls should own a semantic hover surface',
  );
  assert.ok(
    themeControlHover.includes('color: var(--theme-text);'),
    'theme legal controls should preserve readable hover text',
  );
});
