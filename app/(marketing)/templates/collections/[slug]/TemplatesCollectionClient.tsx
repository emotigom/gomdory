"use client";

import { useState } from "react";
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

type TemplateCollectionClientProps = {
  collection: {
    slug: string;
    title: string;
    description: string | null;
    tier: "free" | "pro";
  };
  items: TemplateSummary[];
};

const templateSmallSecondaryCta =
  "templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 text-xs font-semibold";

export function TemplatesCollectionClient({ collection, items }: TemplateCollectionClientProps) {
  const [preview, setPreview] = useState<TemplateDetail | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [upsellState, setUpsellState] = useState<{ collectionSlug: string | null; label: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openUpsell = (template: TemplateSummary) => {
    setUpsellState({
      collectionSlug: template.collection?.slug ?? collection.slug,
      label: template.collection?.title ?? collection.title,
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

  const handleClone = async (template: TemplateSummary) => {
    setInstallingId(template.id);
    setMessage(null);
    try {
      const source = template.tier === "pro" ? "pro_pack" : "community";
      const response = await fetch(routes.api.templates.copy(template.id), {
        method: "POST",
        body: JSON.stringify({ source, collectionSlug: collection.slug }),
      });
      const payload = (await response.json()) as { ok?: boolean; boardId?: string; code?: string };

      if (response.status === 401) {
        window.location.href = `/auth/login?redirect=/templates/collections/${collection.slug}`;
        return;
      }

      if (payload.ok && payload.boardId) {
        window.location.href = `/dashboard/boards/${payload.boardId}/board`;
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

  return (
    <div className="space-y-8" data-templates-interaction-scope>
      <header className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className={cn(tvText.caption, collection.tier === "pro" ? "text-amber-600" : "text-indigo-600")}>
          {collection.tier === "pro" ? "Pro 템플릿 팩" : "Gomdory Picks"}
        </p>
        <div className="space-y-2">
          <h1 className={cn(tvText.heading, "text-4xl")}>{collection.title}</h1>
          {collection.description ? <p className="text-base text-slate-700">{collection.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/templates" className={templateSmallSecondaryCta}>
            전체 템플릿 보기
          </Link>
        </div>
      </header>

      {message ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((template) => (
          <GalleryCard
            key={template.id}
            template={{ ...template } as GalleryTemplate}
            onPreview={() => handlePreview(template.id)}
            onPrimary={() => handleClone(template)}
            onUpgrade={() => openUpsell(template)}
            locked={template.accessLevel === "pro"}
            installing={installingId === template.id}
            tone={template.accessLevel === "pro" ? "emerald" : "indigo"}
          />
        ))}
      </section>

      {preview ? (
        <TemplatePreviewModal
          template={preview}
          locked={preview.accessLevel === "pro"}
          onClose={() => setPreview(null)}
          onPrimary={() => handleClone(preview)}
          onProjector={() => handleClone(preview)}
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
