"use client";

import { useCallback, useState } from "react";

type FileDropzoneProps = {
  onFiles: (files: FileList | File[]) => void;
  children: React.ReactNode;
};

export function FileDropzone({ onFiles, children }: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        onFiles(event.dataTransfer.files);
        event.dataTransfer.clearData();
      }
    },
    [onFiles],
  );

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="relative">
      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-indigo-300 bg-indigo-100/70">
          <p className="text-sm font-semibold text-indigo-700">여기에 파일을 놓아 업로드하세요</p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
