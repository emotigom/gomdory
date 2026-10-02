import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("marketing templates pages redirect to home", () => {
  const listPath = path.join(process.cwd(), "app", "(marketing)", "templates", "page.tsx");
  const detailPath = path.join(process.cwd(), "app", "(marketing)", "templates", "[id]", "page.tsx");
  const collectionPath = path.join(process.cwd(), "app", "(marketing)", "templates", "collections", "[slug]", "page.tsx");
  const listContent = fs.readFileSync(listPath, "utf8");
  const detailContent = fs.readFileSync(detailPath, "utf8");
  const collectionContent = fs.readFileSync(collectionPath, "utf8");

  assert.ok(listContent.includes('redirect("/")'));
  assert.ok(detailContent.includes('redirect("/")'));
  assert.ok(collectionContent.includes('redirect("/")'));
});

test("public marketing pages do not link visitors to disabled templates routes", () => {
  const publicFiles = [
    path.join(process.cwd(), "app", "(marketing)", "_components", "MarketingNav.tsx"),
    path.join(process.cwd(), "app", "(marketing)", "_components", "MarketingFooter.tsx"),
    path.join(process.cwd(), "app", "(marketing)", "page.tsx"),
    path.join(process.cwd(), "app", "(marketing)", "school", "page.tsx"),
    path.join(process.cwd(), "app", "(marketing)", "school", "adoption-readiness", "page.tsx"),
    path.join(process.cwd(), "app", "(marketing)", "pricing", "page.tsx"),
    path.join(process.cwd(), "app", "(marketing)", "contact", "page.tsx"),
  ];

  for (const filePath of publicFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.ok(!source.includes('href="/templates"'), `${filePath} must not link to /templates while it redirects home`);
    assert.ok(!source.includes('href="/templates/'), `${filePath} must not link to disabled templates subroutes`);
    assert.ok(!source.includes("github.com/gkrry"), `${filePath} must not link to private GitHub docs`);
  }
});
