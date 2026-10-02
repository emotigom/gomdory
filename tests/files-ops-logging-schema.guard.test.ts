import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routePath = path.join(process.cwd(), "app", "api", "v1", "files", "upload", "commit", "route.ts");
const routeSource = readFileSync(routePath, "utf8");

test("files ops logs keep correlation keys SSOT", () => {
  const requiredTokens = ["requestId", "route", "method", "status", "code"];

  for (const token of requiredTokens) {
    assert.ok(routeSource.includes(token), `expected files route logs to include token: ${token}`);
  }

  assert.ok(routeSource.includes("fileId"), "expected files route logs to include fileId");
  assert.ok(routeSource.includes("ownerId"), "expected files route logs to include ownerId");
});

test("files ops fallback logs include softDeleteFallbackUsed flag", () => {
  assert.ok(
    routeSource.includes("softDeleteFallbackUsed: true"),
    "expected files route fallback logs to include softDeleteFallbackUsed: true",
  );
});
