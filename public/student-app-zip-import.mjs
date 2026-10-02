export const STUDENT_APP_ZIP_MAX_BYTES = 20 * 1024 * 1024;
export const STUDENT_APP_ZIP_MAX_FILES = 100;

const MAX_ZIP_DEPTH = 8;
const TEXT_EXTENSIONS = new Set(["html", "htm", "css", "js", "mjs", "json", "txt", "md", "svg", "map"]);
const NOISE_PATH_PATTERNS = [/^__MACOSX\//i, /\/\.DS_Store$/i, /^\.DS_Store$/i, /\/Thumbs\.db$/i, /^Thumbs\.db$/i];
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_METHOD_STORE = 0;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_UNSUPPORTED_BROWSER_MESSAGE = "이 브라우저에서는 ZIP 가져오기를 사용할 수 없어요. HTML/CSS/JS를 직접 붙여넣어 주세요.";

const BUILD_PROJECT_PATTERNS = [
  {
    pattern: /(^|\/)next\.config\.(js|mjs|cjs|ts)$/i,
    message: "Next.js 프로젝트 ZIP은 아직 지원하지 않아요. 지금은 HTML/CSS/JS 정적 사이트 ZIP만 가져올 수 있어요.",
  },
  {
    pattern: /(^|\/)vite\.config\.(js|mjs|cjs|ts)$/i,
    message: "Vite 프로젝트 ZIP은 아직 자동 빌드하지 않아요. 빌드 프로젝트가 아니라 index.html이 있는 정적 사이트 ZIP을 넣어주세요.",
  },
  {
    pattern: /(^|\/)package\.json$/i,
    message: "현재는 빌드 프로젝트 ZIP은 지원하지 않아요. package.json 대신 index.html, style.css, script.js 같은 정적 파일만 넣어주세요.",
  },
  {
    pattern: /(^|\/)\.next\//i,
    message: "Next.js 빌드/서버 파일은 가져올 수 없어요. 지금은 HTML/CSS/JS 정적 사이트 ZIP만 지원해요.",
  },
];

const SECRET_OR_EXECUTABLE_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /\.(key|pem|p12|pfx|crt|cer|exe|dll|bat|cmd|ps1|sh|php|py|rb|jar)$/i,
];

const normalizeZipPath = (path) => path.trim().replace(/\\+/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
const isNoisePath = (path) => NOISE_PATH_PATTERNS.some((pattern) => pattern.test(path));

function hasUnsafeZipPath(rawPath, normalizedPath) {
  if (!rawPath.trim()) return true;
  if (normalizedPath.startsWith("/") || /^[A-Za-z]:/.test(normalizedPath)) return true;
  if (/[\x00-\x1F\x7F]/.test(rawPath) || /[\x00-\x1F\x7F]/.test(normalizedPath)) return true;
  return normalizedPath.split("/").some((segment) => segment === "..");
}

function stripSingleRootFolder(paths) {
  if (!paths.length) return paths;
  if (!paths.every((path) => path.includes("/"))) return paths;

  const roots = paths.map((path) => path.split("/")[0]);
  if (!roots.every((root) => root === roots[0])) return null;

  const stripped = paths.map((path) => path.slice(roots[0].length + 1));
  if (stripped.some((path) => !path)) return null;
  return stripped;
}

function toBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function contentTypeFor(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".map")) return "application/json";
  if (lower.endsWith(".webmanifest")) return "application/manifest+json";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) return "audio/midi";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  return undefined;
}

function extensionOf(path) {
  const last = path.split("/").pop() ?? "";
  return last.includes(".") ? last.split(".").pop()?.toLowerCase() ?? "" : "";
}

