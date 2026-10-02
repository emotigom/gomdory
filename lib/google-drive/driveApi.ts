"use client";

import type { GoogleDriveFile } from "./types";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export async function driveFetch(token: string, input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(response.status === 401 ? "Google Drive 권한이 만료되었습니다. 다시 연결해주세요." : `Google Drive 요청에 실패했습니다. (${response.status}) ${body.slice(0, 160)}`);
  }
  return response;
}

export async function createDriveFolder(token: string, name: string, parentId?: string): Promise<GoogleDriveFile> {
  const response = await driveFetch(token, `${DRIVE_API}?fields=id,name,webViewLink`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }) });
  return response.json() as Promise<GoogleDriveFile>;
}
