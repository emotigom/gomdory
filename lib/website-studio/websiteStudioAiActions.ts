import type { WebsiteStudioBlock, WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

const MAX_TEXT = 300;
const MAX_ITEMS = 6;
const UNSAFE = ["<script", "javascript:", "data:", "vbscript:", "onerror=", "onclick=", "<iframe"];

type BaseResult = { action: string; summary: string; warnings: string[]; targetBlockId?: string };
export type WebsiteStudioAiActionResult =
  | (BaseResult & { action: "updateBlockText"; patch: { title?: string; content?: string; buttonLabel?: string } })
  | (BaseResult & { action: "replaceCardGridItems"; patch: { items: { title: string; description: string }[] } })
  | (BaseResult & { action: "updateQuizOptions"; patch: { options: string[] } })
  | (BaseResult & { action: "suggestProjectTitle"; patch: { title: string } })
  | (BaseResult & { action: "explainGeneratedCode"; patch: { explanation: string } })
  | (BaseResult & { action: "privacyCheck"; patch: { riskLevel: "low" | "medium" | "high"; findings: string[]; suggestedFixes: string[] } })
  | (BaseResult & { action: "noOp"; patch: Record<string, never> });

type CardGridPatch = { items?: { title?: unknown; description?: unknown }[] };
type TextPatch = { title?: unknown; explanation?: unknown };
type PrivacyPatch = { riskLevel?: unknown; findings?: unknown[]; suggestedFixes?: unknown[] };

export type ValidationResult = { ok: true; value: WebsiteStudioAiActionResult } | { ok: false; error: string };

function hasUnsafeText(value: string): boolean {
  const lower = value.toLowerCase();
  return UNSAFE.some((token) => lower.includes(token));
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TEXT || hasUnsafeText(trimmed)) return null;
  return trimmed;
}

function findBlock(project: WebsiteStudioProject, id: string): WebsiteStudioBlock | undefined {
  return project.pages[0]?.blocks.find((block) => block.id === id);
}

export function validateWebsiteStudioAiAction(action: unknown, project: WebsiteStudioProject): ValidationResult {
  if (!action || typeof action !== "object") return { ok: false, error: "안전한 AI 제안 형식이 아닙니다." };
  const candidate = action as Record<string, unknown>;
  if (typeof candidate.action !== "string") return { ok: false, error: "AI 동작 이름이 없습니다." };
  const summary = sanitizeText(candidate.summary);
  if (!summary) return { ok: false, error: "요약이 안전하지 않습니다." };
  const warnings = Array.isArray(candidate.warnings) ? candidate.warnings.map((v) => sanitizeText(v)).filter(Boolean) as string[] : [];

  if (candidate.action === "updateBlockText") {
    const blockId = sanitizeText(candidate.targetBlockId);
    if (!blockId) return { ok: false, error: "대상 블록이 없습니다." };
    const block = findBlock(project, blockId);
    if (!block || !["hero", "text", "linkButton", "footer"].includes(block.kind)) return { ok: false, error: "블록 종류가 맞지 않습니다." };
    const patch = (candidate.patch ?? {}) as Record<string, unknown>;
    const allowed = ["title", "content", "buttonLabel"];
    if (Object.keys(patch).some((k) => !allowed.includes(k))) return { ok: false, error: "허용되지 않은 필드가 포함되었습니다." };
    const title = patch.title === undefined ? undefined : sanitizeText(patch.title);
    const content = patch.content === undefined ? undefined : sanitizeText(patch.content);
    const buttonLabel = patch.buttonLabel === undefined ? undefined : sanitizeText(patch.buttonLabel);
    if (patch.title !== undefined && !title) return { ok: false, error: "제목이 안전하지 않습니다." };
    return { ok: true, value: { action: "updateBlockText", summary, warnings, targetBlockId: blockId, patch: { ...(title ? { title } : {}), ...(content ? { content } : {}), ...(buttonLabel ? { buttonLabel } : {}) } } };
  }

  if (candidate.action === "replaceCardGridItems") {
    const blockId = sanitizeText(candidate.targetBlockId);
    const block = blockId ? findBlock(project, blockId) : undefined;
    if (!blockId || !block || block.kind !== "cardGrid") return { ok: false, error: "카드 블록 대상이 올바르지 않습니다." };
    const items = (candidate.patch as CardGridPatch | undefined)?.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) return { ok: false, error: "카드 개수가 올바르지 않습니다." };
    const safe = items.map((item) => ({ title: sanitizeText(item?.title), description: sanitizeText(item?.description) }));
    if (safe.some((item) => !item.title || !item.description)) return { ok: false, error: "카드 내용이 안전하지 않습니다." };
    return { ok: true, value: { action: "replaceCardGridItems", summary, warnings, targetBlockId: blockId, patch: { items: safe as { title: string; description: string }[] } } };
  }

  if (candidate.action === "noOp") return { ok: true, value: { action: "noOp", summary, warnings, patch: {} } };

  if (candidate.action === "suggestProjectTitle") {
    const title = sanitizeText((candidate.patch as TextPatch | undefined)?.title);
    if (!title) return { ok: false, error: "제목 추천이 안전하지 않습니다." };
    return { ok: true, value: { action: "suggestProjectTitle", summary, warnings, patch: { title } } };
  }

  if (candidate.action === "explainGeneratedCode") {
    const explanation = sanitizeText((candidate.patch as TextPatch | undefined)?.explanation);
    if (!explanation) return { ok: false, error: "설명이 안전하지 않습니다." };
    return { ok: true, value: { action: "explainGeneratedCode", summary, warnings, patch: { explanation } } };
  }

  if (candidate.action === "privacyCheck") {
    const patch = (candidate.patch ?? {}) as PrivacyPatch;
    const { riskLevel } = patch;
    if (typeof riskLevel !== "string" || !["low", "medium", "high"].includes(riskLevel)) return { ok: false, error: "위험도 형식이 올바르지 않습니다." };
    const safeRiskLevel = riskLevel as "low" | "medium" | "high";
    const findings = Array.isArray(patch.findings) ? patch.findings.map(sanitizeText).filter(Boolean) as string[] : [];
    const suggestedFixes = Array.isArray(patch.suggestedFixes) ? patch.suggestedFixes.map(sanitizeText).filter(Boolean) as string[] : [];
    return { ok: true, value: { action: "privacyCheck", summary, warnings, patch: { riskLevel: safeRiskLevel, findings, suggestedFixes } } };
  }

  return { ok: false, error: "허용되지 않은 AI 동작입니다." };
}

export function applyWebsiteStudioAiAction(project: WebsiteStudioProject, action: WebsiteStudioAiActionResult): WebsiteStudioProject {
  const next = structuredClone(project);
  if (action.action === "updateBlockText" && action.targetBlockId) {
    const block = next.pages[0].blocks.find((item) => item.id === action.targetBlockId);
    if (block) Object.assign(block, action.patch);
  }
  if (action.action === "replaceCardGridItems" && action.targetBlockId) {
    const block = next.pages[0].blocks.find((item) => item.id === action.targetBlockId);
    if (block?.kind === "cardGrid") block.items = action.patch.items;
  }
  if (action.action === "suggestProjectTitle") next.title = action.patch.title;
  return next;
}
