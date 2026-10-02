import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runStudentStaticAppDryRun, StudentAppDryRunBadRequestError } from "@/lib/student-apps/staticAppDryRun";

test("Level 1 dry-run accepts manual static HTML/CSS/JS files", async () => {
  const result = await runStudentStaticAppDryRun({
    source: "manual_files",
    files: [
      { name: "index.html", path: "index.html", contentText: '<!doctype html><link rel="stylesheet" href="style.css"><script src="script.js"></script>' },
      { name: "style.css", path: "style.css", contentText: "body{margin:0}" },
      { name: "script.js", path: "script.js", contentText: "document.body.dataset.ready='1';" },
      { name: "logo.svg", path: "assets/logo.svg", contentText: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.validation.manifest.entryFile, "index.html");
  assert.deepEqual(result.validation.manifest.files.map((file) => file.path), ["assets/logo.svg", "index.html", "script.js", "style.css"]);
});

test("Level 1 dry-run rejects non-manual sources", async () => {
  for (const source of ["zip_upload", "external_link_capture"] as const) {
    await assert.rejects(
      () => runStudentStaticAppDryRun({ source, files: [{ name: "index.html", contentText: "ok" }] }),
      (err: unknown) => err instanceof StudentAppDryRunBadRequestError && (err as Error).message === "invalid_source",
    );
  }
});

test("student app API source does not install packages or run builds", () => {
  const files = [
    "app/api/v1/dashboard/student-apps/validate/route.ts",
    "app/api/v1/dashboard/student-apps/store/route.ts",
    "app/api/v1/dashboard/student-apps/publish/route.ts",
    "lib/student-apps/staticAppDryRun.ts",
    "lib/student-apps/storeStudentAppDeployment.ts",
    "lib/student-apps/createStudentAppSubmission.ts",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /npm\s+install|pnpm\s+install|yarn\s+install|bun\s+install|next\s+build|vite\s+build|execFile|spawn\(|child_process|node:fs|node:path|process\.env/i, file);
  }
});

test("store route requires manual_files and does not return publicUrl directly", () => {
  const route = readFileSync("app/api/v1/dashboard/student-apps/store/route.ts", "utf8");
  const service = readFileSync("lib/student-apps/storeStudentAppDeployment.ts", "utf8");
  assert.match(route, /source.*manual_files|manual_files[\s\S]*invalid_source/);
  assert.doesNotMatch(route, /publicUrl/);
  assert.doesNotMatch(service, /publicUrl/);
});
