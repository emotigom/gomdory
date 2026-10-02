import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const contactPage = readFileSync("app/(marketing)/contact/page.tsx", "utf8");
const adoptionReadinessPage = readFileSync("app/(marketing)/school/adoption-readiness/page.tsx", "utf8");

test("/contact exists and keeps inquiry link contracts explicit", () => {
  assert.ok(existsSync("app/(marketing)/contact/page.tsx"), "/contact route must exist");
  assert.match(contactPage, /data-contact-interaction-scope/);
  assert.match(contactPage, /href: "mailto:support@gomdory\.app"/);
  assert.match(contactPage, /<a href=\{channel\.href\}/);
  assert.match(contactPage, /<Link href=\{channel\.href\}/);
  assert.doesNotMatch(contactPage, /github\.com\/[^"']*gom-clean\/blob\/main\/docs/);
});

test("school adoption readiness sends public inquiries to /contact", () => {
  assert.ok(existsSync("app/(marketing)/school/adoption-readiness/page.tsx"), "school adoption readiness route must exist");
  assert.match(adoptionReadinessPage, /href="\/contact"/);
});
