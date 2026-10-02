import test from "node:test";
import assert from "node:assert/strict";

import {
  assertA11yFriendlySelectors,
  assertEntryCueVisible,
  assertFreeModeSeparated,
  assertInteractionStateHooks,
  assertLessonCardVisible,
  assertLessonListOrder,
  assertNavigationStarted,
  clickFreeModeCardAndWait,
  clickLessonCardAndWait,
  getSkipReason,
  maybePlaywright,
  resolveLessonEntryUrlFromEnv,
} from "./lesson-list-jt-entry.playwright.helpers.mjs";

const withJtParam = (url) => {
  const parsed = new URL(url);
  return parsed.searchParams.has("jt");
};

test("lesson list jt entry browser e2e", { timeout: 180000 }, async (t) => {
  const skipReason = getSkipReason();
  if (skipReason) {
    t.diagnostic(skipReason);
    return;
  }

  const playwright = await maybePlaywright();
  if (!playwright) {
    t.diagnostic("skip: playwright not installed");
    return;
  }

  const { url: lessonEntryUrl, source } = resolveLessonEntryUrlFromEnv();
  if (!lessonEntryUrl) {
    t.diagnostic("skip: missing jt entry url env");
    return;
  }

  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });

  try {
    await t.test("1) jt lesson entry page opens", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "교시 목록" }).waitFor({ state: "visible", timeout: 20000 });
      await assertLessonCardVisible(page, 1);
      assert.equal(withJtParam(page.url()), true, "jt query must be present on lesson entry page");
      t.diagnostic(`entry source: ${source}`);
      await page.close();
    });

    await t.test("2) ordered core lessons first", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await assertLessonListOrder(page);
      await page.close();
    });

    await t.test("3) free mode separated below", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await assertFreeModeSeparated(page);
      await page.close();
    });

    await t.test("4) click lesson card navigates correctly", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await clickLessonCardAndWait(page, 1);
      assert.equal(page.url().includes("/edu/lesson/1"), true);
      assert.equal(withJtParam(page.url()), true, "jt query must survive lesson card navigation");
      await page.close();
    });

    await t.test("5) click free mode navigates correctly", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await clickFreeModeCardAndWait(page);
      assert.equal(page.url().includes("/edu/lesson/0"), true);
      assert.equal(withJtParam(page.url()), true, "jt query must survive free mode navigation");
      await page.close();
    });

    await t.test("6) entry cue visible without blocking navigation", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await assertInteractionStateHooks(page, 1);
      await assertEntryCueVisible(page, 1);
      await assertNavigationStarted(page, /\/edu\/lesson\/1(?:\?|$)/);
      await page.close();
    });

    await t.test("7) mobile viewport order 유지", async () => {
      const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await mobileContext.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await assertLessonListOrder(page);
      await assertFreeModeSeparated(page);
      await mobileContext.close();
    });

    await t.test("8) a11y-friendly selectors 기반 탐색 가능", async () => {
      const page = await context.newPage();
      await page.goto(lessonEntryUrl, { waitUntil: "domcontentloaded" });
      await assertA11yFriendlySelectors(page);
      await page.close();
    });
  } finally {
    await context.close();
    await browser.close();
  }
});
