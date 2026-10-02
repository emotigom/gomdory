import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.E2E_BASE_URL;

const maybePlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
};

const assertStudentDecorateSurface = async (page) => {
  await page.getByRole("heading", { name: "AI로 꾸미기" }).first().waitFor({ timeout: 15000 });
  await page.locator("textarea").first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "AI로 꾸미기" }).first().waitFor({ timeout: 15000 });
};

const assertNoCoachChrome = async (page) => {
  const text = await page.textContent("body");
  assert.equal(text?.includes("AI COACH"), false);
  assert.equal(text?.includes("잠깐! 버튼으로 먼저 바꿔볼까?"), false);
  assert.equal(text?.includes("다시 시도하면 바로 적용해요"), false);
};

const assertDecorateServerPathStartedOrFallback = (events) => {
  const indexOf = (type) => events.findIndex((line) => line.includes(`"type":"${type}"`));
  const clickAt = indexOf("decorate_click");
  const submitAt = indexOf("decorate_submit_received");
  const txAt = indexOf("decorate_transaction_started");
  const providerAt = indexOf("decorate_provider_availability_checked");
  const openaiAt = indexOf("decorate_openai_attempt_started");
  const previewReadyAt = indexOf("decorate_preview_ready");
  const hasProxyRequest = events.some((line) => line.includes('"type":"decorate_openai_attempt_started"'));
  const hasFallbackOrSkip = events.some((line) => line.includes('"type":"decorate_webllm_skipped"') || line.includes('"type":"decorate_fallback_start"'));

  assert.equal(clickAt >= 0, true);
  assert.equal(submitAt > clickAt, true);
  assert.equal(txAt > submitAt, true);
  assert.equal(providerAt > txAt, true);
  assert.equal(openaiAt > providerAt, true);
  assert.equal(previewReadyAt > openaiAt, true);
  assert.equal(hasProxyRequest, true);
  assert.equal(hasFallbackOrSkip, true);
};

const waitForDecoratePreviewReady = async (page) => {
  await page.waitForFunction(
    () => document.body.innerText.includes("미리보기가 준비됐어요.") || document.body.innerText.includes("조금 더 빠른 방식으로 미리보기를 만들고 있어요."),
    null,
    { timeout: 30000 },
  );
};

test("student decorate panel single-path server-first flow (browser e2e)", { timeout: 180000 }, async (t) => {
  if (!baseUrl) {
    t.diagnostic("skip: E2E_BASE_URL is not set");
    return;
  }
  const playwright = await maybePlaywright();
  if (!playwright) {
    t.diagnostic("skip: playwright not installed");
    return;
  }

  const logs = [];
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", (msg) => logs.push(msg.text()));

  try {
    await page.goto(baseUrl + "/edu/lesson/1", { waitUntil: "domcontentloaded" });
    await assertStudentDecorateSurface(page);
    await assertNoCoachChrome(page);

    await page.locator("textarea").first().fill("버튼을 더 크게 하고 제목을 강조해줘");
    await page.getByRole("button", { name: "AI로 꾸미기" }).first().click();
    await waitForDecoratePreviewReady(page);
    await page.getByRole("button", { name: /적용/ }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes("바뀐 내용이 적용됐어요."), null, { timeout: 20000 });
    await page.getByRole("button", { name: /되돌리기/ }).first().click();

    assertDecorateServerPathStartedOrFallback(logs);

    // server 500 -> fallback
    await page.route("**/api/v1/edu/decorate/plan", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false }) });
    });
    await page.locator("textarea").first().fill("색을 더 부드럽게 바꿔줘");
    await page.getByRole("button", { name: "AI로 꾸미기" }).first().click();
    await waitForDecoratePreviewReady(page);
  } finally {
    await browser.close();
  }
});

export {
  assertStudentDecorateSurface,
  assertNoCoachChrome,
  assertDecorateServerPathStartedOrFallback,
};
