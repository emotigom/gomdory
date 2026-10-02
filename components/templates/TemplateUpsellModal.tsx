"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { cn, surface } from "@/app/_components/uiTokens";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import { routes } from "@/lib/standards/routes";

type TemplateUpsellModalProps = {
  onClose: () => void;
  title?: string | null;
};

type StorageSavingsPayload = {
  optimizeSavingsBytes: number;
  originalBytesNoDup: number;
  note?: string;
};

function buildCanonicalHref(path: string) {
  try {
    return new URL(path, CANONICAL_BASE_URL).toString();
  } catch {
    return path;
  }
}

const templatePrimaryCta =
  "templates-control templates-control-primary templates-control-indigo inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold";
const templateSecondaryCta =
  "templates-control templates-control-secondary inline-flex min-h-[36px] items-center justify-center rounded-xl border px-3 text-sm font-semibold";

export function TemplateUpsellModal({ onClose, title }: TemplateUpsellModalProps) {
  const [savingsPercent, setSavingsPercent] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const fetchSavings = async () => {
      try {
        const response = await fetch(routes.api.storage.usage(), { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { ok?: boolean; savings?: StorageSavingsPayload };
        if (!payload.ok || !payload.savings) return;
        const original = payload.savings.originalBytesNoDup ?? 0;
        const optimized = payload.savings.optimizeSavingsBytes ?? 0;
        if (original <= 0) return;
        const percent = Math.round((optimized / original) * 100);
        if (Number.isFinite(percent) && percent > 0 && active) {
          setSavingsPercent(percent);
        }
      } catch {
        /* ignore */
      }
    };
    void fetchSavings();
    return () => {
      active = false;
    };
  }, []);

  const contactHref = useMemo(() => buildCanonicalHref("/docs/contact"), []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" data-templates-interaction-scope>
      <div className={cn("w-full max-w-2xl space-y-5 p-6", surface.overlay)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-amber-600">PRO 전용</p>
            <h3 className="text-2xl font-bold text-slate-900">{title ?? "Pro 템플릿 팩"}</h3>
            <p className="text-sm text-slate-700">
              잠금 해제 후 바로 복제할 수 있도록 Pro 패키지를 안내해드릴게요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={templateSecondaryCta}
          >
            닫기
          </button>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-900">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              수업 준비 시간을 평균 30분 → 5분으로 절감
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              TV 최적 레이아웃 + 검증된 진행 흐름
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              Pro 저장소/최적화/파일 관리 혜택까지 포함
            </li>
            {savingsPercent ? (
              <li className="flex items-start gap-2 text-amber-800">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                이미지 최적화로 평균 -{savingsPercent}% 절감(실측)
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link className={templatePrimaryCta} href={contactHref}>
            문의/결제 안내 받기
          </Link>
        </div>
      </div>
    </div>
  );
}
