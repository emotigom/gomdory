"use client";

import { useEffect, useState } from "react";

import { getGoogleDriveConfig } from "@/lib/google-drive/config";
import {
  downloadGoogleDriveFile,
  getGoogleDriveDownloadMetadata,
} from "@/lib/google-drive/driveDownload";
import { requestGoogleDriveAccessToken } from "@/lib/google-drive/googleIdentity";
import { pickGoogleDriveFile } from "@/lib/google-drive/googlePicker";

type Props = {
  sections: Array<{
    id: string;
    title: string;
  }>;
  onImportFile: (input: {
    wallId: string;
    file: File;
  }) => Promise<void>;
};

export default function GoogleDriveImportPanel({ sections, onImportFile }: Props) {
  const [selectedWallId, setSelectedWallId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setSelectedWallId((current) =>
      sections.some((section) => section.id === current) ? current : sections[0]?.id ?? "",
    );
  }, [sections]);

  if (!getGoogleDriveConfig()) return null;

  async function importFile() {
    if (busy || !selectedWallId) return;
    setBusy(true);
    setStatus("");
    try {
      const accessToken = await requestGoogleDriveAccessToken();
      const picked = await pickGoogleDriveFile(accessToken);
      if (!picked) {
        setStatus("");
        return;
      }

      setStatus("Google Drive에서 파일 정보를 확인하는 중…");
      const metadata = await getGoogleDriveDownloadMetadata({
        accessToken,
        fileId: picked.id,
      });
      setStatus(
        metadata.importMode === "export"
          ? "Google 문서를 Office 파일로 변환하는 중…"
          : "Google Drive에서 파일을 가져오는 중…",
      );
      const file = await downloadGoogleDriveFile({
        accessToken,
        fileId: picked.id,
        metadata,
      });
      setStatus("곰도리에 저장하는 중…");
      await onImportFile({ wallId: selectedWallId, file });
      setStatus("보드에 자료를 추가했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Google Drive 파일을 가져오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const hasSections = sections.length > 0;

  return (
    <div className="hud-right-rail-inner rounded-xl p-3">
      <p className="text-xs font-semibold text-[var(--theme-text)]">Google Drive 자료 가져오기</p>
      {hasSections ? (
        <div className="mt-3">
          <label className="mt-3 block text-[11px] text-[var(--theme-text-muted)]" htmlFor="google-drive-import-wall">
            저장할 섹션
          </label>
          <select
            id="google-drive-import-wall"
            value={selectedWallId}
            disabled={busy}
            onChange={(event) => setSelectedWallId(event.target.value)}
            className="mt-1 min-h-9 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 text-xs text-[var(--theme-text)] disabled:opacity-50"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>{section.title}</option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--theme-text-muted)]">
          자료를 가져오려면 먼저 보드에 섹션을 만들어 주세요.
        </p>
      )}
      <button
        type="button"
        disabled={busy || !selectedWallId}
        onClick={() => void importFile()}
        className="mt-2 min-h-10 w-full rounded-lg border border-sky-500/60 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
      >
        {busy ? "가져오는 중…" : "Drive에서 자료 가져오기"}
      </button>
      <p className="mt-2 text-[11px] text-[var(--theme-text-muted)]">
        PDF, Word, PowerPoint, Excel, 이미지와 Google Docs·Sheets·Slides를 가져올 수 있습니다.
      </p>
      <p aria-live="polite" className="mt-2 text-[11px] text-[var(--theme-text-muted)]">{status}</p>
    </div>
  );
}
