export const STUDENT_APP_R2_PREFIX = "student-apps";
export const STUDENT_APP_SUBMISSION_R2_PREFIX = "student-apps/submissions/private";

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function assertSafeId(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || !SAFE_ID_RE.test(trimmed)) {
    throw new Error(`Invalid ${label}: only [a-zA-Z0-9_-] is allowed.`);
  }
  return trimmed;
}

export function buildStudentAppDeploymentPrefix(input: {
  boardId: string;
  deploymentId: string;
  version: number;
}): string {
  const boardId = assertSafeId(input.boardId, "boardId");
  const deploymentId = assertSafeId(input.deploymentId, "deploymentId");

  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error("Invalid version: version must be an integer >= 1.");
  }

  return `${STUDENT_APP_R2_PREFIX}/private/${boardId}/${deploymentId}/v${input.version}/`;
}

export function buildStudentAppFileR2Key(prefix: string, filePath: string): string {
  if (!prefix || !prefix.startsWith(`${STUDENT_APP_R2_PREFIX}/`)) {
    throw new Error("Invalid prefix: expected student-apps/ prefix.");
  }

  const normalized = filePath.replace(/\/+/g, "/").trim();
  if (!normalized) {
    throw new Error("Invalid file path: path cannot be empty.");
  }
  if (normalized.startsWith("/")) {
    throw new Error("Invalid file path: absolute paths are not allowed.");
  }
  if (normalized.includes("\\")) {
    throw new Error("Invalid file path: backslashes are not allowed.");
  }
  if (normalized.includes("..")) {
    throw new Error("Invalid file path: traversal segments are not allowed.");
  }
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error("Invalid file path: control characters are not allowed.");
  }

  return `${prefix}${normalized}`;
}

export function buildStudentAppSubmissionPrefix(input: {
  boardId: string;
  submissionId: string;
}): string {
  const boardId = assertSafeId(input.boardId, "boardId");
  const submissionId = assertSafeId(input.submissionId, "submissionId");

  return `${STUDENT_APP_SUBMISSION_R2_PREFIX}/${boardId}/${submissionId}/`;
}
