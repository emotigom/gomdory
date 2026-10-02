"use client";

import Link from "next/link";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import { useEffect, useMemo, useRef, useState } from "react";
import WebsiteStudioQrCode from "@/app/dashboard/websites/_components/WebsiteStudioQrCode";
import { useSearchParams } from "next/navigation";
import TeacherSessionPanel from "./_components/TeacherSessionPanel";
import TeacherSessionSubmissions from "./_components/TeacherSessionSubmissions";
import { getCoursewareLessonsByDay } from "@/lib/edu/courseware/aiCoursewareSelectors";
import { createDefaultTeacherDashboardState, loadTeacherDashboardState, saveTeacherDashboardState } from "@/lib/edu/courseware/teacher/aiCoursewareTeacherDashboardStore";
import { parseTeacherShareInput } from "@/lib/edu/courseware/teacher/aiCoursewareTeacherLinkParser";
import TeacherFinalShowcasePanel from "./_components/TeacherFinalShowcasePanel";
import TeacherDayPicker from "./_components/TeacherDayPicker";
import TeacherTodayRunPanel from "./_components/TeacherTodayRunPanel";
import TeacherToolChecklist from "./_components/TeacherToolChecklist";
import TeacherRecoveryBrief from "./_components/TeacherRecoveryBrief";

type TeacherSessionSubmission = { id: string; displayLabel: string | null; titleKo: string | null; lessonNumber: number | null; publicUrl: string; submittedAt: string };
type TeacherSessionInfo = { status?: string; joinCode?: string; submissions?: TeacherSessionSubmission[] };

type PublishedSite = { id: string; title: string; slug: string; templateId: string; originDay: string | null; publishedAt: string | null; updatedAt: string; safetyStatus: "ready" | "needs-review"; status?: "published" | "unpublished" };

