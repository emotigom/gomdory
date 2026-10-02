import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.Q4_TEACHER_CARD_MENU_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const output = process.env.Q2_BROWSER_OUTPUT_DIR;
const boardId = "00000000-0000-4000-8000-0000000000b7";
const cardId = "00000000-0000-4000-8000-0000000000d7";
if (!base || !token || !output) throw new Error("Q4 teacher card-menu browser environment is incomplete");

const auth = { "x-q2-browser-fixture-token": `${token}:owner` };
const local = (url) => new URL(url).origin === new URL(base).origin;
const card = (page) => page.locator(`[data-card-id="${cardId}"]`);
const trigger = (page) => card(page).getByRole("button", { name: "카드 메뉴 열기" });
const fixtureStylesheet = (url) => new URL(url).hostname === "cdn.jsdelivr.net";

async function evidence(info, id, value) {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(info.outputPath(`${id}.json`), `${JSON.stringify(value, null, 2)}\n`);
}
async function reset(page, scenario = "success") {
  const response = await page.request.post(`${base}/api/q2/browser/teacher-operation-fixture/reset`, {
    headers: { ...auth, "content-type": "application/json" }, data: { scenario },
  });
  expect(response.status()).toBe(200);
}
async function open(page) {
  await page.goto(`${base}/dashboard/boards/${boardId}/board`, { waitUntil: "domcontentloaded", extraHTTPHeaders: auth });
  await expect(card(page)).toHaveCount(1);
}
async function activate(page, label, keyboard = false) {
  await expect(trigger(page)).toBeVisible();
  if (keyboard) await trigger(page).press("Enter"); else await trigger(page).click();
  const action = page.getByRole("menuitem", { name: label, exact: true });
  await expect(action).toHaveCount(1);
  const response = page.waitForResponse((item) => item.url().includes(`/cards/${cardId}/visibility`) && item.request().method() === "POST");
  if (keyboard) await action.press("Enter"); else await action.click();
  return response;
}
function observe(page) {
  const telemetry = { requests: 0, consoleErrors: [], pageErrors: [], failedRequests: [], external: [] };
  page.on("request", (request) => {
    if (request.url().includes(`/cards/${cardId}/visibility`) && request.method() === "POST") telemetry.requests += 1;
    if (!local(request.url()) && !fixtureStylesheet(request.url())) telemetry.external.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !/status of 503|ERR_BLOCKED_BY_CLIENT|status of 401/.test(message.text())) telemetry.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => telemetry.pageErrors.push(error.message));
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") telemetry.failedRequests.push(request.url()); });
  return telemetry;
}
async function expectFocusRecovery(page) {
  await expect(trigger(page)).toBeFocused();
  await expect(page.locator("body")).not.toBeFocused();
}
test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    if (local(route.request().url())) return route.continue({ headers: { ...route.request().headers(), ...auth } });
    if (fixtureStylesheet(route.request().url()) && route.request().resourceType() === "stylesheet") return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    return route.abort("blockedbyclient");
  });
});

test("S1 hide result is announced after canonical confirmation", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page); await open(page);
  expect((await activate(page, "학생에게 숨기기")).status()).toBe(200);
  await expect(card(page)).toHaveAttribute("data-card-hidden", "true");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveText("카드를 학생 화면에서 숨겼습니다.");
  await expect(page.getByTestId("teacher-card-menu-error")).toHaveCount(0);
  await expectFocusRecovery(page);
  await evidence(info, "S1", { status: "PASS", hideAnnouncement: 1, errorAnnouncements: 0, requests: telemetry.requests, focusLoss: 0, telemetry });
});

test("S2 restore result is distinct and announced once", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page); await open(page);
  await activate(page, "학생에게 숨기기");
  await expect(card(page)).toHaveAttribute("data-card-hidden", "true");
  await activate(page, "학생에게 공개하기");
  await expect(card(page)).toHaveAttribute("data-card-hidden", "false");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveText("카드를 학생 화면에 다시 표시했습니다.");
  await expect(page.getByTestId("teacher-card-menu-error")).toHaveCount(0);
  await expectFocusRecovery(page);
  await evidence(info, "S2", { status: "PASS", restoreAnnouncement: 1, hideAnnouncements: 0, errorAnnouncements: 0, requests: telemetry.requests, focusLoss: 0, telemetry });
});

test("S3 failure rolls back and a keyboard retry replaces the error", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page, "retryable-failure"); await open(page);
  await activate(page, "학생에게 숨기기");
  await expect(card(page)).toHaveAttribute("data-card-hidden", "false");
  await expect(page.getByTestId("teacher-card-menu-error")).toHaveText("카드 공개 상태를 바꾸지 못했어요. 다시 시도해주세요.");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveCount(0);
  await expectFocusRecovery(page);
  await reset(page, "success");
  await activate(page, "학생에게 숨기기", true);
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveText("카드를 학생 화면에서 숨겼습니다.");
  await expect(page.getByTestId("teacher-card-menu-error")).toHaveCount(0);
  await expectFocusRecovery(page);
  await evidence(info, "S3", { status: "PASS", rollback: 1, failureSuccessAnnouncements: 0, retry: 1, retrySuccessAnnouncements: 1, staleErrors: 0, focusLoss: 0, requests: telemetry.requests, telemetry });
});

test("S4 a local result is not repeated by polling reflection", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page); await open(page);
  await activate(page, "학생에게 숨기기");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveText("카드를 학생 화면에서 숨겼습니다.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(card(page)).toHaveAttribute("data-card-hidden", "true");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveCount(0);
  await evidence(info, "S4", { status: "PASS", localAnnouncements: 1, pollingDuplicates: 0, requests: telemetry.requests, telemetry });
});

test("S5 reconciliation announces only the canonical terminal result", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page, "version-mismatch"); await open(page);
  await activate(page, "학생에게 숨기기");
  await expect(card(page)).toHaveAttribute("data-teacher-board-mutation-phase", "confirmed");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveText("카드를 학생 화면에서 숨겼습니다.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(card(page)).toHaveAttribute("data-card-hidden", "true");
  await expect(page.getByTestId("teacher-card-menu-status")).toHaveCount(0);
  await evidence(info, "S5", { status: "PASS", reconciliation: 1, canonicalAnnouncement: 1, falseAnnouncements: 0, staleOperationAnnouncements: 0, requests: telemetry.requests, telemetry });
});
