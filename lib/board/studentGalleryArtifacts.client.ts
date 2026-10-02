import { buildStudentGalleryExportItems } from "./studentGalleryExport";
import { buildStudentGalleryStandaloneHtml } from "./studentGalleryStandaloneHtml";
import type { FinalArtworkSubmission } from "./studentSubmissionSummary";
import { createZip } from "./zipWriter";

export type StudentGalleryArtifact = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  appProperties: Record<string, string>;
};

function buildGalleryFiles(finalArtworkCards: FinalArtworkSubmission[]) {
  const items = buildStudentGalleryExportItems(finalArtworkCards);

  return {
    html: buildStudentGalleryStandaloneHtml(items),
    json: JSON.stringify(items, null, 2),
  };
}

export async function buildStudentGalleryHtmlArtifact(input: {
  finalArtworkCards: FinalArtworkSubmission[];
  boardId: string;
}): Promise<StudentGalleryArtifact> {
  const { html } = buildGalleryFiles(input.finalArtworkCards);

  return {
    blob: new Blob([html], { type: "text/html;charset=utf-8" }),
    fileName: "ai-gallery-final.html",
    mimeType: "text/html",
    appProperties: {
      gomdoryArtifactType: "student-gallery-html",
      gomdoryVersion: "1",
      ...(input.boardId === "unknown-board" ? {} : { boardId: input.boardId }),
    },
  };
}

export async function buildStudentGalleryZipArtifact(input: {
  finalArtworkCards: FinalArtworkSubmission[];
  boardId: string;
}): Promise<StudentGalleryArtifact> {
  const { html, json } = buildGalleryFiles(input.finalArtworkCards);
  const readme = `곰도리 AI 작품 갤러리

index.html을 열면 작품 갤러리를 볼 수 있습니다.

이 ZIP에는 갤러리 화면과 작품 정보가 들어 있습니다.
이미지, 영상, 음악, HTML 작품이 외부 URL을 사용하는 경우에는
인터넷 연결과 해당 파일의 공유 권한이 필요합니다.

이 ZIP은 외부 미디어 원본을 자동으로 복사한 오프라인 백업 파일이 아닙니다.
공개하거나 공유하기 전에는 학생 이름과 작품 설명 등 개인정보를 확인해 주세요.
`;
  const encoder = new TextEncoder();
  const zipped = createZip([
    { filename: "ai-gallery-final/index.html", data: encoder.encode(html) },
    { filename: "ai-gallery-final/gallery-data.json", data: encoder.encode(json) },
    { filename: "ai-gallery-final/README.txt", data: encoder.encode(readme) },
  ]);
  const zipBuffer = new ArrayBuffer(zipped.byteLength);
  new Uint8Array(zipBuffer).set(zipped);

  return {
    blob: new Blob([zipBuffer], { type: "application/zip" }),
    fileName: "ai-gallery-final.zip",
    mimeType: "application/zip",
    appProperties: {
      gomdoryArtifactType: "student-gallery-zip",
      gomdoryVersion: "1",
      ...(input.boardId === "unknown-board" ? {} : { boardId: input.boardId }),
    },
  };
}

export function downloadStudentGalleryArtifact(artifact: StudentGalleryArtifact): void {
  const url = URL.createObjectURL(artifact.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
