"use client";
import { apiV1Path, unsafeApiPath, type ApiPath } from "@/lib/standards/pathTypes";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import InlineAlert from "@/app/_components/InlineAlert";
import AnchoredMenu from "@/app/_components/AnchoredMenu";
import { cn } from "@/app/_components/uiTokens";
import useDismissableLayer from "@/app/_components/useDismissableLayer";
import { apiFetch } from "@/lib/http/apiFetch";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { getGuidedPathSelection } from "@/lib/dashboard/guidedPath";

import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import { boardBoardHref, boardPresentHref } from "@/lib/dashboard/boardHrefs";
import { publishDashboardInvalidate } from "@/lib/dashboard/invalidation";
import { pushDashboardToast } from "../useDashboardToast";
import { TemplatePreviewModal } from "@/components/templates/TemplatePreviewModal";
import { ProLockDialog } from "@/components/ProLockDialog";

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
  payload: SanitizedTemplatePayload;
};

type TemplateSort = "recent" | "popular";
type TemplateTab = "community" | "picks" | "pro";

type TemplateListResponse = {
  ok: boolean;
  items?: TemplateSummary[];
  nextCursor?: string | null;
  error?: { message: string };
};

type TemplateCollectionSummary = {
  slug: string;
  title: string;
  description: string | null;
  kind: "picks" | "pro_pack";
  isLocked: boolean;
  badge: string | null;
  coverImageUrl: string | null;
};

type TemplateCollectionItem = TemplateSummary & {
  note?: string | null;
  rank: number;
};

type TemplateCollectionDetail = {
  collection: TemplateCollectionSummary;
  items: TemplateCollectionItem[];
  locked: boolean;
};

type TemplateCollectionListResponse = {
  ok: boolean;
  items?: TemplateCollectionSummary[];
  error?: { message: string };
};

type TemplateCollectionDetailResponse = {
  ok: boolean;
  collection?: TemplateCollectionSummary;
  items?: TemplateCollectionItem[];
  locked?: boolean;
  error?: { message: string };
};

type TemplateQuery = {
  query?: string;
  tag?: string;
  sort?: TemplateSort;
  cursor?: string | null;
  scope?: "public" | "mine";
};

type TemplateGalleryClientProps = {
  isProUser: boolean;
  isOpsOwner: boolean;
  proEnabled?: boolean;
  hasProTemplates: boolean;
};

const workshopFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]";
const workshopPrimaryButton =
  `inline-flex min-h-11 items-center justify-center border-2 border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-4 text-sm font-black text-[var(--theme-accent-text)] shadow-[3px_3px_0_var(--theme-border-strong)] transition hover:-translate-y-0.5 hover:bg-[var(--theme-accent-strong)] disabled:cursor-wait disabled:opacity-60 ${workshopFocus}`;
const workshopSecondaryButton =
  `inline-flex min-h-11 items-center justify-center border border-[var(--theme-border-strong)] bg-[var(--theme-card)] px-4 text-sm font-bold text-[var(--theme-text)] transition hover:bg-[var(--theme-surface-muted)] ${workshopFocus}`;

function getEnabledReportMenuItems(menu: HTMLElement) {
  return Array.from(
    menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]):not([disabled])'),
  );
}

function focusReportMenuItem(items: HTMLElement[], index: number) {
  const item = items[index];
  if (!item) return;
  items.forEach((candidate) => {
    candidate.tabIndex = candidate === item ? 0 : -1;
  });
  item.focus();
}

export function buildTemplatesQuery(params: TemplateQuery): ApiPath {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.tag) search.set("tag", params.tag);
  if (params.sort) search.set("sort", params.sort);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.scope && params.scope !== "public") search.set("scope", params.scope);
  const queryString = search.toString();
  const path = queryString ? apiV1Path(`templates?${queryString}`) : apiV1Path("templates");
  return unsafeApiPath(path, {
    file: "app/dashboard/templates/TemplateGalleryClient.tsx",
    reason: "Template gallery query string parameters",
  });
}

export async function fetchTemplatesWith(
  fetchFn: typeof apiFetch,
  params: TemplateQuery,
): Promise<TemplateListResponse> {
  const url = buildTemplatesQuery(params);
  const response = await fetchFn(url, { cache: "no-store" });
  return (await response.json()) as TemplateListResponse;
}

export async function fetchTemplateCollectionsWith(fetchFn: typeof apiFetch): Promise<TemplateCollectionListResponse> {
  const response = await fetchFn(apiV1Path("template-collections"), { cache: "no-store" });
  return (await response.json()) as TemplateCollectionListResponse;
}

