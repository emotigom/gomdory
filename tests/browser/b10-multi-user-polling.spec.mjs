import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.Q2_B10_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const telemetryPath = process.env.Q2_B10_TELEMETRY_PATH;
const boardId = "00000000-0000-4000-8000-0000000000ba";
const auth = { "x-q2-browser-fixture-token": token };
const telemetry = { contexts: [], scenarios: {}, requests: [], console: [], pageErrors: [], failedRequests: [], duplicateKeyWarnings: [] };

function recordPage(page, label) {
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === base) telemetry.requests.push({ label, method: response.request().method(), path: url.pathname, status: response.status() });
  });
  page.on("console", (message) => {
    const text = message.text();
    if (/react|key/i.test(text)) telemetry.console.push({ label, type: message.type(), text });
    if (/unique.*key|duplicate.*key/i.test(text)) telemetry.duplicateKeyWarnings.push({ label, text });
  });
  page.on("pageerror", (error) => telemetry.pageErrors.push({ label, message: error.message }));
  page.on("requestfailed", (request) => telemetry.failedRequests.push({ label, path: new URL(request.url()).pathname, failure: request.failure()?.errorText ?? "unknown" }));
}

async function allow(context, label) {
  telemetry.contexts.push(label);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base) {
      return route.continue({ headers: { ...route.request().headers(), ...auth, "x-q2-browser-client-label": label } });
    }
    // Keep the browser offline without turning optional third-party resources
    // into opaque window error events that would mask product telemetry.
    return route.fulfill({ status: 204, body: "" });
  });
}
async function reset(page) { expect((await page.request.post(`${base}/api/q2/browser/multi-user-polling-fixture/reset`, { headers: auth })).status()).toBe(200); }
async function snapshot(page) { const response = await page.request.get(`${base}/api/q2/browser/multi-user-polling-fixture/snapshot`, { headers: auth }); expect(response.status()).toBe(200); return response.json(); }
async function open(page) { await page.goto(`${base}/s/q2b10a`); await expect(page.getByTestId("student-smart-layer")).toBeVisible(); }
async function submit(page, text) { await page.keyboard.press("n"); const field = page.getByTestId("student-card-composer-text"); await expect(field).toBeVisible(); await field.fill(text); await page.getByTestId("student-card-composer-submit").click(); await expect(field).toHaveCount(0, { timeout: 15_000 }); }
async function waitForCardCount(page, count) { await expect.poll(async () => page.locator("[data-card-id]").count(), { timeout: 12_000 }).toBe(count); }
async function waitForCardVisible(page, text) { await expect.poll(async () => page.locator("[data-card-id]").filter({ hasText: text }).count(), { timeout: 12_000 }).toBe(1); }
async function waitForCardHidden(page, text) { await expect.poll(async () => page.locator("[data-card-id]").filter({ hasText: text }).count(), { timeout: 12_000 }).toBe(0); }
async function expectOwnedCardMenu(page, ownCardText, otherCardText) {
  await expect(page.locator("[data-card-id]").filter({ hasText: ownCardText }).getByTestId("student-owned-card-menu-trigger")).toHaveCount(1);
  await expect(page.locator("[data-card-id]").filter({ hasText: otherCardText }).getByTestId("student-owned-card-menu-trigger")).toHaveCount(0);
}

test.afterAll(async () => { if (telemetryPath) await fs.writeFile(telemetryPath, `${JSON.stringify(telemetry, null, 2)}\n`); });

test("B10 multi-user polling uses independent student and teacher product UIs", async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await browser.newContext(); const b = await browser.newContext(); const teacher = await browser.newContext();
  try {
    await allow(a, "studentA"); await allow(b, "studentB"); await allow(teacher, "teacher");
    const ap = await a.newPage(); const bp = await b.newPage(); const tp = await teacher.newPage();
    recordPage(ap, "studentA"); recordPage(bp, "studentB"); recordPage(tp, "teacher");
    await reset(ap);
    await tp.goto(`${base}/dashboard/boards/${boardId}/board`);
    await expect(tp.getByTestId("canonical-board-content")).toBeVisible();
    const teacherDraft = tp.getByLabel("새 카드 내용").first();
    await teacherDraft.fill("교사 작성 중 초안");
    await Promise.all([open(ap), open(bp)]);

    await Promise.all([submit(ap, "B10 student A card"), submit(bp, "B10 student B card")]);
    await Promise.all([waitForCardCount(ap, 2), waitForCardCount(bp, 2)]);
    await Promise.all([
      waitForCardVisible(tp, "B10 student A card"),
      waitForCardVisible(tp, "B10 student B card"),
    ]);
    await expect(teacherDraft).toHaveValue("교사 작성 중 초안");
    const s1 = await snapshot(ap); expect(s1.createCount).toBe(2); expect(s1.visibleCardCount).toBe(2); expect(new Set(s1.pollCounts ? Object.keys(s1.pollCounts) : []).size).toBeGreaterThanOrEqual(2); telemetry.scenarios.S1 = "PASS";

    const ids = await ap.locator("[data-card-id]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-card-id")));
    expect(new Set(ids).size).toBe(2); expect(telemetry.duplicateKeyWarnings).toEqual([]); telemetry.scenarios.S2 = "PASS";

    // Reload with fixture cards present. The server and the first client render
    // must both start identity-neutral; ownership resolves after hydration.
    await Promise.all([ap.reload(), bp.reload()]);
    await Promise.all([waitForCardCount(ap, 2), waitForCardCount(bp, 2)]);
    await expectOwnedCardMenu(ap, "B10 student A card", "B10 student B card");
    await expectOwnedCardMenu(bp, "B10 student B card", "B10 student A card");

    await ap.keyboard.press("n"); const draft = ap.getByTestId("student-card-composer-text"); await draft.fill("작성 중인 로컬 초안");
    await submit(bp, "B10 student B draft trigger"); await waitForCardCount(ap, 3); await expect(draft).toHaveValue("작성 중인 로컬 초안");
    await ap.getByTestId("student-card-composer-submit").click(); await waitForCardCount(bp, 4); telemetry.scenarios.S3 = "PASS";

    const target = tp.locator("[data-card-id]").filter({ hasText: "B10 student A card" }); await expect(target).toBeVisible();
    await target.getByRole("button", { name: "카드 메뉴 열기" }).click(); await tp.getByRole("menuitem", { name: "학생에게 숨기기" }).click(); await waitForCardHidden(ap, "B10 student A card");
    await target.getByRole("button", { name: "카드 메뉴 열기" }).click(); await tp.getByRole("menuitem", { name: "학생에게 공개하기" }).click(); await waitForCardVisible(ap, "B10 student A card");
    const s4 = await snapshot(ap); expect(s4.createCount).toBe(4); expect(s4.hideCount).toBe(1); expect(s4.unhideCount).toBe(1); expect(s4.visibleCardCount).toBe(4); telemetry.scenarios.S4 = "PASS";
  } finally { await Promise.all([a.close(), b.close(), teacher.close()]); }
});
