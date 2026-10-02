"use client";

import { useEffect, useMemo, useState } from "react";

const AUTO_ADVANCE_MS = 6000;

export default function ShowcasePresentShell({
  showcaseId,
}: {
  showcaseId: string;
}) {
  const slides = useMemo(() => {
    return Array.from({ length: 6 }).map((_, index) => ({
      title: `Showcase ${showcaseId} • Slide ${index + 1}`,
      subtitle: "전시 항목이 여기에 표시됩니다.",
    }));
  }, [showcaseId]);

  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [playing, slides.length]);

  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6 rounded-xl bg-muted/40 p-6"
      data-page-marker="showcase-present"
    >
      <div className="flex items-center justify-between w-full max-w-5xl">
        <div className="text-sm text-muted-foreground">전시 모드 미리보기</div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <button
            type="button"
            className="rounded-md border px-3 py-1 shadow-sm"
            onClick={() => setPlaying((prev) => !prev)}
          >
            {playing ? "일시정지" : "재생"}
          </button>
          <span className="rounded-full bg-background px-3 py-1 shadow-sm">
            {active + 1} / {slides.length}
          </span>
        </div>
      </div>

      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-lg">
        <div className="grid min-h-[360px] place-items-center px-12 py-16 text-center">
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">TV 모드</p>
            <h2 className="text-3xl font-semibold leading-snug">{slides[active]?.title}</h2>
            <p className="text-lg text-muted-foreground">{slides[active]?.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
