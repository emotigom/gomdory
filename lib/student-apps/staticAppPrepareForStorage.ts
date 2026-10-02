import type { StudentAppSource, StudentAppUploadFileInput } from "./deploymentTypes";
import { buildValidationInputFromNormalizedFiles, normalizeStudentAppFiles } from "./staticAppIntake";
import {
  decodeStudentStaticAppPayload,
  type DecodedStudentStaticAppPayload,
  type StudentStaticAppDryRunInput,
} from "./staticAppDryRun";
import { validateStudentStaticApp } from "./staticAppValidator";

export type PreparedStudentStaticAppForStorage = {
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
    manifest: Awaited<ReturnType<typeof validateStudentStaticApp>>["manifest"];
  };
  filesForStorage: StudentAppUploadFileInput[];
};

function toNormalizedView(files: StudentAppUploadFileInput[], manifest: Awaited<ReturnType<typeof validateStudentStaticApp>>["manifest"]) {
  const sizesByPath = new Map(manifest.files.map((file) => [file.path, file.sizeBytes]));
  return files.map((file) => ({
    path: file.path,
    contentType: file.contentType,
    // Valid files were already encoded once by validation for hashing. Reuse
    // that size instead of creating another TextEncoder allocation.
    sizeBytes: sizesByPath.get(file.path) ?? (typeof file.content === "string" ? new TextEncoder().encode(file.content).byteLength : file.content.byteLength),
  }));
}

export async function prepareStudentStaticAppForStorage(rawInput: unknown): Promise<PreparedStudentStaticAppForStorage> {
  const decoded: DecodedStudentStaticAppPayload = decodeStudentStaticAppPayload(rawInput as StudentStaticAppDryRunInput);
  const normalized = normalizeStudentAppFiles({ files: decoded.intakeFiles, rootFolderName: decoded.rootFolderName });
  const validationInput = buildValidationInputFromNormalizedFiles({
    files: normalized.files,
    title: decoded.title,
    source: decoded.source,
  });
  const validationResult = await validateStudentStaticApp(validationInput);

  return {
    title: validationInput.title,
    source: decoded.source,
    normalized: normalized.ok
      ? { ok: true, warnings: normalized.warnings, files: toNormalizedView(normalized.files, validationResult.manifest) }
      : { ok: false, warnings: normalized.warnings, errors: normalized.errors, files: toNormalizedView(normalized.files, validationResult.manifest) },
    validation: {
      ok: validationResult.ok,
      errors: validationResult.ok ? [] : validationResult.errors,
      manifest: validationResult.manifest,
    },
    filesForStorage: normalized.files,
  };
}
