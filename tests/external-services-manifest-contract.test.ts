import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, "config/external-services.manifest.json"), "utf8"));
const required = ["google-identity", "google-picker", "google-drive", "cloudflare-r2", "cloudflare-deployment", "turnstile", "llm-provider", "supabase"];
assert.equal(manifest.schemaVersion, 1);
assert.deepEqual(Object.keys(manifest.services).sort(), required.sort());
for (const service of Object.values(manifest.services) as Array<Record<string, unknown>>) {
  assert.equal(typeof service.nextWorkId, "string");
  assert.equal(typeof service.fallback, "string");
  if (service.mutatesExternalState && service.nextWorkId !== "Q2-B9-E" && service.nextWorkId !== "Q2-B9-C") assert.equal(service.cleanupRequired, true);
}
