import { expect, test } from '@playwright/test';

test('q2-foundation-intentional-failure', async ({ page }) => {
  await page.goto(`${process.env.Q2_FOUNDATION_BASE_URL}/foundation`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('foundation-ready')).toBeVisible();
  expect('q2-foundation-intentional-failure').toBe('intentional-failure-must-produce-artifacts');
});
