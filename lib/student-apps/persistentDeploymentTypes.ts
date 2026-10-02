import type { StudentAppDeploymentManifest } from "./deploymentTypes";

export const STUDENT_APP_DEPLOYMENT_STATUSES = [
  "draft",
  "validated",
  "stored",
  "approved",
  "published",
  "blocked",
  "archived",
] as const;

export type StudentAppDeploymentStatus = (typeof STUDENT_APP_DEPLOYMENT_STATUSES)[number];

export type StudentAppDeploymentRecord = {
  id: string;
  boardId: string;
  wallId: string | null;
  cardId: string | null;
  classId: string | null;
  createdBy: string;
  title: string;
  slug: string;
  version: number;
  status: StudentAppDeploymentStatus;
  source: "manual_files" | "zip_upload" | "external_link_capture";
  entryFile: "index.html";
  r2Prefix: string;
  manifest: StudentAppDeploymentManifest;
  safety: Record<string, unknown>;
  fileCount: number;
  totalSizeBytes: number;
  createdAt: string;
  updatedAt: string;
  storedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
};

export type StudentAppDeploymentFileRecord = {
  id: string;
  deploymentId: string;
  path: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

export type CreateStudentAppDeploymentDraftInput = {
  boardId: string;
  wallId?: string | null;
  cardId?: string | null;
  classId?: string | null;
  createdBy: string;
  title: string;
  slug: string;
  version?: number;
  source: "manual_files" | "zip_upload" | "external_link_capture";
  entryFile?: "index.html";
  r2Prefix: string;
  manifest: StudentAppDeploymentManifest;
  safety?: Record<string, unknown>;
  fileCount: number;
  totalSizeBytes: number;
};

export type StoredStudentAppFileMetadata = {
  path: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};