async function inflateRaw(compressed) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("decompression_stream_unavailable");
  }
  const compressedCopy = new Uint8Array(compressed);
  const stream = new Blob([compressedCopy.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readZipName(bytes) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function unzipStaticEntries(zipBytes) {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  let eocdOffset = -1;
  for (let offset = zipBytes.byteLength - 22; offset >= Math.max(0, zipBytes.byteLength - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("zip_eocd_missing");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);
  const output = {};

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (centralOffset + 46 > zipBytes.byteLength || view.getUint32(centralOffset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("zip_central_directory_invalid");
    }

    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const fileNameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const nameStart = centralOffset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > zipBytes.byteLength) throw new Error("zip_name_invalid");

    const rawPath = readZipName(zipBytes.subarray(nameStart, nameEnd));
    centralOffset = nameEnd + extraLength + commentLength;

    if (localOffset + 30 > zipBytes.byteLength || view.getUint32(localOffset, true) !== LOCAL_FILE_SIGNATURE) {
      throw new Error("zip_local_file_invalid");
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBytes.byteLength) throw new Error("zip_data_invalid");

    const compressed = zipBytes.subarray(dataStart, dataEnd);
    if (method === ZIP_METHOD_STORE) {
      output[rawPath] = new Uint8Array(compressed);
    } else if (method === ZIP_METHOD_DEFLATE) {
      output[rawPath] = await inflateRaw(compressed);
    } else {
      throw new Error("zip_method_unsupported");
    }
  }

  return output;
}

export async function importStudentStaticSiteZip(zipFile) {
  if (typeof DecompressionStream !== "function") {
    return { ok: false, message: ZIP_UNSUPPORTED_BROWSER_MESSAGE };
  }
  if (!zipFile.name.toLowerCase().endsWith(".zip")) {
    return { ok: false, message: "ZIP 파일만 가져올 수 있어요." };
  }
  if (zipFile.size > STUDENT_APP_ZIP_MAX_BYTES) {
    return { ok: false, message: "ZIP 파일이 너무 커요. 20MB 이하로 줄여주세요." };
  }

  let entries;
  try {
    entries = await unzipStaticEntries(new Uint8Array(await zipFile.arrayBuffer()));
  } catch {
    return { ok: false, message: "ZIP 파일을 읽을 수 없어요. 압축 파일이 손상되지 않았는지 확인해 주세요." };
  }

  const rawEntries = Object.entries(entries)
    .map(([rawPath, bytes]) => ({ rawPath, path: normalizeZipPath(rawPath), bytes }))
    .filter((entry) => entry.path && !entry.path.endsWith("/") && !isNoisePath(entry.path));

  if (rawEntries.some((entry) => hasUnsafeZipPath(entry.rawPath, entry.path))) {
    return { ok: false, message: "ZIP 안에 안전하지 않은 파일 경로가 있어요. ../, 절대 경로, 제어문자가 들어간 파일 이름은 사용할 수 없어요." };
  }

  if (rawEntries.length > STUDENT_APP_ZIP_MAX_FILES) {
    return { ok: false, message: "ZIP 안의 파일이 너무 많아요. 100개 이하로 줄여주세요." };
  }

  const totalBytes = rawEntries.reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
  if (totalBytes > STUDENT_APP_ZIP_MAX_BYTES) {
    return { ok: false, message: "ZIP 파일이 너무 커요. 압축을 푼 전체 크기가 20MB 이하가 되도록 줄여주세요." };
  }

  if (rawEntries.some((entry) => entry.path.split("/").filter(Boolean).length > MAX_ZIP_DEPTH)) {
    return { ok: false, message: "파일 구조가 너무 복잡해요. index.html 중심의 간단한 정적 사이트 ZIP만 지원해요." };
  }

  if (rawEntries.some((entry) => /(^|\/)node_modules\//i.test(entry.path))) {
    return { ok: false, message: "node_modules 폴더는 넣지 말아주세요. 지금은 HTML/CSS/JS 정적 사이트 ZIP만 지원해요." };
  }

  for (const { pattern, message } of BUILD_PROJECT_PATTERNS) {
    if (rawEntries.some((entry) => pattern.test(entry.path))) {
      return { ok: false, message };
    }
  }

  if (rawEntries.some((entry) => /(^|\/)\.env(\.|$)/i.test(entry.path))) {
    return { ok: false, message: ".env나 비밀 키 파일은 업로드할 수 없어요." };
  }

  if (rawEntries.some((entry) => SECRET_OR_EXECUTABLE_PATTERNS.some((pattern) => pattern.test(entry.path)))) {
    return { ok: false, message: "비밀 키 파일이나 실행 파일은 업로드할 수 없어요. HTML/CSS/JS 정적 파일만 넣어주세요." };
  }

  const nestedZipEntries = rawEntries.filter((entry) => entry.path.toLowerCase().endsWith(".zip"));
  const staticEntries = rawEntries.filter((entry) => !entry.path.toLowerCase().endsWith(".zip"));

  const normalizedPaths = stripSingleRootFolder(staticEntries.map((entry) => entry.path));
  if (!normalizedPaths) {
    return { ok: false, message: "index.html 위치가 애매해요. ZIP 루트에 index.html을 두거나, 하나의 폴더 안에 index.html을 넣어주세요." };
  }

  const seenPaths = new Set();
  for (const path of normalizedPaths) {
    const key = path.toLowerCase();
    if (seenPaths.has(key)) {
      return { ok: false, message: "ZIP 안에 같은 경로의 파일이 중복되어 있어요. 중복 파일은 하나만 남겨주세요." };
    }
    seenPaths.add(key);
  }

  if (!normalizedPaths.some((path) => path === "index.html")) {
    if (normalizedPaths.some((path) => path.toLowerCase() === "index.html")) {
      return { ok: false, message: "시작 파일 이름은 소문자 index.html이어야 해요. INDEX.HTML을 index.html로 바꿔 주세요." };
    }
    return { ok: false, message: "index.html을 찾을 수 없어요. ZIP 안에 index.html 파일을 넣어주세요." };
  }

  const files = staticEntries.map(({ bytes }, index) => {
    const path = normalizedPaths[index];
    const name = path.split("/").pop() || path;
    const ext = extensionOf(path);
    const contentType = contentTypeFor(path);
    if (TEXT_EXTENSIONS.has(ext) || (contentType?.startsWith("text/") ?? false)) {
      return { name, path, contentType, contentText: new TextDecoder().decode(bytes) };
    }
    return { name, path, contentType, contentBase64: toBase64(bytes) };
  });

  const ignoredMessage = nestedZipEntries.length > 0
    ? ` ZIP 안의 압축 파일 ${nestedZipEntries.map((entry) => entry.path).join(", ")}은 제출 대상에서 제외했어요.`
    : "";
  return { ok: true, files, ignoredFiles: nestedZipEntries.map((entry) => entry.path), message: `ZIP 정적 사이트를 가져왔어요. 추출한 정적 파일을 기존 제출 흐름으로 확인해 주세요.${ignoredMessage}` };
}
