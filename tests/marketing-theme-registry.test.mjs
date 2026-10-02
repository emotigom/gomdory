import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_MARKETING_THEME, MARKETING_THEMES, resolveMarketingTheme } from '../app/(marketing)/_components/marketingTokens';

test('marketing themes include studio, classic, and nebula-command', () => {
  assert.equal(Boolean(MARKETING_THEMES['daybreak-studio']), true);
  assert.equal(Boolean(MARKETING_THEMES.classic), true);
  assert.equal(Boolean(MARKETING_THEMES['nebula-command']), true);
});

test('default marketing theme is daybreak-studio', () => {
  assert.equal(DEFAULT_MARKETING_THEME, 'daybreak-studio');
});

test('resolveMarketingTheme supports debug query and fallback', () => {
  assert.equal(resolveMarketingTheme('classic'), 'classic');
  assert.equal(resolveMarketingTheme('nebula-command'), 'nebula-command');
  assert.equal(resolveMarketingTheme('daybreak-studio'), 'daybreak-studio');
  assert.equal(resolveMarketingTheme('unknown'), 'daybreak-studio');
});
