import type { StudentAppDeploymentManifest, StudentAppUploadFileInput } from "./deploymentTypes";
import { buildStudentAppFileR2Key } from "./studentAppStorageKeys";

export type StoredSubmissionFileMetadata = {
  path: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

export async function putStudentAppSubmissionFilesToR2(input: {
  bucket: R2Bucket;
  prefix: string;
  files: StudentAppUploadFileInput[];
  manifest: StudentAppDeploymentManifest;
}): Promise<{ prefix: string; manifestKey: string; files: StoredSubmissionFileMetadata[] }> {
  const fileByPath = new Map(input.files.map((file) => [file.path, file]));
  const storedFiles: StoredSubmissionFileMetadata[] = [];

  for (const manifestFile of input.manifest.files) {
    const uploadFile = fileByPath.get(manifestFile.path);
    if (!uploadFile) throw new Error(`Missing upload content for manifest path: ${manifestFile.path}`);
    const r2Key = buildStudentAppFileR2Key(input.prefix, manifestFile.path);
    await input.bucket.put(r2Key, uploadFile.content, {
      httpMetadata: { contentType: manifestFile.contentType },
      customMetadata: {
        sha256: manifestFile.sha256,
        submissionManifestVersion: String(input.manifest.version),
        entryFile: input.manifest.entryFile,
      },
    });
    storedFiles.push({ path: manifestFile.path, r2Key, contentType: manifestFile.contentType, sizeBytes: manifestFile.sizeBytes, sha256: manifestFile.sha256 });
  }

  const manifestKey = buildStudentAppFileR2Key(input.prefix, "manifest.json");
  await input.bucket.put(manifestKey, JSON.stringify(input.manifest), { httpMetadata: { contentType: "application/json" } });

  return { prefix: input.prefix, manifestKey, files: storedFiles };
}

export async function deleteStudentAppSubmissionObjectsFromR2(input: { bucket: R2Bucket; keys: string[] }) {
  await Promise.all(input.keys.map(async (key) => { try { await input.bucket.delete(key); } catch {} }));
}
