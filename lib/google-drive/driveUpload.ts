"use client";

import { GOOGLE_DRIVE_UPLOAD_LIMIT } from "./config";
import { uploadResumableToGoogleDrive } from "./resumableUpload";
import type { GoogleDriveAppProperties, GoogleDriveFile, GoogleDriveUploadProgress } from "./types";

type SaveBlobInput = { blob: Blob; fileName: string; mimeType: string; folderId: string; accessToken: string; appProperties?: GoogleDriveAppProperties; onProgress?: GoogleDriveUploadProgress };
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export async function saveBlobToGoogleDrive(input: SaveBlobInput): Promise<GoogleDriveFile> {
  if (input.blob.size > GOOGLE_DRIVE_UPLOAD_LIMIT) return uploadResumableToGoogleDrive(input);
  const boundary = `gomdory_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: input.fileName, mimeType: input.mimeType, parents: [input.folderId], appProperties: input.appProperties });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`, input.blob, `\r\n--${boundary}--`], { type: `multipart/related; boundary=${boundary}` });
  const response = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`, { method: "POST", headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  if (!response.ok) throw new Error("Google Drive에 파일을 저장하지 못했습니다.");
  input.onProgress?.(100);
  return response.json() as Promise<GoogleDriveFile>;
}
