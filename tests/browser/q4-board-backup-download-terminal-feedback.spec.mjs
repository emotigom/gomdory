import { test, expect } from "@playwright/test";

const base = process.env.Q4_BACKUP_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const boardId = "00000000-0000-4000-8000-0000000000b8";
const auth = () => ({ "x-q2-browser-fixture-token": token });

async function reset(page) { expect((await page.request.post(`${base}/api/q2/browser/result-download-fixture/reset`, { headers: auth() })).status()).toBe(200); }
async function ensureBackupPanel(page) {
  await page.goto(`${base}/dashboard/boards/${boardId}/board`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "B8 결과 백업" })).toBeVisible();
  const railRoot = page.getByTestId("canonical-right-rail");
  await expect(railRoot).toBeAttached();
  await expect(railRoot).toHaveAttribute("data-board-rail-client-ready", "true");
  const trigger = page.locator('button[aria-controls="canonical-right-rail-panel"]');
  const visibleTriggers = await trigger.evaluateAll((buttons) => buttons.filter((button) => {
    const style = window.getComputedStyle(button);
    const box = button.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
  }).length);
  expect(visibleTriggers).toBe(1);
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  if (await trigger.getAttribute("aria-expanded") === "false") await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const rail = page.getByTestId("canonical-right-rail-panel");
  await expect(rail).toBeVisible();
  await expect(rail).toHaveAttribute("data-state", "open");
  await rail.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByRole("region", { name: "보드 백업" })).toBeVisible();
}
async function instrument(page, failOnce = false) {
  await page.addInitScript((shouldFail) => {
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL); let failed = false;
    window.__q4Backup = { create: 0, revoke: 0, anchors: 0 };
    URL.createObjectURL = (blob) => { window.__q4Backup.create += 1; if (shouldFail && !failed) { failed = true; throw new Error("object-url-failure"); } return create(blob); };
    URL.revokeObjectURL = (url) => { window.__q4Backup.revoke += 1; return revoke(url); };
  }, failOnce);
}
async function begin(page, keyboard = false) {
  const panel = page.getByRole("region", { name: "보드 백업" });
  const button = page.getByRole("button", { name: "보드 백업 ZIP 다운로드" });
  const download = page.waitForEvent("download");
  if (keyboard) { await button.focus(); await page.keyboard.press("Enter"); } else await button.click();
  const item = await download; expect(await item.failure()).toBeNull();
  expect(item.suggestedFilename()).toMatch(/\.zip$/);
  await expect(panel.getByRole("status")).toHaveText("백업 파일 다운로드를 시작했습니다.");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  return item;
}
test.beforeEach(async ({ context }) => { await context.route("**/*", async (route) => { const url = new URL(route.request().url()); if (url.origin === new URL(base).origin) return route.continue({ headers: { ...route.request().headers(), ...auth() } }); return route.abort(); }); });
test("S1 valid local ZIP begins exactly one truthful download", async ({ page }) => { await instrument(page); await reset(page); await ensureBackupPanel(page); const item = await begin(page); expect(item.suggestedFilename()).toMatch(/^gomdory-board-/); expect(await page.evaluate(() => window.__q4Backup)).toEqual({ create: 1, revoke: 1, anchors: 0 }); });
test("S2 artifact is a ZIP, not a persistence claim", async ({ page }) => { await instrument(page); await reset(page); await ensureBackupPanel(page); const item = await begin(page); const stream = await item.createReadStream(); expect(stream).not.toBeNull(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks); expect(bytes.readUInt32LE(0)).toBe(0x04034b50); await expect(page.getByRole("status")).not.toContainText("저장"); });
test("S3 failed handoff has an alert and keyboard retry", async ({ page }) => { await instrument(page, true); await reset(page); await ensureBackupPanel(page); const panel = page.getByRole("region", { name: "보드 백업" }); const button = panel.getByRole("button", { name: "보드 백업 ZIP 다운로드" }); let downloads = 0; page.on("download", () => { downloads += 1; }); await button.click(); await expect(panel.getByRole("alert")).toContainText("다시 시도"); await expect(panel.getByRole("status")).toHaveCount(0); await expect(button).toBeFocused(); await begin(page, true); expect(downloads).toBe(1); });
test("S4 rapid duplicate activation creates one handoff", async ({ page }) => { await instrument(page); await reset(page); await ensureBackupPanel(page); const button = page.getByRole("region", { name: "보드 백업" }).getByRole("button", { name: "보드 백업 ZIP 다운로드" }); let downloads = 0; page.on("download", () => { downloads += 1; }); const event = page.waitForEvent("download"); await Promise.all([event, button.click()]); await expect(page.getByRole("region", { name: "보드 백업" }).getByRole("status")).toHaveCount(1); expect(downloads).toBe(1); expect(await page.evaluate(() => window.__q4Backup.create)).toBe(1); });
test("S5 reload has no stale local success", async ({ page }) => { await instrument(page); await reset(page); await ensureBackupPanel(page); await begin(page); await page.reload(); await expect(page.getByRole("status")).toHaveCount(0); });
