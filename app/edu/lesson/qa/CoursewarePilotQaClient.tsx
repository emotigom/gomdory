"use client";

import { useEffect, useState } from "react";
import { buildPilotQaDemoData } from "@/lib/edu/courseware/qa/aiCoursewareDemoData";
import { buildReadinessReport, inspectPilotQaLocalData, PILOT_QA_LOCAL_KEYS, PILOT_QA_ROUTES } from "@/lib/edu/courseware/qa/aiCoursewarePilotQaChecks";
import { resetPilotQaAllLocalData, resetPilotQaKey } from "@/lib/edu/courseware/qa/aiCoursewareLocalReset";

export function CoursewarePilotQaClient() {
  const [tick, setTick] = useState(0);
  const [checks, setChecks] = useState(() => inspectPilotQaLocalData(null));
  const [checkedAt, setCheckedAt] = useState("확인 중");
  const feature = { publicPublishEnabled: true, classSessionsEnabled: true, aiHelperEnabled: true };

  useEffect(() => {
    setChecks(inspectPilotQaLocalData(window.localStorage));
    setCheckedAt(new Date().toISOString());
  }, [tick]);

  const report = buildReadinessReport({ checkedAt, feature, localStatusSummary: checks.map((v) => `${v.label}:${v.status}`).join(", ") });

  return <main data-courseware-pilot-qa="ai-courseware-pilot-qa" data-marker-version="ai-courseware-qa-v1" className="p-6 space-y-4">
    <h1>AI Courseware 파일럿 QA</h1>
    <p>수업 전 테스트용 데모 데이터 만들기</p><p>실제 학생 데이터가 아니라 브라우저에만 저장되는 연습 데이터입니다.</p><p>공개 배포는 자동으로 하지 않습니다.</p>
    <section><h2>Route Checklist</h2>{PILOT_QA_ROUTES.map((r)=><div key={r.path}><strong>{r.label}</strong> {r.path} / {r.status} <button onClick={()=>window.open(r.path.replace("[shareId]","demoqa1"),"_blank")}>열기</button></div>)}</section>
    <section><h2>Feature Gate</h2><p>공개 링크 저장소: {feature.publicPublishEnabled?"사용 가능":"꺼져 있어도 수업은 진행할 수 있어요."}</p><p>수업 코드 제출: {feature.classSessionsEnabled?"사용 가능":"꺼져 있어도 수업은 진행할 수 있어요."}</p><p>AI 초안 도우미: {feature.aiHelperEnabled?"사용 가능":"AI 도우미가 꺼져 있으면 템플릿 예시로 진행됩니다."}</p></section>
    <section><h2>Local Data</h2>{checks.map((c)=><div key={c.key}>{c.label}: {c.status}</div>)}</section>
    <section><button onClick={()=>{ const demo=buildPilotQaDemoData(); Object.entries(demo).forEach(([k,v])=>window.localStorage.setItem(k, JSON.stringify(v))); setTick((v)=>v+1); }}>데모 데이터 만들기</button></section>
    <section><p>공용 기기를 다음 반이 쓰기 전에는 Courseware 로컬 데이터를 초기화하세요.</p><p>전체 reset은 이 브라우저의 임시 결과물과 진행 상태를 삭제합니다. 필요한 결과물은 먼저 복사하거나 JSON으로 보관하세요.</p><p>서버에 공개된 페이지나 제출 기록은 삭제하지 않습니다.</p><p>실제 공개 링크 삭제는 별도 관리 기능에서 다뤄야 합니다.</p>{PILOT_QA_LOCAL_KEYS.map((k)=><button key={k.key} onClick={()=>{ if (window.confirm(`${k.label} 삭제`)) { resetPilotQaKey(window.localStorage,k.key); setTick((v)=>v+1);} }}>{k.label} reset</button>)}<button onClick={()=>{ if(window.confirm("모든 courseware 로컬 데이터 삭제")){ resetPilotQaAllLocalData(window.localStorage); setTick((v)=>v+1);} }}>전체 reset</button></section>
    <section><h2>Runbook</h2><ul><li>AI unavailable → use template fallback</li><li>publish disabled → use presentation/share shell</li><li>session disabled → use manual link collector</li><li>slow network → use paper/card activity first</li><li>student absent → use recovery pack</li><li>safety issue → keep private and revise</li></ul></section>
    <section><h2>Readiness Report</h2><textarea readOnly value={report} className="w-full min-h-40" /><button onClick={()=>navigator.clipboard?.writeText(report)}>복사</button></section>
  </main>;
}
