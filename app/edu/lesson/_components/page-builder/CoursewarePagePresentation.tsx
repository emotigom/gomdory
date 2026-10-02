import type { CoursewarePageDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageTypes";
import { sanitizeDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageSanitizer";

export default function CoursewarePagePresentation({ draft }: { draft: unknown }) {
  const safe = sanitizeDraft(draft);
  if (!safe) return <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm">페이지 초안을 불러오지 못했어요. 빌더에서 다시 저장해 주세요.</div>;
  return <section className="rounded-xl border bg-white p-4"><h5 className="font-semibold">발표 모드</h5><p className="text-xs text-slate-600">편집 도구 없이 결과만 보여줘요. 안전한 블록만 발표 화면에 표시됩니다.</p><div className="mt-3 space-y-2">{safe.blocks.map((block, i) => <article key={`${block.id}-${i}`} className="rounded border p-2 text-sm">{renderBlock(block)}</article>)}</div></section>;
}

function renderBlock(block: CoursewarePageDraft["blocks"][number]) {
  if (block.type === "hero") return <><h6 className="font-semibold">{block.headlineKo}</h6><p>{block.subcopyKo}</p></>;
  if (block.type === "text") return <><h6 className="font-semibold">{block.headingKo}</h6><p>{block.bodyKo}</p></>;
  if (block.type === "source-list") return <ul>{block.sources.map((s, i) => <li key={i}>{s.labelKo}</li>)}</ul>;
  if (block.type === "reflection") return <p>{block.myDecisionKo}</p>;
  if (block.type === "button-link") return <a href={block.url} className="underline">{block.labelKo}</a>;
  if (block.type === "checklist") return <ul>{block.items.map((it, i) => <li key={i}>{it.checked ? "☑" : "☐"} {it.labelKo}</li>)}</ul>;
  if (block.type === "card-grid") return <ul>{block.cards.map((c, i) => <li key={i}>{c.titleKo}</li>)}</ul>;
  if (block.type === "faq") return <ul>{block.items.map((it, i) => <li key={i}>{it.questionKo}</li>)}</ul>;
  if (block.type === "data-insight") return <p>{block.insightKo}</p>;
  if (block.type === "recommendation-table") return <ul>{block.rows.map((r, i) => <li key={i}>{r.conditionKo}: {r.recommendationKo}</li>)}</ul>;
  if (block.type === "quiz-choice") return <p>{block.questionKo}</p>;
  if (block.type === "image-placeholder") return <p>{block.altKo}</p>;
  return <p className="text-xs text-amber-700">지원하지 않는 블록이라 발표 화면에서 숨겼어요.</p>;
}
