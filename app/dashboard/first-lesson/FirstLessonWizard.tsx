"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import CardTile from "@/app/_components/CardTile";
import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn, focusRingSoft, hairlineBorderClass, pill } from "@/app/_components/uiTokens";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { apiFetch } from "@/lib/http/apiFetch";
import { getGuidedPathSelection } from "@/lib/dashboard/guidedPath";

import { boardRemoteHref } from "@/lib/dashboard/boardHrefs";
import { dispatchFirstLessonComplete, FIRST_LESSON_COMPLETE_KEY } from "../_components/FirstLessonCta";

type WizardStep = 1 | 2 | 3;
type DemoScenarioId = "elem" | "mid" | "debate" | "quiz";

type TemplatePick = {
  id: string;
  title: string;
  description: string | null;
  accessLevel: "free" | "pro";
};

type BoardOption = {
  boardId: string;
  title: string;
};

type ShareInfo = {
  code: string;
  shareUrl: string;
  presentUrl: string;
  boardId?: string | null;
};

type FirstLessonDraft =
  | { mode: "template"; templateId: string }
  | { mode: "board"; boardId: string }
  | { mode: "demo"; demoScenario: DemoScenarioId }
  | { mode: null };

type WizardProps = {
  initialStep: number;
  router?: { replace: (url: string) => void; push?: (url: string) => void };
  prefetchedTemplates?: TemplatePick[];
  prefetchedBoards?: BoardOption[];
  ensureShare?: (boardId: string) => Promise<ShareInfo>;
  installTemplate?: (templateId: string) => Promise<{ ok: true; boardId: string } | { ok: false; code?: string; message?: string }>;
};

type ShareState =
  | { status: "idle" }
  | { status: "loading"; message?: string }
  | { status: "ready"; info: ShareInfo }
  | { status: "blocked"; reason: "pro_required"; message?: string }
  | { status: "error"; message: string; requestId?: string };

const DRAFT_STORAGE_KEY = "gomdori:firstLessonDraft";

const demoScenarios: Array<{ id: DemoScenarioId; title: string; description: string }> = [
  { id: "elem", title: "초등 참여 데모", description: "출석 · 한 줄 소감 · 반응 연습" },
  { id: "mid", title: "중등 활동 데모", description: "간단한 생각 모으기 + 스티커" },
  { id: "debate", title: "토론 흐름 데모", description: "찬반 · 질문 던지고 피드백" },
  { id: "quiz", title: "퀴즈/투표 데모", description: "코드만으로 빠르게 참여" },
];

function readDraft(): FirstLessonDraft {
  if (typeof window === "undefined") return { mode: null };
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return { mode: null };
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || !("mode" in parsed)) return { mode: null };
    return parsed as FirstLessonDraft;
  } catch (error) {
    console.warn("[first-lesson] draft read failed", error);
    return { mode: null };
  }
}

function writeDraft(draft: FirstLessonDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("[first-lesson] draft write failed", error);
  }
}

function writeComplete() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIRST_LESSON_COMPLETE_KEY, new Date().toISOString());
  } catch (error) {
    console.warn("[first-lesson] complete write failed", error);
  }
  dispatchFirstLessonComplete();
}

