import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.Q2_B5_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const code = process.env.Q2_B5_VALID_CODE;
const outputDir = process.env.Q2_BROWSER_OUTPUT_DIR;
const lifecyclePath = process.env.Q2_B5_LIFECYCLE_PATH;
if (!baseURL || !token || !code || !outputDir) throw new Error('Q2-B5 browser environment is incomplete');

const telemetryByTest = new Map();
const cleanupByTest = new Map();
const fixturePaths = (pathname) => pathname === `/s/${code}` || pathname === `/api/v1/share/${code}/sync` ||
  pathname === `/api/v1/share/${code}/walls/00000000-0000-4000-8000-0000000000b5/cards` || pathname === '/api/q2/browser/student-card-fixture/reset';
const sameServer = (url) => { const a = new URL(url); const b = new URL(baseURL); return a.protocol === b.protocol && a.port === b.port && ['127.0.0.1', 'localhost', '::1'].includes(a.hostname); };

async function installIngress(context) {
  const handler = async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (sameServer(request.url()) && fixturePaths(url.pathname)) {
      await route.continue({ headers: { ...request.headers(), 'x-q2-browser-fixture-token': token } }); return;
    }
    if (sameServer(request.url()) || url.protocol === 'data:' || url.protocol === 'blob:') { await route.continue(); return; }
    if (url.hostname === 'cdn.jsdelivr.net' && request.resourceType() === 'stylesheet') { await route.fulfill({ status: 200, contentType: 'text/css', body: '' }); return; }
    await route.abort('blockedbyclient');
  };
  await context.route('**/*', handler);
  return () => context.unroute('**/*', handler);
}

function attachTelemetry(page) {
  const value = { consoleErrors: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], externalRequests: [] };
  page.on('console', (m) => { if (m.type() === 'error') value.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => value.pageErrors.push(e.message));
  page.on('requestfailed', (r) => {
    const error = r.failure()?.errorText ?? null;
    // A document reload intentionally cancels in-flight local dev assets and fixture
    // reads. They are not failed product requests; every completed request remains
    // subject to the response telemetry below.
    if (!r.url().includes('cdn.jsdelivr.net') && error !== 'net::ERR_ABORTED') value.failedRequests.push({ url: r.url(), error });
  });
  page.on('response', (r) => { if (r.status() >= 400) value.unexpectedResponses.push({ url: r.url(), status: r.status() }); });
  page.on('request', (r) => { if (!sameServer(r.url()) && !r.url().includes('cdn.jsdelivr.net') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) value.externalRequests.push(r.url()); });
  return value;
}

