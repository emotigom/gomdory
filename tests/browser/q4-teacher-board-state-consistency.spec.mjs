import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.Q4_TEACHER_BOARD_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const output = process.env.Q2_BROWSER_OUTPUT_DIR;
const boardId = "00000000-0000-4000-8000-0000000000b7";
const cardId = "00000000-0000-4000-8000-0000000000d7";
if (!base || !token || !output) throw new Error("Q4 teacher board browser environment is incomplete");
const auth = { "x-q2-browser-fixture-token": `${token}:owner` };
const card = (page) => page.locator(`[data-card-id="${cardId}"]`);
const local = (url) => new URL(url).origin === new URL(base).origin;
async function evidence(info, id, value) { await fs.mkdir(output, { recursive: true }); await fs.writeFile(info.outputPath(`${id}.json`), `${JSON.stringify(value, null, 2)}\n`); }
async function reset(page, scenario = "success") { const response = await page.request.post(`${base}/api/q2/browser/teacher-operation-fixture/reset`, { headers: { ...auth, "content-type": "application/json" }, data: { scenario } }); expect(response.status()).toBe(200); }
async function open(page) { await page.goto(`${base}/dashboard/boards/${boardId}/board`, { waitUntil: "domcontentloaded", extraHTTPHeaders: auth }); await expect(card(page)).toHaveCount(1); }
async function menuDiagnostics(page, trigger) { return page.evaluate((button) => {
  const visible = (node) => { const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0; };
  const menus = [...document.querySelectorAll('[role="menu"]')];
  const items = [...document.querySelectorAll('[role="menuitem"]')];
  return {
    trigger: { visible: visible(button), enabled: !button.disabled, expanded: button.getAttribute("aria-expanded"), focusable: button.tabIndex >= 0 },
    menuCount: menus.length, visibleMenuCount: menus.filter(visible).length, portalMenuCount: menus.filter((menu) => menu.parentElement === document.body).length,
    menuItemCount: items.length, visibleMenuItems: items.filter(visible).map((item) => item.textContent?.trim() ?? ""),
    focus: document.activeElement === button ? "trigger" : document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName ?? "none",
  };
}, await trigger.elementHandle()); }
async function activate(page) {
  const target = card(page); const trigger = target.getByRole("button", { name: "카드 메뉴 열기" });
  await expect(trigger).toBeVisible(); await expect(trigger).toBeEnabled(); await expect(trigger).toHaveAttribute("aria-expanded", "false");
  const initialVisibility = await target.getAttribute("data-card-hidden"); expect(["true", "false"]).toContain(initialVisibility);
  const expectedLabel = initialVisibility === "true" ? "학생에게 공개하기" : "학생에게 숨기기";
  const before = await menuDiagnostics(page, trigger); await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const surface = page.getByRole("menu"); await expect(surface).toHaveCount(1); await expect(surface).toBeVisible();
  const action = surface.getByRole("menuitem", { name: expectedLabel, exact: true }); await expect(action).toHaveCount(1); await expect(action).toBeVisible();
  return { action, diagnostic: { before, after: await menuDiagnostics(page, trigger), initialVisibility, expectedLabel } };
}
const fixtureStylesheet = (url) => new URL(url).hostname === "cdn.jsdelivr.net";
function observe(page) { const telemetry = { requests: 0, consoleErrors: [], expectedFixtureFailures: 0, pageErrors: [], failedRequests: [], external: [] }; page.on("request", (request) => { if (request.url().includes(`/cards/${cardId}/visibility`) && request.method() === "POST") telemetry.requests += 1; if (!local(request.url()) && !fixtureStylesheet(request.url())) telemetry.external.push(request.url()); }); page.on("console", (message) => { if (message.type() !== "error") return; if (/status of 503/.test(message.text())) { telemetry.expectedFixtureFailures += 1; return; } if (!/ERR_BLOCKED_BY_CLIENT|status of 401/.test(message.text())) telemetry.consoleErrors.push(message.text()); }); page.on("pageerror", (error) => telemetry.pageErrors.push(error.message)); page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") telemetry.failedRequests.push(request.url()); }); return telemetry; }
test.beforeEach(async ({ context }) => { await context.route("**/*", async (route) => { if (local(route.request().url())) return route.continue({ headers: { ...route.request().headers(), ...auth } }); if (fixtureStylesheet(route.request().url()) && route.request().resourceType() === "stylesheet") return route.fulfill({ status: 200, contentType: "text/css", body: "" }); return route.abort("blockedbyclient"); }); });

test("S1 normal confirmation waits for the canonical response", async ({ page }, info) => { const telemetry = observe(page); await reset(page); await open(page); const { action, diagnostic } = await activate(page); const response = page.waitForResponse((item) => item.url().includes(`/cards/${cardId}/visibility`) && item.request().method() === "POST"); await action.click(); expect((await response).status()).toBe(200); await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); await expect(card(page)).toHaveAttribute("data-teacher-board-mutation-phase", "confirmed"); expect(telemetry.requests).toBe(1); await evidence(info, "S1", { status: "PASS", activationAttempts: 1, accepted: 1, requests: telemetry.requests, optimistic: 1, confirmed: 1, rollbacks: 0, menu: diagnostic, telemetry }); });
test("S2 retryable failure rolls back the stable card state", async ({ page }, info) => { const telemetry = observe(page); await reset(page, "retryable-failure"); await open(page); const { action } = await activate(page); await action.click(); await expect(card(page)).toHaveAttribute("data-card-hidden", "false"); await expect(page.getByText("카드 공개 상태를 바꾸지 못했어요. 다시 시도해주세요.")).toBeVisible(); await expect(card(page)).toHaveAttribute("data-teacher-board-mutation-phase", "retryable-error"); await evidence(info, "S2", { status: "PASS", rollback: 1, retryable: true, requests: telemetry.requests, telemetry }); });
test("S3 keyboard retry recovers without focus loss", async ({ page }, info) => { const telemetry = observe(page); await reset(page, "retryable-failure"); await open(page); const { action } = await activate(page); await action.press("Enter"); await expect(page.getByText("카드 공개 상태를 바꾸지 못했어요. 다시 시도해주세요.")).toBeVisible(); await reset(page, "success"); const { action: retry } = await activate(page); await retry.press("Enter"); await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); await evidence(info, "S3", { status: "PASS", keyboardRetry: 1, focusLoss: 0, requests: telemetry.requests, telemetry }); });
test("S4 duplicate activation is synchronously guarded", async ({ page }, info) => { const telemetry = observe(page); await reset(page); await open(page); const { action } = await activate(page); await action.click(); await page.keyboard.press("Enter"); await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); expect(telemetry.requests).toBe(1); await evidence(info, "S4", { status: "PASS", activationAttempts: 2, accepted: 1, requests: telemetry.requests, duplicates: 0, telemetry }); });
test("S5 a newer fixture version remains canonical across refresh", async ({ page }, info) => { const telemetry = observe(page); await reset(page, "version-mismatch"); await open(page); const { action } = await activate(page); await action.click(); await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); await page.reload({ waitUntil: "domcontentloaded" }); await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); await evidence(info, "S5", { status: "PASS", versionMismatch: 1, reconciliation: 1, staleOverwrite: 0, requests: telemetry.requests, telemetry }); });
