export const allowedCoachFiles = ["index.html", "style.css", "script.js"] as const;

export type AllowedCoachFile = (typeof allowedCoachFiles)[number];

type AllowedFilesValidationResult =
  | { ok: true }
  | { ok: false; invalidFiles: string[] };

export const validateAllowedCoachFiles = (
  files: Record<string, string>,
): AllowedFilesValidationResult => {
  const allowedSet = new Set<string>(allowedCoachFiles);
  const invalidFiles = Object.keys(files).filter((filename) => !allowedSet.has(filename));

  if (invalidFiles.length > 0) {
    return { ok: false, invalidFiles };
  }

  return { ok: true };
};
