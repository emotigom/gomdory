import type { CoursewarePortfolio } from "./aiCoursewarePortfolioTypes";

export const COURSEWARE_PORTFOLIO_STORAGE_KEY = "gomdory.aiCourseware.portfolio.v1";
let memory: CoursewarePortfolio | null = null;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const makeEmptyPortfolio = (): CoursewarePortfolio => ({
  portfolioId: `portfolio-${Math.random().toString(36).slice(2, 10)}`,
  titleKo: "최종 포트폴리오",
  selectedArtifactRefs: [],
  selectedPublishedLinks: [],
  selectedRevisionEvidenceIds: [],
  finalReflection: { aiHelpedKo: "", myDecisionKo: "", nextImproveKo: "", studentConfirmed: false },
  updatedAt: new Date().toISOString(),
  source: "local-portfolio",
  version: 1,
});

export const loadPortfolio = (): { item: CoursewarePortfolio; warning?: string } => {
  if (!canUseStorage()) return { item: memory ?? makeEmptyPortfolio() };
  try {
    const raw = window.localStorage.getItem(COURSEWARE_PORTFOLIO_STORAGE_KEY);
    if (!raw) return { item: memory ?? makeEmptyPortfolio() };
    const parsed = JSON.parse(raw) as CoursewarePortfolio;
    if (parsed?.source !== "local-portfolio" || parsed?.version !== 1) return { item: memory ?? makeEmptyPortfolio(), warning: "invalid-portfolio" };
    memory = parsed;
    return { item: parsed };
  } catch {
    return { item: memory ?? makeEmptyPortfolio(), warning: "corrupt-portfolio" };
  }
};

export const savePortfolio = (item: CoursewarePortfolio): { ok: boolean } => {
  const next = { ...item, updatedAt: new Date().toISOString() };
  memory = next;
  if (!canUseStorage()) return { ok: true };
  try {
    window.localStorage.setItem(COURSEWARE_PORTFOLIO_STORAGE_KEY, JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false };
  }
};
