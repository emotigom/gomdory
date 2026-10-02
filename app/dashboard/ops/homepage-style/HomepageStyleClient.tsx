"use client";

import { useEffect, useMemo, useState } from "react";

type StyleDraft = {
  targets: {
    gomdory: boolean;
    gkrry: boolean;
  };
  presetId: string;
  themeName: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaLabel: string;
  ctaHref: string;
  accent: string;
  background: string;
  cardRadius: string;
  cardShadow: string;
};

type StylePreset = {
  id: string;
  name: string;
  description: string;
  values: Omit<StyleDraft, "targets" | "presetId">;
};

const STORAGE_KEY = "ops:homepage-style:draft";

const PRESETS: StylePreset[] = [
  {
    id: "fresh-sky",
    name: "Fresh Sky",
    description: "밝은 하늘톤과 따뜻한 CTA로 첫 인상을 가볍게.",
    values: {
      themeName: "Fresh Sky",
      heroTitle: "수업과 협업을 더 가볍게, 더 빠르게.",
      heroSubtitle: "GOMDORY가 팀의 아이디어를 정리하고, 공유하고, 성장시키는 순간을 돕습니다.",
      ctaLabel: "무료로 시작하기",
      ctaHref: "/auth/login",
      accent: "#3B82F6",
      background: "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 60%), #F8FAFC",
      cardRadius: "28px",
      cardShadow: "0 24px 80px -60px rgba(59,130,246,0.5)",
    },
  },
  {
    id: "warm-cream",
    name: "Warm Cream",
    description: "크림톤 베이스로 감성적인 브랜드 톤업.",
    values: {
      themeName: "Warm Cream",
      heroTitle: "브랜드 이야기를 한 장면으로.",
      heroSubtitle: "따뜻한 배경과 부드러운 카드 톤으로 방문자에게 신뢰를 전달합니다.",
      ctaLabel: "데모 보기",
      ctaHref: "/demo",
      accent: "#F97316",
      background: "radial-gradient(circle at top, rgba(249,115,22,0.15), transparent 65%), #FFF7ED",
      cardRadius: "32px",
      cardShadow: "0 28px 90px -70px rgba(249,115,22,0.45)",
    },
  },
  {
    id: "night-slate",
    name: "Night Slate",
    description: "다크 모드 톤으로 임팩트 강조.",
    values: {
      themeName: "Night Slate",
      heroTitle: "어둠 속에서도 선명한 집중.",
      heroSubtitle: "다크 그라데이션과 강한 포인트 색상으로 프리미엄 인상을 만듭니다.",
      ctaLabel: "스토리 보기",
      ctaHref: "/docs",
      accent: "#38BDF8",
      background: "radial-gradient(circle at top, rgba(56,189,248,0.25), transparent 55%), #0F172A",
      cardRadius: "24px",
      cardShadow: "0 30px 100px -70px rgba(56,189,248,0.45)",
    },
  },
];

const defaultPreset = PRESETS[0];

const defaultDraft: StyleDraft = {
  targets: {
    gomdory: true,
    gkrry: true,
  },
  presetId: defaultPreset.id,
  ...defaultPreset.values,
};

