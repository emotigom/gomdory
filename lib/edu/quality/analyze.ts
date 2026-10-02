import { getLessonIdFromNumber, getLessonSpec } from "@/lib/edu/lesson/lessonLock";

export type QualityFixSuggestion = {
  type: "addTitle" | "addH1" | "ensureTwoSections" | "ensureAccentCss";
  label: string;
};

export type QualityCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
  fix?: QualityFixSuggestion;
};

export type QualityResult = {
  score: number;
  checks: QualityCheck[];
};

const personalKeywords = [
  "이름",
  "취미",
  "좋아하는",
  "favorite",
  "hobby",
  "my name",
  "소개",
  "관심",
  "나의",
  "저는",
  "나는",
  "i am",
  "i love",
];

const countMatches = (value: string, pattern: RegExp) => {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
};

const stripTags = (value: string) => value.replace(/<[^>]+>/g, " ");

const extractInlineStyles = (html: string) => {
  const styles: string[] = [];
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match = regex.exec(html);
  while (match) {
    styles.push(match[1] ?? "");
    match = regex.exec(html);
  }
  return styles;
};

const tryParseHtml = (html: string) => {
  if (typeof DOMParser === "undefined") return null;
  try {
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  } catch {
    return null;
  }
};

const hasPersonalKeyword = (text: string) => {
  const normalized = text.toLowerCase();
  return personalKeywords.some((keyword) => normalized.includes(keyword));
};

export const analyzeFiles = (lessonId: number, files: Record<string, string>): QualityResult => {
  const html = files["index.html"] ?? "";
  const css = files["style.css"] ?? "";
  const doc = tryParseHtml(html);

  const titleText = doc?.querySelector("title")?.textContent?.trim() ?? "";
  const h1Count = doc ? doc.querySelectorAll("h1").length : countMatches(html, /<h1\b/gi);
  const sectionCount = doc ? doc.querySelectorAll("section").length : countMatches(html, /<section\b/gi);
  const headingCount = doc
    ? doc.querySelectorAll("h1, h2, h3").length
    : countMatches(html, /<(h1|h2|h3)\b/gi);
  const imgCount = doc ? doc.querySelectorAll("img").length : countMatches(html, /<img\b/gi);

  const inlineStyles = doc
    ? Array.from(doc.querySelectorAll("style")).map((style) => style.textContent ?? "")
    : extractInlineStyles(html);
  const combinedCss = [css, ...inlineStyles].join("\n");
  const hasAccentCss = /--accent\b/i.test(combinedCss) || /background-color\s*:/i.test(combinedCss) || /color\s*:/i.test(combinedCss);

  const textContent = doc?.body?.textContent ?? stripTags(html);
  const hasPersonalInfo = hasPersonalKeyword(textContent);
  const normalizedText = textContent.toLowerCase();

  const lessonSpecId = getLessonIdFromNumber(lessonId);
  const lessonSpec = lessonSpecId ? getLessonSpec(lessonSpecId) : null;
  const mustInclude = lessonSpec?.mustInclude ?? [];
  const rawMustAvoid = lessonSpec?.mustAvoid ?? [];
  const mustAvoid = rawMustAvoid.flatMap((token) =>
    token
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  const missingTokens = mustInclude.filter((token) => !normalizedText.includes(token.toLowerCase()));
  const presentAvoidTokens = mustAvoid.filter((token) => normalizedText.includes(token.toLowerCase()));

  const checks: QualityCheck[] = [
    {
      key: "title",
      label: "페이지 제목이 있어요",
      ok: titleText.length > 0,
      detail: titleText.length > 0 ? undefined : "브라우저 탭 제목을 넣어주세요.",
      fix: { type: "addTitle", label: "제목 자동 추가" },
    },
    {
      key: "h1",
      label: "대표 제목(H1)이 있어요",
      ok: h1Count > 0,
      detail: h1Count > 0 ? undefined : "작품을 소개하는 큰 제목이 필요해요.",
      fix: { type: "addH1", label: "H1 자동 추가" },
    },
    {
      key: "sections",
      label: "내용 섹션이 2개 이상이에요",
      ok: sectionCount >= 2 || headingCount >= 2,
      detail: sectionCount >= 2 || headingCount >= 2 ? undefined : "소개/특징처럼 두 덩어리로 나눠주세요.",
      fix: { type: "ensureTwoSections", label: "섹션 자동 추가" },
    },
    {
      key: "personal",
      label: "나만의 정보가 보이네요",
      ok: hasPersonalInfo,
      detail: hasPersonalInfo ? undefined : "이름, 취미, 좋아하는 것 한 가지를 적어보세요.",
    },
    ...(lessonSpec
      ? [
          {
            key: "lesson-must-include",
            label: "수업 주제 핵심 요소가 들어 있어요",
            ok: missingTokens.length === 0,
            detail:
              missingTokens.length === 0
                ? undefined
                : `빠진 항목: ${missingTokens.join(", ")}`,
          },
          {
            key: "lesson-must-avoid",
            label: "수업과 맞지 않는 요소가 없어요",
            ok: presentAvoidTokens.length === 0,
            detail:
              presentAvoidTokens.length === 0
                ? undefined
                : `피해야 할 표현: ${presentAvoidTokens.join(", ")}`,
          },
        ]
      : []),
    {
      key: "colors",
      label: "기본 색상이 지정되어 있어요",
      ok: hasAccentCss,
      detail: hasAccentCss ? undefined : "accent 컬러나 배경/글자 색상을 추가해보세요.",
      fix: { type: "ensureAccentCss", label: "색상 자동 추가" },
    },
    {
      key: "image",
      label: "이미지가 포함되어 있어요 (선택)",
      ok: imgCount > 0,
      detail: imgCount > 0 ? undefined : "이미지를 추가하면 더 풍부해져요.",
    },
  ];

  const requiredChecks = checks.filter((check) => check.key !== "image");
  const requiredOk = requiredChecks.filter((check) => check.ok).length;
  const score = requiredChecks.length === 0 ? 100 : Math.round((requiredOk / requiredChecks.length) * 100);

  return { score, checks };
};
