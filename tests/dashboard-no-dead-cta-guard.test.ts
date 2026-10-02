import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const dashboardRoot = path.join(process.cwd(), "app", "dashboard");

const CTA_KEYWORDS = [
  "시작",
  "생성",
  "추가",
  "열기",
  "이동",
  "보기",
  "관리",
  "설정",
  "삭제",
  "복사",
  "공유",
  "업그레이드",
  "구매",
  "실행",
  "저장",
  "다운로드",
  "선택",
  "확인",
  "완료",
  "편집",
  "복제",
  "체험",
  "참여",
  "적용",
];

const walk = (dir: string, acc: string[] = []): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, acc);
      continue;
    }
    if (/\.(tsx|jsx)$/.test(entry.name)) {
      acc.push(abs);
    }
  }
  return acc;
};

const normalizeLabel = (inner: string): string =>
  inner
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasKorean = (text: string) => /[가-힣]/.test(text);

const looksLikeCta = (text: string) => CTA_KEYWORDS.some((keyword) => text.includes(keyword));

const hasAction = (tag: string, attrs: string): boolean => {
  if (/\bonClick\s*=/.test(attrs)) return true;
  if (tag === "a") return /\bhref\s*=/.test(attrs);
  if (/\bformAction\s*=/.test(attrs)) return true;
  if (/\btype\s*=\s*"submit"/.test(attrs) || /\btype\s*=\s*'submit'/.test(attrs)) return true;
  if (/\btype\s*=\s*"button"/.test(attrs) || /\btype\s*=\s*'button'/.test(attrs)) return false;
  return true;
};

const isDisabled = (attrs: string) => /\bdisabled\b/.test(attrs);

const looksLikeBrokenCapture = (label: string) => /className=|onClick|href=|=>/.test(label);

const findDeadCtas = (source: string, relPath: string): string[] => {
  const offenders: string[] = [];
  const re = /<(button|a)(?=\s|>)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(source))) {
    const [raw, tag, attrs, inner] = match;
    const label = normalizeLabel(inner);
    if (!label || !hasKorean(label) || !looksLikeCta(label) || looksLikeBrokenCapture(label)) continue;

    if (hasAction(tag, attrs) || isDisabled(attrs)) continue;

    const line = source.slice(0, match.index).split("\n").length;
    offenders.push(`${relPath}:${line} <${tag}> ${label}`);
  }
  return offenders;
};

test("dashboard CTAs are actionable or clearly marked as 준비 중", () => {
  const offenders: string[] = [];

  for (const file of walk(dashboardRoot)) {
    const rel = path.relative(process.cwd(), file);
    const source = fs.readFileSync(file, "utf8");
    offenders.push(...findDeadCtas(source, rel));
  }

  assert.equal(
    offenders.length,
    0,
    `Found dead dashboard CTAs. Wire them to an action or disable with \"준비 중\".\n${offenders.join("\n")}`,
  );
});

test("dashboard dead CTA scanner respects HTML tag-name boundaries", () => {
  assert.deepEqual(findDeadCtas('<a href={url}>문서 열기</a>', "fixture.tsx"), []);
  assert.deepEqual(
    findDeadCtas(
      `<a
  href={url}
  target="_blank"
  rel="noreferrer"
>
  외부 작품 열기
</a>`,
      "fixture.tsx",
    ),
    [],
  );
  assert.deepEqual(
    findDeadCtas('<audio controls src={audioUrl} />\n<a href={documentUrl}>문서 열기</a>', "fixture.tsx"),
    [],
  );
  assert.deepEqual(
    findDeadCtas('<aside>\n  <a href={downloadUrl}>열기/다운로드</a>\n</aside>', "fixture.tsx"),
    [],
  );
  assert.deepEqual(findDeadCtas('<a>문서 열기</a>', "fixture.tsx"), ["fixture.tsx:1 <a> 문서 열기"]);
  assert.deepEqual(
    findDeadCtas('<button type="button">외부 작품 열기</button>', "fixture.tsx"),
    ["fixture.tsx:1 <button> 외부 작품 열기"],
  );
  assert.deepEqual(
    findDeadCtas('<button type="button" disabled>\n  준비 중\n</button>', "fixture.tsx"),
    [],
  );
});
