import assert from "node:assert/strict";
import test from "node:test";

import {
  downloadGoogleDriveFile,
  getGoogleDriveDownloadMetadata,
} from "@/lib/google-drive/driveDownload";
import {
  getGoogleDriveNativeExportTarget,
  GOOGLE_DRIVE_NATIVE_IMPORT_MIME_TYPES,
  isSupportedGoogleDriveNativeMimeType,
  isSupportedGoogleDriveImportFileName,
  isSupportedGoogleDriveImportMimeType,
  resolveGoogleDriveImportPlan,
  SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES,
} from "@/lib/google-drive/driveImport";

const metadataPayload = {
  id: "drive-file-1",
  name: "수업 자료.pdf",
  mimeType: "application/pdf",
  size: "1234",
  webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
  capabilities: { canDownload: true },
};

test("Google Drive import supports only the allowed MIME types", () => {
  for (const mimeType of SUPPORTED_GOOGLE_DRIVE_IMPORT_MIME_TYPES) {
    assert.equal(isSupportedGoogleDriveImportMimeType(mimeType), true);
  }
  for (const mimeType of [
    "text/html",
    "application/zip",
    "application/x-msdownload",
    "audio/mpeg",
    "video/mp4",
  ]) {
    assert.equal(isSupportedGoogleDriveImportMimeType(mimeType), false);
  }
});

test("Google Docs, Sheets, and Slides MIME types have Office export targets", () => {
  const expected = [
    ["application/vnd.google-apps.document", ".docx"],
    ["application/vnd.google-apps.spreadsheet", ".xlsx"],
    ["application/vnd.google-apps.presentation", ".pptx"],
  ] as const;

  assert.deepEqual(GOOGLE_DRIVE_NATIVE_IMPORT_MIME_TYPES, expected.map(([mimeType]) => mimeType));
  for (const [mimeType, extension] of expected) {
    assert.equal(isSupportedGoogleDriveNativeMimeType(mimeType), true);
    assert.equal(getGoogleDriveNativeExportTarget(mimeType)?.extension, extension);
  }
});

test("Google native import plans convert names and MIME types", () => {
  assert.deepEqual(resolveGoogleDriveImportPlan({
    fileName: "수업 계획서",
    mimeType: "application/vnd.google-apps.document",
  }), {
    mode: "export",
    outputFileName: "수업 계획서.docx",
    outputMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sourceLabel: "Google Docs",
  });
  assert.equal(resolveGoogleDriveImportPlan({
    fileName: "성적 정리.xlsx",
    mimeType: "application/vnd.google-apps.spreadsheet",
  }).outputFileName, "성적 정리.xlsx");
  assert.equal(resolveGoogleDriveImportPlan({
    fileName: "발표 자료.pdf",
    mimeType: "application/vnd.google-apps.presentation",
  }).outputFileName, "발표 자료.pptx");
});

test("unsupported Google native MIME types are rejected with specific guidance", () => {
  assert.throws(
    () => resolveGoogleDriveImportPlan({ fileName: "그림", mimeType: "application/vnd.google-apps.drawing" }),
    /Google Drawing은 아직 직접 가져올 수 없습니다/,
  );
  assert.throws(
    () => resolveGoogleDriveImportPlan({ fileName: "설문", mimeType: "application/vnd.google-apps.form" }),
    /이 Google 파일 형식은 아직 가져올 수 없습니다/,
  );
});

test("regular Google Drive import plans preserve media behavior", () => {
  assert.deepEqual(resolveGoogleDriveImportPlan({ fileName: "자료.pdf", mimeType: "APPLICATION/PDF" }), {
    mode: "media",
    outputFileName: "자료.pdf",
    outputMimeType: "application/pdf",
  });
  assert.deepEqual(resolveGoogleDriveImportPlan({ fileName: "사진.JPG", mimeType: "" }), {
    mode: "media",
    outputFileName: "사진.JPG",
    outputMimeType: "image/jpeg",
  });
});

test("Google Drive import supports only the allowed file extensions", () => {
  for (const fileName of ["a.pdf", "a.docx", "a.pptx", "a.xlsx", "a.png", "a.jpg", "a.jpeg", "a.webp", "a.gif"]) {
    assert.equal(isSupportedGoogleDriveImportFileName(fileName), true, fileName);
  }
  for (const fileName of ["a.html", "a.zip", "a.exe", "a.mp3", "a.mp4"]) {
    assert.equal(isSupportedGoogleDriveImportFileName(fileName), false, fileName);
  }
});

