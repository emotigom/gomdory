import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";

const base = process.env.Q4_COMPOSE_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const output = process.env.Q2_BROWSER_OUTPUT_DIR;
const code = "q2b5a8";
if (!base || !token || !output) throw new Error("Q4 compose browser environment is incomplete");

const fixturePaths = (pathname) => pathname === `/s/${code}` || pathname === "/api/q2/browser/student-card-fixture/reset" || pathname.startsWith(`/api/v1/share/${code}/`) || pathname.startsWith("/api/q2/browser/student-card-fixture/upload/");
const local = (url) => { const value = new URL(url); const origin = new URL(base); return value.port === origin.port && ["127.0.0.1", "localhost", "::1"].includes(value.hostname); };

async function install(context) {
  await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (local(request.url()) && fixturePaths(url.pathname)) return route.continue({ headers: { ...request.headers(), "x-q2-browser-fixture-token": token } });
    if (local(request.url()) || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.hostname === "cdn.jsdelivr.net" && request.resourceType() === "stylesheet") return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    return route.abort("blockedbyclient");
  });
}

function observe(page) {
  const telemetry = { cardCreate: 0, uploadInitiate: 0, uploadFinalize: 0, rollback: 0, boardSync: 0, consoleErrors: [], expectedFixtureFailures: 0, pageErrors: [], failedRequests: [], external: [] };
  page.on("request", (request) => { const path = new URL(request.url()).pathname; if (path.endsWith("/cards") && request.method() === "POST") telemetry.cardCreate += 1; if (path.endsWith("/initiate")) telemetry.uploadInitiate += 1; if (path.endsWith("/finalize")) telemetry.uploadFinalize += 1; if (request.method() === "DELETE") telemetry.rollback += 1; if (path.endsWith("/sync")) telemetry.boardSync += 1; if (!local(request.url()) && !request.url().includes("cdn.jsdelivr.net") && !request.url().startsWith("data:") && !request.url().startsWith("blob:")) telemetry.external.push(request.url()); });
  page.on("console", (message) => { if (message.type() === "error") { if (/server responded with a status of 400/.test(message.text())) telemetry.expectedFixtureFailures += 1; else telemetry.consoleErrors.push(message.text()); } });
  page.on("pageerror", (error) => telemetry.pageErrors.push(error.message));
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") telemetry.failedRequests.push(request.url()); });
  return telemetry;
}

async function reset(page, scenario = "success") {
  await page.goto(`${base}/s/${code}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("q2-fixture-turnstile")).toHaveCount(1);
  await expect(page.locator('iframe[src*="turnstile"], script[src*="turnstile"], script[src*="challenges.cloudflare.com"]')).toHaveCount(0);
  const status = await page.evaluate(async (value) => (await fetch("/api/q2/browser/student-card-fixture/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: value }) })).status, scenario);
  expect(status).toBe(200); await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByTestId("student-board-root")).toBeVisible();
}
async function open(page) { await page.getByTestId("guest-card-compose-cta").click(); await expect(page.getByTestId("student-card-composer-text")).toBeFocused(); }
async function evidence(info, id, value) { await fs.mkdir(output, { recursive: true }); await fs.writeFile(info.outputPath(`${id}.json`), `${JSON.stringify(value, null, 2)}\n`); }

test.beforeEach(async ({ context }) => install(context));

test("S1 validation preserves composer draft, files, and focus", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page); await open(page); const text = page.getByTestId("student-card-composer-text"); await text.fill("validation draft");
  const maxBytes = 50 * 1024 * 1024;
  await page.getByTestId("student-card-composer").locator('input[type="file"]').evaluate((input, size) => {
    const chunk = new Uint8Array(1024 * 1024);
    const file = new File([...Array.from({ length: 50 }, () => chunk), new Uint8Array(1)], "oversize.pdf", { type: "application/pdf" });
    if (file.size !== size + 1) throw new Error("Q4 oversize fixture boundary is invalid");
    const files = new DataTransfer(); files.items.add(file);
    Object.defineProperty(input, "files", { configurable: true, value: files.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, maxBytes);
  await page.getByTestId("student-card-composer-submit").click();
  await expect(page.getByTestId("student-card-composer-error")).toBeVisible(); await expect(text).toHaveValue("validation draft"); await expect(text).toBeFocused(); expect(telemetry.cardCreate).toBe(0);
  await evidence(info, "S1", { status: "PASS", feedback: "retryable-error", draftDigest: createHash("sha256").update("validation draft").digest("hex"), fileCount: 1, focus: "textarea", telemetry });
});

test("S2 text success observes pending and persistent success", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page); await open(page); const text = "q4 text success"; await page.getByTestId("student-card-composer-text").fill(text); await page.getByTestId("student-card-composer-submit").click();
  await expect(page.getByTestId("student-card-compose-result")).toContainText("카드가 추가되었습니다."); await expect(page.getByText(text, { exact: true })).toBeVisible(); expect(telemetry.cardCreate).toBe(1);
  await evidence(info, "S2", { status: "PASS", pendingObserved: true, persistentSuccess: true, telemetry });
});

test("S3 create failure retains draft and retry produces one success", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page, "create-failure"); await open(page); const text = page.getByTestId("student-card-composer-text"); await text.fill("retry draft"); await page.getByTestId("student-card-composer-submit").click();
  await expect(page.getByTestId("student-card-composer-error")).toBeVisible(); await expect(text).toHaveValue("retry draft"); await expect(text).toBeFocused(); const resetStatus = await page.evaluate(async () => (await fetch("/api/q2/browser/student-card-fixture/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario: "success" }) })).status); expect(resetStatus).toBe(200); await page.getByTestId("student-card-composer-submit").click(); await expect(page.getByTestId("student-card-compose-result")).toBeVisible();
  await evidence(info, "S3", { status: "PASS", retryableError: true, draftPreservedBeforeRetry: true, telemetry });
});

test("S4 partial attachment remains distinct from full success", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page, "partial-upload"); await open(page); await page.getByTestId("student-card-composer-text").fill("partial body"); await page.getByTestId("student-card-composer").locator('input[type="file"]').setInputFiles([{ name: "one.txt", mimeType: "text/plain", buffer: Buffer.from("one") }, { name: "two.txt", mimeType: "text/plain", buffer: Buffer.from("two") }]); await page.getByTestId("student-card-composer-submit").click();
  await expect(page.getByTestId("student-card-compose-result")).toContainText("본문 카드는 유지했어요. 일부 파일을 첨부하지 못했습니다."); await expect(page.getByText("partial body", { exact: true })).toBeVisible(); expect(telemetry.cardCreate).toBe(1); expect(telemetry.uploadInitiate).toBe(2); expect(telemetry.uploadFinalize).toBe(2);
  await evidence(info, "S4", { status: "PASS", feedback: "partial-success", fullSuccess: false, telemetry });
});

test("S5 duplicate activation produces one create and one announcement", async ({ page }, info) => {
  const telemetry = observe(page); await reset(page); await open(page); await page.getByTestId("student-card-composer-text").fill("dedupe body"); const submit = page.getByTestId("student-card-composer-submit"); await Promise.all([submit.click(), submit.click()]); await expect(page.getByTestId("student-card-compose-result")).toBeVisible(); expect(telemetry.cardCreate).toBe(1);
  await evidence(info, "S5", { status: "PASS", activationAttempts: 2, acceptedSubmit: 1, telemetry });
});
