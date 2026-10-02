"use client";

import { useState } from "react";

type RecapActionsProps = {
  jsonUrl: string;
  mdUrl: string;
};

export default function RecapActions({ jsonUrl, mdUrl }: RecapActionsProps) {
  const [printing, setPrinting] = useState(false);
  const [exportVersion, setExportVersion] = useState<"v1" | "v2">("v2");

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const buildExportUrl = (baseUrl: string) => {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}v=${exportVersion === "v2" ? "2" : "1"}`;
  };

  const handlePrint = () => {
    setPrinting(true);
    window.print();
    setTimeout(() => setPrinting(false), 500);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600">
        <span>내보내기 버전</span>
        <select
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800"
          value={exportVersion}
          onChange={(event) => setExportVersion(event.target.value as "v1" | "v2")}
        >
          <option value="v2">v2 (문서형)</option>
          <option value="v1">v1 (호환)</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => openUrl(buildExportUrl(jsonUrl))}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        JSON 내보내기
      </button>
      <button
        type="button"
        onClick={() => openUrl(buildExportUrl(mdUrl))}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        Markdown 내보내기
      </button>
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
      >
        {printing ? "인쇄 준비 중..." : "인쇄/PDF"}
      </button>
    </div>
  );
}
