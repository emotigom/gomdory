"use client";

import { getGoogleDriveConfig } from "./config";
import { GOOGLE_DRIVE_PICKER_IMPORT_MIME_TYPES } from "./driveImport";
import type { GoogleDriveFile } from "./types";

export type GoogleDrivePickedFile = {
  id: string;
  name: string;
  mimeType?: string;
  url?: string;
};

type PickerData = { action?: string; docs?: Array<{ id: string; name: string; mimeType?: string; url?: string }> };
type DocsView = { setIncludeFolders: (included: boolean) => DocsView; setSelectFolderEnabled: (enabled: boolean) => DocsView; setMimeTypes: (mimeTypes: string) => DocsView };
type PickerBuilder = { addView: (view: DocsView) => PickerBuilder; setOAuthToken: (token: string) => PickerBuilder; setDeveloperKey: (key: string) => PickerBuilder; setAppId: (id: string) => PickerBuilder; setCallback: (callback: (data: PickerData) => void) => PickerBuilder; build: () => { setVisible: (visible: boolean) => void } };
type GooglePicker = { PickerBuilder: new () => PickerBuilder; DocsView: new (viewId: string) => DocsView; ViewId: { FOLDERS: string; DOCS: string }; Action: { PICKED: string; CANCEL: string } };

declare global { interface Window { gapi?: { load: (name: string, callback: () => void) => void; picker?: GooglePicker } } }

let pickerScript: Promise<void> | null = null;
function loadPickerScript() {
  if (window.gapi?.picker) return Promise.resolve();
  if (pickerScript) return pickerScript;
  pickerScript = new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = "https://apis.google.com/js/api.js"; script.async = true; script.onload = () => window.gapi?.load("picker", resolve); script.onerror = () => reject(new Error("Google Picker를 불러오지 못했습니다.")); document.head.appendChild(script); });
  return pickerScript;
}

export async function pickGoogleDriveFolder(accessToken: string): Promise<GoogleDriveFile | null> {
  const config = getGoogleDriveConfig();
  if (!config) throw new Error("Google Drive 연동이 설정되지 않았습니다.");
  await loadPickerScript();
  return new Promise((resolve, reject) => {
    const picker = window.gapi?.picker;
    if (!picker) { reject(new Error("Google Picker를 초기화하지 못했습니다.")); return; }
    const view = new picker.DocsView(picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
    const dialog = new picker.PickerBuilder().addView(view).setOAuthToken(accessToken).setDeveloperKey(config.apiKey).setAppId(config.appId).setCallback((data) => {
      if (data.action === picker.Action.CANCEL) resolve(null);
      if (data.action === picker.Action.PICKED) { const folder = data.docs?.[0]; resolve(folder ? { id: folder.id, name: folder.name, webViewLink: folder.url } : null); }
    }).build();
    dialog.setVisible(true);
  });
}

export async function pickGoogleDriveFile(accessToken: string): Promise<GoogleDrivePickedFile | null> {
  const config = getGoogleDriveConfig();
  if (!config) throw new Error("Google Drive 연동이 설정되지 않았습니다.");
  await loadPickerScript();
  return new Promise((resolve, reject) => {
    const picker = window.gapi?.picker;
    if (!picker) { reject(new Error("Google Picker를 초기화하지 못했습니다.")); return; }
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMimeTypes(GOOGLE_DRIVE_PICKER_IMPORT_MIME_TYPES.join(","));
    const dialog = new picker.PickerBuilder().addView(view).setOAuthToken(accessToken).setDeveloperKey(config.apiKey).setAppId(config.appId).setCallback((data) => {
      if (data.action === picker.Action.CANCEL) resolve(null);
      if (data.action === picker.Action.PICKED) {
        const file = data.docs?.[0];
        resolve(file ? { id: file.id, name: file.name, mimeType: file.mimeType, url: file.url } : null);
      }
    }).build();
    dialog.setVisible(true);
  });
}
