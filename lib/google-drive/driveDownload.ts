import { getCardAttachmentMaxBytes } from "@/lib/uploads/cardAttachmentPolicy";

import {
  resolveGoogleDriveImportPlan,
} from "./driveImport";

export type GoogleDriveDownloadMetadata = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink?: string;
  importMode: "media" | "export";
  outputFileName: string;
  outputMimeType: string;
  sourceLabel?: string;
};

type GoogleDriveMetadataResponse = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string | number;
  webViewLink?: string;
  capabilities?: { canDownload?: boolean };
};

const GOOGLE_DRIVE_EXPORT_MAX_BYTES = 10 * 1024 * 1024;
const GOOGLE_DRIVE_EXPORT_SIZE_ERROR =
  "Google 문서 변환 결과가 10MB를 초과하여 가져올 수 없습니다. Drive에서 PDF나 Office 파일로 다운로드한 뒤 다시 가져와 주세요.";
const CARD_ATTACHMENT_SIZE_ERROR =
  "파일이 너무 큽니다. 큰 파일은 드라이브 링크나 공식 다운로드 링크로 공유해 주세요.";

function driveRequestError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error("Google Drive 권한이 만료되었거나 이 파일에 접근할 수 없습니다.");
  }
  if (status === 404) {
    return new Error("Google Drive에서 파일을 찾지 못했습니다.");
  }
  return new Error("Google Drive 파일을 가져오지 못했습니다.");
}

type GoogleDriveErrorResponse = {
  error?: { errors?: Array<{ reason?: string }> };
};

async function exportRequestError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as GoogleDriveErrorResponse;
    if (payload.error?.errors?.some((error) => error.reason === "exportSizeLimitExceeded")) {
      return new Error(GOOGLE_DRIVE_EXPORT_SIZE_ERROR);
    }
  } catch {
    // The standard status-based message is used when Google does not return JSON.
  }
  return driveRequestError(response.status);
}

function validateMetadata(payload: GoogleDriveMetadataResponse): GoogleDriveDownloadMetadata {
  const id = typeof payload.id === "string" ? payload.id : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  const reportedMimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim().toLowerCase() : "";

  if (!id || !name) throw new Error("Google Drive 파일을 가져오지 못했습니다.");
  if (payload.capabilities?.canDownload === false) {
    throw new Error("이 Google Drive 파일은 다운로드할 수 없습니다.");
  }
  const importPlan = resolveGoogleDriveImportPlan({ fileName: name, mimeType: reportedMimeType });
  const parsedSize =
    typeof payload.size === "number"
      ? payload.size
      : typeof payload.size === "string" && payload.size.trim()
        ? Number(payload.size)
        : Number.NaN;
  const size = Number.isFinite(parsedSize) && parsedSize >= 0 ? parsedSize : null;
  if (importPlan.mode === "media" && size !== null && size > getCardAttachmentMaxBytes()) {
    throw new Error(CARD_ATTACHMENT_SIZE_ERROR);
  }

  return {
    id,
    name,
    mimeType: reportedMimeType,
    size,
    ...(typeof payload.webViewLink === "string" ? { webViewLink: payload.webViewLink } : {}),
    importMode: importPlan.mode,
    outputFileName: importPlan.outputFileName,
    outputMimeType: importPlan.outputMimeType,
    ...(importPlan.mode === "export" ? { sourceLabel: importPlan.sourceLabel } : {}),
  };
}

export async function getGoogleDriveDownloadMetadata(input: {
  accessToken: string;
  fileId: string;
}): Promise<GoogleDriveDownloadMetadata> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}`);
  url.searchParams.set("fields", "id,name,mimeType,size,webViewLink,capabilities(canDownload)");
  url.searchParams.set("supportsAllDrives", "true");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
  } catch {
    throw new Error("Google Drive 파일을 가져오지 못했습니다.");
  }
  if (!response.ok) throw driveRequestError(response.status);

  let payload: GoogleDriveMetadataResponse;
  try {
    payload = (await response.json()) as GoogleDriveMetadataResponse;
  } catch {
    throw new Error("Google Drive 파일을 가져오지 못했습니다.");
  }
  return validateMetadata(payload);
}

export async function downloadGoogleDriveFile(input: {
  accessToken: string;
  fileId: string;
  metadata?: GoogleDriveDownloadMetadata;
}): Promise<File> {
  const metadata = input.metadata ?? await getGoogleDriveDownloadMetadata(input);
  const url = new URL(
    metadata.importMode === "export"
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}/export`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}`,
  );
  if (metadata.importMode === "export") {
    url.searchParams.set("mimeType", metadata.outputMimeType);
  } else {
    url.searchParams.set("alt", "media");
    url.searchParams.set("supportsAllDrives", "true");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
  } catch {
    throw new Error("Google Drive 파일을 가져오지 못했습니다.");
  }
  if (!response.ok) {
    throw metadata.importMode === "export"
      ? await exportRequestError(response)
      : driveRequestError(response.status);
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new Error("Google Drive 파일을 가져오지 못했습니다.");
  }
  if (metadata.importMode === "export" && blob.size > GOOGLE_DRIVE_EXPORT_MAX_BYTES) {
    throw new Error(GOOGLE_DRIVE_EXPORT_SIZE_ERROR);
  }
  if (blob.size > getCardAttachmentMaxBytes()) {
    throw new Error(CARD_ATTACHMENT_SIZE_ERROR);
  }
  return new File([blob], metadata.outputFileName, {
    type: metadata.outputMimeType,
    lastModified: Date.now(),
  });
}
