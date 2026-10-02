import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("student submit rejects requests without access proof and invalid input", async () => {
  const route = await import("@/app/api/v1/student-apps/submit/route");

  const missingProof = await route.POST(
    new NextRequest("http://localhost/api/v1/student-apps/submit", {
      method: "POST",
      body: JSON.stringify({ boardId: "b1", source: "manual_files", files: [{ path: "index.html", contentText: "<html></html>" }] }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(missingProof.status, 400);
  assert.equal((await missingProof.json()).error.code, "access_required");

  const emptyFiles = await route.POST(
    new NextRequest("http://localhost/api/v1/student-apps/submit", {
      method: "POST",
      body: JSON.stringify({ boardId: "b1", source: "manual_files", shareCode: "abc123", files: [] }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(emptyFiles.status, 400);
  assert.equal((await emptyFiles.json()).error.code, "invalid_files");

  const overName = await route.POST(
    new NextRequest("http://localhost/api/v1/student-apps/submit", {
      method: "POST",
      body: JSON.stringify({ boardId: "b1", source: "manual_files", shareCode: "abc123", submittedByName: "x".repeat(41), files: [{ path: "index.html", contentText: "<html></html>" }] }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(overName.status, 400);
  assert.equal((await overName.json()).error.code, "submitted_by_name_too_long");
});
