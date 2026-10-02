export const SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const GOOGLE_DRIVE_NATIVE_IMPORT_MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
] as const;

export const GOOGLE_DRIVE_NATIVE_EXPORT_TARGETS = {
  "application/vnd.google-apps.document": {
    label: "Google Docs",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    label: "Google Sheets",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    label: "Google Slides",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: ".pptx",
  },
} as const;

export type GoogleDriveNativeMimeType = keyof typeof GOOGLE_DRIVE_NATIVE_EXPORT_TARGETS;

export type GoogleDriveNativeExportTarget = {
  label: string;
  mimeType: string;
  extension: string;
};

export const GOOGLE_DRIVE_PICKER_IMPORT_MIME_TYPES = [
  ...SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES,
  ...GOOGLE_DRIVE_NATIVE_IMPORT_MIME_TYPES,
] as const;

export type GoogleDriveImportPlan =
  | {
      mode: "media";
      outputFileName: string;
      outputMimeType: string;
    }
  | {
      mode: "export";
      outputFileName: string;
      outputMimeType: string;
      sourceLabel: string;
    };

const MIME_TYPE_SET = new Set<string>(SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES);
const GOOGLE_NATIVE_MIME_TYPE_PREFIX = "application/vnd.google-apps.";
const GOOGLE_DRAWING_MIME_TYPE = "application/vnd.google-apps.drawing";

const MIME_TYPE_BY_EXTENSION: Record<string, (typeof SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES)[number]> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function isSupportedGoogleDriveImportMimeType(mimeType: string): boolean {
  return MIME_TYPE_SET.has(mimeType.trim().toLowerCase());
}

export function isSupportedGoogleDriveNativeMimeType(
  mimeType: string,
): mimeType is GoogleDriveNativeMimeType {
  return Object.hasOwn(GOOGLE_DRIVE_NATIVE_EXPORT_TARGETS, mimeType.trim().toLowerCase());
}

export function getGoogleDriveNativeExportTarget(
  mimeType: string,
): GoogleDriveNativeExportTarget | null {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (!isSupportedGoogleDriveNativeMimeType(normalizedMimeType)) return null;
  return GOOGLE_DRIVE_NATIVE_EXPORT_TARGETS[normalizedMimeType];
}

export function isSupportedGoogleDriveImportFileName(fileName: string): boolean {
  return getGoogleDriveImportMimeTypeForFileName(fileName) !== null;
}

export function getGoogleDriveImportMimeTypeForFileName(
  fileName: string,
): (typeof SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES)[number] | null {
  const extension = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension ? MIME_TYPE_BY_EXTENSION[extension] ?? null : null;
}

function replaceFileNameExtension(fileName: string, extension: string): string {
  const lastSlashIndex = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  const lastDotIndex = fileName.lastIndexOf(".");
  const hasReplaceableExtension = lastDotIndex > lastSlashIndex + 1 && lastDotIndex < fileName.length - 1;
  return `${hasReplaceableExtension ? fileName.slice(0, lastDotIndex) : fileName}${extension}`;
}

export function resolveGoogleDriveImportPlan(input: {
  fileName: string;
  mimeType: string;
}): GoogleDriveImportPlan {
  const normalizedMimeType = input.mimeType.trim().toLowerCase();
  const exportTarget = getGoogleDriveNativeExportTarget(normalizedMimeType);

  if (exportTarget) {
    return {
      mode: "export",
      outputFileName: replaceFileNameExtension(input.fileName, exportTarget.extension),
      outputMimeType: exportTarget.mimeType,
      sourceLabel: exportTarget.label,
    };
  }

  if (normalizedMimeType === GOOGLE_DRAWING_MIME_TYPE) {
    throw new Error(
      "Google Drawing은 아직 직접 가져올 수 없습니다. Drive에서 PDF나 이미지로 다운로드한 뒤 다시 가져와 주세요.",
    );
  }
  if (normalizedMimeType.startsWith(GOOGLE_NATIVE_MIME_TYPE_PREFIX)) {
    throw new Error(
      "이 Google 파일 형식은 아직 가져올 수 없습니다. Drive에서 PDF나 Office 파일로 다운로드한 뒤 다시 가져와 주세요.",
    );
  }

  if (normalizedMimeType && isSupportedGoogleDriveImportMimeType(normalizedMimeType)) {
    return {
      mode: "media",
      outputFileName: input.fileName,
      outputMimeType: normalizedMimeType,
    };
  }

  if (!normalizedMimeType) {
    const inferredMimeType = getGoogleDriveImportMimeTypeForFileName(input.fileName);
    if (inferredMimeType) {
      return {
        mode: "media",
        outputFileName: input.fileName,
        outputMimeType: inferredMimeType,
      };
    }
  }

  throw new Error("지원하지 않는 Google Drive 파일 형식입니다.");
}
