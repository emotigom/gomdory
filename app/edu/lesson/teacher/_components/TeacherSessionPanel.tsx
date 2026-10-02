"use client";

type TeacherSessionPanelCreateResponse = {
  status?: string;
  joinCode?: string;
};

export default function TeacherSessionPanel({dayNumber,onCreated}:{dayNumber:number;onCreated:(v:TeacherSessionPanelCreateResponse)=>void}){ return <section><h2>수업 코드 세션</h2><button onClick={async()=>{const r=await fetch('/api/edu/courseware/session/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({dayNumber})}); onCreated((await r.json()) as TeacherSessionPanelCreateResponse);}}>오늘 수업 코드 만들기</button><p>학생은 이 코드로 들어와 발표 링크를 제출해요.</p><p>실명 대신 팀명이나 번호를 사용해도 좋아요.</p><p>수업 코드는 개인정보가 아니지만 외부에 넓게 공유하지 마세요.</p></section>; }
