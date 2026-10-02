import { z } from "zod";

export type FilesPayload<AllowedFile extends string = string> = {
  type: "files";
  message?: string;
  files: Record<AllowedFile, string>;
};

const createFilesRecordSchema = <AllowedFile extends string>(allowedFiles: AllowedFile[]) => {
  const allowedSet = new Set(allowedFiles);
  return z.record(z.string()).superRefine((value, ctx) => {
    Object.keys(value).forEach((filename) => {
      if (!allowedSet.has(filename as AllowedFile)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `허용되지 않은 파일명: ${filename}`,
        });
      }
    });
  });
};

export const createFilesPayloadSchema = <AllowedFile extends string>(allowedFiles: AllowedFile[]) =>
  z
    .object({
      type: z.literal("files"),
      message: z.string().optional(),
      files: createFilesRecordSchema(allowedFiles),
    })
    .strict();