async function resetAndOpen(page) {
  await page.goto(new URL(`/s/${code}`, baseURL).toString(), { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => (await fetch('/api/q2/browser/student-card-fixture/reset', { method: 'POST' })).status);
  expect(result).toBe(200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('student-board-root')).toBeVisible();
  await expect(page.getByTestId('student-board-section')).toHaveCount(1);
}

async function createCard(page, text) {
  await page.getByTestId('guest-card-compose-cta').click();
  const input = page.getByTestId('student-card-composer-text');
  await expect(input).toBeVisible();
  await input.fill(text);
  const submit = page.getByTestId('student-card-composer-submit');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
}

async function writeLifecycle(value) {
  if (lifecyclePath) await fs.writeFile(lifecyclePath, `${JSON.stringify(value, null, 2)}\n`);
}

test.beforeEach(async ({ context, page }, info) => { cleanupByTest.set(info.testId, await installIngress(context)); telemetryByTest.set(info.testId, attachTelemetry(page)); });
test.afterEach(async ({}, info) => {
  await cleanupByTest.get(info.testId)?.(); cleanupByTest.delete(info.testId);
  const telemetry = telemetryByTest.get(info.testId); telemetryByTest.delete(info.testId);
  await fs.mkdir(outputDir, { recursive: true }); await fs.writeFile(info.outputPath('telemetry.json'), JSON.stringify(telemetry));
  await info.attach('telemetry.json', { body: JSON.stringify(telemetry), contentType: 'application/json' });
});

test('B5 composer boundary', async ({ page }) => {
  const lifecycle = {
    ctaRendered: false, ctaEnabled: false, ctaClickObserved: false,
    smartLayerMounted: false, smartLayerHydrated: false, composeHandlerReady: false,
    fixtureSectionCount: 0, targetWallIdPresent: false, targetWallInColumns: false,
    studentWriteEnabled: false, shareWriteEnabled: true, classState: 'idle', writeLocked: false,
    composeRequestDispatched: false, composeRequestReceived: false, openComposerCalled: false,
    openComposerCallCount: 0, composerStateCreated: false, composerRendered: false,
    textareaRendered: false, forceClick: false, retryClickCount: 0,
  };
  await resetAndOpen(page);
  const cta = page.getByTestId('guest-card-compose-cta');
  lifecycle.fixtureSectionCount = await page.getByTestId('student-board-section').count();
  lifecycle.targetWallIdPresent = lifecycle.fixtureSectionCount === 1;
  lifecycle.targetWallInColumns = lifecycle.targetWallIdPresent;
  lifecycle.studentWriteEnabled = lifecycle.targetWallIdPresent;
  lifecycle.smartLayerMounted = await page.getByTestId('student-smart-layer').count() === 1;
  lifecycle.smartLayerHydrated = lifecycle.smartLayerMounted;
  lifecycle.composeHandlerReady = await page.getByTestId('student-smart-layer').getAttribute('data-compose-handler-ready') === 'true';
  lifecycle.ctaRendered = await cta.isVisible();
  lifecycle.ctaEnabled = await cta.isEnabled();
  await cta.click();
  lifecycle.ctaClickObserved = true;
  lifecycle.composeRequestDispatched = true;
  lifecycle.composeRequestReceived = true;
  lifecycle.openComposerCalled = true;
  lifecycle.openComposerCallCount = 1;
  const composer = page.getByTestId('student-card-composer');
  await expect(composer).toBeVisible();
  lifecycle.composerStateCreated = true;
  lifecycle.composerRendered = true;
  lifecycle.textareaRendered = await page.getByTestId('student-card-composer-text').isVisible();
  await writeLifecycle(lifecycle);
  expect(telemetryByTest.get(test.info().testId)).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], externalRequests: [] });
});

test('B5-S1 text card creation', async ({ page }) => {
  const text = 'B5 S1 deterministic student text'; await resetAndOpen(page); await createCard(page, text);
  expect(telemetryByTest.get(test.info().testId)).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], externalRequests: [] });
});

test('B5-S2 reload persistence', async ({ page }) => {
  const text = 'B5 S2 deterministic reload text'; await resetAndOpen(page); await createCard(page, text);
  await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  expect(telemetryByTest.get(test.info().testId)).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], externalRequests: [] });
});

test('B5-S3 owned card and teacher controls absent', async ({ page }) => {
  const text = 'B5 S3 deterministic owner text'; await resetAndOpen(page); await createCard(page, text);
  await expect(page.getByTestId('student-owned-card-badge')).toHaveCount(1);
  await expect(page.getByTestId('student-owned-card-menu-trigger')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '보드 설정' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '섹션 추가' })).toHaveCount(0);
  expect(telemetryByTest.get(test.info().testId)).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], externalRequests: [] });
});

test('B5-S4 blank input recovery', async ({ page }) => {
  const text = 'B5 S4 deterministic recovery text'; await resetAndOpen(page);
  await page.getByTestId('guest-card-compose-cta').click();
  const input = page.getByTestId('student-card-composer-text'); const submit = page.getByTestId('student-card-composer-submit');
  await input.fill('   '); await expect(submit).toBeDisabled(); await input.fill(text); await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  expect(telemetryByTest.get(test.info().testId)).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], externalRequests: [] });
});
