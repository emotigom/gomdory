import { test, expect } from '@playwright/test';

const base = process.env.Q2_B6_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const boardId = '00000000-0000-4000-8000-0000000000b6';
const wallId = '00000000-0000-4000-8000-0000000000c6';

function isFixtureRequest(url) {
  const candidate = new URL(url);
  const origin = new URL(base);
  if (candidate.protocol !== origin.protocol || candidate.port !== origin.port || !['127.0.0.1', 'localhost'].includes(candidate.hostname)) return false;
  return candidate.pathname === '/dashboard' || candidate.pathname === `/dashboard/boards/${boardId}/board` || candidate.pathname === '/api/q2/browser/teacher-preparation-fixture/reset' || candidate.pathname === `/api/v1/dashboard/boards/${boardId}/walls` || candidate.pathname === `/api/v1/dashboard/walls/${wallId}/cards`;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async (route) => {
    if (!isFixtureRequest(route.request().url())) return route.continue();
    await route.continue({ headers: { ...route.request().headers(), 'x-q2-browser-fixture-token': token } });
  });
});

test.afterEach(async ({ context }) => {
  await context.unroute('**/*');
});

async function reset(page) {
  const response = await page.request.post(`${base}/api/q2/browser/teacher-preparation-fixture/reset`, { headers: { 'x-q2-browser-fixture-token': token } });
  expect(response.status()).toBe(200);
}

async function openBoard(page) {
  await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: '열기' })).toHaveCount(1, { timeout: 10_000 });
  await page.getByRole('link', { name: '열기' }).click();
  await expect(page).toHaveURL(`${base}/dashboard/boards/${boardId}/board`, { timeout: 10_000 });
}

test('B6-S1 Dashboard to canonical board', async ({ page }) => {
  await reset(page); await openBoard(page);
  await expect(page.getByRole('heading', { name: 'Q2 B6 교사 수업 준비 테스트 보드' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('teacher-section-create-open')).toBeVisible({ timeout: 10_000 });
});

test('B6-S2 section preparation reload', async ({ page }) => {
  await reset(page); await openBoard(page);
  await page.getByTestId('teacher-section-create-open').click();
  await page.getByTestId('teacher-section-title-input').fill('B6 준비 섹션');
  await page.getByTestId('teacher-section-create-submit').click();
  await expect(page.getByText('B6 준비 섹션', { exact: true })).toHaveCount(1, { timeout: 10_000 });
  await page.reload();
  await expect(page.getByText('B6 준비 섹션', { exact: true })).toHaveCount(1, { timeout: 10_000 });
});

test('B6-S3 teacher card reload', async ({ page }) => {
  await reset(page); await openBoard(page);
  await page.getByTestId(`teacher-card-input-${wallId}`).fill('B6 teacher preparation item');
  await page.getByTestId(`teacher-card-submit-${wallId}`).click();
  await expect(page.getByText('B6 teacher preparation item', { exact: true })).toHaveCount(1, { timeout: 10_000 });
  await page.reload();
  await expect(page.getByText('B6 teacher preparation item', { exact: true })).toHaveCount(1, { timeout: 10_000 });
});

test('B6-S4 share readiness', async ({ page }) => {
  await reset(page); await openBoard(page);
  await expect(page.getByRole('main').getByText('Q2B6A8', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('www.gkrry.com에서 이 코드를 입력하면 게스트 모드로 입장합니다.')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('main').getByText('Q2B6A8', { exact: true })).toBeVisible({ timeout: 10_000 });
});
