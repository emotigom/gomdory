import { createHash, randomBytes } from "node:crypto";

import { isSafeWebsiteStudioUrl } from "@/lib/website-studio/websiteStudioUrlSafety";

export type WebsiteStudioPublishStatus = "published" | "unpublished";

export const WEBSITE_STUDIO_PUBLISH_BANNED_PATTERNS = ["<script", "<iframe", "onclick=", "onerror=", "javascript:", "data:", "vbscript:"];

export function hasUnsafeSnapshotContent(text: string): boolean {
  const lower = text.toLowerCase();
  return WEBSITE_STUDIO_PUBLISH_BANNED_PATTERNS.some((p) => lower.includes(p));
}

export function normalizeWebsiteStudioSlugBase(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "gomdory-site";
}

export function createWebsiteStudioSlug(title: string, sourceLocalId: string, nonce?: string): string {
  const base = normalizeWebsiteStudioSlugBase(title);
  const seed = nonce ?? randomBytes(8).toString("hex");
  const digest = createHash("sha256").update(`${sourceLocalId}:${title}:${seed}`).digest("hex").slice(0, 6);
  return `${base}-${digest}`;
}

export function validatePublishSnapshot(snapshot: { html: string; css: string; fullDocument: string }): string | null {
  if (!snapshot.fullDocument?.trim()) return "empty_snapshot";
  if (hasUnsafeSnapshotContent(`${snapshot.html}\n${snapshot.css}\n${snapshot.fullDocument}`)) return "unsafe_snapshot";
  const urlMatches = snapshot.fullDocument.match(/(?:href|src)=["']([^"']+)["']/gi) ?? [];
  for (const entry of urlMatches) {
    const url = entry.split(/["']/)[1] ?? "";
    if (url && !isSafeWebsiteStudioUrl(url)) return "unsafe_url";
  }
  return null;
}
