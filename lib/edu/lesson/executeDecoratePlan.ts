import type { DecorateOpV1, DecoratePlanV1, DecorateTargetV1 } from "@/lib/edu/lesson/decoratePlan";
import type { SlotMap } from "@/lib/edu/lesson/slotMap";

const CAT_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0%25" stop-color="%23dbeafe"/%3E%3Cstop offset="100%25" stop-color="%23fef3c7"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="720" height="420" rx="24" fill="url(%23g)"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="%231e3a8a"%3E%F0%9F%90%B1%20Cat%20Placeholder%3C/text%3E%3C/svg%3E';
const GENERIC_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"%3E%3Crect width="720" height="420" rx="24" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" fill="%23334155"%3EDemo%20Image%3C/text%3E%3C/svg%3E';

type ExecuteReport = {
  appliedOps: number;
  changed: boolean;
  matched: boolean;
  degraded: boolean;
  changedNodes: Array<{
    selector: string;
    kind: "insert" | "update" | "style";
    summary: string;
    beforeSnippet: string;
    afterSnippet: string;
  }>;
  opResults: Array<{
    opId: string;
    applied: boolean;
    degraded: boolean;
    targetResolvedTo: string;
  }>;
  details: Array<{ op: DecorateOpV1["op"]; matched: boolean; changed: boolean }>;
};

const safeStyle = (style: string) => style.slice(0, 500).replace(/on\w+\s*=|javascript:/gi, "");
const STYLE_FORBIDDEN = /(opacity\s*:|position\s*:\s*fixed)/i;
const MAX_STYLE_LEN_PER_ELEMENT = 240;

const resolveSelectors = (target: DecorateTargetV1, slotMap: SlotMap): string[] => {
  if (target.kind === "selector") return [target.selector];
  switch (target.slot) {
    case "image_primary":
      return [slotMap.image_primary];
    case "image_any":
      return slotMap.image_any;
    case "heading_primary":
      return [slotMap.heading_primary];
    case "text_any":
      return slotMap.text_any;
    case "section_any":
      return slotMap.section_any;
    default:
      return [];
  }
};

const firstNode = (doc: Document, selectors: string[]): Element | null => {
  for (const selector of selectors) {
    try {
      const node = doc.querySelector(selector);
      if (node) return node;
    } catch {
      continue;
    }
  }
  return null;
};

