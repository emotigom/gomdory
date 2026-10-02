import assert from "node:assert/strict";
import test from "node:test";

import { runStudentStaticAppDryRun, StudentAppDryRunBadRequestError } from "@/lib/student-apps/staticAppDryRun";

test("accepts minimal text index.html", async () => {
  const result = await runStudentStaticAppDryRun({
    title: "My Student App",
    source: "manual_files",
    files: [{ name: "index.html", path: "index.html", contentText: "<!doctype html><title>Hello</title>" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalized.ok, true);
  assert.equal(result.validation.ok, true);
});

test("accepts nested root folder and strips root", async () => {
  const result = await runStudentStaticAppDryRun({
    source: "manual_files",
    files: [
      { name: "index.html", path: "my-app/index.html", contentText: "<title>x</title>" },
      { name: "style.css", path: "my-app/style.css", contentText: "body{}" },
    ],
  });
  assert.deepEqual(result.normalized.files.map((f) => f.path), ["index.html", "style.css"]);
});

test("accepts base64 image content without returning raw content", async () => {
  const result = await runStudentStaticAppDryRun({
    files: [
      { name: "index.html", path: "index.html", contentText: "ok" },
      { name: "logo.png", path: "assets/logo.png", contentBase64: "AQID", contentType: "image/png" },
    ],
  });
  const encoded = JSON.stringify(result);
  assert.equal(encoded.includes("AQID"), false);
  assert.equal(encoded.includes("contentText"), false);
});

test("rejects file with both contentText and contentBase64", async () => {
  await assert.rejects(
    runStudentStaticAppDryRun({ files: [{ name: "index.html", contentText: "a", contentBase64: "YQ==" }] }),
    (err: unknown) => err instanceof StudentAppDryRunBadRequestError,
  );
});

test("rejects file with neither contentText nor contentBase64", async () => {
  await assert.rejects(
    runStudentStaticAppDryRun({ files: [{ name: "index.html" }] }),
    (err: unknown) => err instanceof StudentAppDryRunBadRequestError,
  );
});

test("returns normalization errors for duplicate paths", async () => {
  const result = await runStudentStaticAppDryRun({
    files: [
      { name: "a", path: "app/index.html", contentText: "1" },
      { name: "b", path: "app\\index.html", contentText: "2" },
    ],
  });
  assert.equal(result.normalized.ok, false);
  assert.match((result.normalized.errors ?? []).join(","), /duplicate_path:index\.html/);
});

test("returns validator errors for missing index.html", async () => {
  const result = await runStudentStaticAppDryRun({ files: [{ name: "main.js", path: "main.js", contentText: "x" }] });
  assert.equal(result.validation.ok, false);
  assert.match(result.validation.errors.join(","), /missing_index_html/);
});

test("returns warnings for external script/fetch/form", async () => {
  const result = await runStudentStaticAppDryRun({
    files: [
      {
        name: "index.html",
        path: "index.html",
        contentText: '<script src="https://x.com/y.js"></script><form action="/x"></form>WebSocket',
      },
    ],
  });

  const warnings = result.validation.manifest.safety.warnings.join(",");
  assert.match(warnings, /external_script_src_detected/);
  assert.match(warnings, /form_action_detected/);
  assert.match(warnings, /network_request_api_detected/);
});

test("returns manifest with deterministic sha256", async () => {
  const input = { files: [{ name: "index.html", contentText: "abc" }], source: "manual_files" };
  const a = await runStudentStaticAppDryRun(input);
  const b = await runStudentStaticAppDryRun(input);
  assert.equal(a.validation.manifest.files[0]?.sha256, b.validation.manifest.files[0]?.sha256);
});

test("does not include raw content in response", async () => {
  const secret = "super-secret-content";
  const result = await runStudentStaticAppDryRun({ files: [{ name: "index.html", contentText: secret }] });
  assert.equal(JSON.stringify(result).includes(secret), false);
});
