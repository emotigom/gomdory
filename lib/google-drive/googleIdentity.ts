"use client";

import { getGoogleDriveConfig, GOOGLE_DRIVE_SCOPE } from "./config";

type TokenResponse = { access_token?: string; error?: string; scope?: string };
type TokenClient = { requestAccessToken: (config?: { prompt?: string }) => void };

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: TokenResponse) => void }) => TokenClient; revoke: (token: string, callback: () => void) => void } } };
  }
}

let accessToken: string | null = null;
let scriptPromise: Promise<void> | null = null;

export function getGoogleDriveAccessToken() { return accessToken; }
export function clearGoogleDriveAccessToken() { accessToken = null; }

function loadIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function requestGoogleDriveAccessToken(): Promise<string> {
  const config = getGoogleDriveConfig();
  if (!config) throw new Error("Google Drive 연동이 설정되지 않았습니다.");
  await loadIdentityScript();
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) { reject(new Error("Google Identity Services를 초기화하지 못했습니다.")); return; }
    const client = oauth2.initTokenClient({ client_id: config.clientId, scope: GOOGLE_DRIVE_SCOPE, callback: (response) => {
      if (!response.access_token) { reject(new Error(response.error === "access_denied" ? "Google Drive 권한 요청이 취소되었습니다." : "Google Drive 권한을 받지 못했습니다.")); return; }
      accessToken = response.access_token;
      resolve(response.access_token);
    }});
    client.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

export function revokeGoogleDriveAccess(): Promise<void> {
  const token = accessToken;
  accessToken = null;
  if (!token || !window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve) => window.google!.accounts!.oauth2!.revoke(token, resolve));
}
