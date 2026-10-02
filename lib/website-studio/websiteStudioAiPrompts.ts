import type { WebsiteStudioBlock, WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

export function isWebsiteStudioAiAssistantEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_WEBSITE_STUDIO_AI_ASSISTANT_V1;
  if (!value) return false;
  return ["1", "true", "enabled"].includes(value.trim().toLowerCase());
}

export function buildWebsiteStudioAiPrompt(params: { actionLabel: string; block?: WebsiteStudioBlock; project?: WebsiteStudioProject; htmlCssSnippet?: string }): string {
  const base = [
    "JSON만 반환하세요.",
    "raw HTML, JS, script, iframe, external tracker를 만들지 마세요.",
    "개인정보를 포함하지 마세요.",
    "중학생 눈높이의 한국어로 작성하세요.",
    "허용 스키마(action, targetBlockId, summary, patch, warnings)만 사용하세요.",
  ].join(" ");

  if (params.block) {
    return `${base}\n동작: ${params.actionLabel}\n대상 블록: ${JSON.stringify({ id: params.block.id, kind: params.block.kind, title: params.block.title ?? "", content: params.block.content ?? "", items: params.block.items ?? [] })}`;
  }

  if (params.htmlCssSnippet) return `${base}\n동작: ${params.actionLabel}\n설명 대상 코드:${params.htmlCssSnippet.slice(0, 2000)}`;
  return `${base}\n동작: ${params.actionLabel}\n프로젝트 제목:${params.project?.title ?? ""}`;
}
