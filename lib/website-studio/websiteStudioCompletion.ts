import { isSafeWebsiteStudioUrl } from "@/lib/website-studio/websiteStudioUrlSafety";
import type { WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

export type WebsiteStudioCompletion = {
  hasHeroTitle: boolean;
  hasIntroText: boolean;
  hasAtLeastThreeCards: boolean;
  hasQuizQuestion: boolean;
  hasSafeLink: boolean;
  hasFooterText: boolean;
  hasNoUnsafeUrls: boolean;
  hasPreviewableHtml: boolean;
  hasNoScriptOutput: boolean;
};

const nonEmpty = (s?: string) => Boolean(s && s.trim().length > 0);

export function getWebsiteStudioCompletion(project: WebsiteStudioProject): WebsiteStudioCompletion {
  const blocks = project.pages[0]?.blocks ?? [];
  const hero = blocks.find((b) => b.kind === "hero");
  const text = blocks.find((b) => b.kind === "text");
  const cardGrid = blocks.find((b) => b.kind === "cardGrid");
  const quiz = blocks.find((b) => b.kind === "quiz");
  const link = blocks.find((b) => b.kind === "linkButton");
  const footer = blocks.find((b) => b.kind === "footer");
  const hasUnsafe = blocks.some((b) => (b.buttonHref && !isSafeWebsiteStudioUrl(b.buttonHref)) || /javascript:/i.test(`${b.content ?? ""} ${b.title ?? ""}`));
  const joined = blocks.map((b) => `${b.title ?? ""} ${b.content ?? ""}`).join(" ").toLowerCase();
  return {
    hasHeroTitle: nonEmpty(hero?.title),
    hasIntroText: nonEmpty(text?.content) || nonEmpty(hero?.content),
    hasAtLeastThreeCards: (cardGrid?.items?.length ?? 0) >= 3,
    hasQuizQuestion: nonEmpty(quiz?.content),
    hasSafeLink: !link?.buttonHref || isSafeWebsiteStudioUrl(link.buttonHref),
    hasFooterText: nonEmpty(footer?.content),
    hasNoUnsafeUrls: !hasUnsafe,
    hasPreviewableHtml: blocks.length > 0,
    hasNoScriptOutput: !joined.includes("<script") && !joined.includes("onerror=") && !joined.includes("onload="),
  };
}

export function getWebsiteStudioCompletionPercent(project: WebsiteStudioProject) {
  const c = getWebsiteStudioCompletion(project);
  const values = Object.values(c);
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export function getWebsiteStudioNextStep(project: WebsiteStudioProject) {
  const c = getWebsiteStudioCompletion(project);
  if (!c.hasHeroTitle) return "제목 블록에서 웹사이트 제목을 먼저 작성해보세요.";
  if (!c.hasIntroText) return "소개 문장을 한 줄 추가해보세요.";
  if (!c.hasAtLeastThreeCards) return "카드 블록에 항목을 3개 이상 채워보세요.";
  if (!c.hasQuizQuestion && project.templateId.includes("quiz")) return "퀴즈 문제와 선택지를 채워보세요.";
  if (!c.hasSafeLink || !c.hasNoUnsafeUrls) return "안전한 외부 링크(https)만 사용하도록 점검해보세요.";
  if (!c.hasFooterText) return "마무리 문장을 footer에 작성해보세요.";
  return "좋아요! 미리보기에서 발표 전 최종 점검을 해보세요.";
}
