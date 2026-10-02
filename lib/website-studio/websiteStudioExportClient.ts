const canUseBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

export function sanitizeExportFilename(base: string, fallback: string) {
  const cleaned = base.toLowerCase().replace(/[^a-z0-9가-힣-_\s]/g, "").trim().replace(/\s+/g, "-");
  return cleaned || fallback;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!canUseBrowser()) return false;
  try {
    await window.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadTextFile(filename: string, text: string, mimeType: string): boolean {
  if (!canUseBrowser()) return false;
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
