"use client";

import { useMemo, useState } from "react";
import { listDrafts } from "@/lib/edu/courseware/aiCoursewareDraftStore";
import { listRevisionEvidence } from "@/lib/edu/courseware/aiHelper/aiCoursewareRevisionEvidence";
import { loadPortfolio, savePortfolio } from "@/lib/edu/courseware/portfolio/aiCoursewarePortfolioStore";
import { buildPortfolioExportJson, buildShowcaseSummaryKo, isFinalReflectionComplete } from "@/lib/edu/courseware/portfolio/aiCoursewarePortfolioSummary";

export default function CoursewarePortfolioPanel() {
  const [portfolio, setPortfolio] = useState(() => loadPortfolio().item);
  const drafts = Object.values(listDrafts().drafts);
  const revision = listRevisionEvidence().items;
  const summary = useMemo(() => buildShowcaseSummaryKo(portfolio, revision.length), [portfolio, revision.length]);

  const addFromDraft = (idx: number) => {
    const d = drafts[idx]; if (!d) return;
    const next = { ...portfolio, selectedArtifactRefs: [...portfolio.selectedArtifactRefs, { refId: crypto.randomUUID(), lessonNumber: d.lessonNumber, artifactType: d.artifactType, artifactLabelKo: d.artifactLabelKo, titleKo: d.titleKo, summaryKo: d.bodyKo, source: "artifact-draft" as const }] };
    setPortfolio(next); savePortfolio(next);
  };

  return <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"><h3 className="text-lg font-semibold">최종 포트폴리오 만들기</h3><p>32차시 동안 만든 작은 결과물을 모아요.</p><p>AI가 도와준 부분과 내가 직접 판단한 부분을 구분해요.</p><p>완벽한 작품보다 배운 과정을 보여주는 것이 중요해요.</p>
  <p className="text-xs">이름은 실명 대신 팀 번호/닉네임 권장</p>
  <div><strong>결과물 선택(3~5개 권장)</strong>{drafts.length===0?<p>아직 모을 결과물이 없어요. 오늘 만든 것부터 하나 선택해도 괜찮아요.</p>:drafts.slice(0,8).map((d,i)=><button key={d.draftId} className="ml-2 rounded border px-2" onClick={()=>addFromDraft(i)}>{d.lessonNumber}차시 {d.artifactLabelKo}</button>)}</div>
  <div><strong>수정 기록</strong><p>AI 초안을 그대로 쓰지 않고 내가 고친 기록이에요.</p><p>이 기록이 있으면 AI 복붙이 아니라 학습 과정으로 설명할 수 있어요.</p>{revision.length===0?<p>수정 기록이 없어도 포트폴리오는 만들 수 있어요. 대신 내가 직접 판단한 부분을 적어주세요.</p>:revision.slice(0,3).map((v)=><div key={v.evidenceId} className="text-xs border p-2 my-1">AI: {v.aiDraftKo.slice(0,40)} / 학생: {v.studentRevisionKo.slice(0,40)} / 이유: {v.revisionReasonKo ?? "-"} / {v.generatedBy}</div>)}</div>
  <div><strong>최종 성찰</strong><input className="w-full border" placeholder="AI가 도와준 부분" value={portfolio.finalReflection.aiHelpedKo} onChange={(e)=>{const next={...portfolio,finalReflection:{...portfolio.finalReflection,aiHelpedKo:e.target.value}};setPortfolio(next);savePortfolio(next);}}/><input className="w-full border" placeholder="내가 직접 판단한 부분" value={portfolio.finalReflection.myDecisionKo} onChange={(e)=>{const next={...portfolio,finalReflection:{...portfolio.finalReflection,myDecisionKo:e.target.value}};setPortfolio(next);savePortfolio(next);}}/><input className="w-full border" placeholder="다음에 개선할 부분" value={portfolio.finalReflection.nextImproveKo} onChange={(e)=>{const next={...portfolio,finalReflection:{...portfolio.finalReflection,nextImproveKo:e.target.value}};setPortfolio(next);savePortfolio(next);}}/><label><input type="checkbox" checked={portfolio.finalReflection.studentConfirmed} onChange={(e)=>{const next={...portfolio,finalReflection:{...portfolio.finalReflection,studentConfirmed:e.target.checked}};setPortfolio(next);savePortfolio(next);}}/>이 포트폴리오는 AI 도움을 받았지만, 최종 내용은 내가 확인하고 수정했어요.</label></div>
  <div><strong>2분 발표용 요약</strong><pre className="whitespace-pre-wrap text-xs">{summary}</pre><button className="rounded border px-2" onClick={()=>navigator.clipboard?.writeText(summary)}>요약 복사</button><button className="rounded border px-2 ml-2" onClick={()=>navigator.clipboard?.writeText(buildPortfolioExportJson(portfolio))}>JSON 복사</button></div>
  <p className="text-xs">완료 상태: {isFinalReflectionComplete(portfolio)?"complete":"draft"}</p>
  </section>;
}
