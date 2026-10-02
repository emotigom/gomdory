"use client";
import Link from "next/link";

type TeacherSessionSubmission = { id: string; displayLabel: string | null; titleKo: string | null; lessonNumber: number | null; publicUrl: string; submittedAt: string; };
type TeacherSessionInfo = { joinCode?: string; submissions?: TeacherSessionSubmission[]; } | null;
export default function TeacherSessionSubmissions({session}:{session:TeacherSessionInfo}){ if(!session?.joinCode) return null; const subs=session.submissions??[]; return <section><h3>세션 제출 링크</h3>{subs.length===0?<p>아직 제출된 링크가 없어요.</p>:subs.map((item)=><div key={item.id}><span>{item.displayLabel ?? '-'}</span> <span>{item.titleKo ?? '-'}</span> <span>{item.lessonNumber ?? '-'}</span> <Link href={item.publicUrl} target="_blank">open page</Link><button onClick={()=>navigator.clipboard?.writeText(item.publicUrl)}>copy link</button><span>{item.submittedAt}</span></div>)}</section>; }
