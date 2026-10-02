import { test, expect } from "@playwright/test";

const base = process.env.Q2_B7_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const boardId = "00000000-0000-4000-8000-0000000000b7";
const cardId = "00000000-0000-4000-8000-0000000000d7";
const wallA = "00000000-0000-4000-8000-0000000000c7";
const wallB = "00000000-0000-4000-8000-0000000000c8";
const auth = (role) => ({ "x-q2-browser-fixture-token": `${token}:${role}` });
const fixtureOrigin = new URL(base).origin;
const fixtureIngressByContext = new WeakMap();

function installOwnerFixtureIngress(context) {
  const current = fixtureIngressByContext.get(context);
  if (current) return current;
  const state = { active: true, installs: 1, sameOriginRequests: [], externalRequests: [] };
  const handler = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === fixtureOrigin) {
      state.sameOriginRequests.push({ path: url.pathname, method: request.method(), fixtureAuthPresent: true });
      await route.continue({ headers: { ...request.headers(), ...auth("owner") } });
      return;
    }
    state.externalRequests.push({ origin: url.origin, fixtureAuthPresent: false });
    await route.continue();
  };
  state.handler = handler;
  fixtureIngressByContext.set(context, state);
  return context.route("**/*", handler).then(() => state);
}

function assertFixtureIngress(context, { path, method }) {
  const state = fixtureIngressByContext.get(context);
  expect(state?.active).toBe(true);
  expect(state?.installs).toBe(1);
  expect(state?.sameOriginRequests.some((request) => request.path === path && request.method === method && request.fixtureAuthPresent)).toBe(true);
  expect(state?.externalRequests.every((request) => request.fixtureAuthPresent === false)).toBe(true);
}

async function reset(page) { expect((await page.request.post(`${base}/api/q2/browser/teacher-operation-fixture/reset`, { headers: auth("owner") })).status()).toBe(200); }
async function open(page, role = "owner") { await page.goto(`${base}/dashboard/boards/${boardId}/board`, { waitUntil: "domcontentloaded", extraHTTPHeaders: auth(role) }); await expect(page.getByRole("heading", { name: "Q2 B7 교사 수업 운영 테스트 보드" })).toBeVisible(); }
function card(page) { return page.locator(`[data-card-id="${cardId}"]`); }
async function menu(page) { await card(page).getByRole("button", { name: "카드 메뉴 열기" }).click(); }
async function clickMutation(page, label, pathname) {
  const responsePromise = page.waitForResponse((response) => response.url().includes(pathname) && response.request().method() !== "GET");
  await page.getByRole("menuitem", { name: label }).click();
  return responsePromise;
}

test.beforeEach(async ({ context }) => { await installOwnerFixtureIngress(context); });
test.afterEach(async ({ context }) => { const state = fixtureIngressByContext.get(context); if (state?.handler) await context.unroute("**/*", state.handler); fixtureIngressByContext.delete(context); });

test("B7-S1 student submission hide and restore", async ({ page }) => {
  await reset(page); await open(page); await expect(card(page)).toContainText("B7 fixture student submission"); await menu(page);
  const hide = await clickMutation(page, "학생에게 숨기기", `/cards/${cardId}/visibility`); expect(hide.status()).toBe(200); expect((await hide.json()).card.isHidden).toBe(true);
  await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); await page.reload(); assertFixtureIngress(page.context(), { path: `/dashboard/boards/${boardId}/board`, method: "GET" }); await expect(card(page)).toHaveAttribute("data-card-hidden", "true"); await menu(page);
  const unhide = await clickMutation(page, "학생에게 공개하기", `/cards/${cardId}/visibility`); expect(unhide.status()).toBe(200); expect((await unhide.json()).card.isHidden).toBe(false);
  assertFixtureIngress(page.context(), { path: `/api/v1/dashboard/cards/${cardId}/visibility`, method: "POST" });
  await expect(card(page)).toHaveAttribute("data-card-hidden", "false"); await page.reload(); await expect(card(page)).toHaveCount(1); await expect(card(page)).toHaveAttribute("data-card-hidden", "false");
});
test("B7-S2 final artwork persists", async ({ page }) => {
  await reset(page); await open(page); await menu(page); await page.getByRole("menuitem", { name: "최종 작품으로 표시" }).click(); await expect(card(page).getByText("최종 작품")).toBeVisible(); await page.reload(); await expect(card(page).getByText("최종 작품")).toBeVisible(); await expect(card(page)).toHaveCount(1);
});
test("B7-S3 menu move between sections", async ({ page }) => {
  await reset(page); await open(page); await expect(page.locator(`[data-teacher-wall-id="${wallA}"] [data-card-id="${cardId}"]`)).toHaveCount(1); await menu(page);
  const move = await clickMutation(page, "“발표 작품”로 이동", `/cards/${cardId}/move`); expect(move.status()).toBe(200); expect((await move.json()).card.wallId).toBe(wallB);
  await expect(page.locator(`[data-teacher-wall-id="${wallA}"] [data-card-id="${cardId}"]`)).toHaveCount(0); await expect(page.locator(`[data-teacher-wall-id="${wallB}"] [data-card-id="${cardId}"]`)).toHaveCount(1); await page.reload(); await expect(page.locator(`[data-teacher-wall-id="${wallB}"] [data-card-id="${cardId}"]`)).toHaveCount(1);
});
test("B7-S4 denied roles expose no operation controls", async ({ browser }) => {
  for (const role of ["viewer", "non-member", "student"]) { const context = await browser.newContext({ extraHTTPHeaders: auth(role) }); const page = await context.newPage(); await page.goto(`${base}/dashboard/boards/${boardId}/board`); await expect(card(page)).toHaveCount(1); await expect(card(page).getByRole("button", { name: "카드 메뉴 열기" })).toHaveCount(1); await card(page).getByRole("button", { name: "카드 메뉴 열기" }).click(); await expect(page.getByRole("menuitem", { name: "최종 작품으로 표시" })).toHaveCount(0); const denied = await page.request.post(`${base}/api/v1/dashboard/cards/${cardId}/visibility`, { headers: auth(role), data: { hidden: true } }); expect(denied.status()).toBe(403); await context.close(); }
});
