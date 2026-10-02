import assert from "node:assert/strict";
import test from "node:test";

import { parseNavConfig } from "@/lib/site-content/navConfig";

test("parseNavConfig accepts valid payload", () => {
  const parsed = parseNavConfig(
    JSON.stringify({
      landingFooterLinks: [
        { label: "로드맵", href: "/roadmap" },
        { label: "지원", href: "https://example.com/help" },
      ],
      dashboardHelpLinks: [{ label: "운영", href: "/operator" }],
    }),
  );

  assert.ok(parsed);
  assert.equal(parsed?.landingFooterLinks.length, 2);
  assert.equal(parsed?.dashboardHelpLinks[0]?.href, "/operator");
});

test("parseNavConfig rejects invalid href", () => {
  const parsed = parseNavConfig(
    JSON.stringify({
      landingFooterLinks: [{ label: "bad", href: "javascript:alert(1)" }],
      dashboardHelpLinks: [],
    }),
  );

  assert.equal(parsed, null);
});

test("parseNavConfig rejects too many links", () => {
  const parsed = parseNavConfig(
    JSON.stringify({
      landingFooterLinks: Array.from({ length: 11 }, (_, index) => ({ label: `L${index}`, href: "/roadmap" })),
      dashboardHelpLinks: [],
    }),
  );

  assert.equal(parsed, null);
});

test("parseNavConfig rejects empty label", () => {
  const parsed = parseNavConfig(
    JSON.stringify({
      landingFooterLinks: [{ label: " ", href: "/roadmap" }],
      dashboardHelpLinks: [],
    }),
  );

  assert.equal(parsed, null);
});
