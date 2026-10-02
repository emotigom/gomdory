import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const runbookPath = "docs/student-app-classroom-runbook.md";

test("student app classroom runbook exists and includes required content", () => {
  assert.equal(existsSync(runbookPath), true);
  const source = readFileSync(runbookPath, "utf8");

  for (const text of [
    "Students cannot publish",
    "accepted + latest",
    "session_closed",
    "eduview.gkrry.com/apps/{deploymentId}",
    "Cloudflare beacon CSP",
    "A. Before session",
    "B. Start session",
    "C. Student submit",
    "D. Versioning",
    "E. Teacher review",
    "F. Student gallery",
    "G. Gallery removal",
    "H. Publish flow",
    "I. End session",
  ]) {
    assert.equal(source.includes(text), true);
  }
});
