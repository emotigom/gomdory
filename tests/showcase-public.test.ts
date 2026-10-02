import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("public showcase page includes marker and excludes student identifiers", () => {
  const pagePath = path.join(process.cwd(), "app", "x", "[token]", "page.tsx");
  const snapshotPath = path.join(process.cwd(), "lib", "showcase", "buildShowcaseSnapshot.ts");

  const pageContent = fs.readFileSync(pagePath, "utf8");
  const snapshotContent = fs.readFileSync(snapshotPath, "utf8");

  assert.ok(pageContent.includes("data-page-marker=\"showcase-public\""));
  assert.equal(snapshotContent.includes("student_name"), false);
  assert.equal(snapshotContent.includes("gomdori_student_name"), false);
});