export default function CoursewareTeacherDashboardClient({ initialBoardId, publishedSites }: { initialBoardId?: string; publishedSites: PublishedSite[] }) {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("boardId") ?? initialBoardId;
  const [state, setState] = useState(() => createDefaultTeacherDashboardState(1));

  useEffect(() => {
    const loaded = loadTeacherDashboardState(1);
    const normalizedDayNumber = Number.isInteger(loaded.selectedDayNumber) && loaded.selectedDayNumber >= 1 && loaded.selectedDayNumber <= 16 ? loaded.selectedDayNumber : 1;
    setState(normalizedDayNumber === loaded.selectedDayNumber ? loaded : { ...loaded, selectedDayNumber: normalizedDayNumber });
  }, []);

  const selectedDayNumber = Number.isInteger(state.selectedDayNumber) && state.selectedDayNumber >= 1 && state.selectedDayNumber <= 16 ? state.selectedDayNumber : 1;
  const [linkInput, setLinkInput] = useState("");
  const [labelKo, setLabelKo] = useState("");
  const [noteKo, setNoteKo] = useState("");
  const [sessionInfo, setSessionInfo] = useState<TeacherSessionInfo | null>(null);
  const [openQrSiteId, setOpenQrSiteId] = useState<string | null>(null);

  const [gallerySites, setGallerySites] = useState<PublishedSite[]>(publishedSites);
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);
  const todayRunRef = useRef<HTMLElement | null>(null);
  const websiteStudioHref = boardId
    ? `/dashboard/websites/new?boardId=${encodeURIComponent(boardId)}&source=edu-course`
    : "/dashboard/websites/new?source=edu-course";

  const todayLessons = useMemo(() => {
    const picked = getCoursewareLessonsByDay(selectedDayNumber);
    return picked.length > 0 ? picked : getCoursewareLessonsByDay(1);
  }, [selectedDayNumber]);
  const toolHints = [...new Set(todayLessons.flatMap((lesson) => lesson.toolHints))];
  const buildPublicUrl = (slug: string) => `${CANONICAL_BASE_URL}/w/${slug}`;

  const copyPublicLink = async (slug: string) => {
    const publicUrl = buildPublicUrl(slug);
    await navigator.clipboard.writeText(publicUrl);
    window.alert("링크를 복사했습니다.");
  };

  const dayLabel = (originDay: string | null) => {
    const n = Number(originDay);
    if (!Number.isFinite(n) || n < 1) return "기타 웹사이트";
    return `Day ${Math.floor(n)}`;
  };


  const persist = (next: typeof state) => {
    setState(next);
    saveTeacherDashboardState({ ...next, updatedAt: new Date().toISOString() });
  };


  const dayFilterOptions = useMemo(() => {
    const hasDay = gallerySites.some((site) => Number.isFinite(Number(site.originDay)));
    if (!hasDay) return [] as Array<{ value: string; label: string }>;
    return [
      { value: "all", label: "전체" },
      { value: "1", label: "Day 1" },
      { value: "2", label: "Day 2" },
      { value: "3", label: "Day 3" },
      { value: "4", label: "Day 4" },
      { value: "other", label: "기타" },
    ];
  }, [gallerySites]);

  const visibleSites = useMemo(() => {
    const filtered = gallerySites.filter((site) => {
      const day = Number(site.originDay);
      if (dayFilter === "all") return true;
      if (dayFilter === "other") return !Number.isFinite(day) || day < 1 || day > 4;
      return String(Math.floor(day)) === dayFilter;
    });
    return filtered.sort((a, b) => {
      const aTime = new Date(a.publishedAt ?? a.updatedAt).getTime();
      const bTime = new Date(b.publishedAt ?? b.updatedAt).getTime();
      return sortOrder === "latest" ? bTime - aTime : aTime - bTime;
    });
  }, [dayFilter, gallerySites, sortOrder]);

  const dayCounts = useMemo(() => {
    return gallerySites.reduce<Record<string, number>>((acc, site) => {
      const label = dayLabel(site.originDay);
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
  }, [gallerySites]);

  const onUnpublish = async (site: PublishedSite) => {
    const ok = window.confirm("이 웹사이트의 공개를 중지할까요? 학생이 받은 공개 링크에서는 더 이상 보이지 않습니다.");
    if (!ok) return;
    setUnpublishingId(site.id);
    try {
      const res = await fetch(`/api/website-studio/publish/${site.id}/unpublish`, { method: "PATCH" });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; requestId?: string };
      if (!res.ok) {
        const requestId = payload?.requestId ? ` (requestId: ${payload.requestId})` : "";
        window.alert(`공개 중지에 실패했습니다. 잠시 후 다시 시도해주세요.${requestId}`);
        return;
      }
      setGallerySites((prev) => prev.filter((v) => v.id !== site.id));
      setOpenQrSiteId((prev) => (prev === site.id ? null : prev));
      window.alert("공개를 중지했습니다.");
    } catch {
      window.alert("공개 중지 요청 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      setUnpublishingId(null);
    }
  };

  const onSelectDay = (dayNumber: number) => {
    persist({ ...state, selectedDayNumber: dayNumber });
    if (todayRunRef.current?.scrollIntoView) {
      todayRunRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };


  return (
    <main data-courseware-teacher-dashboard="ai-courseware-teacher-shell" data-marker-version="ai-courseware-teacher-v1" className="p-6 space-y-6">
      <section className="rounded-lg border p-4 space-y-2">
        <h1 className="text-2xl font-bold">AI 코스웨어 교사용 운영판</h1>
        <p>16일 × 하루 2차시, 작은 결과물 중심의 중학교 인공지능 수업 운영 도구</p>
        <div className="flex flex-wrap gap-2 text-sm"><span className="rounded border px-2 py-1">총 32차시</span><span className="rounded border px-2 py-1">16일 운영</span><span className="rounded border px-2 py-1">오늘 2차시</span><span className="rounded border px-2 py-1">안전 점검 후 공유</span></div>
      </section>
      <section className="rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Website Studio</p>
        <h2 className="text-2xl font-bold text-slate-900">학생 웹사이트 만들기</h2>
        <p className="text-sm text-slate-700">학생들이 AI와 함께 자기소개, 탐구, 퀴즈, 포트폴리오 웹사이트를 만들고 배포할 수 있어요.</p>
        <Link href={websiteStudioHref} className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">웹사이트 스튜디오 열기</Link>
      </section>


      {boardId ? <section className="rounded-lg border p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-semibold">학생 웹사이트 작품</h2><p className="text-sm text-slate-600">이 보드에서 시작해 제출·공개된 웹사이트입니다.</p><p className="text-xs text-slate-500">학생이 웹사이트를 공개하면 이곳에 자동으로 표시됩니다.</p><p className="text-xs text-slate-500">문제가 있는 작품은 공개 중지할 수 있습니다.</p><p className="text-xs text-slate-500">공개된 학생 웹사이트 {gallerySites.length}개 {Object.entries(dayCounts).slice(0, 2).map(([label, count]) => `· ${label} ${count}개`).join(" ")}</p></div><Link href={`/edu/lesson/teacher/showcase?boardId=${encodeURIComponent(boardId)}`} className={`rounded px-3 py-1.5 text-xs font-semibold ${gallerySites.length > 0 ? "bg-slate-900 text-white" : "border text-slate-400 pointer-events-none"}`}>발표/전시 모드 열기</Link></div>{gallerySites.length === 0 ? <div className="rounded-md border border-dashed p-3 text-sm text-slate-600"><p>아직 공개된 학생 웹사이트가 없습니다.</p><ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600"><li>학생에게 웹사이트 스튜디오 링크를 공유하세요.</li><li>학생이 배포 전 점검 후 공유 링크를 만들면 여기에 표시됩니다.</li></ol><Link href={websiteStudioHref} className="mt-2 inline-flex rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">학생 웹사이트 만들기 열기</Link></div> : <><div className="flex flex-wrap items-center gap-2 text-xs">{dayFilterOptions.length > 0 ? <select aria-label="Day별" className="rounded border px-2 py-1" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>{dayFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <button type="button" disabled className="rounded border px-2 py-1 text-slate-400">Day별</button>}<button type="button" className={`rounded border px-2 py-1 ${sortOrder === "latest" ? "bg-slate-900 text-white" : ""}`} onClick={() => setSortOrder("latest")}>최신순</button><button type="button" className={`rounded border px-2 py-1 ${sortOrder === "oldest" ? "bg-slate-900 text-white" : ""}`} onClick={() => setSortOrder("oldest")}>오래된순</button></div><div className="grid gap-2">{visibleSites.map((site) => { const publicUrl = buildPublicUrl(site.slug); const qrOpen = openQrSiteId === site.id; return <article key={site.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{site.title}</h3><span className={`rounded px-2 py-0.5 text-xs ${site.safetyStatus === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{site.safetyStatus === "ready" ? "안전 점검 완료" : "검토 필요"}</span></div><div className="mt-1 flex flex-wrap gap-1 text-[11px]"><span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700">제출됨</span><span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">공개중</span>{site.originDay ? <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">Day {site.originDay}</span> : null}</div><p className="text-xs text-slate-500">{dayLabel(site.originDay)} · 템플릿 {site.templateId}</p><p className="text-xs text-slate-500">공개: {new Date(site.publishedAt ?? site.updatedAt).toLocaleDateString("ko-KR")}</p><div className="mt-2 flex gap-2"><Link href={`/w/${site.slug}`} target="_blank" className="rounded border px-2 py-1 text-xs">열기</Link><button type="button" onClick={() => copyPublicLink(site.slug)} className="rounded border px-2 py-1 text-xs">링크 복사</button><button type="button" onClick={() => setOpenQrSiteId(qrOpen ? null : site.id)} className="rounded border px-2 py-1 text-xs">{qrOpen ? "QR 닫기" : "QR 보기"}</button><button type="button" onClick={() => void onUnpublish(site)} disabled={unpublishingId === site.id} className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">{unpublishingId === site.id ? "처리 중..." : "공개 중지"}</button></div>{qrOpen ? <div className="mt-3 rounded border bg-slate-50 p-3 text-xs"><WebsiteStudioQrCode url={publicUrl} label={`${site.title} QR`} size={132} /><p className="mt-2 break-all text-slate-600">{publicUrl}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => copyPublicLink(site.slug)} className="rounded border px-2 py-1">링크 복사</button><button type="button" onClick={() => { const img = document.querySelector<HTMLImageElement>(`img[alt="${site.title} QR"]`); if (!img?.src) return; const a = document.createElement("a"); a.href = img.src; a.download = `${site.slug}-qr.png`; a.click(); }} className="rounded border px-2 py-1">QR 이미지 다운로드</button></div></div> : null}</article>;})}</div></>}</section> : null}

      <section className="rounded-lg border p-4 space-y-2"><h2 className="text-xl font-semibold">오늘 수업은 이렇게 운영하세요</h2><p>1교시: 맛보기와 따라하기</p><p>2교시: 내 것으로 바꾸고 결과물 남기기</p><TeacherRecoveryBrief /></section>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Day 전체 보기</summary>
        <div className="mt-3"><TeacherDayPicker selectedDayNumber={selectedDayNumber} onSelectDay={onSelectDay} boardId={boardId} /></div>
      </details>

      <section ref={todayRunRef} className="space-y-3">
        <TeacherTodayRunPanel dayNumber={selectedDayNumber} lessons={todayLessons} />
        <div>
          <Link href={boardId ? `/dashboard/websites/new?boardId=${encodeURIComponent(boardId)}&source=day-website&day=${selectedDayNumber}` : `/dashboard/websites/new?source=day-website&day=${selectedDayNumber}`} className="text-sm font-medium text-indigo-700 underline underline-offset-4">이 Day로 웹사이트 만들기</Link>
        </div>
      </section>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">도구 체크리스트 펼치기</summary><div className="mt-3"><TeacherToolChecklist toolHints={toolHints} /></div></details>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">운영 안내 펼치기</summary><div className="mt-3 space-y-4"><TeacherFinalShowcasePanel /><section><h2>안전/공유 안내</h2><ul><li>공개 전 safety gate 확인이 필요합니다.</li><li>공개 페이지는 noindex입니다.</li><li>raw JS/HTML은 지원하지 않습니다.</li><li>WebLLM은 선택 사항입니다. WebLLM은 선택 기능이며 수업 진행에 필요하지 않습니다.</li><li>저장소 불가 시 presentation 모드와 요약 복사를 사용하세요.</li></ul></section></div></details>
      <TeacherSessionPanel dayNumber={selectedDayNumber} onCreated={async (created) => { if (created?.status !== "ok") { setSessionInfo(created); return; } const loaded = await fetch(`/api/edu/courseware/session/${created.joinCode}`).then((r) => r.json() as Promise<{ submissions?: TeacherSessionSubmission[] }>).catch(() => null); setSessionInfo({ ...created, submissions: loaded?.submissions ?? [] }); }} />
      {sessionInfo?.joinCode ? <section><p>Join code: {sessionInfo.joinCode}</p><p>Join URL: /edu/lesson/join?code={sessionInfo.joinCode}</p></section> : null}
      {sessionInfo?.status === "disabled" ? <p>수업 코드 기능이 꺼져 있으면 수동 링크 수집을 사용하세요.</p> : null}
      <TeacherSessionSubmissions session={sessionInfo} />
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">학생 발표 링크 모음 펼치기</summary><section className="mt-3"><h2>학생 발표 링크 모음</h2><p>실제 이름 대신 팀명이나 번호를 사용해도 좋아요.</p><input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="/edu/courseware/p/[shareId] 또는 shareId" /><input value={labelKo} onChange={(e) => setLabelKo(e.target.value)} placeholder="표시 이름(선택)" /><input value={noteKo} onChange={(e) => setNoteKo(e.target.value)} placeholder="메모(선택)" /><button type="button" onClick={() => { const parsed = parseTeacherShareInput(linkInput, window.location.origin); if (!parsed) return; persist({ ...state, collectedLinks: [{ id: crypto.randomUUID(), addedAt: new Date().toISOString(), publicUrl: parsed.publicUrl, shareId: parsed.shareId, status: parsed.status, labelKo, noteKo }, ...state.collectedLinks] }); setLinkInput(""); setLabelKo(""); setNoteKo(""); }}>추가</button>
        {state.collectedLinks.length === 0 ? <p>아직 제출된 링크가 없어요.</p> : state.collectedLinks.map((item) => <div key={item.id}><span>{item.labelKo ?? item.shareId}</span> <Link href={item.publicUrl} target="_blank">열기</Link> <button type="button" onClick={() => navigator.clipboard.writeText(item.publicUrl)}>복사</button> <button type="button" onClick={() => persist({ ...state, collectedLinks: state.collectedLinks.filter((v) => v.id !== item.id) })}>삭제</button></div>)}
      </section></details>
      {todayLessons.length === 0 ? <p>선택한 Day 정보를 불러오지 못했어요. Day 1로 다시 시작합니다.</p> : null}
    </main>
  );
}
