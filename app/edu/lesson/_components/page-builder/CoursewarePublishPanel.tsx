"use client";
import { useState } from "react";
import type { CoursewarePageDraft } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePageTypes";
import { loadSafetyAcknowledgement } from "@/lib/edu/courseware/safety/aiCoursewareSafetyStore";
import { isCoursewarePublishUiHintEnabled } from "@/lib/edu/courseware/publish/aiCoursewarePublishFlags";
import CoursewarePublishedLinkPanel from "./CoursewarePublishedLinkPanel";

export default function CoursewarePublishPanel({ draft }: { draft: CoursewarePageDraft }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const safety = loadSafetyAcknowledgement("page-draft", draft.pageId);
  const unavailable = !isCoursewarePublishUiHintEnabled();

  const onPublish = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/edu/courseware/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageDraft: draft, safetyAcknowledgement: safety }),
      });
      const data = (await response.json()) as { status?: string; publicUrl?: string };
      if (!response.ok || data.status !== "ok" || !data.publicUrl) throw new Error("publish-failed");
      setUrl(data.publicUrl);
    } catch {
      alert("발행 조건을 확인해 주세요. 개인정보가 들어간 내용은 공개하지 마세요.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="rounded border bg-white p-3"><h5 className="font-semibold">공개 발행</h5><p className="text-xs text-slate-600">안전 점검을 통과한 발표용 페이지를 저장합니다.</p><p className="text-xs text-slate-600">공개 링크는 편집 화면이 아니라 읽기 전용 발표 화면만 보여줘요.</p>{unavailable ? <p className="mt-2 text-xs text-amber-700">현재 환경에서는 공개 링크 저장소가 꺼져 있어요. 발표 모드와 복사용 요약을 사용하세요.</p> : <><p className="mt-2 text-xs text-emerald-700">공개 링크 저장소가 연결되어 있어요.</p><button disabled={busy} className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60" onClick={onPublish}>공개 링크 만들기</button></>}{url ? <div className="mt-2"><CoursewarePublishedLinkPanel url={url} /></div> : null}<p className="mt-2 text-xs text-slate-500">공개 후에는 개인정보가 없는지 다시 확인하세요.</p></section>;
}
