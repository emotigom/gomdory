import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const landingPagePath = path.join(root, "app", "(marketing)", "page.tsx");
const pricingPagePath = path.join(root, "app", "(marketing)", "pricing", "page.tsx");
const appConfigPath = path.join(root, "lib", "env", "appConfig.ts");
const flagRegistryPath = path.join(root, "lib", "standards", "publicFlagsRegistry.mjs");

function read(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

test("root marketing route is canonical and cannot silently fall back to legacy", () => {
  const source = fs.readFileSync(landingPagePath, "utf8");

  assert.doesNotMatch(source, /readMarketingLandingV2Enabled/);
  assert.doesNotMatch(source, /LandingLegacy/);
  assert.match(source, /marketing-landing-canonical/);
  assert.match(source, /data-landing-variant="canonical"/);
  assert.match(source, /data-testid="marketing-landing-marker-version"/);
  assert.match(source, /data-marker-version=\{MARKETING_HOME_CANONICAL_MARKER_VERSION\}/);
});

test("homepage marker version stays aligned with the public marker contract", () => {
  const source = fs.readFileSync(landingPagePath, "utf8");
  const markerContract = read("app", "(marketing)", "_components", "landingMarkerContract.ts");

  assert.match(source, /data-marker-version=\{MARKETING_HOME_CANONICAL_MARKER_VERSION\}/);
  assert.match(markerContract, /MARKETING_HOME_CANONICAL_MARKER_VERSION\s*=\s*"marketing-home-canonical-v4-liberated"/);
});

test("root route ownership remains single-source and marketing-group-owned", () => {
  const appRootEntries = fs.readdirSync(path.join(root, "app"));

  assert.equal(appRootEntries.includes("page.tsx"), false, "app/page.tsx must not exist");
  assert.equal(fs.existsSync(landingPagePath), true, "app/(marketing)/page.tsx must exist");
  assert.equal(fs.existsSync(path.join(root, "app", "(marketing)", "layout.tsx")), true, "app/(marketing)/layout.tsx must exist");
});

test("marketing pricing route exports a stable public marker for smoke verification", () => {
  const source = fs.readFileSync(pricingPagePath, "utf8");
  assert.match(source, /data-testid="marketing-pricing-route-public"/);
});

test("landing v2/scenario rollout flags are removed from runtime reader and public flag registry", () => {
  const appConfig = fs.readFileSync(appConfigPath, "utf8");
  const registry = fs.readFileSync(flagRegistryPath, "utf8");

  assert.doesNotMatch(appConfig, /NEXT_PUBLIC_MARKETING_LANDING_V2/);
  assert.doesNotMatch(appConfig, /NEXT_PUBLIC_MARKETING_LANDING_SCENARIO_V1/);
  assert.doesNotMatch(registry, /NEXT_PUBLIC_MARKETING_LANDING_V2/);
  assert.doesNotMatch(registry, /NEXT_PUBLIC_MARKETING_LANDING_SCENARIO_V1/);
});

test("middleware has no special-case /pricing rewrite logic", () => {
  const middleware = read("middleware.ts");
  assert.doesNotMatch(middleware, /\/pricing/);
});
