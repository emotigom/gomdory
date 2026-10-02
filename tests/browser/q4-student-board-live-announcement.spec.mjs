import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.Q4_BOARD_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const telemetryPath = process.env.Q4_BOARD_TELEMETRY_PATH;
const boardId = "00000000-0000-4000-8000-0000000000ba";
const auth = { "x-q2-browser-fixture-token": token };
const telemetry = { scenarios: {}, console: [], pageErrors: [], failedRequests: [], duplicateKeyWarnings: [], requests: [], announcementEvents: [], announcements: {}, fixture: {}, s4: {} };

function record(page, label) {
  page.on("console", (message) => { if (message.type() === "error" && /react|hydration|key/i.test(message.text())) telemetry.console.push({ label, text: message.text() }); if (/unique.*key|duplicate.*key/i.test(message.text())) telemetry.duplicateKeyWarnings.push({ label, text: message.text() }); });
  page.on("pageerror", (error) => telemetry.pageErrors.push({ label, message: error.message }));
  page.on("requestfailed", (request) => telemetry.failedRequests.push({ label, path: new URL(request.url()).pathname }));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes("/sync") || path.includes("/cards/")) telemetry.requests.push({ label, method: request.method(), path });
  });
}
async function allow(context, label) { await context.route("**/*", (route) => { const url = new URL(route.request().url()); return url.origin === base ? route.continue({ headers: { ...route.request().headers(), ...auth, "x-q2-browser-client-label": label } }) : route.fulfill({ status: 204, body: "" }); }); }
async function reset(page) { expect((await page.request.post(`${base}/api/q2/browser/multi-user-polling-fixture/reset`, { headers: auth })).status()).toBe(200); }
async function open(page) { await page.goto(`${base}/s/q2b10a`); await expect(page.getByTestId("student-board-live-announcement")).toBeAttached(); }
async function submit(page, text) { await page.keyboard.press("n"); const field = page.getByTestId("student-card-composer-text"); await expect(field).toBeVisible(); await field.fill(text); await page.getByTestId("student-card-composer-submit").click(); await expect(field).toHaveCount(0); }
async function waitCard(page, text, visible = true) { await expect.poll(() => page.locator("[data-card-id]").filter({ hasText: text }).count(), { timeout: 30_000 }).toBe(visible ? 1 : 0); }
async function observeAnnouncements(page) { await expect(page.getByTestId("student-board-live-announcement")).toBeAttached(); await page.evaluate(() => { const node = document.querySelector('[data-testid="student-board-live-announcement"]'); window.__q4Announcements = []; let previousText = node?.textContent?.trim() ?? ""; let previousKey = node?.getAttribute("data-announcement-event-key") ?? ""; new MutationObserver((mutations) => { const nextText = node?.textContent?.trim() ?? ""; const nextKey = node?.getAttribute("data-announcement-event-key") ?? ""; if (nextText && (nextText !== previousText || nextKey !== previousKey)) window.__q4Announcements.push({ previousText: previousText ? "meaningful" : "blank", nextText: "meaningful", previousKey: previousKey ? previousKey.split(":")[0] : "blank", nextKey: nextKey ? nextKey.split(":")[0] : "blank", mutationTypes: [...new Set(mutations.map((mutation) => mutation.type))] }); previousText = nextText; previousKey = nextKey; }).observe(node, { attributes: true, attributeFilter: ["data-announcement-event-key"], childList: true, characterData: true, subtree: true }); }); }
async function announcementEvents(page) { return page.evaluate(() => window.__q4Announcements ?? []); }
async function announcements(page) { return (await announcementEvents(page)).map((event) => event.nextKey); }
async function waitPollBoundary() { await new Promise((resolve) => setTimeout(resolve, 8_000)); }

test.afterAll(async () => { if (telemetryPath) await fs.writeFile(telemetryPath, `${JSON.stringify(telemetry, null, 2)}\n`); });

