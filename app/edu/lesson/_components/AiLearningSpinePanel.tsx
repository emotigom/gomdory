"use client";
import { useMemo, useState } from "react";
import { requestAiLearningSpineAssist, type AiLearningSpineAssistPayload, type AiLearningSpineAssistUiResult } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineAssistClient";
import { getAiLearningSpineByLesson } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineCatalog";
import { getAiLearningSpineDraft, saveAiLearningSpineDraft } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineStore";

export default function AiLearningSpinePanel({ lessonNumber }: { lessonNumber: number }) {
  const config = useMemo(() => getAiLearningSpineByLesson(lessonNumber), [lessonNumber]);
  const [draft, setDraft] = useState(() => getAiLearningSpineDraft(lessonNumber));
  const [selectedPromptChipId, setSelectedPromptChipId] = useState<string | null>(config?.promptChips[0]?.id ?? null);
  const [assistResult, setAssistResult] = useState<AiLearningSpineAssistUiResult | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const aiAssistEnabled = process.env.NEXT_PUBLIC_EDU_AI_ASSIST_V1 === "1";
  if (!config) return <section className="rounded-xl border p-4 text-sm">AI 학습 스파인 준비 중입니다.</section>;
  return <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="AI 학습 스파인">
    <h3 className="font-semibold">AI 학습 스파인</h3>
    <p className="mt-2 text-sm"><b>{config.conceptCard.headline}</b> · {config.conceptCard.body}</p>
    <p className="text-xs text-slate-600 mt-1">사람 판단: {config.conceptCard.humanJudgementPoint}</p>
    <div className="mt-3 flex flex-wrap gap-2">{config.promptChips.map((c)=><button key={c.id} className={`rounded-full border px-3 py-1 text-xs ${selectedPromptChipId===c.id?"border-slate-900":""}`} aria-label={c.label} onClick={()=>setSelectedPromptChipId(c.id)}>{c.label}</button>)}</div>
    <ul className="mt-3 space-y-1 text-sm">{config.verificationItems.map((item)=><li key={item.id}><label><input type="checkbox" checked={Boolean(draft.verificationState[item.id])} onChange={(e)=>{const next={...draft,verificationState:{...draft.verificationState,[item.id]:e.target.checked}}; setDraft(next); saveAiLearningSpineDraft(next);}}/> {item.label}</label></li>)}</ul>
    {aiAssistEnabled ? <div className="mt-4 rounded-lg border border-slate-200 p-3" aria-live="polite">
      <p className="text-xs text-slate-600">도움말은 참고용입니다. 마지막 판단은 내가 하고, 근거를 확인해요.</p>
      <div className="mt-2 flex flex-wrap gap-2">{([
        ["explain","쉽게 설명"],
        ["verify","검증하기"],
        ["improve","고쳐보기"],
        ["generate_hint","다음 행동 추천"],
      ] as const).map(([taskKind,label])=><button key={taskKind} disabled={assistLoading} className="rounded-md border px-2 py-1 text-xs disabled:opacity-60" aria-label={`${label} 도움말 요청`} onClick={async ()=>{
        setAssistLoading(true);
        const payload: AiLearningSpineAssistPayload = {
          taskKind,
          lessonId: lessonNumber,
          selectedPromptChipId,
          promptSummary: draft.evidence?.promptSummary ?? null,
          verificationContext: Object.entries(draft.verificationState).filter(([,v])=>v).map(([k])=>k).join(","),
          artifactSummary: draft.evidence?.changedReason ?? null,
        };
        const result = await requestAiLearningSpineAssist(payload);
        setAssistResult(result);
        setAssistLoading(false);
      }}>{label}</button>)}
      </div>
      {assistLoading ? <p className="mt-2 text-xs text-slate-600">도움말을 준비하고 있어요…</p> : null}
      {assistResult ? <div className="mt-2 rounded-md bg-slate-50 p-2 text-sm">
        <p className="text-xs text-slate-500">{assistResult.providerMode === "server_llm" && !assistResult.fallbackUsed ? "AI 도움말" : "기본 안전 도움말"}</p>
        <p className="mt-1">{assistResult.resultText}</p>
        {assistResult.redactionApplied ? <p className="mt-1 text-xs text-slate-600">개인정보로 보일 수 있는 내용은 가린 뒤 처리했어요.</p> : null}
        <p className="mt-1 text-xs text-slate-700">다음 행동: {assistResult.nextStudentAction}</p>
      </div> : null}
    </div> : null}
  </section>;
}
