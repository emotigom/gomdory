import type { ManualFile } from "./studentAppLocalPreview";

const NOISE_PATH_PATNS = [/^__MACOSX\//i, /\/\.DS_Store$/i, /^\.DS_Store$/i, /\/Thumbs\.db$/i, /^Thumbs\.db$/i];

const normalizePath = (value: string) => value.trim().replace(/\\+/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
const isNoisePath = (path: string) => NOISE_PATH_PATNS.some((pattern) => pattern.test(path));

export type SelectedFileSummary = {
  fileCount: number;
  totalBytes: number;
  hasIndexHtml: boolean;
  hasCommonRoot: boolean;
  hasZip: boolean;
  hasProjectSourceSignals: boolean;
};

function buildSummaryFromEntries(files: Array<File | ManualFile>): SelectedFileSummary {
  const normalizedPaths = files
    .map((file) => toManualPath(file))
    .filter((path) => path && !path.endsWith("/") && !isNoisePath(path));
  // R2 object paths are case-sensitive; only the normalized root entry is safe.
  const hasIndexHtml = normalizedPaths.some((path) => path === "index.html");
  const hasZip = files.some((file) => file.name.toLowerCase().endsWith(".zip"));
  const pathSegments = normalizedPaths.map((path) => path.split("/").filter(Boolean));
  const allHaveTopFolder = pathSegments.length > 0 && pathSegments.every((parts) => parts.length > 1);
  const topLevelFolders = pathSegments.map((parts) => parts[0]).filter(Boolean);
  const hasCommonRoot = allHaveTopFolder && topLevelFolders.every((folder) => folder === topLevelFolders[0]);
  const hasProjectSourceSignals =
    normalizedPaths.some((path) => /(^|\/)package\.json$/i.test(path)) ||
    normalizedPaths.some((path) => /(^|\/)vite\.config\.(ts|js|mjs|cjs)$/i.test(path)) ||
    normalizedPaths.some((path) => /(^|\/)next\.config\.(ts|js|mjs|cjs)$/i.test(path)) ||
    normalizedPaths.some((path) => /(^|\/)src\//i.test(path)) ||
    normalizedPaths.some((path) => /(^|\/)node_modules\//i.test(path));

  const fileSize = (file: File | ManualFile) => {
    if ("size" in file && typeof file.size === "number") return file.size;
    if ("contentText" in file && typeof file.contentText === "string") return new TextEncoder().encode(file.contentText).byteLength;
    if ("contentBase64" in file && typeof file.contentBase64 === "string") return Math.ceil((file.contentBase64.length * 3) / 4);
    return 0;
  };

  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + fileSize(file), 0),
    hasIndexHtml,
    hasCommonRoot,
    hasZip,
    hasProjectSourceSignals: hasProjectSourceSignals && !hasIndexHtml,
  };
}

export function buildSelectedFileSummary(files: File[]): SelectedFileSummary {
  return buildSummaryFromEntries(files);
}

export function buildSelectedManualFileSummary(files: ManualFile[]): SelectedFileSummary {
  return buildSummaryFromEntries(files);
}

export function mapErrorToProblemFix(errorCode: string): { problem: string; fix: string } {
  if (errorCode === "missing_index_html") {
    return { problem: "index.html 파일이 없습니다.", fix: "index.html이 들어 있는 HTML/CSS/JS 정적 웹앱 폴더를 선택하세요." };
  }
  if (errorCode === "invalid_source") {
    return { problem: "HTML/CSS/JS 정적 파일만 지원해요.", fix: "ZIP이나 React/Vite/Next.js 프로젝트 소스가 아니라 브라우저에서 바로 실행되는 파일을 선택하세요." };
  }
  if (errorCode.startsWith("unsupported_extension:")) {
    return { problem: "지원하지 않는 파일 형식이 있습니다.", fix: "HTML, CSS, JS, JSON, TXT, 이미지 파일만 남기고 다시 선택하세요." };
  }
  if (errorCode.startsWith("disallowed_extension:")) {
    return { problem: "서버 기능이나 비밀 파일은 사용할 수 없어요.", fix: ".exe, .sh, .php, .py, .env, .key 같은 파일을 제거하세요." };
  }
  if (errorCode.startsWith("invalid_path:") || errorCode.startsWith("path_outside_root:")) {
    return { problem: "위험한 주소나 파일 경로는 제한될 수 있어요.", fix: "선택한 폴더 안의 파일만 다시 선택하세요." };
  }
  if (errorCode.startsWith("duplicate_path:")) {
    return { problem: "같은 경로의 파일이 중복되었습니다.", fix: "중복 파일은 하나만 남기세요." };
  }
  if (errorCode.startsWith("total_size_exceeds_limit:")) {
    return { problem: "파일 크기가 너무 큽니다.", fix: "전체 크기가 10MB 이하가 되도록 큰 이미지나 불필요한 파일을 줄이세요." };
  }
  if (errorCode.startsWith("file_count_exceeds_limit:")) {
    return { problem: "파일 개수가 너무 많습니다.", fix: "100개 이하가 되도록 HTML/CSS/JS 정적 파일과 필요한 에셋만 남기세요." };
  }
  return { problem: `검증 오류: ${errorCode}`, fix: "문제를 고친 뒤 폴더를 다시 선택하세요." };
}

export function buildStudentGuidanceMessage(errors: string[]): string {
  const mapped = (errors.length ? errors : ["missing_index_html"]).map(mapErrorToProblemFix);
  const summary = mapped.slice(0, 3).map((item) => item.problem).join(" ");
  return `소스 검증 결과: ${summary} 현재 지원 형식은 index.html이 포함된 HTML/CSS/JS 정적 웹앱입니다.`;
}

export function toManualPath(file: File | ManualFile): string {
  const webkitRelativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  const manualPath = "path" in file ? file.path : "";
  return normalizePath(webkitRelativePath || manualPath || file.name);
}
