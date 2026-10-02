import test from 'node:test';
import assert from 'node:assert/strict';
import { listCoursewareOpenSourceAdapters } from '@/lib/edu/courseware/openSourceAdapters/openSourceAdapterRegistry';

test('adapter registry is pure and lazy-safe metadata', () => {
  const items = listCoursewareOpenSourceAdapters();
  assert.ok(items.length >= 3);
  items.forEach((item) => assert.equal(item.lazy, true));
});
