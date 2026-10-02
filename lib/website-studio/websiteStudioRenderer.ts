import type { WebsiteStudioBlock, WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";
import { isSafeWebsiteStudioUrl } from "@/lib/website-studio/websiteStudioUrlSafety";

function escapeHtml(value: string | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBlock(block: WebsiteStudioBlock): string {
  switch (block.kind) {
    case "hero":
      return `<section class="ws-block ws-hero"><h1>${escapeHtml(block.title)}</h1><p>${escapeHtml(block.content)}</p>${block.buttonLabel ? `<button>${escapeHtml(block.buttonLabel)}</button>` : ""}</section>`;
    case "text":
      return `<section class="ws-block ws-text"><h2>${escapeHtml(block.title)}</h2><p>${escapeHtml(block.content)}</p></section>`;
    case "cardGrid":
      return `<section class="ws-block ws-card-grid"><h2>${escapeHtml(block.title)}</h2><div class="ws-cards">${(block.items ?? []).map((item) => `<article class="ws-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join("")}</div></section>`;
    case "image":
      return `<section class="ws-block ws-image"><div class="ws-image-placeholder">${escapeHtml(block.imageAlt ?? block.title ?? "이미지 자리")}</div><p>${escapeHtml(block.content)}</p></section>`;
    case "quiz":
      return `<section class="ws-block ws-quiz"><h2>${escapeHtml(block.title || "퀴즈")}</h2><p>${escapeHtml(block.content)}</p></section>`;
    case "linkButton": {
      const safe = isSafeWebsiteStudioUrl(block.buttonHref ?? "") ? block.buttonHref : "";
      return `<section class="ws-block ws-link">${safe ? `<a class="ws-link-button" href="${escapeHtml(safe)}">${escapeHtml(block.buttonLabel || "링크")}</a>` : "<p>안전하지 않은 URL입니다.</p>"}</section>`;
    }
    case "footer":
      return `<footer class="ws-block ws-footer">${escapeHtml(block.content)}</footer>`;
    default:
      return "";
  }
}

export function renderWebsiteProjectToHtml(project: WebsiteStudioProject): string {
  const page = project.pages[0];
  return `<main class="ws-root">${page.blocks.map(renderBlock).join("\n")}</main>`;
}

export function renderWebsiteProjectToCss(): string {
  return `.ws-root{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:24px;line-height:1.5}.ws-block{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}.ws-hero{background:#eef2ff}.ws-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ws-card{border:1px solid #cbd5e1;border-radius:8px;padding:8px}.ws-image-placeholder{height:160px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;border-radius:8px}.ws-link-button{display:inline-block;padding:8px 12px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none}`;
}

export function renderWebsiteProjectToDocument(project: WebsiteStudioProject): string {
  const html = renderWebsiteProjectToHtml(project);
  const css = renderWebsiteProjectToCss();
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body>${html}</body></html>`;
}

const FORBIDDEN_PATTERNS = [/<script/i, /<\/script/i, /\bon(?:click|error|load|submit|focus|blur|change|input|mouseover|mouseenter|mouseleave|keydown|keyup|keypress)\s*=/i, /javascript:/i, /data:/i, /vbscript:/i, /<iframe/i];

export function assertWebsiteStudioDocumentIsScriptFree(document: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(document)) {
      throw new Error(`Unsafe markup detected: ${pattern}`);
    }
  }
}
