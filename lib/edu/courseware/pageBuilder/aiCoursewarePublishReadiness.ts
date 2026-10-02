import { isKnownBlockType, normalizeText, normalizeUrl, sanitizeDraft } from "./aiCoursewarePageSanitizer";
import type { CoursewarePageDraft } from "./aiCoursewarePageTypes";

export type CoursewarePublishReadinessCheck = { id: string; labelKo: string; status: "pass" | "warning" | "fail"; messageKo: string; severity: "info" | "warning" | "blocking" };
export type CoursewarePublishReadiness = { status: "ready" | "needs-attention" | "blocked"; checks: CoursewarePublishReadinessCheck[] };
type ReadinessSource = Record<string, unknown> & { blocks?: unknown[] };
type BlockWithOptionalFields = Record<string, unknown> & { url?: unknown; primaryButtonUrl?: unknown; sources?: unknown[]; imageUrl?: unknown; headlineKo?: unknown };
const isReadinessSource = (value: unknown): value is ReadinessSource => Boolean(value) && typeof value === "object";
const asBlockWithOptionalFields = (value: unknown): BlockWithOptionalFields =>
  (isReadinessSource(value) ? value : {}) as BlockWithOptionalFields;

const hasScriptLikeText = (value: string) => /<\s*script|javascript:|onerror\s*=|onload\s*=/i.test(value);

export function evaluatePublishReadiness(rawDraft: unknown, options?: { privacyAcknowledged?: boolean }): CoursewarePublishReadiness {
  const draft = sanitizeDraft(rawDraft);
  const rawDraftSource: ReadinessSource = isReadinessSource(rawDraft) ? rawDraft : {};
  if (!draft) return { status: "blocked", checks: [{ id: "draft-corrupt", labelKo: "초안 무결성", status: "fail", messageKo: "페이지 초안이 손상되어 발표 화면을 열 수 없어요.", severity: "blocking" }] };

  const content = draft.blocks.map((b) => JSON.stringify(b)).join("\n");
  const hasHero = draft.blocks.some((b) => b.type === "hero" && normalizeText(asBlockWithOptionalFields(b).headlineKo));
  const unsupportedRaw = (rawDraftSource.blocks ?? []).filter((b) => !isKnownBlockType((b as { type?: unknown })?.type));
  const hasUnsupported = unsupportedRaw.length > 0;
  const hasUnsafeUrl = /https:\/\/local\.invalid/.test(content) || draft.blocks.some((b) => {
    const block = asBlockWithOptionalFields(b);
    const urls = [block.url, block.primaryButtonUrl, ...((block.sources ?? []).map((s) => (s as { url?: unknown })?.url)), block.imageUrl];
    return urls.some((u) => String(u ?? "").trim() && !normalizeUrl(u));
  });
  const hasScriptLike = hasScriptLikeText(content);
  const hasSource = draft.blocks.some((b) => b.type === "source-list" && ((asBlockWithOptionalFields(b).sources ?? []).length > 0 || /출처 없음|직접 작성/.test(JSON.stringify(b))));
  const hasReflection = draft.blocks.some((b) => b.type === "reflection");
  const isVeryShort = normalizeText(draft.titleKo).length < 2 || content.length < 80;
  const hasContent = draft.blocks.length > 0;

  const checks: CoursewarePublishReadinessCheck[] = [
    { id: "title-hero", labelKo: "제목/히어로", status: hasHero || normalizeText(draft.titleKo).length > 0 ? "pass" : "fail", messageKo: hasHero ? "제목과 도입이 확인됐어요." : "제목 또는 히어로 블록을 추가해 주세요.", severity: hasHero || normalizeText(draft.titleKo).length > 0 ? "info" : "blocking" },
    { id: "has-content", labelKo: "콘텐츠 블록", status: hasContent ? "pass" : "fail", messageKo: hasContent ? "콘텐츠가 있어요." : "비어 있는 페이지는 발표할 수 없어요.", severity: hasContent ? "info" : "blocking" },
    { id: "unsupported", labelKo: "지원 블록 점검", status: hasUnsupported ? "fail" : "pass", messageKo: hasUnsupported ? "지원하지 않는 블록이 있어 발표 화면에서 숨겨집니다." : "지원 블록만 사용했어요.", severity: hasUnsupported ? "blocking" : "info" },
    { id: "unsafe-url", labelKo: "URL 안전성", status: hasUnsafeUrl ? "fail" : "pass", messageKo: hasUnsafeUrl ? "안전하지 않은 URL이 있어요." : "링크가 안전 규칙을 통과했어요.", severity: hasUnsafeUrl ? "blocking" : "info" },
    { id: "privacy", labelKo: "개인정보 점검", status: options?.privacyAcknowledged ? "pass" : "warning", messageKo: options?.privacyAcknowledged ? "개인정보 비공개 확인 완료." : "개인정보가 없는지 마지막으로 확인해 주세요.", severity: options?.privacyAcknowledged ? "info" : "warning" },
    { id: "sources", labelKo: "출처 표기", status: hasSource ? "pass" : "warning", messageKo: hasSource ? "출처 표기가 있어요." : "출처 없음/직접 작성 또는 출처 목록을 추가해 주세요.", severity: hasSource ? "info" : "warning" },
    { id: "script-like", labelKo: "스크립트 유사 내용", status: hasScriptLike ? "fail" : "pass", messageKo: hasScriptLike ? "스크립트처럼 보이는 내용이 감지됐어요." : "스크립트 유사 내용이 없어요.", severity: hasScriptLike ? "blocking" : "info" },
    { id: "reflection", labelKo: "AI 활용/회고", status: hasReflection ? "pass" : "warning", messageKo: hasReflection ? "회고 블록이 있어요." : "발표를 위해 배운 점 회고를 권장해요.", severity: hasReflection ? "info" : "warning" },
    { id: "length", labelKo: "내용 길이", status: isVeryShort ? "warning" : "pass", messageKo: isVeryShort ? "내용이 매우 짧아요. 문제·결과·배운 점을 조금 더 적어보세요." : "발표용 길이가 충분해요.", severity: isVeryShort ? "warning" : "info" },
  ];

  const hasBlocking = checks.some((c) => c.severity === "blocking" && c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warning");
  return { status: hasBlocking ? "blocked" : hasWarning ? "needs-attention" : "ready", checks };
}

export const summarizeDraftForPresentation = (draft: CoursewarePageDraft) => `${draft.lessonNumber}차시 · ${draft.titleKo}\n블록 ${draft.blocks.length}개 · 안전한 발표 모드`;
