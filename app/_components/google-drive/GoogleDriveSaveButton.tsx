"use client";

import { GoogleDriveSavePanel } from "./GoogleDriveSavePanel";
import type { GoogleDrivePurpose } from "@/lib/google-drive/types";

type Props = {
  purpose: GoogleDrivePurpose;
  defaultFolderName: string;
  buttonLabel?: string;
  disabled?: boolean;
  createFile: () => Promise<{ blob: Blob; fileName: string; mimeType: string; appProperties?: Record<string, string> }>;
  className?: string;
};

export function GoogleDriveSaveButton({ purpose, defaultFolderName, buttonLabel, disabled, createFile, className }: Props) {
  return (
    <GoogleDriveSavePanel
      purpose={purpose}
      defaultFolderName={defaultFolderName}
      actions={[{
        id: "save",
        label: buttonLabel ?? "Google Drive에 저장",
        disabled,
        createFile,
        className,
      }]}
    />
  );
}
