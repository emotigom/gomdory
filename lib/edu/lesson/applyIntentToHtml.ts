import type { SlotCandidate } from "@/lib/edu/lesson/slotResolverV2";
import type { DecorateIntent } from "@/lib/edu/llm/responseSchemas";

const EXTERNAL_IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"%3E%3Crect width="480" height="280" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="%23475569"%3EImage placeholder%3C/text%3E%3C/svg%3E';
const IMAGE_PLACEHOLDER_STYLE =
  "display:block;width:100%;max-width:520px;height:auto;min-height:160px;outline:2px dashed #6aa; border-radius:12px; margin:12px 0;";
const IMAGE_PLACEHOLDER_CAPTION = "(시연용) 외부 이미지는 차단되어 대체 이미지로 표시됩니다.";
const INLINE_TEXT_TAGS = new Set(["h1", "h2", "h3", "p", "span"]);
const BLOCK_CONTAINER_TAGS = new Set(["section", "div", "article", "main", "aside"]);

type VisibilityDiagnostics = {
  inserted: boolean;
  insertedInto: string | null;
  selectorUsed: string;
};

const safeSrc = (src: string | undefined) => {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return EXTERNAL_IMAGE_PLACEHOLDER;
  if (/^\/\//i.test(src)) return EXTERNAL_IMAGE_PLACEHOLDER;
  if (/^data:/i.test(src)) return src;
  return src;
};

type ApplyIntentResult = {
  nextHtml: string;
  changed: boolean;
  matched: boolean;
  degradedExternalImage: boolean;
};

const findSafeContainerForImage = (target: Element): Element => {
  let current: Element | null = target;
  let hopCount = 0;
  if (!INLINE_TEXT_TAGS.has(target.tagName.toLowerCase())) return target;
  while (current && hopCount < 2) {
    current = current.parentElement;
    if (!current) break;
    const tag = current.tagName.toLowerCase();
    if (BLOCK_CONTAINER_TAGS.has(tag)) return current;
    hopCount += 1;
  }
  return target.parentElement ?? target;
};

const emitVisibilityDiagnostics = (payload: VisibilityDiagnostics) => {
  console.info("[decorate] decorate_apply_visibility", payload);
};

export const applyIntentToHtml = (html: string, slot: SlotCandidate, intent: DecorateIntent): ApplyIntentResult => {
  const degradedExternalImage =
    intent.kind === "insert_img_tag" && (!!intent.src && (/^https?:\/\//i.test(intent.src) || /^\/\//i.test(intent.src)));

  if (typeof DOMParser === "undefined") {
    if (intent.kind === "set_img_alt") {
      const nextHtml = html.replace(/<img\b([^>]*?)alt=("[^"]*"|'[^']*')?([^>]*)>/i, `<img$1alt="${intent.alt ?? ""}"$3>`);
      return { nextHtml, changed: nextHtml !== html, matched: nextHtml !== html, degradedExternalImage };
    }
    if (intent.kind === "insert_img_tag") {
      const src = safeSrc(intent.src);
      const nextHtml = html.replace(
        /<section class="edu-auto-slot">[\s\S]*?<\/section>/i,
        `<section class="edu-auto-slot"><img alt="${intent.alt ?? ""}" src="${src}" style="${IMAGE_PLACEHOLDER_STYLE}" /><div style="font-size:12px;opacity:.7;margin-top:6px;">${IMAGE_PLACEHOLDER_CAPTION}</div></section>`,
      );
      return { nextHtml, changed: nextHtml !== html, matched: nextHtml !== html, degradedExternalImage };
    }
    if (intent.kind === "set_text") {
      const nextHtml = html.replace(/<section class="edu-auto-slot">[\s\S]*?<\/section>/i, `<section class="edu-auto-slot">${intent.text}</section>`);
      return { nextHtml, changed: nextHtml !== html, matched: nextHtml !== html, degradedExternalImage };
    }
    return { nextHtml: html, changed: false, matched: false, degradedExternalImage };
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const target = doc.querySelector(slot.selector);
  if (!target) return { nextHtml: html, changed: false, matched: false, degradedExternalImage };

  if (intent.kind === "insert_img_tag") {
    const src = safeSrc(intent.src);
    const imgMarkup = `<img alt="${intent.alt ?? ""}" src="${src}" style="${IMAGE_PLACEHOLDER_STYLE}" />`;
    const captionMarkup = `<div style="font-size:12px;opacity:.7;margin-top:6px;">${IMAGE_PLACEHOLDER_CAPTION}</div>`;
    const wrapperMarkup = `${imgMarkup}${captionMarkup}`;

    const safeContainer = findSafeContainerForImage(target);
    const targetTagName = target.tagName.toLowerCase();
    if (INLINE_TEXT_TAGS.has(targetTagName)) {
      target.insertAdjacentHTML("afterend", wrapperMarkup);
    } else {
      safeContainer.insertAdjacentHTML("afterbegin", wrapperMarkup);
    }

    const insertedImg = doc.querySelector(`img[alt="${CSS.escape(intent.alt ?? "")}"]`) ?? doc.querySelector("img");
    const insertedIntoTag = insertedImg?.parentElement?.tagName.toLowerCase() ?? null;
    const insertedInsideHeading = insertedImg?.closest("h1,h2,h3") != null;
    emitVisibilityDiagnostics({
      inserted: Boolean(insertedImg),
      insertedInto: insertedInsideHeading ? `${insertedIntoTag}:heading` : insertedIntoTag,
      selectorUsed: slot.selector,
    });
  } else if (intent.kind === "set_img_alt") {
    const img = target.tagName.toLowerCase() === "img" ? target : target.querySelector("img");
    if (img) img.setAttribute("alt", intent.alt ?? "");
  } else if (intent.kind === "set_text") {
    target.textContent = intent.text ?? "";
  }

  const nextHtml = doc.documentElement.outerHTML;
  return { nextHtml, changed: nextHtml !== html, matched: true, degradedExternalImage };
};
