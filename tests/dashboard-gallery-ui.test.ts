import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { DEMO_MODE_STORAGE_KEY, readDemoModeFromStorage, writeDemoModeToStorage } from "@/lib/demo/demoMode";

class MemoryStorage implements Storage {
  store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

test("dashboard gallery page exposes page marker", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "gallery", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes('data-page-marker="dashboard-gallery"'));
});

test("demo mode toggle persists to storage key", () => {
  const storage = new MemoryStorage();
  writeDemoModeToStorage(true, storage);
  assert.equal(storage.getItem(DEMO_MODE_STORAGE_KEY), "1");
  assert.equal(readDemoModeFromStorage(storage), true);

  writeDemoModeToStorage(false, storage);
  assert.equal(storage.getItem(DEMO_MODE_STORAGE_KEY), "0");
  assert.equal(readDemoModeFromStorage(storage), false);
});
