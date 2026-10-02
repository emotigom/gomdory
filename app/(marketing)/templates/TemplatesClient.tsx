"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { cn, tvText } from "@/app/_components/uiTokens";
import { GalleryCard, type GalleryTemplate } from "@/components/gallery/GalleryCard";
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

const templateSmallSecondaryCta =
  "templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 text-xs font-semibold";

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-interactive="true"
      onClick={onClick}
      className={cn(
        "templates-control flex min-h-[44px] items-center justify-center rounded-full border px-4 text-sm font-semibold",
        active ? "templates-control-active" : "templates-control-secondary",
      )}
    >
      {label}
    </button>
  );
}

export function TemplatesClient({
  picks,
  proPacks,
  community,
}: {
  picks: TemplateSummary[];
  proPacks: TemplateSummary[];
  community: TemplateSummary[];
}) {
  const templates = community;
  const pickItems = picks;
  const proItems = proPacks;
  const [preview, setPreview] = useState<TemplateDetail | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [upsellState, setUpsellState] = useState<{ collectionSlug: string | null; label: string } | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);

  const tags = useMemo(() => {
    const set = new Set<string>();
    [...templates, ...pickItems, ...proItems].forEach((template) => template.tags.forEach((tag) => set.add(tag)));
    return Array.from(set.values());
  }, [pickItems, templates, proItems]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    [...templates, ...pickItems, ...proItems].forEach((template) => {
      if (template.subject) set.add(template.subject);
    });
    return Array.from(set.values());
  }, [pickItems, templates, proItems]);

  const filterTemplates = useCallback(
    (list: TemplateSummary[]) =>
      list.filter((item) => {
        const gradeOk = gradeFilter === "all" || item.gradeBand === gradeFilter;
        const subjectOk = subjectFilter === "all" || item.subject === subjectFilter;
        const tagOk = !tagFilter || item.tags.includes(tagFilter);
        return gradeOk && subjectOk && tagOk;
      }),
    [gradeFilter, subjectFilter, tagFilter],
  );

  const filteredPicks = useMemo(() => filterTemplates(pickItems), [filterTemplates, pickItems]);
  const filteredProPacks = useMemo(() => filterTemplates(proItems), [filterTemplates, proItems]);
  const filteredTemplates = useMemo(
    () => filterTemplates(templates).filter((template) => !template.isFeatured),
    [filterTemplates, templates],
  );

  const openUpsell = (template: TemplateSummary) => {
    setUpsellState({
      collectionSlug: template.collection?.slug ?? null,
      label: template.collection?.title ?? "Pro 템플릿 팩",
    });
  };

  const handlePreview = async (templateId: string) => {
    setMessage(null);
    try {
      const response = await fetch(routes.api.templates.byId(templateId), { cache: "no-store" });
      const payload = (await response.json()) as { template?: TemplateDetail };
      if (response.ok && payload.template) {
        setPreview(payload.template);
      } else {
        setMessage("템플릿을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (error) {
      console.error(error);
      setMessage("템플릿을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleClone = async (template: TemplateSummary, options?: { launch?: "class" | "projector" }) => {
    setInstallingId(template.id);
    setMessage(null);
    try {
      const source =
        template.tier === "pro"
          ? "pro_pack"
          : template.isFeatured
            ? "picks"
            : "community";
      const response = await fetch(routes.api.templates.copy(template.id), {
        method: "POST",
        body: JSON.stringify({ source, collectionSlug: template.collection?.slug ?? null }),
      });
      const payload = (await response.json()) as { ok?: boolean; boardId?: string; code?: string };

      if (response.status === 401) {
        window.location.href = "/auth/login?redirect=/templates";
        return;
      }

      if (payload.ok && payload.boardId) {
        setMessage("보드에 추가했습니다. 바로 수업을 시작해보세요.");
        const target = options?.launch === "projector" ? `/dashboard/boards/${payload.boardId}#projector` : `/dashboard/boards/${payload.boardId}/board`;
        window.location.href = target;
        return;
      }

      if (payload.code === "pro_required") {
        openUpsell(template);
        return;
      }

      setMessage("가져오기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } catch (error) {
      console.error(error);
      setMessage("가져오기에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setInstallingId(null);
    }
  };

  const handleReport = async (templateId: string) => {
    setReportingId(templateId);
    setMessage(null);
    try {
      const response = await fetch(routes.api.templates.report(templateId), {
        method: "POST",
        body: JSON.stringify({ reason: "other", details: "" }),
      });
      const payload = (await response.json()) as { ok?: boolean };
      if (payload.ok) {
        setMessage("신고해주셔서 감사합니다. 검토 후 처리하겠습니다.");
      } else {
        setMessage("신고 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (error) {
      console.error(error);
      setMessage("신고 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setReportingId(null);
    }
  };

  const header = (
    <header className="space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-6 shadow-sm">
      <p className={cn(tvText.kicker, "text-indigo-600")}>Teacher Template Library</p>
      <div className="space-y-2">
        <h1 className={cn(tvText.heading, "text-4xl sm:text-5xl")}>10초 만에 수업 흐름을 시작하세요</h1>
        <p className="text-lg leading-7 text-slate-700">
          교실 흐름을 빠르게 여는 템플릿 갤러리. 느린 네트워크와 TV 환경에서도 부드럽게 작동합니다.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">CTA 중심 · 카드 본문 클릭 없음</span>
        <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">prefers-reduced-motion 준수</span>
        <Link href="/dashboard/pro" className={templateSmallSecondaryCta}>
          Pro 알아보기
        </Link>
      </div>
    </header>
  );

  const filterBar = (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap gap-2" aria-label="학년대 필터">
        {[{ key: "all", label: "전체" }, { key: "elem", label: "초등" }, { key: "middle", label: "중등" }, { key: "mixed", label: "혼합" }].map((option) => (
          <FilterChip key={option.key} label={option.label} active={gradeFilter === option.key} onClick={() => setGradeFilter(option.key)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="과목 필터">
        <FilterChip label="전체" active={subjectFilter === "all"} onClick={() => setSubjectFilter("all")} />
        {subjects.map((subject) => (
          <FilterChip key={subject} label={subject} active={subjectFilter === subject} onClick={() => setSubjectFilter(subject)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="태그 필터">
        <FilterChip label="전체" active={!tagFilter} onClick={() => setTagFilter("")} />
        {tags.map((tag) => (
          <FilterChip key={tag} label={`#${tag}`} active={tagFilter === tag} onClick={() => setTagFilter(tag)} />
        ))}
      </div>
    </div>
  );

  const renderGalleryCard = (template: TemplateSummary) => {
    const galleryTemplate: GalleryTemplate = { ...template };
    return (
      <GalleryCard
        key={template.id}
        template={galleryTemplate}
        onPreview={() => handlePreview(template.id)}
        onPrimary={() => handleClone(template)}
        onUpgrade={() => openUpsell(template)}
        onReport={() => handleReport(template.id)}
        locked={template.accessLevel === "pro"}
        installing={installingId === template.id}
        reporting={reportingId === template.id}
        tone={template.accessLevel === "pro" ? "emerald" : "indigo"}
      />
    );
  };

  return (
    <div className="space-y-10" data-templates-interaction-scope>
      {header}
      {filterBar}
      {message ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(tvText.caption, "text-indigo-600")}>Gomdory Picks</p>
            <h2 className={cn(tvText.heading, "text-2xl")}>
              운영팀이 고른 교사 프리미엄 템플릿
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">TV-first · 좌우 스크롤</span>
          </div>
        </div>
        {filteredPicks.length === 0 ? (
          <p className="text-sm text-slate-600">추천 템플릿을 준비하고 있습니다.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredPicks.map((template) => (
              <div key={template.id} className="w-[320px] flex-shrink-0">
                {renderGalleryCard(template)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(tvText.caption, "text-amber-600")}>Pro 템플릿 팩</p>
            <h2 className={cn(tvText.heading, "text-2xl")}>한 번에 꺼내 쓰는 완성형 묶음</h2>
            <p className="text-sm text-slate-600">미리보기는 자유롭게, 복제는 잠금 해제 후 가능합니다.</p>
          </div>
          <Link href="/templates/collections/pro-pack-starter" className={templateSmallSecondaryCta}>
            Pro 팩 보기
          </Link>
        </div>
        {filteredProPacks.length === 0 ? (
          <p className="text-sm text-slate-600">Pro 템플릿 팩을 준비하고 있습니다.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProPacks.map((template) => renderGalleryCard(template))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(tvText.caption, "text-slate-600")}>커뮤니티</p>
            <h2 className={cn(tvText.heading, "text-2xl")}>새로운 수업 아이디어를 차분히 발견하세요</h2>
            <p className="text-sm text-slate-600">큰 글씨와 넓은 여백으로 TV 친화적인 카드 구성을 제공합니다.</p>
          </div>
          <Link href="/dashboard" className={templateSmallSecondaryCta}>
            대시보드로 이동
          </Link>
        </div>
        {filteredTemplates.length === 0 ? (
          <p className="text-sm text-slate-600">조건에 맞는 템플릿이 아직 없습니다.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => renderGalleryCard(template))}
          </div>
        )}
      </section>

      {preview ? (
        <TemplatePreviewModal
          template={preview}
          locked={preview.accessLevel === "pro"}
          reportingId={reportingId}
          onClose={() => setPreview(null)}
          onPrimary={() => handleClone(preview)}
          onProjector={() => handleClone(preview, { launch: "projector" })}
          onReport={handleReport}
          onUpgrade={() => openUpsell(preview)}
          onPreviewOnly={() => setMessage("구성 요약을 열었습니다.")}
        />
      ) : null}

      {upsellState ? (
        <TemplateUpsellModal
          onClose={() => setUpsellState(null)}
          title={upsellState.label}
        />
      ) : null}
    </div>
  );
}
