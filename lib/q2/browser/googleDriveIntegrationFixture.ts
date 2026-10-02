import type { GoogleDrivePreference } from "@/lib/google-drive/types";

const STORE = Symbol.for("gomdory.q2.b9.google-drive-preference-store");
type Store = { preference: GoogleDrivePreference | null; version: number };

function registry() { return globalThis as typeof globalThis & { [STORE]?: Store }; }
function store(): Store { const global = registry(); return global[STORE] ?? (global[STORE] = { preference: null, version: 0 }); }

export function resetGoogleDriveIntegrationFixture() { const current = store(); current.preference = null; current.version += 1; return current.version; }
export function readGoogleDriveIntegrationPreference() { const preference = store().preference; return preference ? { ...preference } : null; }
export function saveGoogleDriveIntegrationPreference(folder: Pick<GoogleDrivePreference, "folderId" | "folderName" | "folderWebViewLink">) {
  const current = store();
  current.version += 1;
  current.preference = { userId: "00000000-0000-4000-8000-0000000000e9", purpose: "board-backup", ...folder, updatedAt: new Date().toISOString() };
  return { ...current.preference };
}
export function clearGoogleDriveIntegrationPreference() { const current = store(); current.preference = null; current.version += 1; }
