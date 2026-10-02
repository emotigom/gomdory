import type { WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

export type WebsiteStudioSuggestionMeta = {
  targetBlockId: string;
  targetBlockKind: string;
  editorRevision: number;
};

export function canApplyWebsiteStudioSuggestionSafely(project: WebsiteStudioProject, meta: WebsiteStudioSuggestionMeta, currentRevision: number): { ok: boolean } {
  const target = project.pages[0]?.blocks.find((block) => block.id === meta.targetBlockId);
  if (!target) return { ok: false };
  if (target.kind !== meta.targetBlockKind) return { ok: false };
  if (currentRevision !== meta.editorRevision) return { ok: false };
  return { ok: true };
}
