"use client";

import { useCallback, useEffect, useState } from "react";

import { getGoogleDriveConfig } from "@/lib/google-drive/config";
import { saveBlobToGoogleDrive } from "@/lib/google-drive/driveUpload";
import { requestGoogleDriveAccessToken } from "@/lib/google-drive/googleIdentity";
import { pickGoogleDriveFolder } from "@/lib/google-drive/googlePicker";
import {
  clearGoogleDrivePreference,
  loadGoogleDrivePreference,
  saveGoogleDrivePreference,
} from "@/lib/google-drive/preferences";
import type { GoogleDrivePreference, GoogleDrivePurpose } from "@/lib/google-drive/types";

export type GoogleDriveSaveAction = {
  id: string;
  label: string;
  disabled?: boolean;
  createFile: () => Promise<{
    blob: Blob;
    fileName: string;
    mimeType: string;
    appProperties?: Record<string, string>;
  }>;
  className?: string;
};

type Props = {
  purpose: GoogleDrivePurpose;
  defaultFolderName: string;
  actions: GoogleDriveSaveAction[];
  className?: string;
};

export function GoogleDriveSavePanel({ purpose, defaultFolderName, actions, className }: Props) {
  const enabled = Boolean(getGoogleDriveConfig());
  const [preference, setPreference] = useState<GoogleDrivePreference | null>(null);
  const [status, setStatus] = useState("");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileLink, setFileLink] = useState<string | null>(null);

  useEffect(() => {
    if (enabled) void loadGoogleDrivePreference(purpose).then(setPreference).catch(() => undefined);
  }, [enabled, purpose]);

  const chooseFolder = useCallback(async () => {
    const token = await requestGoogleDriveAccessToken();
    const folder = await pickGoogleDriveFolder(token);
    if (!folder) throw new Error(`${defaultFolderName} 저장 폴더 선택이 취소되었습니다.`);
    const saved = await saveGoogleDrivePreference(purpose, {
      folderId: folder.id,
      folderName: folder.name,
      folderWebViewLink: folder.webViewLink,
    });
    setPreference(saved); return token;
  }, [defaultFolderName, purpose]);

  const changeFolder = useCallback(async () => {
    setBusy(true);
    setStatus("저장 폴더를 여는 중…");
    try {
      const token = await requestGoogleDriveAccessToken();
      const folder = await pickGoogleDriveFolder(token);
      if (folder) {
        const saved = await saveGoogleDrivePreference(purpose, {
          folderId: folder.id,
          folderName: folder.name,
          folderWebViewLink: folder.webViewLink,
        });
        setPreference(saved);
        setStatus("저장 폴더를 변경했습니다.");
      } else {
        setStatus("");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장 폴더를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [purpose]);

  const save = useCallback(async (action: GoogleDriveSaveAction) => {
    if (action.disabled || busy || activeActionId) return;
    setBusy(true);
    setActiveActionId(action.id);
    setFileLink(null);
    try {
      setStatus("Google Drive에 연결하는 중…");
      const token = preference ? await requestGoogleDriveAccessToken() : await chooseFolder();
      const target = preference ?? await loadGoogleDrivePreference(purpose);
      if (!target) throw new Error("저장 폴더를 설정하지 못했습니다.");
      setStatus("파일을 준비하는 중…");
      const file = await action.createFile();
      const uploaded = await saveBlobToGoogleDrive({
        ...file,
        folderId: target.folderId,
        accessToken: token,
        onProgress: (percent) => setStatus(`Drive에 저장 중… ${percent}%`),
      });
      setFileLink(uploaded.webViewLink ?? `https://drive.google.com/open?id=${uploaded.id}`);
      setStatus("Google Drive에 저장했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Google Drive에 저장하지 못했습니다.");
    } finally {
      setActiveActionId(null);
      setBusy(false);
    }
  }, [activeActionId, busy, chooseFolder, preference, purpose]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await clearGoogleDrivePreference(purpose);
      setPreference(null);
      setStatus("Google Drive 저장 폴더 연결을 해제했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "연결을 해제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [purpose]);

  if (!enabled) return null;

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={action.disabled || busy || activeActionId !== null}
          onClick={() => void save(action)}
          className={action.className ?? "rounded border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50"}
        >
          {activeActionId === action.id
            ? "저장 중…"
            : preference
              ? action.label
              : action.label === "Google Drive에 저장"
                ? "Google Drive 연결 후 저장"
                : `${action.label} (연결 후)`}
        </button>
      ))}
      {preference ? (
        <>
          <span className="text-xs text-neutral-500">저장 폴더: {preference.folderName}</span>
          <button type="button" disabled={busy} onClick={() => void changeFolder()} className="text-xs font-medium text-sky-700 underline disabled:opacity-50">폴더 변경</button>
          <button type="button" disabled={busy} onClick={() => void disconnect()} className="text-xs font-medium text-neutral-600 underline disabled:opacity-50">연결 해제</button>
        </>
      ) : null}
      <span aria-live="polite" className={status.includes("못") || status.includes("취소") ? "text-sm text-red-700" : "text-sm text-neutral-600"}>{status}</span>
      {fileLink ? <a className="text-sm font-medium text-sky-700 underline" href={fileLink} target="_blank" rel="noreferrer">Drive에서 열기</a> : null}
    </div>
  );
}
