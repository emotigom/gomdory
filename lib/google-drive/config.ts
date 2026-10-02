export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_DRIVE_UPLOAD_LIMIT = 5 * 1024 * 1024;

export type GoogleDriveConfig = {
  clientId: string;
  apiKey: string;
  appId: string;
};

export function getGoogleDriveConfig(): GoogleDriveConfig | null {
  if (process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ENABLED !== "true") return null;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY?.trim();
  const appId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID?.trim();
  return clientId && apiKey && appId ? { clientId, apiKey, appId } : null;
}
