import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ensureRequiredRefs, normalizeFiles } from "@/lib/edu/fileProtocol";

const ALLOWED_FILES = ["index.html", "style.css", "script.js"] as const;
const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, "\n");

test("webllm files payload applies required refs (school/grade/interests cards)", () => {
  const files = {
    "index.html": `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>학교/학년/관심사 소개</title>
</head>
<body>
  <main class="profile-page">
    <header>
      <h1>학교/학년/관심사 소개</h1>
      <p>우리 학교와 학년, 관심사를 소개해요.</p>
    </header>
    <section class="profile-cards">
      <article class="profile-card">
        <h2>학교</h2>
        <p>햇살중학교</p>
      </article>
      <article class="profile-card">
        <h2>학년</h2>
        <p>2학년</p>
      </article>
      <article class="profile-card">
        <h2>관심사</h2>
        <p>환경 보호, 로봇 만들기, 그림 그리기</p>
      </article>
    </section>
  </main>
</body>
</html>`,
    "style.css": "body { font-family: 'Pretendard', sans-serif; }",
    "script.js": "document.querySelectorAll('.profile-card');",
  };

  const normalized = normalizeFiles(files, { allowedFilenames: [...ALLOWED_FILES] });
  const fixed = ensureRequiredRefs(normalized);
  const snapshotPath = path.join(
    process.cwd(),
    "tests",
    "__snapshots__",
    "edu-webllm-files-apply.html",
  );
  const snapshot = fs.readFileSync(snapshotPath, "utf8").trim();

  assert.equal(normalizeLineEndings(fixed.files["index.html"].content.trim()), normalizeLineEndings(snapshot));
});
