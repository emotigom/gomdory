import assert from "node:assert/strict";

const CORE_LESSON_IDS = [1, 2, 3, 4];

export const maybePlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
};

export function resolveLessonEntryUrlFromEnv() {
  const rawUrl = process.env.E2E_LESSON_ENTRY_JT_URL?.trim() ?? "";
  if (rawUrl) {
    return { url: rawUrl, source: "E2E_LESSON_ENTRY_JT_URL" };
  }

  const baseUrl = process.env.E2E_BASE_URL?.trim() ?? "";
  const jt = process.env.E2E_LESSON_ENTRY_JT?.trim() ?? "";
  if (!baseUrl || !jt) {
    return { url: "", source: "" };
  }

  const entryUrl = new URL("/edu/lesson", baseUrl);
  entryUrl.searchParams.set("jt", jt);
  return { url: entryUrl.toString(), source: "E2E_BASE_URL+E2E_LESSON_ENTRY_JT" };
}

export function getSkipReason() {
  const hasFull = Boolean(process.env.E2E_LESSON_ENTRY_JT_URL?.trim());
  const hasPair = Boolean(process.env.E2E_BASE_URL?.trim() && process.env.E2E_LESSON_ENTRY_JT?.trim());
  if (hasFull || hasPair) {
    return "";
  }
  return "skip: set E2E_LESSON_ENTRY_JT_URL or both E2E_BASE_URL + E2E_LESSON_ENTRY_JT";
}

async function getCoreLessonLinks(page) {
  const grid = page.locator('[aria-label="교시 카드 목록"]');
  await assertLessonCardVisible(page, 1);
  return await grid.locator('a[href*="/edu/lesson/"]').all();
}

export async function assertLessonCardVisible(page, lessonId) {
  const card = page.getByRole("link", { name: new RegExp(`${lessonId}교시`) }).first();
  await card.waitFor({ state: "visible", timeout: 20000 });
  return card;
}

export async function assertLessonCardCue(page, lessonId) {
  const card = await assertLessonCardVisible(page, lessonId);
  const cue = card.getByText(/교시|들어가는 중/).first();
  await cue.waitFor({ state: "visible", timeout: 10000 });
}

export async function assertLessonListOrder(page) {
  const links = await getCoreLessonLinks(page);
  const labels = [];
  for (const link of links) {
    labels.push((await link.getAttribute("aria-label")) ?? "");
  }

  const positions = CORE_LESSON_IDS.map((id) => labels.findIndex((label) => label.includes(`${id}교시`)));
  positions.forEach((index, i) => {
    assert.notEqual(index, -1, `${CORE_LESSON_IDS[i]}교시 card missing`);
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i - 1] < positions[i], "core lessons are not rendered in 1→4 order");
  }
}

export async function assertFreeModeSeparated(page) {
  const freeSection = page.locator('[aria-label="자유모드 영역"]');
  await freeSection.waitFor({ state: "visible", timeout: 20000 });

  const coreGrid = page.locator('[aria-label="교시 카드 목록"]');
  const coreBottom = await coreGrid.boundingBox();
  const freeTop = await freeSection.boundingBox();
  assert.ok(coreBottom && freeTop, "failed to measure lesson list sections");
  assert.ok(freeTop.y >= coreBottom.y, "free mode section must be below core lesson grid");

  const freeCard = freeSection.getByRole("link", { name: /자유모드/ }).first();
  await freeCard.waitFor({ state: "visible", timeout: 10000 });
}

export async function clickLessonCardAndWait(page, lessonId) {
  const card = await assertLessonCardVisible(page, lessonId);
  await card.click();
  await page.waitForURL(new RegExp(`/edu/lesson/${lessonId}(?:\\?|$)`), { timeout: 20000 });
}

export async function clickFreeModeCardAndWait(page) {
  const freeCard = page.locator('[aria-label="자유모드 영역"]').getByRole("link", { name: /자유모드/ }).first();
  await freeCard.click();
  await page.waitForURL(/\/edu\/lesson\/0(?:\?|$)/, { timeout: 20000 });
}

export async function assertEntryCueVisible(page, lessonId) {
  await page.route(new RegExp(`.*/edu/lesson/${lessonId}(?:\\?.*)?$`), async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.continue();
  });

  const card = await assertLessonCardVisible(page, lessonId);
  await card.click();
  await page.getByText("들어가는 중…").first().waitFor({ state: "visible", timeout: 5000 });
  await page.waitForURL(new RegExp(`/edu/lesson/${lessonId}(?:\\?|$)`), { timeout: 20000 });
}

export async function assertNavigationStarted(page, expectedPathPattern) {
  await page.waitForURL(expectedPathPattern, { timeout: 20000 });
}

export async function assertA11yFriendlySelectors(page) {
  const coreGrid = page.getByLabel("교시 카드 목록");
  await coreGrid.waitFor({ state: "visible", timeout: 10000 });

  const firstCard = coreGrid.getByRole("link", { name: /1교시/ }).first();
  await firstCard.waitFor({ state: "visible", timeout: 10000 });

  const freeSection = page.getByLabel("자유모드 영역");
  await freeSection.waitFor({ state: "visible", timeout: 10000 });
}

export async function assertInteractionStateHooks(page, lessonId) {
  const card = await assertLessonCardVisible(page, lessonId);
  const className = await card.getAttribute("class");
  assert.ok(className?.includes("data-[pressing=true]"), "pressing state class hook missing");
  assert.ok(className?.includes("focus-visible"), "focus-visible class hook missing");
  assert.ok(className?.includes("hover:"), "hover class hook missing");

  await card.focus();
  const isFocused = await card.evaluate((element) => document.activeElement === element);
  assert.equal(isFocused, true, "lesson card did not receive focus");

  await card.dispatchEvent("pointerdown");
  await page.waitForFunction((el) => el.getAttribute("data-pressing") === "true", await card.elementHandle(), {
    timeout: 2000,
  });
}
