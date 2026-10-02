"use client";

import { useState } from "react";

type JoinLesson = { lessonNumber: number; titleKo: string };
type SessionResponse = { status: "ok"; dayNumber: number; lessons?: JoinLesson[] };
type SubmitResponse = { status: "ok"; publicUrl: string } | { status: string };

export default function CoursewareSessionJoinClient() {
  const [code, setCode] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);

  return <main data-courseware-session-join="ai-courseware-session-join" data-marker-version="ai-courseware-session-v1" className="p-6 space-y-3"><h1>수업 코드로 결과물 제출</h1><p>공개 링크를 붙여넣으세요.</p><p>실명 대신 팀명이나 번호를 써도 됩니다.</p><p>개인정보가 들어간 페이지는 제출하지 마세요.</p><p>제출 전 안전 점검을 완료했는지 확인하세요.</p><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="수업 코드" /><button onClick={async () => { const r = await fetch(`/api/edu/courseware/session/${encodeURIComponent(code)}`); const j: { status?: string; dayNumber?: number; lessons?: JoinLesson[] } = await r.json(); setSession(j.status === "ok" && typeof j.dayNumber === "number" ? { status: "ok", dayNumber: j.dayNumber, lessons: j.lessons } : null); }}>세션 확인</button>{session ? <div><p>Day {session.dayNumber}</p><p>{session.lessons?.map((l) => `${l.lessonNumber} ${l.titleKo}`).join(" / ")}</p></div> : null}<input value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} placeholder="/edu/courseware/p/[shareId] 또는 shareId" /><input value={displayLabel} onChange={(e) => setDisplayLabel(e.target.value)} placeholder="표시 이름(선택)" /><button onClick={async () => { const r = await fetch('/api/edu/courseware/session/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ joinCode: code, publicUrl, displayLabel }) }); const response: { status?: string; publicUrl?: string } = await r.json(); setResult(response.status === "ok" && typeof response.publicUrl === "string" ? { status: "ok", publicUrl: response.publicUrl } : { status: response.status ?? "error" }); }}>제출</button>{result?.status === 'ok' && 'publicUrl' in result ? <p>제출 완료: {result.publicUrl}</p> : null}</main>;
}
