import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = readFileSync("app/(marketing)/page.tsx", "utf8");
const login = readFileSync("app/auth/login/page.tsx", "utf8");
const loginForm = readFileSync("app/auth/login/LoginForm.tsx", "utf8");
const turnstile = readFileSync("app/_components/TurnstileWidget.tsx", "utf8");
const marketingNav = readFileSync("app/(marketing)/_components/MarketingNav.tsx", "utf8");
const contact = readFileSync("app/(marketing)/contact/page.tsx", "utf8");
const school = readFileSync("app/(marketing)/school/page.tsx", "utf8");
const community = readFileSync("app/(marketing)/community/page.tsx", "utf8");
const marketingFallbacks = readFileSync("lib/site-content/marketing.ts", "utf8");
const studentEntry = readFileSync("app/_components/JoinByCode.tsx", "utf8");
const dashboard = readFileSync("app/dashboard/_components/HermesDashboardNav.tsx", "utf8");
const themes = readFileSync("lib/theme/themes.ts", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

test("workshop theme keeps a distinct paper-and-ink visual contract", () => {
  for (const marker of [
    "--gom-paper",
    "--gom-ink",
    "--gom-orange",
    "--gom-hard-shadow",
    ".gomdory-workboard-tape",
    ".gomdory-live-stamp",
  ]) {
    assert.match(styles, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(styles, /\.marketing-studio-aurora\s*\{\s*display:\s*none/);
  assert.match(themes, /label: "곰도리 작업실"/);
  assert.match(themes, /label: "OLD · 오리지널 HUD"/);
});

test("OLD theme keeps translucent HUD furniture on redesigned workshop pages", () => {
  assert.match(themes, /purpose: "기존 HUD의 어두운 색과 반투명 패널을 사용합니다\."/);

  for (const marker of [
    'html[data-gom-theme="minimal-hud"] [data-dashboard-files-workshop="paper-drawer"]',
    'html[data-gom-theme="minimal-hud"] [data-dashboard-templates-workshop="2"]',
    'html[data-gom-theme="minimal-hud"] [data-gallery-workshop-surface]',
  ]) {
    assert.match(styles, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(styles, /backdrop-filter: blur\(var\(--theme-backdrop-blur\)\)/);
  assert.match(styles, /\[data-gallery-paper-background\] > \* \{\s*display: none/);
});

test("high-coverage surfaces share workshop artifacts instead of generic aurora cards", () => {
  for (const marker of [
    "gomdory-workboard",
    "gomdory-flow-rail",
    "gomdory-submission-sheet",
    "gomdory-blackboard",
    "gomdory-safety-ticket",
  ]) {
    assert.match(landing, new RegExp(marker));
  }
  assert.doesNotMatch(landing, /rounded-\[(?:2|2\.25)rem\]|blur-3xl/);
  assert.match(login, /auth-brand-stamp/);
  assert.match(login, /initialMode=\{initialMode\}/);
  assert.match(login, /xl:grid-cols-\[0\.72fr_1\.05fr_0\.78fr\]/);
  assert.match(loginForm, /useState<"login" \| "signup">\(initialMode\)/);
  assert.match(loginForm, /auth-form-shell flex w-full max-w-none/);
  assert.match(marketingNav, /href="\/auth\/login"/);
  assert.match(studentEntry, /data-student-entry-scope/);
  assert.match(studentEntry, /student-entry-ticket/);
  assert.match(dashboard, /gomdory-dashboard-mark/);
});

test("workshop chrome stays crisp and action contrast remains explicit", () => {
  assert.match(
    styles,
    /\[data-marketing-interaction-scope\]\.sticky\[class\*="backdrop-blur"\][\s\S]*?background: var\(--gom-sheet\)/,
  );
  assert.match(
    styles,
    /\.gomdory-final-primary\s*\{\s*background: var\(--gom-yellow, #e6f05a\);\s*color: var\(--gom-ink, #19243a\)/,
  );
  assert.doesNotMatch(styles, /content: "LOGIN \/ TEACHER DESK"/);
});

test("narrow screens keep the workshop actions and security check inside the page", () => {
  assert.match(landing, /marketing-hero-login-cta[^\n]*w-full[^\n]*sm:w-auto/);
  assert.match(landing, /gomdory-sheet-spark hidden/);
  assert.match(styles, /font-size: clamp\(2\.35rem, 11vw, 2\.65rem\)/);
  assert.match(turnstile, /matchMedia\("\(max-width: 403px\)"\)/);
  assert.match(turnstile, /size: widgetSize/);
  assert.match(loginForm, /role="tablist"/);
  assert.match(loginForm, /role="tabpanel"/);
  assert.match(loginForm, /aria-selected=\{activeTab === "login"\}/);
});

test("public support and review pages use purpose-built workshop surfaces", () => {
  assert.match(contact, /contact-workdesk/);
  assert.match(contact, /contact-directory/);
  assert.match(contact, /contact-response-ticket/);
  assert.match(school, /school-question-grid/);
  assert.match(school, /school-question-card/);
  assert.match(community, /data-community-interaction-scope/);
  assert.match(community, /수업에서 나온 이야기/);
  assert.doesNotMatch(community, /카테고리 탭, 운영 고정글|신고\/운영 플로우/);
  assert.doesNotMatch(marketingFallbacks, /중심으로 안내합니다|순차 배포합니다|우선순위는/);
});
