import assert from "node:assert/strict";
import test from "node:test";
import { assertWebsiteStudioDocumentIsScriptFree } from "@/lib/website-studio/websiteStudioRenderer";

test("script safety assertion rejects active content patterns", () => {
  assert.throws(() => assertWebsiteStudioDocumentIsScriptFree("<script>alert(1)</script>"));
  assert.throws(() => assertWebsiteStudioDocumentIsScriptFree('<a href="javascript:alert(1)">x</a>'));
  assert.doesNotThrow(() => assertWebsiteStudioDocumentIsScriptFree("<p>safe</p>"));
});
