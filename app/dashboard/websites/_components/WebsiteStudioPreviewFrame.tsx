"use client";

import { useEffect, useState } from "react";
import { WebsiteStudioPreviewShell } from "@/app/dashboard/websites/_components/WebsiteStudioGlassSurface";

export default function WebsiteStudioPreviewFrame({ srcDoc }: { srcDoc: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WebsiteStudioPreviewShell>
      <div className="w-full max-w-full overflow-hidden rounded-lg border border-slate-700 bg-white">
        <iframe
          title="website-studio-preview"
          className="block h-[clamp(320px,52vh,560px)] w-full max-w-full border-0 bg-white"
          srcDoc={mounted ? srcDoc : "<!doctype html><html><body></body></html>"}
          sandbox="allow-same-origin"
        />
      </div>
      <p className="mt-2 text-xs text-slate-300">미리보기는 안전한 sandbox 안에서 실행됩니다.</p>
      <p className="text-xs text-slate-300">이번 단계에서는 JavaScript를 실행하지 않습니다.</p>
    </WebsiteStudioPreviewShell>
  );
}