test("Google Drive metadata is parsed without returning authorization data", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify(metadataPayload), { status: 200 });
  }) as typeof fetch;
  try {
    const metadata = await getGoogleDriveDownloadMetadata({ accessToken: "memory-only-token", fileId: "drive-file-1" });
    assert.deepEqual(metadata, {
      id: "drive-file-1",
      name: "수업 자료.pdf",
      mimeType: "application/pdf",
      size: 1234,
      webViewLink: metadataPayload.webViewLink,
      importMode: "media",
      outputFileName: "수업 자료.pdf",
      outputMimeType: "application/pdf",
    });
    assert.match(requestedUrl, /fields=id%2Cname%2CmimeType%2Csize%2CwebViewLink%2Ccapabilities%28canDownload%29/);
    assert.match(requestedUrl, /supportsAllDrives=true/);
    assert.equal(authorization, "Bearer memory-only-token");
    assert.equal(JSON.stringify(metadata).includes("memory-only-token"), false);
    assert.equal("accessToken" in metadata, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Drive metadata rejects files that cannot be downloaded", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ...metadataPayload,
    capabilities: { canDownload: false },
  }), { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(
      () => getGoogleDriveDownloadMetadata({ accessToken: "token", fileId: "drive-file-1" }),
      /이 Google Drive 파일은 다운로드할 수 없습니다/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google native metadata resolves an export plan without using original size for preflight", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ...metadataPayload,
    name: "수업 문서",
    mimeType: "application/vnd.google-apps.document",
    size: String(100 * 1024 * 1024),
  }), { status: 200 })) as typeof fetch;
  try {
    const metadata = await getGoogleDriveDownloadMetadata({ accessToken: "token", fileId: "drive-file-1" });
    assert.equal(metadata.importMode, "export");
    assert.equal(metadata.outputFileName, "수업 문서.docx");
    assert.equal(metadata.outputMimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.equal(metadata.sourceLabel, "Google Docs");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Drive Blob is converted to a File with metadata name and MIME", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    if (callCount === 1) return new Response(JSON.stringify(metadataPayload), { status: 200 });
    return new Response(new Blob(["synthetic pdf"], { type: "" }), { status: 200 });
  }) as typeof fetch;
  try {
    const file = await downloadGoogleDriveFile({ accessToken: "token", fileId: "drive-file-1" });
    assert.equal(file.name, metadataPayload.name);
    assert.equal(file.type, metadataPayload.mimeType);
    assert.equal(await file.text(), "synthetic pdf");
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Workspace export uses the export endpoint and converted File metadata", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";
  const metadata = {
    id: "workspace-file-1",
    name: "발표 자료",
    mimeType: "application/vnd.google-apps.presentation",
    size: null,
    importMode: "export" as const,
    outputFileName: "발표 자료.pptx",
    outputMimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    sourceLabel: "Google Slides",
  };
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(new Blob(["synthetic presentation"]), { status: 200 });
  }) as typeof fetch;
  try {
    const file = await downloadGoogleDriveFile({
      accessToken: "memory-only-export-token",
      fileId: "workspace-file-1",
      metadata,
    });
    const url = new URL(requestedUrl);
    assert.equal(url.pathname, "/drive/v3/files/workspace-file-1/export");
    assert.equal(url.searchParams.get("mimeType"), metadata.outputMimeType);
    assert.equal(url.searchParams.has("supportsAllDrives"), false);
    assert.equal(file.name, metadata.outputFileName);
    assert.equal(file.type, metadata.outputMimeType);
    assert.equal(authorization, "Bearer memory-only-export-token");
    assert.equal(JSON.stringify(metadata).includes("memory-only-export-token"), false);
    assert.equal("accessToken" in metadata, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Workspace export size-limit API errors use actionable guidance", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: { errors: [{ reason: "exportSizeLimitExceeded" }] },
  }), { status: 403 })) as typeof fetch;
  try {
    await assert.rejects(
      () => downloadGoogleDriveFile({
        accessToken: "token",
        fileId: "workspace-file-1",
        metadata: {
          id: "workspace-file-1",
          name: "문서",
          mimeType: "application/vnd.google-apps.document",
          size: null,
          importMode: "export",
          outputFileName: "문서.docx",
          outputMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sourceLabel: "Google Docs",
        },
      }),
      /Google 문서 변환 결과가 10MB를 초과하여 가져올 수 없습니다/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Workspace export rejects converted Blobs over 10MB", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), {
    status: 200,
  })) as typeof fetch;
  try {
    await assert.rejects(
      () => downloadGoogleDriveFile({
        accessToken: "token",
        fileId: "workspace-file-1",
        metadata: {
          id: "workspace-file-1",
          name: "문서",
          mimeType: "application/vnd.google-apps.document",
          size: null,
          importMode: "export",
          outputFileName: "문서.docx",
          outputMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sourceLabel: "Google Docs",
        },
      }),
      /Google 문서 변환 결과가 10MB를 초과하여 가져올 수 없습니다/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