export async function fetchTemplateCollectionDetailWith(
  fetchFn: typeof apiFetch,
  slug: string,
): Promise<TemplateCollectionDetailResponse> {
  const response = await fetchFn(apiV1Path(`template-collections/${slug}`), { cache: "no-store" });
  return (await response.json()) as TemplateCollectionDetailResponse;
}

type TemplateCardProps = {
  template: TemplateSummary;
  onPreview: (templateId: string) => void;
  onInstall: (template: TemplateSummary) => void;
  onUpgrade: () => void;
  onReport?: (templateId: string) => void;
  isPending?: boolean;
  installingId?: string | null;
  reportingId?: string | null;
  locked: boolean;
  lockBadge?: string;
  lockedLabel?: string;
  variant?: "default" | "compact";
};

type TemplateUpgradeModalProps = {
  onClose: () => void;
  upgradeHref?: string;
  linkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
};

export function TemplateUpgradeModal({ onClose, upgradeHref, linkComponent }: TemplateUpgradeModalProps) {
  const LinkComponent = linkComponent ?? Link;
  const targetHref = upgradeHref ?? "/dashboard/billing#upgrade";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-text)]/75 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-upgrade-title"
        tabIndex={-1}
        className="w-full max-w-xl border-2 border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-5 text-[var(--theme-text)] shadow-[6px_6px_0_var(--theme-accent)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-2 py-1 text-[11px] font-black tracking-[0.16em] text-[var(--theme-accent-text)]">PRO TEMPLATE</p>
            <h3 id="template-upgrade-title" className="mt-3 text-xl font-black">Pro 템플릿입니다</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">미리보기는 열려 있어요. 내 보드로 가져오려면 Pro 권한이 필요합니다.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={`grid size-11 shrink-0 place-items-center border border-[var(--theme-border-strong)] bg-[var(--theme-card)] text-sm font-black text-[var(--theme-text)] ${workshopFocus}`}
            aria-label="Pro 안내 닫기"
          >
            ×
          </button>
        </div>
        <ul className="mt-5 divide-y divide-dashed divide-[var(--theme-border-strong)] border-y border-[var(--theme-border-strong)] text-sm font-medium">
          <li className="py-3">수업 흐름과 질문 미리보기</li>
          <li className="py-3">Pro 권한으로 내 보드에 복사</li>
          <li className="py-3">업그레이드 요청 후 바로 이어서 사용</li>
        </ul>
        <div className="mt-5 grid gap-2 min-[420px]:grid-cols-2">
          <LinkComponent className={workshopPrimaryButton} href={targetHref}>
            업그레이드 요청
          </LinkComponent>
          <button
            type="button"
            onClick={onClose}
            className={workshopSecondaryButton}
          >
            미리보기로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplateCard({
  template,
  onPreview,
  onInstall,
  onUpgrade,
  onReport,
  isPending,
  installingId,
  reportingId,
  locked,
  lockBadge,
  lockedLabel,
  variant = "default",
}: TemplateCardProps) {
  const reportMenuInstanceId = useId();
  const reportMenuId = `${reportMenuInstanceId}-report-menu`;
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportButtonRef = useRef<HTMLButtonElement | null>(null);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

  const closeReportMenuAndRestoreFocus = useCallback(() => {
    setReportMenuOpen(false);
    window.requestAnimationFrame(() => reportButtonRef.current?.focus());
  }, []);

  // Register before useDismissableLayer's passive listener so Escape has one owner.
  useLayoutEffect(() => {
    if (!reportMenuOpen) return;

    const menu = reportMenuRef.current;
    if (menu) menu.id = reportMenuId;
    const focusFrame = window.requestAnimationFrame(() => {
      const currentMenu = reportMenuRef.current;
      if (!currentMenu) return;
      focusReportMenuItem(getEnabledReportMenuItems(currentMenu), 0);
    });

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (!(target instanceof Node) || !reportMenuRef.current?.contains(target)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      closeReportMenuAndRestoreFocus();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [closeReportMenuAndRestoreFocus, reportMenuId, reportMenuOpen]);

  useDismissableLayer({
    isOpen: reportMenuOpen,
    setIsOpen: setReportMenuOpen,
    anchorRef: reportButtonRef,
    boundaryRefs: [reportMenuRef],
  });

  const handleReportMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const menu = reportMenuRef.current;
    if (!menu) return;
    const items = getEnabledReportMenuItems(menu);
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;

    event.preventDefault();
    event.stopPropagation();
    focusReportMenuItem(items, nextIndex);
  };

  return (
    <article
      data-template-workshop-card
      className={cn(
        "group relative flex min-w-0 flex-col border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-3 text-[var(--theme-text)] shadow-[4px_4px_0_var(--theme-border)] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--theme-accent)] sm:p-4",
        locked ? "bg-[var(--theme-surface-muted)]" : "",
        variant === "compact" ? "min-w-[260px] max-w-[320px]" : "",
      )}
    >
      {template.coverUrl ? (
        <div
          className={cn(
            "relative h-40 overflow-hidden border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] sm:h-44",
            locked ? "after:absolute after:inset-0 after:bg-[var(--theme-card)]/45 after:backdrop-blur-[1px]" : "",
          )}
        >
          <Image
            src={template.coverUrl}
            alt={`${template.title} 커버`}
            fill
            sizes="(min-width: 1280px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div aria-hidden="true" className="relative grid h-40 place-items-center overflow-hidden border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] sm:h-44">
          <div className="absolute inset-3 border border-dashed border-[var(--theme-text)]/35" />
          <span className="absolute left-4 top-4 bg-[var(--theme-card)] px-2 py-1 font-mono text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">LESSON SHEET</span>
          <span className="text-6xl font-black text-[var(--theme-text)] opacity-80">{template.title.trim().slice(0, 1) || "곰"}</span>
        </div>
      )}
      {lockBadge ? (
        <span className="absolute right-5 top-5 z-10 border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-2 py-1 text-[11px] font-black text-[var(--theme-accent-text)] shadow-[2px_2px_0_var(--theme-border-strong)]">
          {lockBadge}
        </span>
      ) : null}
      <div className="mt-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[var(--theme-text-muted)]">
            <span className="border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2 py-1 text-[var(--theme-text)]">
              {template.installCount}명 가져감
            </span>
            <span className="border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2 py-1">
              {new Date(template.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-black tracking-[0.08em]">
            {template.accessLevel === "pro" ? (
              <span className="inline-flex items-center gap-1 border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-2 py-0.5 text-[var(--theme-accent-text)]">
                PRO
              </span>
            ) : null}
            {template.isFeatured ? (
              <span className="inline-flex items-center gap-1 border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-2 py-0.5 text-[var(--theme-accent-text)]">
                GOMDORY PICK
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-xl font-black tracking-[-0.025em] text-[var(--theme-text)]">{template.title}</h3>
          {template.description ? <p className="line-clamp-2 text-sm leading-6 text-[var(--theme-text-muted)]">{template.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span key={tag} className="border-b border-[var(--theme-border-strong)] px-1 py-0.5 text-[11px] font-bold text-[var(--theme-text-muted)]">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {onReport ? (
          <div className="relative">
            <button
              type="button"
              ref={reportButtonRef}
              aria-label="템플릿 신고 메뉴"
              aria-expanded={reportMenuOpen}
              aria-haspopup="menu"
              aria-controls={reportMenuOpen ? reportMenuId : undefined}
              onClick={() => setReportMenuOpen((prev) => !prev)}
              className={`grid size-11 cursor-pointer place-items-center border border-[var(--theme-border-strong)] bg-[var(--theme-card)] text-sm font-black text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-muted)] ${workshopFocus}`}
            >
              ···
            </button>
            <AnchoredMenu
              open={reportMenuOpen}
              anchorRef={reportButtonRef}
              menuRef={reportMenuRef}
              align="right"
              role="menu"
              className="w-32 border border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-2 text-xs text-[var(--theme-text)] shadow-[3px_3px_0_var(--theme-border)]"
            >
              <div onKeyDown={handleReportMenuKeyDown}>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    closeReportMenuAndRestoreFocus();
                    void onReport(template.id);
                  }}
                  disabled={reportingId === template.id}
                  className={`min-h-10 w-full px-3 py-2 text-left font-bold text-[var(--theme-danger)] hover:bg-[var(--theme-surface-muted)] ${workshopFocus}`}
                >
                  {reportingId === template.id ? "신고 중..." : "신고"}
                </button>
              </div>
            </AnchoredMenu>
          </div>
        ) : null}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-dashed border-[var(--theme-border-strong)] pt-4">
        <button type="button" onClick={() => void onPreview(template.id)} className={workshopSecondaryButton}>
          미리보기
        </button>
        <button
          type="button"
          data-testid={`template-install-${template.id}`}
          onClick={() => (locked ? onUpgrade() : onInstall(template))}
          aria-haspopup={locked ? "dialog" : undefined}
          aria-label={locked ? `${template.title} Pro 이용 안내 열기` : `${template.title} 내 보드로 가져오기`}
          className={cn(
            locked
              ? `cursor-pointer border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-3 text-sm font-bold text-[var(--theme-text-muted)] ${workshopFocus}`
              : workshopPrimaryButton,
            installingId === template.id ? "opacity-70" : "",
          )}
          disabled={!locked && (isPending || installingId === template.id)}
        >
          {locked ? lockedLabel ?? "Pro 안내 보기" : installingId === template.id ? "가져오는 중..." : "가져오기"}
        </button>
      </div>
    </article>
  );
}

export function TemplateGalleryClient({ isProUser, isOpsOwner, proEnabled = true, hasProTemplates }: TemplateGalleryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = useMemo<TemplateTab>(() => {
    const value = searchParams.get("tab");
    if (value === "picks") return "picks";
    if (value === "pro") return "pro";
    return "community";
  }, [searchParams]);
  const [tab, setTab] = useState<TemplateTab>(initialTab);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [collections, setCollections] = useState<TemplateCollectionSummary[]>([]);
  const [collectionDetails, setCollectionDetails] = useState<Record<string, TemplateCollectionDetail | null>>({});
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [sort, setSort] = useState<TemplateSort>("recent");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDetail | null>(null);
  const [previewContext, setPreviewContext] = useState<{
    source: "community" | "picks" | "pro_pack";
    collectionSlug?: string;
    lockMode?: "pro_plan" | "pro_pack" | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [proLockOpen, setProLockOpen] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminAccessLevel, setAdminAccessLevel] = useState<"free" | "pro">("free");
  const [adminFeatured, setAdminFeatured] = useState(false);
  const [guidedPathId, setGuidedPathId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setGuidedPathId(getGuidedPathSelection()?.pathId ?? null);
    trackMarketingFunnelEvent("guided_path_step_view", {
      location: "dashboard_templates",
      step_id: "template_gallery_view",
      path_id: "template_start",
    });
  }, []);

  const tags = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((template) => template.tags.forEach((tag) => set.add(tag)));
    return Array.from(set.values());
  }, [templates]);

  const loadTemplates = useCallback(
    async (options: { cursor?: string | null; append?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      const result = await fetchTemplatesWith(apiFetch, {
        query: debouncedQuery,
        tag: selectedTag,
        sort,
        cursor: options.cursor ?? null,
        scope: "public",
      });

      if (!result.ok) {
        setError(result.error?.message ?? "템플릿을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      setTemplates((prev) => (options.append ? [...prev, ...(result.items ?? [])] : result.items ?? []));
      setNextCursor(result.nextCursor ?? null);
      setLoading(false);
    },
    [debouncedQuery, selectedTag, sort],
  );

  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    const result = await fetchTemplateCollectionsWith(apiFetch);
    if (!result.ok) {
      setCollections([]);
      setCollectionsLoading(false);
      return;
    }
    setCollections(result.items ?? []);
    setCollectionsLoading(false);
  }, []);

  const loadCollectionDetail = useCallback(
    async (slug: string) => {
      const result = await fetchTemplateCollectionDetailWith(apiFetch, slug);
      const collection = result.collection;
      if (!result.ok || !collection) {
        return;
      }
      setCollectionDetails((prev) => ({
        ...prev,
        [slug]: {
          collection,
          items: result.items ?? [],
          locked: result.locked ?? false,
        },
      }));
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setTemplates([]);
    setNextCursor(null);
    if (tab !== "community") {
      setLoading(false);
      return;
    }
    void loadTemplates();
  }, [debouncedQuery, selectedTag, sort, tab, loadTemplates]);

  useEffect(() => {
    if (tab === "community") return;
    if (!collections.length && !collectionsLoading) {
      void loadCollections();
    }
  }, [tab, collections.length, collectionsLoading, loadCollections]);

  useEffect(() => {
    if (tab === "community") return;
    const targetKind = tab === "picks" ? "picks" : "pro_pack";
    collections
      .filter((collection) => collection.kind === targetKind)
      .forEach((collection) => {
        if (!collectionDetails[collection.slug]) {
          void loadCollectionDetail(collection.slug);
        }
      });
  }, [tab, collections, collectionDetails, loadCollectionDetail]);

  useEffect(() => {
    setSelectedTag("");
    setQuery("");
  }, [tab]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const closePreview = useCallback(() => {
    setPreviewTemplate(null);
    setPreviewLoading(false);
    setPreviewContext(null);
  }, []);

  const handleLoadMore = () => {
    if (!nextCursor || loading) return;
    void loadTemplates({ cursor: nextCursor, append: true });
  };

  const handleOpenPreview = useCallback(async (templateId: string, context?: typeof previewContext) => {
    setPreviewLoading(true);
    setPreviewTemplate(null);
    setPreviewContext(context ?? null);
    const response = await apiFetch(apiV1Path(`templates/${templateId}`), { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; template?: TemplateDetail; error?: { message: string } };
    if (payload.ok && payload.template) {
      setPreviewTemplate(payload.template);
    } else {
      setError(payload.error?.message ?? "템플릿을 불러오지 못했습니다.");
    }
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    const previewId = searchParams.get("preview");
    if (!previewId) return;
    void handleOpenPreview(previewId);
  }, [handleOpenPreview, searchParams]);

  const handleTabChange = (nextTab: TemplateTab) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "community") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    const queryString = params.toString();
    router.replace(queryString ? `/dashboard/templates?${queryString}` : "/dashboard/templates");
  };

  const handleInstall = (
    template: TemplateSummary,
    options?: { target?: "class" | "projector"; source?: "community" | "picks" | "pro_pack"; collectionSlug?: string; lockMode?: "pro_pack" | "pro_plan" },
  ) => {
    const shouldGate = proEnabled && template.accessLevel === "pro";
    if (shouldGate && !isProUser) {
      setUpgradeOpen(true);
      return;
    }

    setInstallingId(template.id);
    setError(null);
    startTransition(() => {
      void apiFetch(apiV1Path(`templates/${template.id}/import`), {
        method: "POST",
        body: JSON.stringify({
          source: options?.source,
          collectionSlug: options?.collectionSlug,
        }),
      })
        .then(
          async (response) =>
            (await response.json()) as Promise<{
              ok?: boolean;
              boardId?: string;
              error?: { code?: string; message?: string };
              code?: string;
            }>,
        )
        .then((result) => {
          if (result.ok && result.boardId) {
            trackMarketingFunnelEvent("first_template_started", {
              location: "dashboard_templates",
              path_id: guidedPathId ?? "template_start",
              template_id: template.id,
              source: options?.source ?? "community",
              board_id: result.boardId,
            });
            publishDashboardInvalidate({
              type: "boards_changed",
              reason: "created",
              ts: Date.now(),
            });
            publishDashboardInvalidate({
              type: "templates_changed",
              reason: "copied",
              ts: Date.now(),
            });
            pushDashboardToast({
              title: "템플릿으로 보드를 만들었어요",
              description: "새 보드에서 바로 수업을 시작하세요.",
            });
            const nextHref =
              options?.target === "projector"
                ? boardPresentHref(result.boardId)
                : boardBoardHref(result.boardId);
            router.push(nextHref);
          } else if (result.code === "pro_required") {
            setUpgradeOpen(true);
          } else if (result.error?.code === "pro_locked") {
            setProLockOpen(true);
          } else {
            setError(result.error?.message ?? "보드를 생성하지 못했습니다.");
          }
        })
        .catch((cause) => {
          console.error(cause);
          setError("보드를 생성하지 못했습니다.");
        })
        .finally(() => setInstallingId(null));
    });
  };

  const handleReport = async (templateId: string) => {
    if (!window.confirm("이 템플릿을 신고하시겠어요?")) return;
    setReportingId(templateId);
    setError(null);
    try {
      const response = await apiFetch(apiV1Path(`templates/${templateId}/report`), {
        method: "POST",
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        status?: string;
        reportCount?: number;
        error?: { message: string; code?: string };
        retryAfterSeconds?: number;
      };
      if (payload.ok) {
        pushDashboardToast({
          title: "신고 완료",
          description: payload.status === "hidden" ? "신고 누적으로 숨김 처리되었습니다." : "검토 후 처리됩니다.",
        });
        void loadTemplates();
      } else {
        if (response.status === 429 && payload.retryAfterSeconds) {
          setError(`잠시 후 다시 시도해주세요 (약 ${payload.retryAfterSeconds}초)`);
        } else {
          setError(payload.error?.message ?? "신고를 접수하지 못했습니다.");
        }
      }
    } finally {
      setReportingId(null);
    }
  };

  useEffect(() => {
    if (!previewTemplate) return;
    setAdminAccessLevel(previewTemplate.accessLevel);
    setAdminFeatured(previewTemplate.isFeatured);
  }, [previewTemplate]);

  const handleSaveAdmin = async () => {
    if (!previewTemplate) return;
    setAdminSaving(true);
    setError(null);
    const response = await apiFetch(apiV1Path(`templates/${previewTemplate.id}/admin`), {
      method: "PATCH",
      body: JSON.stringify({
        pro_only: adminAccessLevel === "pro",
        picks_rank: adminFeatured ? previewTemplate.featuredRank ?? 1 : null,
      }),
    });
    const payload = (await response.json()) as { ok?: boolean; template?: TemplateSummary; error?: { message: string } };
    if (payload.ok && payload.template) {
      const updated = payload.template;
      setPreviewTemplate((prev) => (prev ? { ...prev, ...updated } : prev));
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      pushDashboardToast({
        title: "운영자 설정을 저장했습니다.",
        description: "추천/Pro 상태가 업데이트되었습니다.",
      });
      void loadTemplates();
    } else {
      setError(payload.error?.message ?? "설정을 저장하지 못했습니다.");
    }
    setAdminSaving(false);
  };

  const adminPanel =
    previewTemplate && isOpsOwner ? (
      <div className="space-y-3 border-l-4 border-[var(--gom-yellow,var(--theme-accent))] bg-[var(--theme-surface-muted)] p-4 text-[var(--theme-text)]">
        <p className="font-mono text-xs font-black tracking-[0.12em] text-[var(--theme-text-muted)]">OPS · TEMPLATE</p>
        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--theme-text)]">
            <input
              type="checkbox"
              checked={adminFeatured}
              onChange={(event) => setAdminFeatured(event.target.checked)}
              className="size-5 border-[var(--theme-border-strong)] accent-[var(--theme-accent)]"
            />
            추천 템플릿으로 노출
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-[var(--theme-text-muted)]">
            접근 권한
            <select
              value={adminAccessLevel}
              onChange={(event) => setAdminAccessLevel(event.target.value as "free" | "pro")}
              className={`min-h-11 border border-[var(--theme-border-strong)] bg-[var(--theme-card)] px-3 py-2 text-sm font-bold text-[var(--theme-text)] ${workshopFocus}`}
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveAdmin()}
            disabled={adminSaving}
            className={cn(workshopSecondaryButton, adminSaving ? "opacity-70" : "")}
          >
            {adminSaving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>
    ) : null;

  const activeCollections = useMemo(() => {
    if (tab === "community") return [];
    const kind = tab === "picks" ? "picks" : "pro_pack";
    return collections.filter((collection) => collection.kind === kind);
  }, [collections, tab]);

  const openLockDialog = useCallback((mode?: "pro_plan" | "pro_pack" | null) => {
    if (mode === "pro_pack") {
      setProLockOpen(true);
      return;
    }
    setUpgradeOpen(true);
  }, []);

  return (
    <div className="space-y-6" data-template-gallery-workshop>
      <section className="border-[1.5px] border-[var(--theme-border-strong)] bg-[var(--theme-card)] shadow-[4px_4px_0_var(--theme-border)]" aria-label="템플릿 찾기">
        <div className="flex flex-col gap-4 border-b border-dashed border-[var(--theme-border-strong)] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-black tracking-[0.15em] text-[var(--theme-text-muted)]">OPEN DRAWER</p>
            <h2 className="text-xl font-black tracking-[-0.025em] text-[var(--theme-text)]">
              {tab === "community" ? "모두의 수업" : tab === "picks" ? "곰도리 추천" : "Pro 수업 묶음"}
            </h2>
            <p className="text-sm leading-6 text-[var(--theme-text-muted)]">
              {tab === "community"
                ? "제목이나 태그로 찾은 뒤, 미리보기에서 수업 흐름을 확인하세요."
                : tab === "picks"
                  ? "곧바로 수업에 쓸 만한 템플릿만 모았습니다."
                  : "Pro 수업도 전부 미리 볼 수 있습니다."}
            </p>
          </div>
          <Link className={workshopSecondaryButton} href="/dashboard">
            내 작업대로
          </Link>
        </div>
        <nav className="grid grid-cols-3 border-b border-[var(--theme-border-strong)]" aria-label="템플릿 서랍">
          {([
            { key: "community", number: "01", label: "모두의 수업" },
            { key: "picks", number: "02", label: "곰도리 추천" },
            { key: "pro", number: "03", label: "Pro 묶음" },
          ] as const).map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTabChange(item.key)}
                className={cn(
                  `min-h-16 border-r border-[var(--theme-border-strong)] px-2 py-2 text-xs font-black transition last:border-r-0 sm:px-4 ${workshopFocus}`,
                  active
                    ? "bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-[inset_0_-5px_0_var(--theme-border-strong)]"
                    : "bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-card)] hover:text-[var(--theme-text)]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="block font-mono text-[10px] opacity-65">{item.number}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {tab === "community" ? (
          <>
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_9rem]">
              <label className="flex min-h-12 min-w-0 items-center gap-3 border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-3">
                <span aria-hidden className="font-mono text-base font-black text-[var(--theme-text-muted)]">⌕</span>
                <span className="sr-only">템플릿 검색</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="제목이나 설명 검색"
                  className={`min-w-0 flex-1 border-none bg-transparent text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none ${workshopFocus}`}
                />
              </label>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as TemplateSort)}
                className={`min-h-12 w-full border border-[var(--theme-border-strong)] bg-[var(--theme-card)] px-3 text-sm font-bold text-[var(--theme-text)] ${workshopFocus}`}
                aria-label="템플릿 정렬"
              >
                <option value="recent">최근 순</option>
                <option value="popular">인기 순</option>
              </select>
            </div>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-dashed border-[var(--theme-border)] px-4 py-4 sm:px-5" aria-label="태그 필터">
                <button
                  type="button"
                  onClick={() => setSelectedTag("")}
                  className={cn(
                    `min-h-10 border px-3 text-xs font-bold ${workshopFocus}`,
                    selectedTag
                      ? "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)]"
                      : "border-[var(--theme-text)] bg-[var(--theme-text)] text-[var(--theme-card)]",
                  )}
                >
                  전체
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={cn(
                      `min-h-10 border px-3 text-xs font-bold ${workshopFocus}`,
                      selectedTag === tag
                        ? "border-[var(--theme-text)] bg-[var(--theme-text)] text-[var(--theme-card)]"
                        : "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)]",
                    )}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="border-t border-dashed border-[var(--theme-border)] px-4 py-4 text-sm font-medium text-[var(--theme-text-muted)] sm:px-5">
            {tab === "picks"
              ? "하나씩 열어보고 우리 반에 맞는 수업을 골라보세요."
              : "자물쇠가 붙어 있어도 미리보기는 열립니다."}
          </p>
        )}
      </section>

      {guidedPathId === "template_start" ? (
        <section className="border-[1.5px] border-[var(--theme-border-strong)] border-l-[9px] border-l-[var(--gom-mint,var(--theme-accent))] bg-[var(--theme-card)] p-4 shadow-[3px_3px_0_var(--theme-border)] sm:p-5">
          <p className="font-mono text-[11px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">FIRST LESSON</p>
          <h2 className="mt-1 text-lg font-black text-[var(--theme-text)]">가져온 뒤 질문만 우리 반에 맞게 바꾸세요</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">수정이 끝나면 학생 참여 화면이나 프로젝터를 바로 열 수 있습니다.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/first-lesson"
              className={workshopSecondaryButton}
              onClick={() =>
                trackMarketingFunnelEvent("guided_path_next_click", {
                  location: "dashboard_templates",
                  path_id: "template_start",
                  step_id: "template_gallery_view",
                  next_action: "first_lesson_share_setup",
                })
              }
            >
              첫 수업 준비 열기
            </Link>
          </div>
        </section>
      ) : null}

      {error ? <InlineAlert tone="error" title="요청 실패" description={error} /> : null}

      {tab === "community" ? (
        <>
          {templates.length === 0 && !loading ? (
            <div className="border-[1.5px] border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-7 text-center shadow-[3px_3px_0_var(--theme-border)] sm:p-12">
              <span aria-hidden className="mx-auto grid size-16 place-items-center border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] text-3xl font-black text-[var(--theme-text)]">+</span>
              <p className="mt-4 text-lg font-black text-[var(--theme-text)]">아직 나눠 쓸 템플릿이 없어요</p>
              <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">새 보드를 만든 뒤 템플릿으로 공개하면 이곳에 놓입니다.</p>
              <div className="mx-auto mt-5 grid max-w-md gap-2 min-[420px]:grid-cols-2">
                <Link className={workshopPrimaryButton} href="/dashboard">
                  새 보드 만들기
                </Link>
                <button
                  type="button"
                  onClick={() => void loadTemplates()}
                  className={workshopSecondaryButton}
                >
                  다시 불러오기
                </button>
              </div>
            </div>
          ) : null}

          <section className="space-y-4" aria-labelledby="community-template-heading">
            <div className="flex items-end justify-between gap-3 border-b-2 border-[var(--theme-text)] pb-2">
              <div>
                <p className="font-mono text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">DRAWER 01</p>
                <h2 id="community-template-heading" className="text-lg font-black text-[var(--theme-text)]">모두의 수업</h2>
              </div>
              <span className="border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-2 py-1 font-mono text-xs font-black text-[var(--theme-text)]">{templates.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const requiresProPlan = template.accessLevel === "pro" && proEnabled && !isProUser;
                return (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={(id) =>
                      void handleOpenPreview(id, { source: "community", lockMode: requiresProPlan ? "pro_plan" : null })
                    }
                    onInstall={(item) => handleInstall(item, { source: "community" })}
                    onUpgrade={() => openLockDialog(requiresProPlan ? "pro_plan" : null)}
                    onReport={handleReport}
                    locked={requiresProPlan}
                    installingId={installingId}
                    reportingId={reportingId}
                    isPending={isPending}
                  />
                );
              })}
            </div>
          </section>

          {loading ? <p role="status" className="border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-4 py-5 text-center text-sm font-bold text-[var(--theme-text-muted)]">템플릿을 꺼내는 중...</p> : null}

          {nextCursor ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className={workshopSecondaryButton}
              >
                더 보기
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {collectionsLoading ? <p role="status" className="border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-4 py-5 text-center text-sm font-bold text-[var(--theme-text-muted)]">수업 묶음을 꺼내는 중...</p> : null}
          {!collectionsLoading && activeCollections.length === 0 ? (
            <div className="border-[1.5px] border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-7 text-center shadow-[3px_3px_0_var(--theme-border)] sm:p-12">
              <span aria-hidden className="mx-auto grid size-16 place-items-center border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] font-mono text-2xl font-black text-[var(--theme-accent-text)]">···</span>
              <p className="mt-4 text-lg font-black text-[var(--theme-text)]">
                {tab === "picks" ? "아직 추천 수업이 없어요" : "아직 Pro 수업 묶음이 없어요"}
              </p>
              <p className="mt-2 text-sm text-[var(--theme-text-muted)]">다른 서랍에서 템플릿을 먼저 골라보세요.</p>
            </div>
          ) : null}
          {activeCollections.map((collection) => {
            const detail = collectionDetails[collection.slug];
            const items = detail?.items ?? [];
            const collectionLocked = detail?.locked ?? collection.isLocked;
            return (
              <section key={collection.slug} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--theme-text)] pb-2">
                  <div>
                    <p className="font-mono text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">{tab === "picks" ? "DRAWER 02" : "DRAWER 03"}</p>
                    <h2 className="text-lg font-black text-[var(--theme-text)]">{collection.title}</h2>
                    {collection.description ? (
                      <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">{collection.description}</p>
                    ) : null}
                  </div>
                  {collection.badge ? (
                    <span className="border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-3 py-1 text-xs font-black text-[var(--theme-accent-text)] shadow-[2px_2px_0_var(--theme-border-strong)]">
                      {collection.badge}
                    </span>
                  ) : null}
                </div>
                {detail ? (
                  items.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {items.map((template) => {
                        const requiresProPlan = template.accessLevel === "pro" && proEnabled && !isProUser;
                        const requiresProPack = collectionLocked && !hasProTemplates;
                        const locked = requiresProPlan || requiresProPack;
                        const lockMode = requiresProPack ? "pro_pack" : requiresProPlan ? "pro_plan" : null;
                        const source = tab === "picks" ? "picks" : "pro_pack";
                        return (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            onPreview={(id) =>
                              void handleOpenPreview(id, {
                                source,
                                collectionSlug: collection.slug,
                                lockMode,
                              })
                            }
                            onInstall={(item) =>
                              handleInstall(item, {
                                source,
                                collectionSlug: collection.slug,
                              })
                            }
                            onUpgrade={() => openLockDialog(lockMode)}
                            locked={locked}
                            lockBadge={requiresProPack ? "🔒 Pro" : undefined}
                            lockedLabel={requiresProPack ? "Pro 안내 보기" : undefined}
                            installingId={installingId}
                            reportingId={reportingId}
                            isPending={isPending}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-4 py-5 text-sm font-bold text-[var(--theme-text-muted)]">이 묶음에는 아직 템플릿이 없습니다.</p>
                  )
                ) : (
                  <p role="status" className="border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-4 py-5 text-sm font-bold text-[var(--theme-text-muted)]">템플릿을 꺼내는 중...</p>
                )}
              </section>
            );
          })}
        </>
      )}

      {previewLoading ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--theme-text)]/65 p-4 text-[var(--theme-bg)]">
          <div role="status" className="border border-[var(--theme-bg)] bg-[var(--theme-text)] px-5 py-4 text-sm font-black shadow-[4px_4px_0_var(--theme-accent)]">미리보기를 여는 중...</div>
        </div>
      ) : null}

      {previewTemplate ? (
        <TemplatePreviewModal
          template={previewTemplate}
          locked={
            previewContext?.lockMode === "pro_pack"
              ? !hasProTemplates
              : previewContext?.lockMode === "pro_plan"
                ? previewTemplate.accessLevel === "pro" && proEnabled && !isProUser
                : previewTemplate.accessLevel === "pro" && proEnabled && !isProUser
          }
          reportingId={reportingId}
          onClose={closePreview}
          onPrimary={() =>
            handleInstall(previewTemplate, {
              source: previewContext?.source ?? "community",
              collectionSlug: previewContext?.collectionSlug,
            })
          }
          onProjector={() =>
            handleInstall(previewTemplate, {
              target: "projector",
              source: previewContext?.source ?? "community",
              collectionSlug: previewContext?.collectionSlug,
            })
          }
          onPreviewOnly={() => setPreviewTemplate((prev) => prev ?? previewTemplate)}
          onReport={tab === "community" ? handleReport : undefined}
          onUpgrade={() => openLockDialog(previewContext?.lockMode ?? null)}
          adminControls={adminPanel}
        />
      ) : null}

      {upgradeOpen ? <TemplateUpgradeModal onClose={() => setUpgradeOpen(false)} /> : null}
      {proLockOpen ? <ProLockDialog onClose={() => setProLockOpen(false)} /> : null}
    </div>
  );
}
