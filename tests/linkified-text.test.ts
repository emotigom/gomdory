import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { linkifyPlainText } from "../lib/urlLinkify";

const linksFrom = (text: string) =>
  linkifyPlainText(text).filter(
    (segment): segment is { type: "link"; text: string; href: string } => segment.type === "link",
  );

test("linkifyPlainText turns https and http URLs into safe link segments", () => {
  const links = linksFrom("참고 https://example.com/path 그리고 http://example.org/a");
  assert.equal(links.length, 2);
  assert.deepEqual(
    links.map((link) => link.href),
    ["https://example.com/path", "http://example.org/a"],
  );
});

test("linkifyPlainText normalizes www URLs to https hrefs", () => {
  const [link] = linksFrom("www.example.com/docs");
  assert.equal(link?.text, "www.example.com/docs");
  assert.equal(link?.href, "https://www.example.com/docs");
});

test("linkifyPlainText preserves query strings, hashes, multiple URLs, and excludes trailing punctuation", () => {
  const segments = linkifyPlainText(
    "참고: https://www.gomdory.com/dashboard/websites/new?boardId=abc&source=edu-course#top. 다음 https://example.com/a,b!",
  );
  const links = segments.filter(
    (segment): segment is { type: "link"; text: string; href: string } => segment.type === "link",
  );
  assert.equal(links.length, 2);
  assert.equal(
    links[0]?.href,
    "https://www.gomdory.com/dashboard/websites/new?boardId=abc&source=edu-course#top",
  );
  assert.equal(links[1]?.href, "https://example.com/a,b");
  assert.equal(segments.some((segment) => segment.type === "text" && segment.text.includes(".")), true);
  assert.equal(segments.some((segment) => segment.type === "text" && segment.text.includes("!")), true);
});

test("linkifyPlainText preserves newlines as text for the renderer", () => {
  const segments = linkifyPlainText("첫 줄\nhttps://example.com\n마지막 줄");
  assert.equal(segments.some((segment) => segment.type === "text" && segment.text.includes("\n")), true);
  assert.equal(segments.filter((segment) => segment.type === "link").length, 1);
});

test("linkifyPlainText does not linkify unsafe schemes", () => {
  assert.equal(linksFrom("javascript:alert(1)").length, 0);
  assert.equal(linksFrom("data:text/html,hello").length, 0);
  assert.equal(linksFrom("vbscript:msgbox(1)").length, 0);
  assert.equal(linksFrom("file:///etc/passwd").length, 0);
  assert.equal(linksFrom("chrome://settings").length, 0);
});

test("LinkifiedText renders new-tab anchors with overflow-safe classes and no innerHTML", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "_components", "LinkifiedText.tsx"), "utf8");
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.match(source, /break-words/);
  assert.match(source, /새 창에서 열기/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("owner and public board card renderers use LinkifiedText", () => {
  const owner = fs.readFileSync(
    path.join(process.cwd(), "app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx"),
    "utf8",
  );
  const sharedWallColumn = fs.readFileSync(path.join(process.cwd(), "app", "_components", "WallColumn.tsx"), "utf8");
  const collapsible = fs.readFileSync(path.join(process.cwd(), "app", "_components", "CollapsibleCardText.tsx"), "utf8");
  const publicCardTile = fs.readFileSync(path.join(process.cwd(), "app", "s", "[code]", "_components", "CardTile.tsx"), "utf8");

  assert.match(owner, /<LinkifiedText[\s\S]*text=\{card\.text\}/);
  assert.match(sharedWallColumn, /<CollapsibleCardText[\s\S]*text=\{card\.text/);
  assert.match(collapsible, /<LinkifiedText[\s\S]*text=\{displayText\}/);
  assert.match(publicCardTile, /<LinkifiedText[\s\S]*text=\{body\}/);
});

test("linkifyPlainText displays placeholder markdown labels as the actual URL", () => {
  const [link] = linksFrom("참고 [링크](https://example.com/a)");
  assert.equal(link?.text, "https://example.com/a");
  assert.equal(link?.href, "https://example.com/a");
});

test("linkifyPlainText preserves meaningful markdown link labels", () => {
  const [link] = linksFrom("참고 [자료 보기](https://example.com/a)");
  assert.equal(link?.text, "자료 보기");
  assert.equal(link?.href, "https://example.com/a");
});

test("linkifyPlainText keeps unsafe markdown links as plain text", () => {
  const segments = linkifyPlainText("참고 [링크](javascript:alert(1))");
  assert.equal(segments.filter((segment) => segment.type === "link").length, 0);
  assert.equal(segments.some((segment) => segment.type === "text" && segment.text.includes("[링크]")), true);
});
