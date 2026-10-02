import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const marker = {
  console: 'q2-foundation-console-error',
  page: 'q2-foundation-page-error',
  request: '/abort',
};

test('collects isolated Chromium foundation telemetry', async ({ browser, page }, testInfo) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || null }));

  await page.goto(`${process.env.Q2_FOUNDATION_BASE_URL}/foundation`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('foundation-ready')).toBeVisible();
  await expect.poll(() => consoleErrors.filter((value) => value.includes(marker.console)).length).toBeGreaterThanOrEqual(1);
  await expect.poll(() => pageErrors.filter((value) => value.includes(marker.page)).length).toBeGreaterThanOrEqual(1);
  await expect.poll(() => failedRequests.filter((value) => value.url.includes(marker.request)).length).toBeGreaterThanOrEqual(1);

  const viewport = testInfo.project.use.viewport;
  expect(viewport).toEqual(testInfo.project.name === 'foundation-mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 });
  const telemetry = {
    projectName: testInfo.project.name,
    viewport,
    browserVersion: browser.version(),
    browserExecutable: browser.browserType().executablePath(),
    consoleErrors,
    pageErrors,
    failedRequests,
    url: page.url(),
  };
  await fs.writeFile(testInfo.outputPath('telemetry.json'), `${JSON.stringify(telemetry, null, 2)}\n`);
});