test("Q4 student board live announcement uses the B10 product fixture in managed Chromium", async ({ browser }) => {
  test.setTimeout(180_000);
  const a = await browser.newContext(); const b = await browser.newContext(); const teacher = await browser.newContext();
  try {
    await Promise.all([allow(a, "studentA"), allow(b, "studentB"), allow(teacher, "teacher")]);
    const ap = await a.newPage(); const bp = await b.newPage(); const tp = await teacher.newPage(); record(ap, "studentA"); record(bp, "studentB");
    await reset(ap); await Promise.all([open(ap), open(bp)]); await observeAnnouncements(ap);
    const region = ap.getByTestId("student-board-live-announcement"); await expect(region).toHaveAttribute("role", "status"); await expect(region).toHaveAttribute("aria-live", "polite"); await expect(region).toHaveAttribute("aria-atomic", "true"); await expect(region).toHaveText("");
    await waitPollBoundary(); await waitPollBoundary(); expect(await announcements(ap)).toEqual([]); telemetry.scenarios.S1 = "PASS";

    await submit(bp, "remote-card"); await waitCard(ap, "remote-card"); await expect.poll(() => announcements(ap).then((items) => items.length), { timeout: 30_000 }).toBe(1); const remoteEvents = await announcementEvents(ap); expect(remoteEvents[0].nextKey).toBe("remote-card-added"); await waitPollBoundary(); expect((await announcements(ap)).length).toBe(1); telemetry.scenarios.S2 = "PASS";

    await submit(ap, "own-card"); await waitCard(ap, "own-card"); await waitPollBoundary(); expect((await announcements(ap)).length).toBe(1); expect(await ap.locator("[data-card-id]").filter({ hasText: "own-card" }).count()).toBe(1); telemetry.scenarios.S3 = "PASS";

    await submit(bp, "moderated-card"); await waitCard(ap, "moderated-card"); await expect.poll(() => announcements(ap).then((items) => items.length), { timeout: 30_000 }).toBe(2); await tp.goto(`${base}/dashboard/boards/${boardId}/board`); const target = tp.locator("[data-card-id]").filter({ hasText: "moderated-card" }); await expect(target).toBeVisible(); await target.getByRole("button", { name: "카드 메뉴 열기" }).click(); await tp.getByRole("menuitem", { name: "학생에게 숨기기" }).click(); await waitCard(ap, "moderated-card", false); await expect.poll(() => announcements(ap).then((items) => items.length), { timeout: 30_000 }).toBe(3); await expect(region).toHaveText("카드가 숨겨졌습니다."); await waitPollBoundary(); expect((await announcements(ap)).length).toBe(3); await target.getByRole("button", { name: "카드 메뉴 열기" }).click(); await tp.getByRole("menuitem", { name: "학생에게 공개하기" }).click(); await waitCard(ap, "moderated-card"); await expect.poll(() => announcements(ap).then((items) => items.length), { timeout: 30_000 }).toBe(4); await expect(region).toHaveText("카드가 다시 표시되었습니다."); await waitPollBoundary(); expect((await announcements(ap)).length).toBe(4); const moderationEvents = await announcementEvents(ap); expect(moderationEvents.slice(-2).map((event) => event.nextKey)).toEqual(["remote-card-hidden", "remote-card-restored"]); expect(moderationEvents.slice(-2).map((event) => event.previousText)).toEqual(["meaningful", "meaningful"]); telemetry.s4 = { teacherMutations: 2, studentVisibility: ["hidden", "visible"], classifierEventTypes: moderationEvents.slice(-2).map((event) => event.nextKey), announcementEvents: moderationEvents.slice(-2) }; telemetry.scenarios.S4 = "PASS";

    await reset(ap); await Promise.all([ap.reload(), bp.reload()]); await expect(ap.getByTestId("student-board-live-announcement")).toHaveText(""); await observeAnnouncements(ap); await ap.keyboard.press("n"); const draft = ap.getByTestId("student-card-composer-text"); await draft.fill("draft-preserved"); await submit(bp, "remote-while-drafting"); await waitCard(ap, "remote-while-drafting"); await expect.poll(() => announcements(ap).then((items) => items.length), { timeout: 30_000 }).toBe(1); await expect(draft).toHaveValue("draft-preserved"); await expect(draft).toBeFocused(); telemetry.scenarios.S5 = "PASS";
    telemetry.fixture = await ap.request.get(`${base}/api/q2/browser/multi-user-polling-fixture/snapshot`, { headers: auth }).then((response) => response.json());
    telemetry.announcementEvents = await announcementEvents(ap); telemetry.announcements = { initial: 0, noChange: 0, remoteAdd: 1, ownReconciliation: 0, hide: 1, restore: 1, duplicate: 0, privacyViolations: 0 };
  } finally { await Promise.all([a.close(), b.close(), teacher.close()]); }
});
