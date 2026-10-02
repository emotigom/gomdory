"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  deleteOfflineBoardPack,
  listOfflineBoardPacks,
  type OfflineBoardPack,
} from "@/lib/offline/packStore";

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function OfflineBoardsPage() {
  const [packs, setPacks] = useState<OfflineBoardPack[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const next = await listOfflineBoardPacks();
    setPacks(next);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (boardId: string) => {
    const confirmed = window.confirm("오프라인 팩을 삭제할까요?");
    if (!confirmed) return;
    await deleteOfflineBoardPack(boardId);
    await refresh();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">오프라인 보드</h1>
        <p className="text-sm text-gray-600">
          저장된 보드 ZIP을 브라우저에 보관합니다. 네트워크 없이도 읽을 수 있습니다.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : packs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          저장된 오프라인 보드가 없습니다. 보드 설정에서 &quot;오프라인으로 저장&quot;을
          눌러주세요.
        </div>
      ) : (
        <div className="space-y-4">
          {packs.map((pack) => (
            <div
              key={pack.boardId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{pack.title}</p>
                <p className="text-xs text-gray-500">
                  저장 시각: {new Date(pack.savedAt).toLocaleString("ko-KR")} · 용량:
                  {" "}
                  {formatFileSize(pack.sizeBytes)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/offline/boards/${pack.boardId}`}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  열기
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(pack.boardId)}
                  className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
