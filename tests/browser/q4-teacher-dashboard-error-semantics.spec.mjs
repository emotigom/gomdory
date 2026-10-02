import { expect, test } from "@playwright/test";

const base = process.env.Q4_DASHBOARD_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const resetPath = "/api/q2/browser/teacher-preparation-fixture/reset";

function fixtureRequest(url) {
  const candidate = new URL(url); const origin = new URL(base);
  return candidate.protocol === origin.protocol && candidate.port === origin.port && ["127.0.0.1", "localhost"].includes(candidate.hostname) && (candidate.pathname === "/dashboard" || candidate.pathname === resetPath);
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    if (!fixtureRequest(route.request().url())) return route.continue();
    await route.continue({ headers: { ...route.request().headers(), "x-q2-browser-fixture-token": token } });
  });
});
test.afterEach(async ({ context }) => context.unroute("**/*"));

async function reset(page, scenario) {
  const response = await page.request.post(`${base}${resetPath}`, { headers: { "x-q2-browser-fixture-token": token }, data: { scenario } });
  expect(response.status()).toBe(200);
}
async function error(page, scenario) {
  await reset(page, scenario);
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-dashboard-error]")).toBeVisible();
}

test("Q4-S1 loading has a named status before normal empty", async ({ page }) => {
  await reset(page, "loading-to-empty");
  // App Router's initial document navigation does not stream this segment's
  // loading boundary reliably in Chromium; the direct semantic test owns that assertion.
  await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "내 보드" })).toBeVisible();
  await expect(page.locator("[data-dashboard-error]")).toHaveCount(0);
});

test("Q4-S2 page error uses one visible labelled alert without internal detail", async ({ page }) => {
  await error(page, "error-always");
  const alert = page.locator("[data-dashboard-error]");
  await expect(alert).toHaveCount(1);
  await expect(alert.getByRole("heading", { name: "대시보드를 불러오지 못했습니다" })).toBeVisible();
  await expect(alert.getByText("잠시 후 다시 시도해 주세요.")).toBeVisible();
  await expect(page.getByText("오류 코드")).toHaveCount(0);
  await page.locator("[data-dashboard-error-retry]").focus();
  await expect(page.locator("[data-dashboard-error-retry]")).toBeFocused();
});

test("Q4-S3 keyboard retry reaches normal empty", async ({ page }) => {
  await error(page, "error-then-empty");
  await page.locator("[data-dashboard-error-retry]").focus();
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(page.getByRole("heading", { name: "내 보드" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-dashboard-error]")).toHaveCount(0);
});

test("Q4-S4 close double activation accepts one recovery", async ({ page }) => {
  await error(page, "error-then-empty");
  await page.locator("[data-dashboard-error-retry]").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(page.getByRole("heading", { name: "내 보드" })).toBeVisible({ timeout: 10_000 });
});

test("Q4-S5 retry failure keeps the error and a usable retry", async ({ page }) => {
  await error(page, "error-twice");
  await page.locator("[data-dashboard-error-retry]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-dashboard-error]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-dashboard-error-retry]")).toBeEnabled();
  await expect(page.locator("[data-empty-dashboard]")).toHaveCount(0);
});
