export const STUDENT_APP_MANIFEST_VERSION = 1 as const;
export const STUDENT_APP_ENTRY_FILE = "index.html" as const;

export type StudentAppSource =
  | "zip_upload"
  | "manual_files"
  | "external_link_capture";

export type StudentAppManifestFile = {
  path: string;
  sizeBytes: number;
  contentType: string;
  sha256: string;
};

export type StudentAppDeploymentManifest = {
  version: typeof STUDENT_APP_MANIFEST_VERSION;
  title: string;
  entryFile: typeof STUDENT_APP_ENTRY_FILE;
  files: StudentAppManifestFile[];
  totalSizeBytes: number;
  createdAt: string;
  source: StudentAppSource;
  safety: {
    hasExternalScripts: boolean;
    hasInlineScripts: boolean;
    hasForms: boolean;
    hasNetworkRequests: boolean;
    warnings: string[];
    blockedReasons: string[];
  };
};

export type StudentAppUploadFileInput = {
  path: string;
  contentType?: string;
  content: string | Uint8Array;
};

export type ValidateStudentStaticAppInput = {
  title: string;
  source: StudentAppSource;
  files: StudentAppUploadFileInput[];
  createdAt?: string;
};

export type ValidateStudentStaticAppResult =
  | { ok: true; manifest: StudentAppDeploymentManifest }
  | {
      ok: false;
      errors: string[];
      manifest: StudentAppDeploymentManifest;
    };
