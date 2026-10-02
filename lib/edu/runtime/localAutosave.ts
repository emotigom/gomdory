import { digestHex } from "@/lib/crypto/webcrypto";
import { arrayBufferToBase64, base64ToArrayBuffer } from "@/lib/edu/p2p/utils";

type AutosaveFile = {
  content: string;
  contentType: string;
};

type AutosavePayload = {
  v: 1;
  files: Record<string, AutosaveFile>;
};

type AutosaveMeta = {
  codeHash: string;
  fileNames: string[];
  lens: number[];
};

type StoredAutosave = {
  v: 1;
  ts: number;
  ciphertext: string;
  iv: string;
  meta: AutosaveMeta;
};

const AUTOSAVE_STORAGE_KEY = "edu:autosave:v1";
const AUTOSAVE_KEY_STORAGE = "edu:autosave:key";
const AUTOSAVE_ENABLED_KEY = "edu:autosave:enabled";

const getCrypto = () => (typeof crypto !== "undefined" ? crypto : null);

const getStoredKey = async () => {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(AUTOSAVE_KEY_STORAGE);
  if (!stored) return null;
  const buffer = base64ToArrayBuffer(stored);
  const subtle = getCrypto()?.subtle;
  if (!subtle) return null;
  return subtle.importKey("raw", buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const createKey = async () => {
  if (typeof window === "undefined") return null;
  const subtle = getCrypto()?.subtle;
  if (!subtle) return null;
  const raw = new Uint8Array(32);
  getCrypto()?.getRandomValues(raw);
  window.sessionStorage.setItem(AUTOSAVE_KEY_STORAGE, arrayBufferToBase64(raw.buffer));
  return subtle.importKey("raw", raw.buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
};

const getOrCreateKey = async () => {
  const existing = await getStoredKey();
  if (existing) return existing;
  return createKey();
};

const buildMeta = async (files: Record<string, AutosaveFile>): Promise<AutosaveMeta> => {
  const fileNames = Object.keys(files).sort((a, b) => a.localeCompare(b));
  const lens = fileNames.map((name) => files[name]?.content.length ?? 0);
  const seed = fileNames.map((name) => `${name}\n${files[name]?.content ?? ""}`).join("\n");
  const digest = await digestHex("SHA-256", seed);
  return {
    codeHash: digest.slice(0, 12),
    fileNames,
    lens,
  };
};

export const getAutosaveEnabled = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(AUTOSAVE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
};

export const setAutosaveEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.sessionStorage.setItem(AUTOSAVE_ENABLED_KEY, "1");
    } else {
      window.sessionStorage.removeItem(AUTOSAVE_ENABLED_KEY);
      window.sessionStorage.removeItem(AUTOSAVE_KEY_STORAGE);
    }
  } catch {
    // ignore storage failures
  }
};

export const clearLocalAutosave = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
};

export const saveLocalAutosave = async (files: Record<string, AutosaveFile>) => {
  if (typeof window === "undefined") return;
  if (!files || Object.keys(files).length === 0) return;
  const subtle = getCrypto()?.subtle;
  if (!subtle) return;
  const key = await getOrCreateKey();
  if (!key) return;
  const iv = new Uint8Array(12);
  getCrypto()?.getRandomValues(iv);
  const payload: AutosavePayload = { v: 1, files };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const meta = await buildMeta(files);
  const record: StoredAutosave = {
    v: 1,
    ts: Date.now(),
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer),
    meta,
  };
  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage failures
  }
};

export const restoreLocalAutosave = async (): Promise<
  | { ok: true; files: Record<string, AutosaveFile>; meta: AutosaveMeta }
  | { ok: false }
> => {
  if (typeof window === "undefined") return { ok: false };
  const subtle = getCrypto()?.subtle;
  if (!subtle) return { ok: false };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return { ok: false };
  let stored: StoredAutosave | null = null;
  try {
    stored = JSON.parse(raw) as StoredAutosave;
  } catch {
    stored = null;
  }
  if (!stored || stored.v !== 1) return { ok: false };
  const key = await getStoredKey();
  if (!key) return { ok: false };
  try {
    const iv = base64ToArrayBuffer(stored.iv);
    const cipher = base64ToArrayBuffer(stored.ciphertext);
    const decrypted = await subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, cipher);
    const decoded = new TextDecoder().decode(decrypted);
    const payload = JSON.parse(decoded) as AutosavePayload;
    if (!payload || payload.v !== 1 || !payload.files) {
      return { ok: false };
    }
    return { ok: true, files: payload.files, meta: stored.meta };
  } catch {
    return { ok: false };
  }
};
