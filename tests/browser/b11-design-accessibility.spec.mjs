import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.Q2_B11_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const auth = { "x-q2-browser-fixture-token": token };
const telemetry = {
  viewports: [],
  audits: {
    responsive: [],
    geometry: [],
    semantics: [],
    keyboard: [],
    reducedMotion: [],
  },
  console: [],
  responses: [],
  pageErrors: [],
  failedRequests: [],
  duplicateKeyWarnings: [],
  clientOpsLogs: [],
  screenshots: [],
  hydrationMismatchCount: 0,
};
const viewports = [
  ["desktop", 1440, 900],
  ["small-desktop", 1280, 720],
  ["tablet-landscape", 1024, 768],
  ["tablet-portrait", 768, 1024],
  ["mobile", 390, 844],
  ["narrow-mobile", 360, 800],
];

function track(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      telemetry.console.push({ label, type: message.type(), text: message.text() });
    }
    if (/hydration|server rendered HTML/i.test(message.text())) {
      telemetry.hydrationMismatchCount += 1;
    }
    if (/unique.*key|duplicate.*key/i.test(message.text())) {
      telemetry.duplicateKeyWarnings.push({ label, text: message.text() });
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === base && response.status() >= 400) {
      telemetry.responses.push({ label, path: url.pathname, status: response.status() });
    }
  });
  page.on("pageerror", (error) => telemetry.pageErrors.push({ label, message: error.message }));
  page.on("requestfailed", (request) =>
    telemetry.failedRequests.push({
      label,
      path: new URL(request.url()).pathname,
      failure: request.failure()?.errorText ?? "unknown",
    }),
  );
}

async function fixture(context, label) {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("gomdory:guest-view-theme:q2b10a", "follow-teacher");
    } catch {
      // Storage can be unavailable on transient opaque documents before navigation.
    }
  });

  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/api/v1/me/ui-prefs") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ classPrefs: {} }),
      });
    }
    if (url.pathname === "/api/v1/dashboard/student-apps/session") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, session: null }),
      });
    }
    if (url.pathname === "/api/v1/ops/log") {
      let payload = null;
      try {
        payload = request.postDataJSON();
      } catch {
        payload = null;
      }
      const message = typeof payload?.message === "string" ? payload.message : null;
      telemetry.clientOpsLogs.push({
        label,
        message,
        expected: message === "slow_ui",
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, requestId: null, reasons: [] }),
      });
    }
    return route.continue({
      headers: {
        ...request.headers(),
        ...auth,
        "x-q2-browser-client-label": label,
      },
    });
  });
}

async function reset(page) {
  const response = await page.request.post(
    `${base}/api/q2/browser/b11-design-accessibility-fixture/reset`,
    { headers: auth },
  );
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.visualStress).toBe(true);
  expect(payload.cardCount).toBeGreaterThanOrEqual(16);
}

async function seed(page) {
  await page.goto(`${base}/s/q2b10a`);
  await expect(page.getByTestId("student-smart-layer")).toBeVisible();
  await expect(page.getByTestId("student-board-section")).toHaveCount(5);
  for (const text of [
    "긴 한국어 카드 내용입니다. 학생이 읽고 답할 수 있도록 여러 문장으로 구성한 검증용 내용입니다.",
    "https://example.invalid/this-is-a-long-url-without-natural-breaks-for-responsive-layout-verification",
    "붙여쓰기없는긴문자열반응형레이아웃검증콘텐츠",
    "여러 줄\n텍스트도 카드 안에서 안전하게 보여야 합니다.",
  ]) {
    await page.keyboard.press("n");
    const field = page.getByTestId("student-card-composer-text");
    await field.fill(text);
    await page.getByTestId("student-card-composer-submit").click();
    await expect(field).toHaveCount(0);
  }
}

async function openTeacher(page) {
  const url = `${base}/dashboard/boards/00000000-0000-4000-8000-0000000000ba/board`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-teacher-wall-dropzone=\"true\"]")).toHaveCount(5);
      await expect(page.locator("[data-card-id]").first()).toBeVisible();
      return;
    } catch (error) {
      if (attempt) throw error;
    }
  }
}

