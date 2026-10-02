"use client";

import { useState } from "react";
import Image from "next/image";

import { cn, surface } from "@/app/_components/uiTokens";
import { TemplatePreviewModal } from "@/components/templates/TemplatePreviewModal";
import { TemplateUpsellModal } from "@/components/templates/TemplateUpsellModal";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { TemplatePayload } from "@/lib/templates/sanitize";
import { routes } from "@/lib/standards/routes";

type TemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  installCount: number;
  createdAt: string;
  tier: "free" | "pro";
  source: "community" | "official";
  accessLevel: "free" | "pro";
  isFeatured: boolean;
  featuredRank: number | null;
  gradeBand?: string | null;
  subject?: string | null;
  collection?: { slug: string; title: string; tier: "free" | "pro" } | null;
};

type TemplateDetail = TemplateSummary & {
  payload: SanitizedTemplatePayload | TemplatePayload;
};

type TemplateDetailClientProps = {
  template: TemplateDetail;
  sourceLabel: string;
  sourceKind: "community" | "picks" | "pro_pack";
  locked: boolean;
};

const templateControlBase =
  "templates-control inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold";
const templatePrimaryCta = `${templateControlBase} templates-control-primary templates-control-indigo`;
const templateSecondaryCta = `${templateControlBase} templates-control-secondary`;
const templateLockedCta = `${templateControlBase} templates-control-locked cursor-pointer`;

export function TemplateDetailClient({ template, sourceLabel, sourceKind, locked }: TemplateDetailClientProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const handleImport = async () => {
    if (locked) {
      setUpsellOpen(true);
      return;
    }
    setInstalling(true);
    setMessage(null);
    try {
      const response = await fetch(routes.api.templates.copy(template.id), {
        method: "POST",
        body: JSON.stringify({ source: sourceKind, collectionSlug: template.collection?.slug ?? null }),
      });
      const payload = (await response.json()) as { ok?: boolean; boardId?: string };
      if (response.status === 401) {
        window.location.href = `/auth/login?redirect=/templates/${template.id}`;
        return;
      }
      if (payload.ok && payload.boardId) {
        window.location.href = `/dashboard/boards/${payload.boardId}/board`;
        return;
      }
      setMessage("가져오기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } catch (error) {
      console.error(error);
      setMessage("가져오기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setInstalling(false);
    }
  };

  const handleReport = async () => {
    setReporting(true);
    setMessage(null);
    try {
      const response = await fetch(routes.api.templates.report(template.id), {
        method: "POST",
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      const payload = (await response.json()) as { ok?: boolean; hidden?: boolean; error?: { message?: string } };
      if (payload.ok) {
        setMessage(payload.hidden ? "신고 누적으로 숨김 처리되었습니다." : "신고가 접수되었습니다.");
        setReportOpen(false);
        setReportDetails("");
      } else {
        setMessage(payload.error?.message ?? "신고 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (error) {
      console.error(error);
      setMessage("신고 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="space-y-8" data-templates-interaction-scope>
      {template.accessLevel === "pro" ? (
        <section className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-amber-700">Pro Pack</p>
              <h2 className="text-2xl font-bold text-slate-900">완성형 템플릿으로 수업을 정돈하세요</h2>
            </div>
            <button
              type="button"
              onClick={() => setUpsellOpen(true)}
              className={templatePrimaryCta}
            >
              잠금 해제
            </button>
          </div>
          <ul className="space-y-2 text-sm text-slate-800">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              수업 준비 시간을 크게 단축
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              TV 최적 레이아웃과 검증된 진행 흐름
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              Pro 저장소 · 최적화 · 파일 관리 혜택 포함
            </li>
          </ul>
        </section>
      ) : null}
      <header className={cn("space-y-4 p-6", surface.card)}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className={cn("rounded-full px-3 py-1", sourceKind === "pro_pack" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700")}>
            {sourceLabel}
          </span>
          {template.accessLevel === "pro" ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">🔒 PRO</span>
          ) : null}
          {template.isFeatured ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">추천</span>
          ) : null}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">{template.title}</h1>
          {template.description ? <p className="text-base text-slate-700">{template.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
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
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={cn("relative min-h-[320px] overflow-hidden", surface.card)}>
          {template.coverUrl ? (
            <Image
              src={template.coverUrl}
              alt={`${template.title} 커버`}
              fill
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">커버 이미지가 준비되지 않았습니다.</div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4 text-white">
            <p className="text-sm font-semibold">{new Date(template.createdAt).toLocaleDateString("ko-KR")}</p>
            <p className="text-xs text-slate-100">{template.installCount.toLocaleString()}명이 사용 중</p>
          </div>
        </div>

        <div className={cn("space-y-4 p-6", surface.card)}>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">체험</p>
            <p className="text-sm text-slate-700">미리보기로 살펴보고 수업에 맞는 구성인지 확인하세요.</p>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className={templateSecondaryCta}
            >
              미리보기로 살펴보기
            </button>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-500">가져오기</p>
            <button
              type="button"
              onClick={handleImport}
              disabled={installing}
              className={cn(
                locked
                  ? templateLockedCta
                  : templatePrimaryCta,
                installing ? "opacity-70" : "",
              )}
            >
              {locked ? "잠금 해제" : installing ? "복제 중..." : "복제"}
            </button>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-500">문제 신고</p>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 text-xs font-semibold"
            >
              템플릿 신고하기
            </button>
          </div>
          {message ? <p className="text-xs font-semibold text-rose-600">{message}</p> : null}
        </div>
      </div>

      {previewOpen ? (
        <TemplatePreviewModal
          template={template}
          locked={locked}
          onClose={() => setPreviewOpen(false)}
          onPrimary={handleImport}
          onProjector={handleImport}
          onPreviewOnly={() => setPreviewOpen(true)}
          onUpgrade={() => setUpsellOpen(true)}
        />
      ) : null}

      {upsellOpen ? (
        <TemplateUpsellModal
          onClose={() => setUpsellOpen(false)}
          title={template.collection?.title ?? "Pro 템플릿 팩"}
        />
      ) : null}

      {reportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className={cn("w-full max-w-lg space-y-4 p-6", surface.card)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">템플릿 신고</h3>
                <p className="text-sm text-slate-600">신고 사유를 선택하고 필요한 설명을 남겨주세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 text-xs font-semibold"
              >
                닫기
              </button>
            </div>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold text-slate-600">사유</span>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="spam">스팸</option>
                <option value="copyright">저작권 침해</option>
                <option value="privacy">개인정보 노출</option>
                <option value="abuse">부적절한 내용</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm text-slate-700">
              <span className="text-xs font-semibold text-slate-600">추가 설명 (선택)</span>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                rows={4}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className={templateSecondaryCta}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReport}
                disabled={reporting}
                className={cn(`${templateControlBase} templates-control-primary templates-control-rose`, reporting ? "opacity-70" : "")}
              >
                {reporting ? "접수 중..." : "신고 접수"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
