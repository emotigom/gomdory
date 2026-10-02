export type WaitingActionId = "image-slot" | "title-intro" | "sticker" | "text-box";

type StudentDecorateAssistContext = {
  isStudentDecorateSurface: boolean;
  primaryIntent?: "color" | "tone" | "emphasis" | "text_rewrite" | "image_replace" | "layout" | "ambiguous" | null;
  styleIntent?:
    | "background_color"
    | "background_gradient"
    | "surface_tone"
    | "accent_color"
    | "text_color_only"
    | "cta_emphasis"
    | "headline_emphasis"
    | "card_tone"
    | "section_tone"
    | "accent_emphasis"
    | "typography_tone"
    | "cute_soft_style"
    | "luxury_clean_style"
    | "playful_bright_style"
    | "none"
    | null;
  prompt?: string | null;
};

export type WaitingActionResult =
  | { ok: true; html: string; css: string; applied: WaitingActionId }
  | { ok: false; reason: "no_change" | "invalid_html" | "unsupported" | "apply_failed" };

const WAITING_ACTIONS: Record<WaitingActionId, { label: string; description: string }> = {
  "image-slot": {
    label: "그림칸 만들기",
    description: "그림 자리",
  },
  "title-intro": {
    label: "제목/한 줄 소개 먼저 쓰기",
    description: "제목과 소개",
  },
  sticker: {
    label: "스티커(아이콘) 넣기",
    description: "스티커",
  },
  "text-box": {
    label: "글상자 만들기",
    description: "글상자",
  },
};

export const applyWaitingActionChangeSet = (
  actionId: WaitingActionId,
  html: string,
  css: string,
): WaitingActionResult => {
  if (typeof DOMParser === "undefined" || typeof document === "undefined") {
    return { ok: false, reason: "unsupported" };
  }
  if (!html || !css) {
    return { ok: false, reason: "invalid_html" };
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const host = doc.querySelector("main") ?? doc.body;
  if (!host) {
    return { ok: false, reason: "invalid_html" };
  }

  if (actionId === "image-slot") {
    const existing = doc.querySelector('[data-edu-waiting-slot="image"]');
    if (!existing) {
      const section = doc.createElement("section");
      section.className = "edu-waiting-image-slot";
      section.setAttribute("data-edu-waiting-slot", "image");
      section.setAttribute("data-edu-slot", "image");
      section.setAttribute("data-slot", "photo.waiting.image");
      section.setAttribute("data-slot-id", "photo.waiting.image");
      section.innerHTML = [
        '<h3 class="edu-waiting-slot-title">그림칸</h3>',
        '<figure class="edu-waiting-image-frame">',
        '<img alt="여기에 이미지를 넣어보세요" src="" loading="lazy" decoding="async" />',
        '<figcaption>AI 이미지 자리를 만들었어요.</figcaption>',
        "</figure>",
      ].join("");
      host.appendChild(section);
    }

    const nextCss =
      css +
      `\n.edu-waiting-image-slot{margin:16px 0;padding:12px;border:1px dashed #93c5fd;border-radius:12px;background:#eff6ff;}\n` +
      `.edu-waiting-slot-title{margin:0 0 8px;font-size:14px;font-weight:700;color:#1d4ed8;}\n` +
      `.edu-waiting-image-frame{margin:0;display:grid;gap:8px;}\n` +
      `.edu-waiting-image-frame img{display:block;width:100%;min-height:180px;object-fit:cover;border-radius:10px;border:1px solid #bfdbfe;background:linear-gradient(135deg,#dbeafe,#eff6ff);}\n` +
      `.edu-waiting-image-frame figcaption{margin:0;font-size:12px;color:#1e40af;}\n`;
    return {
      ok: true,
      html: doc.documentElement.outerHTML,
      css: nextCss,
      applied: actionId,
    };
  }

  if (actionId === "text-box") {
    const existing = doc.querySelector('[data-edu-waiting-slot="text"]');
    if (!existing) {
      const section = doc.createElement("section");
      section.className = "edu-waiting-text-slot";
      section.setAttribute("data-edu-waiting-slot", "text");
      section.setAttribute("data-edu-slot", "text");
      section.setAttribute("data-slot", "text.waiting.box");
      section.setAttribute("data-slot-id", "text.waiting.box");
      section.innerHTML =
        '<h3 class="edu-waiting-slot-title">글상자</h3><p class="edu-waiting-text-content">여기에 소개 문장을 써보세요.</p>';
      host.appendChild(section);
    }
    const nextCss =
      css +
      `\n.edu-waiting-text-slot{margin:16px 0;padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;}\n` +
      `.edu-waiting-text-content{margin:0;font-size:14px;line-height:1.6;color:#334155;}\n`;
    return {
      ok: true,
      html: doc.documentElement.outerHTML,
      css: nextCss,
      applied: actionId,
    };
  }

  return { ok: false, reason: "unsupported" };
};

export const WAITING_ACTION_LABELS = WAITING_ACTIONS;

const EXPLICIT_STRUCTURE_PATTERN = /(그림칸|이미지칸|이미지\s*자리|사진\s*칸|글상자|텍스트\s*상자|소개칸|섹션\s*(추가|만들)|카드\s*(추가|만들)|추가해줘|넣어줘)/i;

const STYLE_ONLY_INTENTS = new Set([
  "background_gradient",
  "background_color",
  "surface_tone",
  "accent_color",
  "text_color_only",
  "card_tone",
  "section_tone",
  "typography_tone",
  "cute_soft_style",
  "luxury_clean_style",
  "playful_bright_style",
]);

export const shouldShowStudentDecorateAssistUi = (input: {
  isStudentDecorateSurface: boolean;
  isTeacherMode: boolean;
}) => !input.isStudentDecorateSurface || input.isTeacherMode;

export const shouldShowStructureFallbackActions = (input: StudentDecorateAssistContext) => {
  if (!input.isStudentDecorateSurface) return true;
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) return false;
  if (STYLE_ONLY_INTENTS.has(input.styleIntent ?? "none")) return false;
  if (input.primaryIntent === "text_rewrite") return false;
  if (input.primaryIntent === "image_replace") return true;
  return EXPLICIT_STRUCTURE_PATTERN.test(prompt);
};

export const getContextualFallbackActions = (
  input: StudentDecorateAssistContext,
): WaitingActionId[] => {
  if (!shouldShowStructureFallbackActions(input)) {
    return [];
  }
  if (input.primaryIntent === "text_rewrite") {
    return ["title-intro"];
  }
  if (input.primaryIntent === "image_replace") {
    return ["image-slot"];
  }
  return ["image-slot", "text-box"];
};
