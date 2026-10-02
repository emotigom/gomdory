"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";

import { cn, surface } from "@/app/_components/uiTokens";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { TemplatePayload } from "@/lib/templates/sanitize";

type TemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  installCount: number;
  createdAt: string;
  accessLevel: "free" | "pro";
  isFeatured: boolean;
  featuredRank: number | null;
  gradeBand?: string | null;
  subject?: string | null;
};

type TemplateDetail = TemplateSummary & {
  payload: SanitizedTemplatePayload | TemplatePayload;
};

type TemplatePreviewModalProps = {
  template: TemplateDetail;
  onClose: () => void;
  onPrimary: () => void;
  onProjector?: () => void;
  onPreviewOnly?: () => void;
  onReport?: (templateId: string) => void;
  onUpgrade?: () => void;
  locked?: boolean;
  reportingId?: string | null;
  adminControls?: ReactNode;
};

function buildHighlights(template: TemplateDetail) {
  const highlights: string[] = [];
  if (template.gradeBand) {
    highlights.push(template.gradeBand === "elem" ? "초등 수업 집중" : template.gradeBand === "middle" ? "중등 최적화" : "혼합 학년 대응");
  }
  if (template.subject) {
    highlights.push(`${template.subject} 테마`);
  }
  if (template.tags.length > 0) {
    highlights.push(`${template.tags.slice(0, 2).map((tag) => `#${tag}`).join(" · ")}`);
  }
  highlights.push(`${template.installCount.toLocaleString()}명 사용 중`);
  return highlights.slice(0, 3);
}

const templateControlBase =
  "templates-control inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold";
const templatePrimaryCta = `${templateControlBase} templates-control-primary templates-control-indigo`;
const templateSecondaryCta = `${templateControlBase} templates-control-secondary`;
const templateLockedCta = `${templateControlBase} templates-control-locked cursor-pointer`;
const templateSmallSecondaryCta =
  "templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 text-xs font-semibold";

export function TemplatePreviewModal({
  template,
  onClose,
  onPrimary,
  onProjector,
  onPreviewOnly,
  onReport,
  onUpgrade,
  locked = false,
  reportingId,
  adminControls,
}: TemplatePreviewModalProps) {
  const payload = template.payload;
  const isV1Payload = (value: SanitizedTemplatePayload | TemplatePayload): value is TemplatePayload =>
    (value as TemplatePayload).kind === "board_template";
  const columnCount = isV1Payload(payload) ? payload.board.columns ?? 0 : payload?.walls?.length ?? 0;
  const cardCount = isV1Payload(payload) ? payload.board.cards.length : payload?.cards?.length ?? 0;
  const [showStructure, setShowStructure] = useState(false);

  const highlights = useMemo(() => buildHighlights(template), [template]);

  const actionButton = (
    label: string,
    onClick: () => void,
    options?: { tone?: "primary" | "secondary"; subtle?: boolean; requiresUnlock?: boolean },
  ) => {
    const tone = options?.tone ?? "primary";
    const requiresUnlock = options?.requiresUnlock ?? tone === "primary";
    const className = tone === "primary"
      ? locked
        ? templateLockedCta
        : templatePrimaryCta
      : templateSecondaryCta;

    return (
      <button
        type="button"
        data-interactive="true"
        aria-disabled={locked && requiresUnlock}
        onClick={() => (locked && requiresUnlock ? onUpgrade?.() : onClick())}
        className={cn(className, options?.subtle ? "h-full w-full justify-between" : "w-full justify-center", "min-h-[52px]")}
      >
        {label}
        {locked && requiresUnlock ? <span className="text-[11px] font-semibold text-slate-600">Pro 필요</span> : null}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" data-templates-interaction-scope>
      <div className={cn("w-full max-w-5xl space-y-5 p-6", surface.overlay)}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-indigo-600">템플릿 미리보기</p>
            <h3 className="text-3xl font-semibold text-slate-900">{template.title}</h3>
            {template.description ? <p className="text-base text-slate-700">{template.description}</p> : null}
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              {template.accessLevel === "pro" ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">🔒 PRO</span>
              ) : null}
              {template.gradeBand ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
                  {template.gradeBand === "elem" ? "초등" : template.gradeBand === "middle" ? "중등" : "혼합"}
                </span>
              ) : null}
              {template.subject ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-800">{template.subject}</span> : null}
              {template.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1">#{tag}</span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-interactive="true"
            className="templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-full border px-3 text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="relative h-64 overflow-hidden rounded-3xl bg-slate-100">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/40 via-indigo-300/30 to-indigo-500/30" aria-hidden />
            {template.coverUrl ? (
              <Image
                src={template.coverUrl}
                alt={`${template.title} 커버`}
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
              />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent p-4 text-white">
              <p className="text-sm font-semibold">{new Date(template.createdAt).toLocaleDateString("ko-KR")}</p>
              <p className="text-xs text-slate-100">{template.installCount.toLocaleString()}명이 사용 중</p>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">이 템플릿으로 무엇을 할 수 있나요?</p>
            <ul className="space-y-2 text-sm text-slate-800">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-3">
              {actionButton(locked ? "잠금 해제" : "내 보드로 가져오기", onPrimary, { tone: "primary", requiresUnlock: true })}
              {actionButton(
                locked ? "Pro에서 발표 흐름을 시작할 수 있어요." : "가져온 뒤 바로 발표를 시작할 수 있어요.",
                onProjector ?? onPrimary,
                { tone: "secondary", subtle: true, requiresUnlock: true },
              )}
              {actionButton("먼저 구성 요약 보기", () => {
                setShowStructure(true);
                onPreviewOnly?.();
              }, { tone: "secondary", subtle: true, requiresUnlock: false })}
            </div>
            {onReport ? (
              <button
                type="button"
                onClick={() => onReport(template.id)}
                data-interactive="true"
                disabled={reportingId === template.id}
                className="text-xs font-semibold text-rose-600 underline underline-offset-4"
              >
                {reportingId === template.id ? "신고 중..." : "문제 신고하기"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">구성 요약</p>
                <p className="text-sm text-slate-700">칸 {columnCount}개 · 카드 {cardCount}개</p>
              </div>
              {!showStructure ? (
                <button
                  type="button"
                  onClick={() => setShowStructure(true)}
                  data-interactive="true"
                  className={templateSmallSecondaryCta}
                >
                  열기
                </button>
              ) : null}
            </div>
            {showStructure ? (
              <div className="mt-3 space-y-2 text-sm text-slate-800">
                <p className="rounded-2xl bg-white px-3 py-2 text-slate-700">
                  보드 타입: {isV1Payload(payload) ? payload.board.layoutType ?? "기본" : payload.board.boardViewType ?? "기본"}
                </p>
                <p className="rounded-2xl bg-white px-3 py-2 text-slate-700">
                  레이아웃: {isV1Payload(payload) ? "자동" : payload.board.layout ?? "자동"}
                </p>
                <p className="rounded-2xl bg-white px-3 py-2 text-slate-700">
                  테마: {isV1Payload(payload) ? "기본" : payload.board.theme ?? "기본"}
                </p>
                <div className="rounded-2xl bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">샘플 카드</p>
                  {(isV1Payload(payload) ? payload.board.cards.length : payload.cards.length) === 0 ? (
                    <p className="text-sm text-slate-700">카드가 아직 없습니다.</p>
                  ) : (
                    <ul className="mt-2 grid gap-2 md:grid-cols-2">
                      {(isV1Payload(payload) ? payload.board.cards : payload.cards).slice(0, 4).map((card, index) => (
                        <li
                          key={`${"kind" in card ? card.kind : "type" in card ? card.type : "card"}-${index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                        >
                          {"kind" in card && card.kind === "text"
                            ? card.text
                            : "type" in card && card.type === "text"
                              ? card.text
                              : "attachment" in card
                                ? card.attachment.filename
                                : "첨부 자료"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">테마 (예정)</p>
            <p className="text-sm text-slate-800">곧 Pro에서 캐릭터와 교실 테마를 추가로 제공할게요.</p>
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              테마 팩은 다음 업데이트에서 만나보세요.
            </div>
          </div>
        </div>

        {adminControls ? (
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
            {adminControls}
          </div>
        ) : null}
      </div>
    </div>
  );
}