export function HomepageStyleClient() {
  const [draft, setDraft] = useState<StyleDraft>(defaultDraft);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<StyleDraft>;
      setDraft({ ...defaultDraft, ...parsed });
    } catch {
      setDraft(defaultDraft);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const cssTokens = useMemo(() => {
    return [
      ":root {",
      `  --home-accent: ${draft.accent};`,
      `  --home-hero-bg: ${draft.background};`,
      `  --home-card-radius: ${draft.cardRadius};`,
      `  --home-card-shadow: ${draft.cardShadow};`,
      "}",
    ].join("\n");
  }, [draft.accent, draft.background, draft.cardRadius, draft.cardShadow]);

  const applyPreset = (preset: StylePreset) => {
    setDraft((prev) => ({
      ...prev,
      presetId: preset.id,
      ...preset.values,
    }));
  };

  const updateField = <K extends keyof StyleDraft>(key: K, value: StyleDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateTarget = (key: keyof StyleDraft["targets"], value: boolean) => {
    setDraft((prev) => ({
      ...prev,
      targets: { ...prev.targets, [key]: value },
    }));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cssTokens);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="dashboard-ops-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">테마 프리셋</h2>
              <p className="text-sm text-slate-500">워드프레스 테마처럼 빠르게 선택하세요.</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              현재: {draft.themeName}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`dashboard-ops-card dashboard-ops-control rounded-xl border px-4 py-3 text-left ${
                  draft.presetId === preset.id
                    ? "border-slate-900 bg-slate-900 text-white shadow"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <p className="text-sm font-semibold">{preset.name}</p>
                <p className="mt-1 text-xs text-slate-400">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-ops-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">콘텐츠 · CTA</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              테마 이름
              <input
                value={draft.themeName}
                onChange={(event) => updateField("themeName", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              CTA 버튼 텍스트
              <input
                value={draft.ctaLabel}
                onChange={(event) => updateField("ctaLabel", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
              Hero 타이틀
              <input
                value={draft.heroTitle}
                onChange={(event) => updateField("heroTitle", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
              Hero 서브타이틀
              <textarea
                value={draft.heroSubtitle}
                onChange={(event) => updateField("heroSubtitle", event.target.value)}
                rows={3}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
              CTA 링크
              <input
                value={draft.ctaHref}
                onChange={(event) => updateField("ctaHref", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
          </div>
        </div>

        <div className="dashboard-ops-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">스타일 토큰</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              Accent 컬러
              <input
                value={draft.accent}
                onChange={(event) => updateField("accent", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              카드 라운드
              <input
                value={draft.cardRadius}
                onChange={(event) => updateField("cardRadius", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
              배경 그라데이션
              <input
                value={draft.background}
                onChange={(event) => updateField("background", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
              카드 그림자
              <input
                value={draft.cardShadow}
                onChange={(event) => updateField("cardShadow", event.target.value)}
                className="dashboard-ops-input w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              />
            </label>
          </div>
        </div>

        <div className="dashboard-ops-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">배포 토큰</h2>
              <p className="text-sm text-slate-500">
                메인 페이지에 적용할 CSS 변수 묶음입니다. 배포 파이프라인에서 참조하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {copyState === "copied" ? "복사 완료" : "CSS 복사"}
            </button>
          </div>
          <pre className="dashboard-ops-card mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-slate-100">
            {cssTokens}
          </pre>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="dashboard-ops-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">적용 대상</h2>
          <p className="text-sm text-slate-500">어느 도메인에 배포할지 선택합니다.</p>
          <div className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
            <label className="dashboard-ops-row flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span className="min-w-0 truncate">gomdory.com</span>
              <input
                type="checkbox"
                checked={draft.targets.gomdory}
                onChange={(event) => updateTarget("gomdory", event.target.checked)}
                className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900"
              />
            </label>
            <label className="dashboard-ops-row flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span className="min-w-0 truncate">gkrry.com</span>
              <input
                type="checkbox"
                checked={draft.targets.gkrry}
                onChange={(event) => updateTarget("gkrry", event.target.checked)}
                className="dashboard-ops-input h-4 w-4 rounded border-slate-300 text-slate-900"
              />
            </label>
          </div>
        </div>

        <div className="dashboard-ops-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">미리보기</h2>
          <div
            className="mt-4 rounded-2xl border border-slate-200 p-5 text-slate-900"
            style={{ background: draft.background }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Homepage</p>
            <h3 className="mt-2 text-xl font-bold" style={{ color: draft.accent }}>
              {draft.heroTitle}
            </h3>
            <p className="mt-2 break-words text-sm text-slate-600">{draft.heroSubtitle}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="dashboard-ops-control rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: draft.accent }}
              >
                {draft.ctaLabel}
              </button>
              <span className="min-w-0 break-all text-xs text-slate-500">{draft.ctaHref}</span>
            </div>
            <div
              className="mt-4 rounded-xl bg-white/90 p-4 text-xs text-slate-600"
              style={{
                borderRadius: draft.cardRadius,
                boxShadow: draft.cardShadow,
              }}
            >
              카드 컴포넌트 · 반경 {draft.cardRadius}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