async function normalizeBoardPosition(page, screen) {
  await page.evaluate((target) => {
    window.scrollTo(0, 0);
    const selector =
      target === "student"
        ? '[data-testid="student-board-scroll-surface"]'
        : '[data-testid="canonical-board-content"]';
    const surface = document.querySelector(selector);
    if (surface instanceof HTMLElement) {
      surface.scrollLeft = 0;
      surface.scrollTop = 0;
    }
    for (const nested of document.querySelectorAll(
      target === "student"
        ? '[data-scroll="wall-column"]'
        : '[data-teacher-wall-scroll-container="true"]',
    )) {
      if (nested instanceof HTMLElement) {
        nested.scrollLeft = 0;
        nested.scrollTop = 0;
      }
    }
  }, screen);
  await page.waitForTimeout(100);
}

async function auditLayout(page, screen, name, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(120);
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    main: Boolean(document.querySelector("main")),
    buttons: [...document.querySelectorAll("button")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((node) => ({
        name: node.getAttribute("aria-label") || node.textContent?.trim() || "",
        fixed: getComputedStyle(node).position === "fixed",
        offscreen: (() => {
          const rect = node.getBoundingClientRect();
          return rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight;
        })(),
      })),
  }));
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
  expect(result.main).toBe(true);
  expect(result.buttons.filter((button) => !button.name).length).toBe(0);
  telemetry.audits.responsive.push({
    screen,
    viewport: name,
    ...result,
    criticalOffscreen: result.buttons.filter((button) => button.fixed && button.offscreen).length,
  });
  telemetry.viewports.push({
    screen,
    name,
    width,
    height,
    scrollWidth: result.scrollWidth,
    clientWidth: result.clientWidth,
  });
}

async function auditGeometry(page, screen, viewport, viewportWidth) {
  await normalizeBoardPosition(page, screen);
  const result = await page.evaluate((target) => {
    const sectionSelector =
      target === "student" ? '[data-testid="student-board-section"]' : "[data-teacher-wall-dropzone=\"true\"]";
    const surfaceSelector =
      target === "student"
        ? '[data-testid="student-board-scroll-surface"]'
        : '[data-testid="canonical-board-content"]';
    const rect = (node) => {
      if (!(node instanceof HTMLElement)) return null;
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      };
    };
    const sections = [...document.querySelectorAll(sectionSelector)].map(rect).filter(Boolean);
    const firstSection = document.querySelector(sectionSelector);
    const firstHeader =
      target === "student"
        ? firstSection?.querySelector('[data-column-header="true"]')
        : firstSection?.children?.[0] ?? null;
    const firstCard = firstSection?.querySelector("[data-card-id]") ?? null;
    const teacherMoveControls =
      target === "teacher"
        ? firstSection?.querySelector('[role="group"][aria-label="섹션 위치 이동"]') ?? null
        : null;

    const topbarTitleScrim =
      target === "student"
        ? document.querySelector('[data-student-topbar-title-scrim="true"]')
        : null;
    const composeResult =
      target === "student"
        ? document.querySelector('[data-testid="student-card-compose-result"]')
        : null;
    const mobileComposeBar =
      target === "student"
        ? document.querySelector('[data-testid="student-mobile-compose-bar"]')
        : null;

    return {
      surface: rect(document.querySelector(surfaceSelector)),
      sections,
      firstHeader: rect(firstHeader),
      firstCard: rect(firstCard),
      teacherMoveControls: rect(teacherMoveControls),
      topbarTitleScrim: rect(topbarTitleScrim),
      topbarTitleBackground:
        topbarTitleScrim instanceof HTMLElement
          ? getComputedStyle(topbarTitleScrim).backgroundColor
          : null,
      composeResult: rect(composeResult),
      mobileComposeBar: rect(mobileComposeBar),
    };
  }, screen);

  expect(result.sections.length).toBeGreaterThanOrEqual(5);
  expect(Math.abs(result.sections[0].top - result.sections[1].top)).toBeLessThanOrEqual(2);
  expect(result.sections[0].width).toBeGreaterThanOrEqual(300);
  expect(result.sections[0].width).toBeLessThanOrEqual(421);
  expect(result.sections[0].scrollWidth).toBeLessThanOrEqual(result.sections[0].clientWidth + 1);

  if (result.firstHeader && result.firstCard && screen === "student") {
    expect(Math.abs(result.firstHeader.left - result.firstCard.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.firstHeader.right - result.firstCard.right)).toBeLessThanOrEqual(2);
  }

  if (screen === "student") {
    expect(result.topbarTitleScrim).not.toBeNull();
    expect(result.topbarTitleBackground).not.toBe("rgba(0, 0, 0, 0)");
    if (result.composeResult && viewportWidth <= 390) {
      expect(result.composeResult.left).toBeGreaterThanOrEqual(-1);
      expect(result.composeResult.right).toBeLessThanOrEqual(viewportWidth + 1);
    }
  }

  if (result.teacherMoveControls) {
    expect(result.teacherMoveControls.right).toBeLessThanOrEqual(result.sections[0].right + 1);
  }

  if (viewportWidth <= 390) {
    expect(result.sections[0].left).toBeGreaterThanOrEqual(-1);
    expect(result.sections[0].right).toBeLessThanOrEqual(viewportWidth + 1);
  }

  telemetry.audits.geometry.push({
    screen,
    viewport,
    viewportWidth,
    ...result,
  });
}

