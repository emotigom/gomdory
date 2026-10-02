import type { ManualFile } from "@/app/dashboard/boards/[boardId]/board/_components/studentAppLocalPreview";

const TEXT_EXTENSIONS = new Set(["html", "htm", "css", "js", "mjs", "json", "txt", "md", "svg", "map"]);

function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export async function fileToStudentAppManualFile(file: File, pathOverride?: string): Promise<ManualFile> {
  const path = pathOverride || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) {
    return { name: file.name, path, contentType: file.type || undefined, contentText: await file.text() };
  }
  return { name: file.name, path, contentType: file.type || undefined, contentBase64: toBase64(await file.arrayBuffer()) };
}

export async function filesToStudentAppManualFiles(files: File[]): Promise<ManualFile[]> {
  // Keep memory bounded for large Base64 payloads and preserve selected order.
  const manualFiles: ManualFile[] = [];
  for (const file of files) manualFiles.push(await fileToStudentAppManualFile(file));
  return manualFiles;
}
