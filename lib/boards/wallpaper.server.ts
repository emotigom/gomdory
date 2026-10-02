import "server-only";

import { listObjectKeysV2, presignGetUrl } from "@/lib/r2/client";
import { readEnvString } from "@/lib/server/runtimeEnv";

const DEFAULT_PREFIX = "assets/wallpaper/";
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"] as const;

export type BoardWallpaperItem = {
  key: string;
  name: string;
  url: string;
};

export function normalizeWallpaperPrefix(prefix: string | null | undefined): string {
  const trimmed = prefix?.trim() ?? "";
  if (!trimmed) return DEFAULT_PREFIX;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function resolveWallpaperPrefix(): string {
  return normalizeWallpaperPrefix(readEnvString("BOARD_WALLPAPER_PREFIX") ?? DEFAULT_PREFIX);
}

export function isWallpaperImageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function normalizeWallpaperKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const prefix = resolveWallpaperPrefix();
  if (!value.startsWith(prefix) || !isWallpaperImageKey(value)) return null;
  return value;
}

function toDisplayName(key: string): string {
  const file = key.split("/").pop() ?? key;
  return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export async function listBoardWallpapers(maxKeys = 100): Promise<{ wallpapers: BoardWallpaperItem[]; truncated: boolean }> {
  const prefix = resolveWallpaperPrefix();
  const listed = await listObjectKeysV2({ prefix, maxKeys });
  const keys = listed.keys.filter((key) => key.startsWith(prefix) && isWallpaperImageKey(key));

  const wallpapers: BoardWallpaperItem[] = await Promise.all(
    keys.map(async (key) => ({
      key,
      name: toDisplayName(key),
      url: await presignGetUrl({ key, expiresSeconds: 60 * 60 * 24 }),
    })),
  );

  wallpapers.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return { wallpapers, truncated: listed.isTruncated };
}

export async function getBoardWallpaperUrl(key: string | null | undefined): Promise<string | null> {
  const normalized = normalizeWallpaperKey(key);
  if (!normalized) return null;
  return presignGetUrl({ key: normalized, expiresSeconds: 60 * 60 * 24 });
}
