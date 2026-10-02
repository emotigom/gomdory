import assert from "node:assert/strict";
import test from "node:test";

import { inspectorSamples, inspectorSampleMap } from "../app/dashboard/boards/[boardId]/board/_components/studentAppInspectorSamples";

const totalSize = (key: keyof typeof inspectorSampleMap) => inspectorSampleMap[key].files.reduce((sum, f) => sum + (f.contentText?.length ?? f.contentBase64?.length ?? 0), 0);

test("sample packs include required structures", () => {
  const valid = inspectorSampleMap.validBasicApp;
  assert.ok(valid.files.some((f) => f.path === "index.html"));
  const html = valid.files.find((f) => f.path === "index.html")?.contentText ?? "";
  assert.match(html, /styles\/app\.css/);
  assert.match(html, /scripts\/app\.js/);
  assert.match(html, /assets\/icon\.svg/);

  assert.equal(inspectorSampleMap.missingIndexSample.files.some((f) => /index\.html$/i.test(f.path)), false);
  assert.ok(inspectorSampleMap.projectSourceSample.files.some((f) => f.path === "package.json"));
  assert.ok(inspectorSampleMap.projectSourceSample.files.some((f) => f.path.startsWith("src/")));

  const warningHtml = inspectorSampleMap.warningSample.files.find((f) => f.path === "index.html")?.contentText ?? "";
  assert.match(warningHtml, /https?:\/\//);
  assert.match(warningHtml, /<form[^>]+action=/i);
  assert.match(warningHtml, /fetch|WebSocket/);
});

test("samples stay tiny and safe", () => {
  const banned = /API_KEY|SECRET|TOKEN|PASSWORD/i;
  const pii = /@gmail\.com|010-\d{4}-\d{4}|\b\d{6}-\d{7}\b/;
  for (const sample of inspectorSamples) {
    assert.ok(totalSize(sample.key) < 100 * 1024);
    for (const file of sample.files) {
      const text = `${file.path}\n${file.contentText ?? ""}`;
      assert.doesNotMatch(text, banned);
      assert.doesNotMatch(text, pii);
    }
  }
});
