import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("server Supabase client uses batched getAll/setAll cookie hooks", () => {
  const source = readFileSync("lib/supabase/server.ts", "utf8");

  assert.match(source, /cookies:\s*\{\s*async getAll\(\)/);
  assert.match(source, /async setAll\(cookieList:/);
  assert.match(source, /const cookieStorePromise = cookies\(\);/);
  assert.match(source, /const requestCookiesPromise = cookieStorePromise\.then/);
  assert.match(source, /Promise\.all\(\[\s*cookieStorePromise,\s*requestCookiesPromise,\s*\]\)/);
  assert.doesNotMatch(source, /\bget\(name: string\)/);
  assert.doesNotMatch(source, /\bremove\(name: string/);
});

test("route Supabase client uses batched getAll/setAll cookie hooks", () => {
  const source = readFileSync("lib/supabase/route.ts", "utf8");

  assert.match(source, /cookies:\s*\{\s*async getAll\(\)/);
  assert.match(source, /async setAll\(cookies:/);
  assert.doesNotMatch(source, /\bget\(name: string\)/);
  assert.doesNotMatch(source, /\bremove\(name: string/);
});
