import type { StudentAppDeploymentManifest, StudentAppSource } from "./deploymentTypes";
import { buildValidationInputFromNormalizedFiles, normalizeStudentAppFiles } from "./staticAppIntake";
import { validateStudentStaticApp } from "./staticAppValidator";

export class StudentAppDryRunBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentAppDryRunBadRequestError";
  }
}

type StudentStaticAppDryRunApiFile = {
  name: string;
  path?: string | null;
  contentType?: string | null;
  contentText?: string;
  contentBase64?: string;
};

export type StudentStaticAppDryRunInput = {
  title?: string;
  source?: StudentAppSource;
  rootFolderName?: string | null;
  files?: StudentStaticAppDryRunApiFile[];
};

export type StudentStaticAppDryRunResult = {
  ok: boolean;
  title: string;
  source: StudentAppSource;
  normalized: {
    ok: boolean;
    warnings: string[];
    errors?: string[];
    files: Array<{ path: string; contentType?: string; sizeBytes: number }>;
  };
  validation: {
    ok: boolean;
    errors: string[];
    manifest: StudentAppDeploymentManifest;
  };
};

export function decodeBase64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  let binary = "";
  try {
    binary = atob(normalized);
  } catch {
    throw new StudentAppDryRunBadRequestError("invalid_base64_content");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}


export type DecodedStudentStaticAppPayload = {
  title?: string;
  source: StudentAppSource;
  rootFolderName?: string | null;
  intakeFiles: Array<{
    name: string;
    path?: string | null;
    contentType?: string | null;
    content: string | Uint8Array;
  }>;
};

export function decodeStudentStaticAppPayload(rawInput: unknown): DecodedStudentStaticAppPayload {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new StudentAppDryRunBadRequestError("invalid_body");
  }

  const input = rawInput as StudentStaticAppDryRunInput;
  if (!Array.isArray(input.files)) throw new StudentAppDryRunBadRequestError("files_required");
  if (input.files.length === 0) throw new StudentAppDryRunBadRequestError("files_required");
  // The validator counts only files that are actually submitted. Explicitly
  // safe originals (for example a PSD or ZIP beside a web project) are
  // decoded once here but excluded before the 100-file project limit.

  const source = input.source ?? "manual_files";
  if (source !== "manual_files") {
    throw new StudentAppDryRunBadRequestError("invalid_source");
  }

  const intakeFiles = input.files.map((file, index) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw new StudentAppDryRunBadRequestError(`invalid_file:${index}`);
    }
    if (typeof file.name !== "string" || !file.name.trim()) throw new StudentAppDryRunBadRequestError(`invalid_file_name:${index}`);

    const hasText = typeof file.contentText === "string";
    const hasBase64 = typeof file.contentBase64 === "string";
    if (hasText && hasBase64) throw new StudentAppDryRunBadRequestError(`file_content_conflict:${index}`);
    if (!hasText && !hasBase64) throw new StudentAppDryRunBadRequestError(`file_content_missing:${index}`);

    const content = hasText ? file.contentText! : decodeBase64ToBytes(file.contentBase64!);

    return {
      name: file.name,
      path: file.path,
      contentType: file.contentType,
      content,
    };
  });

  return { title: input.title, source: source as StudentAppSource, rootFolderName: input.rootFolderName, intakeFiles };
}
export async function runStudentStaticAppDryRun(rawInput: unknown): Promise<StudentStaticAppDryRunResult> {
  const decoded = decodeStudentStaticAppPayload(rawInput);
  const normalized = normalizeStudentAppFiles({ files: decoded.intakeFiles, rootFolderName: decoded.rootFolderName });
  const normalizedFiles = normalized.files.map((file) => ({
    path: file.path,
    contentType: file.contentType,
    sizeBytes: typeof file.content === "string" ? new TextEncoder().encode(file.content).byteLength : file.content.byteLength,
  }));

  const validationInput = buildValidationInputFromNormalizedFiles({ files: normalized.files, title: decoded.title, source: decoded.source });
  const validationResult = await validateStudentStaticApp(validationInput);
  const validationErrors = validationResult.ok ? [] : validationResult.errors;

  return {
    ok: normalized.ok && validationResult.ok,
    title: validationInput.title,
    source: decoded.source,
    normalized: normalized.ok
      ? { ok: true, warnings: normalized.warnings, files: normalizedFiles }
      : { ok: false, warnings: normalized.warnings, errors: normalized.errors, files: normalizedFiles },
    validation: {
      ok: validationResult.ok,
      errors: validationErrors,
      manifest: validationResult.manifest,
    },
  };
}