const buildSnippet = (raw: string | null | undefined) =>
  (raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

const summarizeOp = (op: DecorateOpV1["op"]): string => {
  switch (op) {
    case "insert_media":
      return "이미지 요소를 새로 추가";
    case "add_caption":
      return "설명 캡션 텍스트를 추가";
    case "add_callout_box":
      return "콜아웃 박스를 추가";
    case "emphasize_heading":
      return "제목 강조 스타일을 적용";
    case "tidy_spacing":
      return "여백/간격 스타일을 정리";
    case "set_surface_background":
      return "표면/배경 스타일을 적용";
    case "set_surface_tone":
      return "표면 톤 스타일을 적용";
    case "set_text_style":
      return "텍스트 스타일을 조정";
    case "set_text_emphasis":
      return "텍스트 강조를 조정";
    case "set_accent_style":
      return "강조 색상 스타일을 조정";
    case "set_button_style":
      return "버튼 스타일을 조정";
    case "set_card_style":
      return "카드 스타일을 조정";
    case "set_section_style":
      return "섹션 스타일을 조정";
    default:
      return "요소를 업데이트";
  }
};

export const executeDecoratePlan = ({
  html,
  plan,
  slotMap,
}: {
  html: string;
  plan: DecoratePlanV1;
  slotMap: SlotMap;
}): { nextHtml: string; report: ExecuteReport } => {
  if (typeof DOMParser === "undefined") {
    return {
      nextHtml: html,
      report: { appliedOps: 0, changed: false, matched: false, degraded: false, changedNodes: [], opResults: [], details: [] },
    };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const details: ExecuteReport["details"] = [];
  const changedNodes: ExecuteReport["changedNodes"] = [];
  const opResults: ExecuteReport["opResults"] = [];
  let degraded = false;

  for (const [index, op] of plan.ops.entries()) {
    const selectors = resolveSelectors(op.target, slotMap);
    const node = firstNode(doc, selectors);
    const opId = `${index + 1}:${op.op}`;
    if (!node) {
      details.push({ op: op.op, matched: false, changed: false });
      opResults.push({ opId, applied: false, degraded: false, targetResolvedTo: "unresolved" });
      continue;
    }

    const before = doc.documentElement.outerHTML;
    const beforeNodeHtml = node.outerHTML;
    let opDegraded = false;

    if (op.op === "insert_media") {
      const src = op.media.kind === "cat_placeholder" ? CAT_PLACEHOLDER : GENERIC_PLACEHOLDER;
      const prominenceStyle =
        op.style.prominence === "high"
          ? "display:block;width:100%;max-width:720px;min-height:220px;border-radius:16px;outline:3px dashed #2563eb;margin:14px 0;"
          : "display:block;width:100%;max-width:560px;min-height:180px;border-radius:12px;outline:2px dashed #64748b;margin:10px 0;";
      node.insertAdjacentHTML(
        "afterbegin",
        `<img alt="시연용 이미지" src="${src}" style="${safeStyle(prominenceStyle)}" />${
          op.style.caption
            ? `<div style="${safeStyle("font-size:12px;opacity:.8;margin-top:6px;")}">(시연용) 외부 이미지는 차단되어 대체 이미지로 표시됩니다.</div>`
            : ""
        }`,
      );
      degraded = degraded || true;
      opDegraded = true;
    } else if (op.op === "add_caption") {
      node.insertAdjacentHTML("beforeend", `<div style="${safeStyle("font-size:12px;opacity:.85;margin-top:6px;")}">${op.text}</div>`);
    } else if (op.op === "emphasize_heading") {
      const toneStyle =
        op.tone === "cute"
          ? "font-weight:800;letter-spacing:.02em;background:#fef3c7;padding:4px 8px;border-radius:8px;"
          : op.tone === "bold"
            ? "font-weight:900;letter-spacing:.01em;text-transform:uppercase;"
            : "font-weight:700;letter-spacing:.01em;border-bottom:2px solid #94a3b8;display:inline-block;";
      const safeToneStyle = safeStyle(toneStyle);
      if (!STYLE_FORBIDDEN.test(safeToneStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeToneStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    } else if (op.op === "add_callout_box") {
      node.insertAdjacentHTML(
        "beforeend",
        `<div style="${safeStyle("margin-top:10px;padding:12px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;")}">${op.text}</div>`,
      );
    } else if (op.op === "tidy_spacing") {
      const style = op.level === "sm" ? "margin-top:8px;margin-bottom:8px;padding-top:2px;padding-bottom:2px;" : "margin-top:14px;margin-bottom:14px;padding-top:6px;padding-bottom:6px;";
      const safeSpacingStyle = safeStyle(style);
      if (!STYLE_FORBIDDEN.test(safeSpacingStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeSpacingStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    } else if (op.op === "set_surface_background") {
      const backgroundStyle =
        op.style.mode === "gradient"
          ? `background:linear-gradient(135deg, ${op.style.gradientFrom}, ${op.style.gradientTo});`
          : `background:${op.style.color};`;
      const textStyle = op.style.textColor ? `color:${op.style.textColor};` : "";
      const safeBgStyle = safeStyle(`${backgroundStyle}${textStyle}padding:12px;border-radius:12px;`);
      if (!STYLE_FORBIDDEN.test(safeBgStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeBgStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    } else if (op.op === "set_surface_tone") {
      const toneStyle = `${op.style.background ? `background:${op.style.background};` : ""}${op.style.textColor ? `color:${op.style.textColor};` : ""}${op.style.borderColor ? `border:1px solid ${op.style.borderColor};` : ""}${op.style.radiusLevel === "lg" ? "border-radius:16px;" : op.style.radiusLevel === "md" ? "border-radius:12px;" : op.style.radiusLevel === "sm" ? "border-radius:8px;" : ""}${op.style.shadowLevel === "md" ? "box-shadow:0 12px 26px rgba(15,23,42,0.14);" : op.style.shadowLevel === "sm" ? "box-shadow:0 8px 18px rgba(15,23,42,0.08);" : ""}${op.style.spacingToneHint === "airy" ? "padding:16px 14px;" : op.style.spacingToneHint === "compact" ? "padding:8px 10px;" : "padding:12px;"}`;
      const safeToneStyle = safeStyle(toneStyle);
      if (!STYLE_FORBIDDEN.test(safeToneStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeToneStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    } else if (op.op === "set_text_style") {
      const textStyle = `${op.style.textColor ? `color:${op.style.textColor};` : ""}${op.style.contrastAdjust === "boost" ? "font-weight:600;" : ""}`;
      const safeTextStyle = safeStyle(textStyle);
      if (!STYLE_FORBIDDEN.test(safeTextStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeTextStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    } else if (op.op === "set_text_emphasis") {
      const style = op.style.emphasisStrength === "strong" ? "font-weight:800;letter-spacing:.015em;" : op.style.emphasisStrength === "medium" ? "font-weight:700;" : "font-weight:600;";
      const safeTextStyle = safeStyle(style);
      if (!STYLE_FORBIDDEN.test(safeTextStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeTextStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    } else if (op.op === "set_accent_style" || op.op === "set_button_style" || op.op === "set_card_style" || op.op === "set_section_style") {
      const styleObj = op.style;
      const style = `${"background" in styleObj && styleObj.background ? `background:${styleObj.background};` : ""}${"textColor" in styleObj && styleObj.textColor ? `color:${styleObj.textColor};` : ""}${"accentColor" in styleObj && styleObj.accentColor ? `background:${styleObj.accentColor};` : ""}${"borderColor" in styleObj && styleObj.borderColor ? `border:1px solid ${styleObj.borderColor};` : ""}${"radiusLevel" in styleObj && styleObj.radiusLevel === "lg" ? "border-radius:16px;" : ""}${"radiusLevel" in styleObj && styleObj.radiusLevel === "md" ? "border-radius:12px;" : ""}${"radiusLevel" in styleObj && styleObj.radiusLevel === "sm" ? "border-radius:8px;" : ""}${"shadowLevel" in styleObj && styleObj.shadowLevel === "md" ? "box-shadow:0 10px 20px rgba(15,23,42,.18);" : ""}${"shadowLevel" in styleObj && styleObj.shadowLevel === "sm" ? "box-shadow:0 6px 14px rgba(15,23,42,.12);" : ""}${"spacingToneHint" in styleObj && styleObj.spacingToneHint === "airy" ? "padding:16px;" : ""}`;
      const safeToneStyle = safeStyle(style);
      if (!STYLE_FORBIDDEN.test(safeToneStyle)) {
        const merged = `${node.getAttribute("style") ?? ""};${safeToneStyle}`.slice(0, MAX_STYLE_LEN_PER_ELEMENT);
        node.setAttribute("style", merged);
      }
    }

    const after = doc.documentElement.outerHTML;
    const changed = before !== after;
    details.push({ op: op.op, matched: true, changed });
    opResults.push({
      opId,
      applied: changed,
      degraded: opDegraded,
      targetResolvedTo: selectors[0] ?? "resolved_unknown",
    });
    if (changed) {
      changedNodes.push({
        selector: selectors[0] ?? "resolved_unknown",
        kind: ["emphasize_heading", "tidy_spacing", "set_surface_background", "set_surface_tone", "set_text_style", "set_text_emphasis", "set_accent_style", "set_button_style", "set_card_style", "set_section_style"].includes(op.op) ? "style" : op.op === "insert_media" ? "insert" : "update",
        summary: summarizeOp(op.op),
        beforeSnippet: buildSnippet(beforeNodeHtml),
        afterSnippet: buildSnippet(node.outerHTML),
      });
    }
  }

  const nextHtml = doc.documentElement.outerHTML.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*['"][^'"]*['"]/gi, "");
  const appliedOps = details.filter((item) => item.changed).length;
  return {
    nextHtml,
    report: {
      appliedOps,
      changed: nextHtml !== html,
      matched: details.some((item) => item.matched),
      degraded,
      changedNodes,
      opResults,
      details,
    },
  };
};
