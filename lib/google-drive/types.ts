export type GoogleDrivePurpose =
  | "student-records"
  | "student-gallery"
  | "board-backup";

export type GoogleDrivePreference = {
  userId: string;
  purpose: GoogleDrivePurpose;
  folderId: string;
  folderName: string;
  folderWebViewLink?: string;
  updatedAt: string;
};

export type GoogleDriveFile = { id: string; name: string; webViewLink?: string };
export type GoogleDriveAppProperties = Record<string, string>;
export type GoogleDriveUploadProgress = (percent: number) => void;