async function shot(page, name) {
  const file = `${process.env.Q2_B11_SCREENSHOT_DIR}/${name}.png`;
  await fs.mkdir(process.env.Q2_B11_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  telemetry.screenshots.push(file);
}

test.afterAll(async () => {
  await fs.writeFile(
    process.env.Q2_B11_TELEMETRY_PATH,
    `${JSON.stringify(telemetry, null, 2)}\n`,
  );
});

test("student responsive matrix, themes, and long content", async ({ browser }) => {
  const context = await browser.newContext();
  await fixture(context, "student");
  const page = await context.newPage();
  track(page, "student");
  try {
    await reset(page);
    await seed(page);
    for (const [name, width, height] of viewports) {
      await auditLayout(page, "student", name, width, height);
      await auditGeometry(page, "student", name, width);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await normalizeBoardPosition(page, "student");
    await shot(page, "student-mobile");

    const own = page
      .locator("[data-card-id]")
      .filter({ hasText: "긴 한국어 카드 내용입니다." })
      .getByTestId("student-owned-card-menu-trigger");
    await expect(own).toBeVisible();
    await own.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await shot(page, "student-mobile-menu");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await normalizeBoardPosition(page, "student");
    await shot(page, "student-desktop");
  } finally {
    await context.close();
  }
});

test("teacher responsive matrix and tablet visibility operation", async ({ browser }) => {
  const context = await browser.newContext();
  await fixture(context, "teacher");
  const seedPage = await context.newPage();
  track(seedPage, "teacher-seed");
  await reset(seedPage);
  await seed(seedPage);
  await seedPage.close();

  const page = await context.newPage();
  track(page, "teacher");
  try {
    await openTeacher(page);
    for (const [name, width, height] of viewports) {
      await auditLayout(page, "teacher", name, width, height);
      await auditGeometry(page, "teacher", name, width);
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await normalizeBoardPosition(page, "teacher");
    const firstHeaderActions = page.locator('[data-teacher-wall-header-actions="true"]').first();
    await expect(firstHeaderActions.getByText("왼쪽", { exact: true })).toBeHidden();
    await expect(firstHeaderActions.getByText("오른쪽", { exact: true })).toBeHidden();
    const card = page.locator("[data-card-id]").first();
    await card.getByRole("button", { name: "카드 메뉴 열기" }).click();
    await expect(page.getByRole("menuitem", { name: "학생에게 숨기기" })).toBeVisible();
    await shot(page, "teacher-tablet-menu");
    await page.getByRole("menuitem", { name: "학생에게 숨기기" }).click();
    await card.getByRole("button", { name: "카드 메뉴 열기" }).click();
    await page.getByRole("menuitem", { name: "학생에게 공개하기" }).click();

    await page.setViewportSize({ width: 1440, height: 900 });
    await normalizeBoardPosition(page, "teacher");
    await expect(firstHeaderActions.getByText("왼쪽", { exact: true })).toBeVisible();
    await expect(firstHeaderActions.getByText("오른쪽", { exact: true })).toBeVisible();
    await shot(page, "teacher-desktop");
  } finally {
    await context.close();
  }
});

test("student touch mobile compose result clears fixed compose bar", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await fixture(context, "student-touch-mobile");
  const page = await context.newPage();
  track(page, "student-touch-mobile");
  try {
    await reset(page);
    await seed(page);
    const result = page.getByTestId("student-card-compose-result");
    const composeBar = page.getByTestId("student-mobile-compose-bar");
    await expect(result).toBeVisible();
    await expect(composeBar).toBeVisible();

    const geometry = await page.evaluate(() => {
      const toRect = (node) => {
        if (!(node instanceof HTMLElement)) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        result: toRect(document.querySelector('[data-testid="student-card-compose-result"]')),
        composeBar: toRect(document.querySelector('[data-testid="student-mobile-compose-bar"]')),
      };
    });

    expect(geometry.result).not.toBeNull();
    expect(geometry.composeBar).not.toBeNull();
    expect(geometry.result.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.result.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.result.bottom).toBeLessThanOrEqual(geometry.composeBar.top - 4);
    expect(geometry.result.top).toBeGreaterThanOrEqual(-1);
    telemetry.audits.geometry.push({
      screen: "student-touch",
      viewport: "mobile-compose-result-clearance",
      viewportWidth: geometry.viewportWidth,
      viewportHeight: geometry.viewportHeight,
      composeResult: geometry.result,
      mobileComposeBar: geometry.composeBar,
    });
  } finally {
    await context.close();
  }
});

test("keyboard-only student journey returns focus after Escape", async ({ browser }) => {
  const context = await browser.newContext();
  await fixture(context, "keyboard-student");
  const page = await context.newPage();
  track(page, "keyboard-student");
  try {
    await reset(page);
    await seed(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press("n");
    const field = page.getByTestId("student-card-composer-text");
    await expect(field).toBeFocused();
    await page.keyboard.type("키보드 제출 카드");
    await page.getByTestId("student-card-composer-submit").focus();
    await page.keyboard.press("Enter");
    await expect(field).toHaveCount(0);
    const trigger = page
      .locator("[data-card-id]")
      .filter({ hasText: "키보드 제출 카드" })
      .getByTestId("student-owned-card-menu-trigger");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    telemetry.audits.keyboard.push({
      screen: "student",
      submit: "PASS",
      menuEscapeFocusReturn: "PASS",
    });
    await shot(page, "student-keyboard-focus");
  } finally {
    await context.close();
  }
});

test("keyboard-only teacher journey exposes menu semantics", async ({ browser }) => {
  const context = await browser.newContext();
  await fixture(context, "keyboard-teacher");
  const seedPage = await context.newPage();
  track(seedPage, "keyboard-teacher-seed");
  await reset(seedPage);
  await seed(seedPage);
  await seedPage.close();

  const page = await context.newPage();
  track(page, "keyboard-teacher");
  try {
    await openTeacher(page);
    const trigger = page.locator("[data-card-id]").first().getByRole("button", {
      name: "카드 메뉴 열기",
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const item = page.getByRole("menuitem", { name: "학생에게 숨기기" });
    await expect(item).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    telemetry.audits.keyboard.push({
      screen: "teacher",
      menuRole: "PASS",
      escapeFocusReturn: "PASS",
    });
  } finally {
    await context.close();
  }
});

test("semantic audit and reduced motion retain usable controls", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await fixture(context, "semantics");
  const page = await context.newPage();
  track(page, "semantics");
  try {
    await reset(page);
    await seed(page);
    const scan = await page.evaluate(() => {
      const visible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      return {
        unnamedButtons: [...document.querySelectorAll("button")].filter(
          (button) => visible(button) && !(button.getAttribute("aria-label") || button.textContent?.trim()),
        ).length,
        unnamedControls: [...document.querySelectorAll("input, textarea")].filter(
          (node) =>
            visible(node) &&
            !(node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") || node.labels?.length),
        ).length,
        duplicateIds: [...document.querySelectorAll("[id]")]
          .map((node) => node.id)
          .filter((id, index, all) => all.indexOf(id) !== index).length,
        main: Boolean(document.querySelector("main")),
        h1: document.querySelectorAll("h1").length,
      };
    });
    expect(scan.unnamedButtons).toBe(0);
    expect(scan.unnamedControls).toBe(0);
    expect(scan.duplicateIds).toBe(0);
    expect(scan.main).toBe(true);
    expect(scan.h1).toBeLessThanOrEqual(1);
    telemetry.audits.semantics.push(scan);
    telemetry.audits.reducedMotion.push({ screen: "student", result: "PASS" });
    await normalizeBoardPosition(page, "student");
    await shot(page, "reduced-motion");
  } finally {
    await context.close();
  }
});
