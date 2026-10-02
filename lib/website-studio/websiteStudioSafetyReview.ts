import { getWebsiteStudioCompletionPercent } from "@/lib/website-studio/websiteStudioCompletion";
import { renderWebsiteProjectToCss, renderWebsiteProjectToDocument, renderWebsiteProjectToHtml } from "@/lib/website-studio/websiteStudioRenderer";
import type { WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";
import { isSafeWebsiteStudioUrl } from "@/lib/website-studio/websiteStudioUrlSafety";

export type WebsiteStudioSafetySeverity = "pass" | "warning" | "blocker";
export type WebsiteStudioSafetyCheck = { id: string; label: string; severity: WebsiteStudioSafetySeverity; passed: boolean; message: string; recommendation: string };
export type WebsiteStudioExportSnapshot = { html: string; css: string; document: string };
export type WebsiteStudioSafetyReview = { completionPercent: number; checks: WebsiteStudioSafetyCheck[]; snapshot: WebsiteStudioExportSnapshot };

const nonEmpty = (v?: string) => Boolean(v?.trim());
const banned = ["<script", "<iframe", "onclick=", "onerror=", "javascript:", "data:", "vbscript:"];
const meaningful = (v?: string) => (v ?? "").trim().length >= 2;

function check(id: string, label: string, passed: boolean, blockerMessage: string, recommendation: string, warning = false): WebsiteStudioSafetyCheck {
  return { id, label, passed, severity: passed ? "pass" : warning ? "warning" : "blocker", message: passed ? "점검 통과" : blockerMessage, recommendation };
}

function collectText(project: WebsiteStudioProject): string {
  return project.pages.flatMap((p) => p.blocks).map((b) => `${b.title ?? ""} ${b.content ?? ""} ${b.buttonLabel ?? ""} ${b.buttonHref ?? ""} ${b.imageAlt ?? ""} ${(b.items ?? []).map((i) => `${i.title} ${i.description}`).join(" ")}`).join("\n");
}

export function getWebsiteStudioExportSnapshot(project: WebsiteStudioProject): WebsiteStudioExportSnapshot {
  const html = renderWebsiteProjectToHtml(project);
  const css = renderWebsiteProjectToCss();
  const document = renderWebsiteProjectToDocument(project);
  return { html, css, document };
}

export function getWebsiteStudioSafetyReview(project: WebsiteStudioProject): WebsiteStudioSafetyReview {
  const blocks = project.pages[0]?.blocks ?? [];
  const hero = blocks.find((b) => b.kind === "hero");
  const text = blocks.find((b) => b.kind === "text");
  const footer = blocks.find((b) => b.kind === "footer");
  const quiz = blocks.find((b) => b.kind === "quiz");
  const cardGrid = blocks.find((b) => b.kind === "cardGrid");
  const linkBlocks = blocks.filter((b) => b.kind === "linkButton");
  const snapshot = getWebsiteStudioExportSnapshot(project);
  const joined = `${snapshot.html}\n${snapshot.document}`.toLowerCase();
  const content = collectText(project);
  const completionPercent = getWebsiteStudioCompletionPercent(project);

  const unsafeLinks = linkBlocks.some((b) => b.buttonHref && !isSafeWebsiteStudioUrl(b.buttonHref));
  const hasBannedOutput = banned.some((item) => joined.includes(item));
  const imageWarnings = blocks.some((b) => b.kind === "image" && !nonEmpty(b.imageAlt));
  const hasPrivacy = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(content)
    || /(?:\+?82[-\s]?)?0?1[0-9][-\s]?\d{3,4}[-\s]?\d{4}/.test(content)
    || /\d{6}[-\s]?[1-4]\d{6}/.test(content)
    || /(이름\s*:|주소\s*:)/.test(content);

  const quizComplete = !quiz || (nonEmpty(quiz.content) && (quiz.items?.length ?? 0) >= 2);
  const cardsComplete = !cardGrid || (cardGrid.items?.filter((i) => meaningful(i.title) || meaningful(i.description)).length ?? 0) >= 3;

  const checks: WebsiteStudioSafetyCheck[] = [
    check("title", "프로젝트 제목 점검", nonEmpty(project.title), "프로젝트 제목이 비어 있습니다.", "프로젝트 제목을 입력해주세요."),
    check("hero", "히어로 제목 점검", nonEmpty(hero?.title), "대표 제목이 비어 있습니다.", "hero 블록 제목을 채워주세요."),
    check("intro", "소개 문구 점검", nonEmpty(text?.content) || nonEmpty(hero?.content), "소개 문구가 비어 있습니다.", "소개 문장을 추가해주세요."),
    check("footer", "푸터 문구 점검", nonEmpty(footer?.content), "마무리 문구가 비어 있습니다.", "footer 문장을 작성해주세요."),
    check("unsafe-url", "안전하지 않은 URL 여부", !unsafeLinks, "안전하지 않은 URL이 있습니다.", "https 또는 내부 경로 링크만 사용하세요."),
    check("forbidden-tags", "금지 태그/스크립트 점검", !hasBannedOutput, "금지된 태그/스크립트 문자열이 감지되었습니다.", "script/iframe/이벤트 핸들러/javascript:data URL을 제거하세요."),
    check("previewable", "미리보기 생성 가능 여부", Boolean(snapshot.document.trim()), "미리보기를 생성할 수 없습니다.", "블록 내용을 먼저 채워주세요."),
    check("quiz", "퀴즈 블록 완성 여부", quizComplete, "퀴즈 문제/선택지가 부족합니다.", "퀴즈 질문과 선택지를 채워주세요."),
    check("card-grid", "카드 블록 완성 여부", cardsComplete, "카드 항목이 부족합니다.", "의미 있는 카드 3개 이상을 입력하세요."),
    check("privacy", "개인정보 점검", !hasPrivacy, "개인정보로 보일 수 있는 표현이 감지되었습니다.", "개인정보가 보이면 직접 수정해주세요.", true),
    check("image-placeholder", "이미지 자리 점검", !imageWarnings, "이미지 대체 텍스트가 비어 있습니다.", "이미지 설명 문구를 넣어주세요.", true),
  ];

  return { completionPercent, checks, snapshot };
}

export function getWebsiteStudioReviewStatus(project: WebsiteStudioProject): "ready" | "needs-review" | "blocked" {
  const review = getWebsiteStudioSafetyReview(project);
  if (review.checks.some((c) => c.severity === "blocker" && !c.passed)) return "blocked";
  if (review.completionPercent >= 80 && review.checks.every((c) => c.passed || c.severity === "warning")) return "ready";
  return "needs-review";
}
