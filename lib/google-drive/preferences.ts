"use client";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";
import type { GoogleDrivePreference, GoogleDrivePurpose } from "./types";

type PreferenceResponse = {
  ok?: boolean;
  preference?: GoogleDrivePreference | null;
  error?: { message?: string };
};

function preferencePath(purpose: GoogleDrivePurpose) {
  return apiV1Path(`google-drive/preferences?purpose=${encodeURIComponent(purpose)}`);
}

async function readResponse(response: Response, fallbackMessage: string): Promise<PreferenceResponse> {
  const payload = (await response.json().catch(() => null)) as PreferenceResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? fallbackMessage);
  }
  return payload;
}

export async function loadGoogleDrivePreference(
  purpose: GoogleDrivePurpose,
): Promise<GoogleDrivePreference | null> {
  const response = await apiFetch(preferencePath(purpose), { cache: "no-store" });
  const payload = await readResponse(response, "저장 폴더 정보를 불러오지 못했습니다.");
  return payload.preference ?? null;
}

export async function saveGoogleDrivePreference(
  purpose: GoogleDrivePurpose,
  folder: Pick<GoogleDrivePreference, "folderId" | "folderName" | "folderWebViewLink">,
): Promise<GoogleDrivePreference> {
  const response = await apiFetch(preferencePath(purpose), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folder),
  });
  const payload = await readResponse(response, "저장 폴더 정보를 저장하지 못했습니다.");
  if (!payload.preference) {
    throw new Error("저장 폴더 정보를 저장하지 못했습니다.");
  }
  return payload.preference;
}

export async function clearGoogleDrivePreference(purpose: GoogleDrivePurpose): Promise<void> {
  const response = await apiFetch(preferencePath(purpose), { method: "DELETE" });
  await readResponse(response, "저장 폴더 연결을 해제하지 못했습니다.");
}