function StepIndicator({ step }: { step: WizardStep }) {
  const steps = [
    { id: 1, label: "수업 시작 방식" },
    { id: 2, label: "공유 준비" },
    { id: 3, label: "시작하기" },
  ];
  return (
    <div className="grid gap-3 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-3">
      {steps.map((item) => {
        const active = step === item.id;
        const done = step > item.id;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
              active
                ? "border-indigo-200 bg-indigo-50 text-indigo-900 shadow-sm"
                : done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-700",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                active
                  ? "bg-indigo-600 text-white"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-700",
              )}
            >
              {item.id}
            </span>
            <div className="flex flex-col">
              <span>{item.label}</span>
              <span className="text-[12px] font-medium text-slate-500">
                {item.id}/3
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ title, children, kicker }: { title: string; children: ReactNode; kicker?: string }) {
  return (
    <div
      className={cn(
        "space-y-6 rounded-[32px] bg-white/95 p-6 shadow-[0_24px_120px_-80px_rgba(79,70,229,0.25)]",
        hairlineBorderClass,
      )}
    >
      <div className="space-y-1">
        {kicker ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">{kicker}</p> : null}
        <h2 className="text-3xl font-bold text-slate-950">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ProUpgradeHint() {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Pro면 더 쉬워요</p>
        <ul className="list-disc space-y-1 pl-5 text-indigo-900">
          <li>Pro 템플릿 팩 복제</li>
          <li>저장공간/최적화</li>
          <li>커뮤니티 자료 관리(태그/파일 매니저 v1 예정)</li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/billing/institution" className={buttonTone("secondary", { size: "sm" })} data-interactive="true">
          학교/기관 문의
        </Link>
        <Link href="/dashboard/billing?intent=demo#upgrade" className={buttonTone("primary", { size: "sm", tone: "indigo" })} data-interactive="true">
          업그레이드
        </Link>
      </div>
    </div>
  );
}

function SelectionBadge({ label }: { label: string }) {
  return <span className={cn(pill.badge, "bg-indigo-50 text-indigo-800 ring-indigo-100")}>{label}</span>;
}

export default function FirstLessonWizard({
  initialStep,
  router: routerOverride,
  prefetchedTemplates,
  prefetchedBoards,
  ensureShare,
  installTemplate,
}: WizardProps) {
  const nextRouter = useRouter();
  const router = routerOverride ?? nextRouter;
  const [step, setStep] = useState<WizardStep>(() => {
    if (initialStep === 2) return 2;
    if (initialStep === 3) return 3;
    return 1;
  });
  const [templates, setTemplates] = useState<TemplatePick[]>(prefetchedTemplates ?? []);
  const [boards, setBoards] = useState<BoardOption[]>(prefetchedBoards ?? []);
  const [loadingTemplates, setLoadingTemplates] = useState(!prefetchedTemplates);
  const [loadingBoards, setLoadingBoards] = useState(!prefetchedBoards);
  const [draft, setDraft] = useState<FirstLessonDraft>({ mode: null });
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });
  const [qrData, setQrData] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [guidedPathId, setGuidedPathId] = useState<string | null>(null);

  useEffect(() => {
    const nextDraft = readDraft();
    setDraft(nextDraft);
    setGuidedPathId(getGuidedPathSelection()?.pathId ?? null);
  }, []);

  useEffect(() => {
    writeDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (prefetchedTemplates) return;
    let cancelled = false;
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await apiFetch(apiV1Path("templates/picks"), { cache: "no-store" });
        const payload = (await response.json()) as { ok?: boolean; items?: TemplatePick[] };
        if (cancelled) return;
        if (payload.ok && payload.items) {
          setTemplates(payload.items);
        }
      } catch (error) {
        console.warn("[first-lesson] picks load failed", error);
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    };
    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [prefetchedTemplates]);

  useEffect(() => {
    if (prefetchedBoards) return;
    let cancelled = false;
    const loadBoards = async () => {
      setLoadingBoards(true);
      try {
        const response = await fetch(apiV1Path("dashboard/boards"), { cache: "no-store" });
        const payload = (await response.json()) as { boards?: Array<{ boardId?: string; title?: string }> };
        if (cancelled) return;
        const nextBoards =
          payload.boards
            ?.map((board) => ({
              boardId: board.boardId ?? "",
              title: board.title ?? "제목 없는 보드",
            }))
            .filter((b) => b.boardId) ?? [];
        setBoards(nextBoards.slice(0, 6));
      } catch (error) {
        console.warn("[first-lesson] boards load failed", error);
      } finally {
        if (!cancelled) setLoadingBoards(false);
      }
    };
    void loadBoards();
    return () => {
      cancelled = true;
    };
  }, [prefetchedBoards]);

  const updateStepQuery = (nextStep: WizardStep) => {
    const search = new URLSearchParams();
    if (nextStep > 1) search.set("step", String(nextStep));
    const query = search.toString();
    const target = query ? `/dashboard/first-lesson?${query}` : "/dashboard/first-lesson";
    router.replace(target);
  };

  const clampToWizardStep = (value: number): WizardStep => {
    if (value < 1) return 1;
    if (value > 3) return 3;
    return value as WizardStep;
  };

  const handleStepChange = (nextStep: WizardStep) => {
    if (nextStep === step) return;
    if (step === 1 && nextStep === 2) {
      trackMarketingFunnelEvent("first_lesson_started", {
        location: "first_lesson_step_1",
        path_id: guidedPathId ?? "first_lesson",
        mode: draft.mode ?? "none",
      });
    }
    setStep(nextStep);
    updateStepQuery(nextStep);
    if (nextStep === 3) {
      writeComplete();
    }
  };

  useEffect(() => {
    trackMarketingFunnelEvent("guided_path_step_view", {
      location: "first_lesson_wizard",
      path_id: guidedPathId ?? "first_lesson",
      step_id: `wizard_step_${step}`,
      selected_mode: draft.mode ?? "none",
    });
  }, [draft.mode, guidedPathId, step]);

  const selectionLabel = useMemo(() => {
    if (draft.mode === "template") return "추천 템플릿으로 시작";
    if (draft.mode === "board") return "내 보드로 시작";
    if (draft.mode === "demo") return "데모로 먼저 체험";
    return null;
  }, [draft.mode]);

  const resetShareState = () => {
    setShareState({ status: "idle" });
    setQrData(null);
  };

  const ensureShareFn =
    ensureShare ??
    (async (boardId: string) => {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/share/ensure`), { method: "POST" });
      const requestId = response.headers.get("x-request-id") ?? undefined;
      const payload = (await response.json()) as { ok?: boolean; code?: string; shareUrl?: string; presentUrl?: string };
      if (!response.ok || !payload.ok || !payload.code || !payload.shareUrl || !payload.presentUrl) {
        throw Object.assign(new Error(payload?.code ?? "ensure_failed"), { requestId });
      }
      return {
        code: payload.code,
        shareUrl: payload.shareUrl,
        presentUrl: payload.presentUrl,
        boardId,
      };
    });

  const installTemplateFn =
    installTemplate ??
    (async (templateId: string) => {
      const response = await apiFetch(apiV1Path(`templates/${templateId}/install`), { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; boardId?: string; code?: string; error?: { message?: string } };
      if (payload.ok && payload.boardId) return { ok: true, boardId: payload.boardId };
      return { ok: false, code: payload.code, message: payload.error?.message };
    });

  const beginShareEnsure = (targetDraft: FirstLessonDraft) => {
    if (targetDraft.mode === "demo") {
      const demoInfo: ShareInfo = {
        code: "DEMO123",
        shareUrl: "https://gkrry.com/demo",
        presentUrl: "https://gkrry.com/s/demo/present",
        boardId: null,
      };
      setShareState({ status: "ready", info: demoInfo });
      return;
    }
    if (targetDraft.mode === null) return;
    setShareState({ status: "loading", message: "공유 링크를 준비하고 있어요…" });
    startTransition(() => {
      const install = async () => {
        if (targetDraft.mode === "template") {
          const selectedTemplate = templates.find((tpl) => tpl.id === targetDraft.templateId);
          if (selectedTemplate?.accessLevel === "pro") {
            setShareState({
              status: "blocked",
              reason: "pro_required",
              message: "Pro 템플릿입니다. 업그레이드 후 복제할 수 있어요.",
            });
            return null;
          }
          const result = await installTemplateFn(targetDraft.templateId);
          if (!result.ok) {
            if (result.code === "pro_required") {
              setShareState({
                status: "blocked",
                reason: "pro_required",
                message: "Pro 템플릿입니다. 업그레이드 후 복제할 수 있어요.",
              });
              return null;
            }
            throw new Error(result.message ?? "템플릿을 복제하지 못했습니다.");
          }
          return result.boardId;
        }
        if (targetDraft.mode === "board") {
          return targetDraft.boardId;
        }
        return null;
      };

      install()
        .then(async (boardId) => {
          if (!boardId) return;
          const info = await ensureShareFn(boardId);
          setShareState({ status: "ready", info });
        })
        .catch((error: unknown) => {
          const requestId = (error as { requestId?: string }).requestId;
          const message =
            error instanceof Error ? error.message : "공유 링크를 준비하지 못했습니다.";
          setShareState({ status: "error", message, requestId });
        });
    });
  };

  useEffect(() => {
    if (step !== 2) return;
    resetShareState();
    beginShareEnsure(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft.mode, (draft as { templateId?: string }).templateId, (draft as { boardId?: string }).boardId, (draft as { demoScenario?: string }).demoScenario]);

  useEffect(() => {
    if (shareState.status !== "ready" || !shareState.info.shareUrl) {
      setQrData(null);
      return;
    }
    let cancelled = false;
    const generate = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const url = await toDataURL(shareState.info.shareUrl);
        if (!cancelled) setQrData(url);
      } catch (error) {
        console.warn("[first-lesson] qr failed", error);
        if (!cancelled) setQrData(null);
      }
    };
    void generate();
    return () => {
      cancelled = true;
    };
  }, [shareState]);

  const canProceed = useMemo(() => {
    if (step === 1) {
      if (draft.mode === "template") return Boolean(draft.templateId);
      if (draft.mode === "board") return Boolean(draft.boardId);
      if (draft.mode === "demo") return Boolean(draft.demoScenario);
      return false;
    }
    if (step === 2) return shareState.status === "ready";
    return true;
  }, [draft, shareState.status, step]);

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopyLabel(`${label} 복사됨`);
        setTimeout(() => setCopyLabel(null), 1400);
      }
    } catch {
      setCopyLabel(null);
    }
  };

  const stepTitle =
    step === 1
      ? "수업 시작 방식 선택"
      : step === 2
        ? "공유 준비(링크/QR/코드 확보)"
        : "프로젝터/리모컨 시작";

  const kicker = selectionLabel ?? "First Lesson Wizard";

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 md:py-12">
      <StepIndicator step={step} />
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">추천 경로 연속 안내</p>
        <p className="mt-1 text-sm font-semibold text-indigo-950">첫 수업 흐름은 “시작 방식 선택 → 공유 준비 → 교실 실행” 3단계로 끝납니다.</p>
        <p className="text-xs text-indigo-900">한 단계씩 완료하면 바로 다음 행동이 보이도록 구성했습니다. 막히면 이전 단계로 돌아가도 저장 상태는 유지됩니다.</p>
      </div>
      <StepCard title={stepTitle} kicker={kicker}>
        {step === 1 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <CardTile
              interactive
              calm
              data-testid="first-lesson-choice-template"
              onClick={() => {
                trackMarketingFunnelEvent("first_template_use_click", {
                  location: "first_lesson_step_1",
                  cta_slot: "template_quick_pick",
                });
                setDraft({ mode: "template", templateId: templates[0]?.id ?? "demo-template" });
              }}
              selected={draft.mode === "template"}
              className="h-full cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <SelectionBadge label="추천" />
                <span className="text-xs font-semibold text-indigo-700">템플릿 6개</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">추천 템플릿으로 시작</p>
                <p className="text-sm text-slate-600">가장 많이 쓰는 수업 흐름을 바로 복제합니다.</p>
              </div>
              <div className="space-y-2">
                {loadingTemplates ? (
                  <p className="text-xs text-slate-500">템플릿을 불러오는 중…</p>
                ) : templates.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {templates.slice(0, 6).map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        data-testid={`first-lesson-template-${tpl.id}`}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-[13px] font-semibold text-slate-800",
                          draft.mode === "template" && draft.templateId === tpl.id
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-slate-200 bg-white",
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          trackMarketingFunnelEvent("first_template_use_click", {
                            location: "first_lesson_step_1",
                            cta_slot: "template_tile_pick",
                            template_id: tpl.id,
                          });
                          setDraft({ mode: "template", templateId: tpl.id });
                        }}
                        data-interactive="true"
                      >
                        {tpl.title}
                        {tpl.accessLevel === "pro" ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            PRO
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">추천 템플릿이 없어 데모 템플릿으로 진행합니다.</p>
                )}
              </div>
            </CardTile>

            <CardTile
              interactive
              calm
              data-testid="first-lesson-choice-board"
              onClick={() => setDraft(boards[0] ? { mode: "board", boardId: boards[0].boardId } : { mode: "board", boardId: "" })}
              selected={draft.mode === "board"}
              className="h-full cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <SelectionBadge label="내 자료" />
                <span className="text-xs font-semibold text-indigo-700">최근 보드</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">내 보드로 시작</p>
                <p className="text-sm text-slate-600">방금 만들거나 즐겨찾기한 보드를 바로 공유합니다.</p>
              </div>
              <div className="space-y-2">
                {loadingBoards ? (
                  <p className="text-xs text-slate-500">최근 보드를 불러오는 중…</p>
                ) : boards.length ? (
                  <div className="space-y-2">
                    {boards.map((board) => (
                      <button
                        key={board.boardId}
                        type="button"
                        data-testid={`first-lesson-board-${board.boardId}`}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left text-[13px] font-semibold text-slate-800",
                          draft.mode === "board" && draft.boardId === board.boardId
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-slate-200 bg-white",
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDraft({ mode: "board", boardId: board.boardId });
                        }}
                        data-interactive="true"
                      >
                        {board.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    최근 보드가 없습니다. 새 보드를 만든 후 다시 시도하세요.
                  </div>
                )}
              </div>
            </CardTile>

            <CardTile
              interactive
              calm
              data-testid="first-lesson-choice-demo"
              onClick={() => setDraft({ mode: "demo", demoScenario: demoScenarios[0].id })}
              selected={draft.mode === "demo"}
              className="h-full cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <SelectionBadge label="체험" />
                <span className="text-xs font-semibold text-indigo-700">실데이터 없음</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">데모로 먼저 체험</p>
                <p className="text-sm text-slate-600">실제 학생 데이터 없이 흐름만 테스트합니다.</p>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {demoScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      data-testid={`first-lesson-demo-${scenario.id}`}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-[13px] font-semibold text-slate-800 transition",
                        draft.mode === "demo" && draft.demoScenario === scenario.id
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-indigo-200",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDraft({ mode: "demo", demoScenario: scenario.id });
                      }}
                      data-interactive="true"
                    >
                      {scenario.title}
                      <span className="block text-[11px] font-medium text-slate-500">{scenario.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardTile>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">공유 코드</p>
                  <p className="text-[32px] font-black leading-none text-indigo-950">
                    {shareState.status === "ready" ? shareState.info.code : "------"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={shareState.status !== "ready"}
                  className={buttonTone("secondary", { size: "sm" })}
                  onClick={() => shareState.status === "ready" ? handleCopy(shareState.info.code, "코드") : undefined}
                  data-interactive="true"
                >
                  {copyLabel?.includes("코드") ? copyLabel : "복사"}
                </button>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">학생 링크</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-slate-900">
                    {shareState.status === "ready" ? shareState.info.shareUrl : "https://gkrry.com/------"}
                  </span>
                  <button
                    type="button"
                    disabled={shareState.status !== "ready"}
                    className={buttonTone("secondary", { size: "sm" })}
                    onClick={() =>
                      shareState.status === "ready"
                        ? handleCopy(shareState.info.shareUrl, "학생 링크")
                        : undefined
                    }
                    data-interactive="true"
                  >
                    {copyLabel?.includes("학생 링크") ? copyLabel : "복사"}
                  </button>
                </div>
              </div>
              <p className="text-sm font-semibold text-indigo-900">
                학생은 gkrry.com 입력 후 코드만 치면 됩니다.
              </p>
              {shareState.status === "loading" ? (
                <InlineAlert
                  tone="info"
                  className="bg-white/80"
                  title={shareState.message ?? "공유 링크를 준비하는 중입니다."}
                />
              ) : null}
              {shareState.status === "blocked" ? (
                <InlineAlert
                  tone="warning"
                  className="bg-white/80"
                  title={shareState.message ?? "Pro 업그레이드가 필요합니다."}
                />
              ) : null}
              {shareState.status === "error" ? (
                <InlineAlert
                  tone="error"
                  className="bg-white"
                  title={shareState.message}
                  description={shareState.requestId ? `요청 ID: ${shareState.requestId}` : undefined}
                  action={
                    <button
                      type="button"
                      className={buttonTone("secondary", { size: "sm" })}
                      onClick={() => beginShareEnsure(draft)}
                      data-interactive="true"
                    >
                      다시 시도
                    </button>
                  }
                />
              ) : null}
            </div>
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">QR</p>
              {shareState.status === "ready" ? (
                qrData ? (
                  <Image
                    src={qrData}
                    alt="학생 링크 QR"
                    width={256}
                    height={256}
                    className="mx-auto h-64 w-64 rounded-3xl border border-slate-200 bg-white object-contain"
                  />
                ) : (
                  <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                    QR 생성 중…
                  </div>
                )
              ) : (
                <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                  링크 준비 후 QR이 표시됩니다.
                </div>
              )}
              <p className="text-xs font-semibold text-slate-600">프로젝터에서 촬영 가능한 크기</p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Link
                href={shareState.status === "ready" ? shareState.info.presentUrl : "#"}
                data-interactive="true"
                onClick={() =>
                  trackMarketingFunnelEvent("classroom_action_cta_click", {
                    location: "first_lesson_step_3",
                    path_id: guidedPathId ?? "first_lesson",
                    action: "open_projector",
                  })
                }
                className={cn(
                  buttonTone("primary", { size: "lg", tone: "emerald" }),
                  "flex h-full flex-col items-start gap-1 text-left",
                  shareState.status !== "ready" ? "pointer-events-none opacity-60" : "",
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">프로젝터</span>
                <span className="text-xl font-bold">프로젝터 시작</span>
              </Link>
              <Link
                href={shareState.status === "ready" ? shareState.info.shareUrl : "#"}
                data-interactive="true"
                onClick={() =>
                  trackMarketingFunnelEvent("classroom_action_cta_click", {
                    location: "first_lesson_step_3",
                    path_id: guidedPathId ?? "first_lesson",
                    action: "open_student_preview",
                  })
                }
                className={cn(
                  buttonTone("secondary", { size: "lg" }),
                  "flex h-full flex-col items-start gap-1 text-left",
                  shareState.status !== "ready" ? "pointer-events-none opacity-60" : "",
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">학생 화면</span>
                <span className="text-xl font-bold">학생 화면 미리보기</span>
              </Link>
              <Link
                href={
                  shareState.status === "ready" && shareState.info.boardId
                    ? boardRemoteHref(shareState.info.boardId)
                    : "#"
                }
                data-interactive="true"
                onClick={() =>
                  trackMarketingFunnelEvent("classroom_action_cta_click", {
                    location: "first_lesson_step_3",
                    path_id: guidedPathId ?? "first_lesson",
                    action: "open_remote",
                  })
                }
                className={cn(
                  buttonTone("secondary", { size: "lg" }),
                  "flex h-full flex-col items-start gap-1 text-left",
                  shareState.status !== "ready" || !shareState.info.boardId ? "pointer-events-none opacity-60" : "",
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">리모컨</span>
                <span className="text-xl font-bold">리모컨 열기</span>
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              수업 중에는 Focus 모드에서 승인/숨김/핀으로 관리하세요.
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">다음 추천 단계</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">첫 참여가 확인되면 오늘 쓴 흐름을 템플릿으로 저장해 다음 수업 준비 시간을 줄여보세요.</p>
              <Link
                href="/dashboard/templates"
                className={cn(buttonTone("secondary", { size: "sm" }), "mt-2")}
                onClick={() =>
                  trackMarketingFunnelEvent("guided_path_next_click", {
                    location: "first_lesson_step_3",
                    path_id: guidedPathId ?? "first_lesson",
                    step_id: "classroom_started",
                    next_action: "open_templates",
                  })
                }
              >
                템플릿으로 이어서 관리
              </Link>
            </div>
          </div>
        ) : null}

        <ProUpgradeHint />
      </StepCard>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className={cn(pill.badge, "bg-slate-100 text-slate-700 ring-slate-200")}>Step {step}/3</span>
          {selectionLabel ? <span className={cn(pill.badge, "bg-indigo-50 text-indigo-800 ring-indigo-100")}>{selectionLabel}</span> : null}
          {shareState.status === "blocked" ? (
            <span className={cn(pill.badge, "bg-amber-50 text-amber-700 ring-amber-100")}>Pro 업그레이드 필요</span>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={step === 1 || isPending}
            onClick={() => handleStepChange(clampToWizardStep(step - 1))}
            className={cn(
              "min-w-[120px] rounded-2xl border px-5 py-3 text-sm font-semibold text-slate-700 transition",
              focusRingSoft,
              step === 1 ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white hover:border-slate-300",
            )}
            data-testid="first-lesson-back"
            data-interactive="true"
          >
            이전
          </button>
          <button
            type="button"
            disabled={!canProceed || isPending}
            onClick={() => handleStepChange(clampToWizardStep(step + 1))}
            className={cn(
              "min-w-[160px] rounded-2xl px-6 py-3 text-sm font-bold text-white transition",
              buttonTone("primary", { size: "lg", tone: "indigo" }),
              !canProceed || isPending ? "opacity-60" : "",
            )}
            data-testid="first-lesson-next"
            data-interactive="true"
          >
            {step === 3 ? "대시보드로" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
