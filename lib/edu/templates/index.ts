import type { LessonId } from "@/lib/edu/lesson/lessonLock";
import { normalizeLessonContent, type P1Content, type P2Content, type P3Content, type P4Content } from "@/lib/edu/templates/schema";
import { renderP1 } from "@/lib/edu/templates/p1";
import { renderP2 } from "@/lib/edu/templates/p2";
import { renderP3 } from "@/lib/edu/templates/p3";
import { renderP4 } from "@/lib/edu/templates/p4";
import { escapeHtml, safeText } from "@/lib/edu/templates/utils";

type RenderResult = { html: string; css: string; js: string };

export { escapeHtml, safeText };

const buildFiles = (rendered: RenderResult) => ({
  "index.html": rendered.html,
  "style.css": rendered.css,
  "script.js": rendered.js,
});

export const renderLessonSite = (lessonId: LessonId, content: unknown) => {
  const normalized = normalizeLessonContent(lessonId, content);
  switch (lessonId) {
    case "P2":
      return buildFiles(renderP2(normalized as P2Content));
    case "P3":
      return buildFiles(renderP3(normalized as P3Content));
    case "P4":
      return buildFiles(renderP4(normalized as P4Content));
    case "P1":
    default:
      return buildFiles(renderP1(normalized as P1Content));
  }
};
