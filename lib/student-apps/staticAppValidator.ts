import {
  STUDENT_APP_ENTRY_FILE,
  STUDENT_APP_MANIFEST_VERSION,
  type StudentAppManifestFile,
  type StudentAppUploadFileInput,
  type ValidateStudentStaticAppInput,
  type ValidateStudentStaticAppResult,
} from "./deploymentTypes";
import { checkStudentAppFileRule, STUDENT_APP_MAX_FILE_COUNT, STUDENT_APP_MAX_TOTAL_SIZE_BYTES } from "./fileRules";

function toBytes(content: StudentAppUploadFileInput["content"]): Uint8Array {
  return typeof content === "string" ? new TextEncoder().encode(content) : content;
}


async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("crypto_subtle_unavailable");
  }

  const digestInput = Uint8Array.from(bytes);
  const digest = await subtle.digest("SHA-256", digestInput);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validateStudentStaticApp(input: ValidateStudentStaticAppInput): Promise<ValidateStudentStaticAppResult> {
  const warnings = new Set<string>();
  const blockedReasons: string[] = [];
  const errors: string[] = [];

  const manifestFiles: StudentAppManifestFile[] = [];
  let totalSizeBytes = 0;
  let hasIndexHtml = false;
  let submittedFileCount = 0;

  for (const file of [...input.files].sort((a, b) => a.path.localeCompare(b.path))) {
    const bytes = toBytes(file.content);
    const rule = checkStudentAppFileRule({ path: file.path, contentType: file.contentType, sizeBytes: bytes.byteLength });
    if (rule.skip) {
      warnings.add(`skipped_system_file:${file.path}`);
      continue;
    }
    if (rule.classification === "ignored-safe") {
      warnings.add(`ignored_safe_file:${file.path}`);
      continue;
    }
    if (rule.issue) {
      const error = `${rule.issue}:${file.path}`;
      errors.push(error);
      if (rule.issue === "dangerous_file") blockedReasons.push(error);
      continue;
    }
    submittedFileCount += 1;
    totalSizeBytes += bytes.byteLength;
    if (file.path === STUDENT_APP_ENTRY_FILE) hasIndexHtml = true;
    const isHtml = file.path.toLowerCase().endsWith(".html");
    const isJavaScript = /\.(?:js|mjs)$/i.test(file.path);
    if (isHtml || isJavaScript) {
      const source = new TextDecoder().decode(bytes);
      if (isHtml) {
        const html = source;
        if (/<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i.test(html)) {
          warnings.add("external_script_src_detected");
        }
        if (/<form\b[^>]*\baction\s*=/i.test(html)) {
          warnings.add("form_action_detected");
        }
        if (/\bon[a-z]+\s*=/i.test(html)) {
          warnings.add("inline_event_handler_detected");
        }
      }
      if (/\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|EventSource\b)/i.test(source)) {
        warnings.add("network_request_api_detected");
      }
    }

    const sha256 = await sha256Hex(bytes);
    manifestFiles.push({
      path: file.path,
      sizeBytes: bytes.byteLength,
      contentType: rule.contentType,
      sha256,
    });
  }

  if (!hasIndexHtml) {
    errors.push("missing_index_html");
  }
  if (submittedFileCount > STUDENT_APP_MAX_FILE_COUNT) {
    errors.push(`file_count_exceeds_limit:${submittedFileCount}`);
  }
  if (totalSizeBytes > STUDENT_APP_MAX_TOTAL_SIZE_BYTES) {
    errors.push(`total_size_exceeds_limit:${totalSizeBytes}`);
  }

  const warningList = [...warnings].sort();
  const manifest = {
    version: STUDENT_APP_MANIFEST_VERSION,
    title: input.title,
    entryFile: STUDENT_APP_ENTRY_FILE,
    files: manifestFiles,
    totalSizeBytes,
    createdAt: input.createdAt ?? new Date().toISOString(),
    source: input.source,
    safety: {
      hasExternalScripts: warningList.includes("external_script_src_detected"),
      hasInlineScripts: warningList.includes("inline_event_handler_detected"),
      hasForms: warningList.includes("form_action_detected"),
      hasNetworkRequests: warningList.includes("network_request_api_detected"),
      warnings: warningList,
      blockedReasons: [...blockedReasons].sort(),
    },
  };

  if (errors.length > 0) {
    return { ok: false, errors: [...new Set(errors)].sort(), manifest };
  }

  return { ok: true, manifest };
}
