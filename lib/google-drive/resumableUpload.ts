"use client";

import type { GoogleDriveAppProperties, GoogleDriveFile, GoogleDriveUploadProgress } from "./types";

type UploadInput = { blob: Blob; fileName: string; mimeType: string; folderId: string; accessToken: string; appProperties?: GoogleDriveAppProperties; onProgress?: GoogleDriveUploadProgress };
const CHUNK_SIZE = 8 * 1024 * 1024;

export async function uploadResumableToGoogleDrive(input: UploadInput): Promise<GoogleDriveFile> {
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": input.mimeType, "X-Upload-Content-Length": String(input.blob.size) }, body: JSON.stringify({ name: input.fileName, mimeType: input.mimeType, parents: [input.folderId], appProperties: input.appProperties }) });
  const sessionUrl = start.headers.get("Location");
  if (!start.ok || !sessionUrl) throw new Error("Google Drive 업로드를 시작하지 못했습니다.");
  for (let offset = 0; offset < input.blob.size;) {
    const end = Math.min(offset + CHUNK_SIZE, input.blob.size);
    const response = await fetch(sessionUrl, { method: "PUT", headers: { "Content-Type": input.mimeType, "Content-Length": String(end - offset), "Content-Range": `bytes ${offset}-${end - 1}/${input.blob.size}` }, body: input.blob.slice(offset, end) });
    if (response.status === 308) { offset = end; input.onProgress?.(Math.round((offset / input.blob.size) * 100)); continue; }
    if (!response.ok) throw new Error("Google Drive 업로드가 중단되었습니다. 다시 시도해주세요.");
    input.onProgress?.(100);
    return response.json() as Promise<GoogleDriveFile>;
  }
  throw new Error("Google Drive 업로드 결과를 확인하지 못했습니다.");
}
