"use client";

import { useMemo, useState } from "react";

import { AI_COURSEWARE_PAGE_TEMPLATES } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageTemplates";
import { savePageDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageStore";
import type { CoursewarePageBlock, CoursewarePageDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageTypes";
import CoursewarePagePresentation from "./CoursewarePagePresentation";
import CoursewarePublishReadinessPanel from "./CoursewarePublishReadinessPanel";
import { evaluatePublishReadiness } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import CoursewareSharePanel from "./CoursewareSharePanel";
import CoursewarePublishPanel from "./CoursewarePublishPanel";
import CoursewareSafetyChecklistPanel from "../safety/CoursewareSafetyChecklistPanel";
import CoursewareAiHelperPanel from "../ai-helper/CoursewareAiHelperPanel";

const fallbackBlock = () => <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">지원하지 않는 블록</div>;

function BlockPreview({ block }: { block: CoursewarePageBlock }) {
  if (block.type === "hero") return <div><h4 className="font-semibold">{block.headlineKo}</h4><p>{block.subcopyKo}</p></div>;
  if (block.type === "text") return <div><h4 className="font-semibold">{block.headingKo}</h4><p>{block.bodyKo}</p></div>;
  if (block.type === "card-grid") return <ul>{block.cards?.map((card, i: number) => <li key={i}>{card.titleKo}</li>)}</ul>;
  if (block.type === "faq") return <ul>{block.items?.map((it, i: number) => <li key={i}>{it.questionKo}</li>)}</ul>;
  if (block.type === "checklist") return <ul>{block.items?.map((it, i: number) => <li key={i}>{it.checked ? "☑" : "☐"} {it.labelKo}</li>)}</ul>;
  if (block.type === "data-insight") return <p>{block.insightKo}</p>;
  if (block.type === "recommendation-table") return <ul>{block.rows?.map((r, i: number) => <li key={i}>{r.conditionKo}: {r.recommendationKo}</li>)}</ul>;
  if (block.type === "quiz-choice") return <div><p>{block.questionKo}</p>{block.choices?.map((c, i: number) => <button key={i} type="button" className="mr-1 rounded border px-2">{c.labelKo}</button>)}</div>;
  if (block.type === "reflection") return <p>{block.myDecisionKo || "회고를 입력해요"}</p>;
  if (block.type === "source-list") return <ul>{block.sources?.map((s, i: number) => <li key={i}>{s.labelKo}</li>)}</ul>;
  if (block.type === "button-link") return <a href={block.url} className="underline">{block.labelKo}</a>;
  if (block.type === "image-placeholder") return <p>{block.altKo}</p>;
  return fallbackBlock();
}

export default function CoursewareQuickPageBuilder({ lessonNumber }: { lessonNumber: number }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(AI_COURSEWARE_PAGE_TEMPLATES[0].templateId);
  const template = useMemo(() => AI_COURSEWARE_PAGE_TEMPLATES.find((item) => item.templateId === selectedTemplateId) ?? AI_COURSEWARE_PAGE_TEMPLATES[0], [selectedTemplateId]);
  const [draft, setDraft] = useState<CoursewarePageDraft>({ pageId: `page-${lessonNumber}`, lessonNumber, titleKo: "웹페이지 초안", descriptionKo: "", templateId: template.templateId, blocks: template.initialBlocks, updatedAt: new Date().toISOString(), source: "local-page-draft", version: 1 });

  return <section className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4"><h4 className="text-lg font-semibold">웹페이지 초안 만들기</h4><p className="text-xs text-rose-700">이름, 얼굴, 전화번호, 주소 같은 개인정보는 웹페이지에 올리지 않아요.</p><p className="text-xs">스타터 템플릿은 빠르게 시작하기 위한 예시예요. 내 주제에 맞게 꼭 수정하세요.</p><select className="mt-2 rounded border" value={selectedTemplateId} onChange={(e) => { if (draft.blocks.length > 0 && !confirm("기존 초안을 템플릿으로 바꿀까요?")) return; const next = AI_COURSEWARE_PAGE_TEMPLATES.find((v) => v.templateId === e.target.value) ?? template; setSelectedTemplateId(next.templateId); setDraft({ ...draft, templateId: next.templateId, blocks: next.initialBlocks }); }}>{AI_COURSEWARE_PAGE_TEMPLATES.map((item) => <option key={item.templateId} value={item.templateId}>{item.titleKo}</option>)}</select><div className="mt-2 flex gap-2"><button className="rounded border px-2 py-1 text-sm" onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, { id: `text-${Date.now()}`, type: "text", order: draft.blocks.length, headingKo: "제목", bodyKo: "내용" }] })}>블록 추가</button><button className="rounded bg-slate-900 px-2 py-1 text-sm text-white" onClick={() => savePageDraft({ ...draft, updatedAt: new Date().toISOString() })}>임시 저장</button></div><p className="mt-2 text-xs">이 미리보기는 안전한 블록만 보여줘요. 복잡한 JavaScript는 아직 실행하지 않아요.</p><CoursewareAiHelperPanel onApply={(text) => { const idx = draft.blocks.findIndex((b) => b.type === "hero"); if (idx >= 0) { const blocks = [...draft.blocks]; const b = { ...blocks[idx], subcopyKo: text }; blocks[idx] = b; setDraft({ ...draft, blocks }); } }} /><div className="mt-2 space-y-2 rounded border bg-white p-3"><h5 className="font-semibold">미리보기</h5>{draft.blocks.map((block, index) => <div key={block.id + index} className="rounded border p-2"><BlockPreview block={block} /></div>)}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><CoursewarePagePresentation draft={draft} /><CoursewarePublishReadinessPanel draft={draft} /></div><div className="mt-3 grid gap-3 md:grid-cols-3"><CoursewareSharePanel draft={draft} /><CoursewareSafetyChecklistPanel targetType="page-draft" targetId={draft.pageId} lessonNumber={lessonNumber} readiness={evaluatePublishReadiness(draft)} /><CoursewarePublishPanel draft={draft} /></div>{lessonNumber === 24 ? <p className="mt-2 text-xs text-blue-700">오늘은 QR/공유 흐름을 연습해요. 실제 공개 배포는 안전 점검 후 다음 단계에서 연결됩니다.</p> : null}{lessonNumber >= 30 && lessonNumber <= 31 ? <p className="mt-2 text-xs text-blue-700">발표 모드를 열어 문제, 결과물, 배운 점을 짧게 발표해 보세요.</p> : null}<p className="mt-2 text-xs">공개 링크와 QR 배포는 다음 단계에서 연결됩니다. 지금은 로컬 초안과 복사용 요약을 만들어요.</p></section>;
}
