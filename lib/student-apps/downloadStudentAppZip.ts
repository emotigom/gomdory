"use client";

import { createZip } from "@/lib/board/zipWriter";

type StudentAppZipSource = {
  html: string;
  css: string;
  js: string;
};

const STUDENT_APP_ZIP_FILENAME = "gomdory-student-app.zip";

function textToBytes(value: string) {
  return new TextEncoder().encode(value);
}

export function downloadStudentAppZip(source: StudentAppZipSource) {
  const zipData = createZip([
    { filename: "index.html", data: textToBytes(source.html) },
    { filename: "style.css", data: textToBytes(source.css) },
    { filename: "script.js", data: textToBytes(source.js) },
  ]);
  const zipBuffer = new ArrayBuffer(zipData.byteLength);
  new Uint8Array(zipBuffer).set(zipData);
  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = STUDENT_APP_ZIP_FILENAME;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
