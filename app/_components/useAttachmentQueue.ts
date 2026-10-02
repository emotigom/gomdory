"use client";

import type { ClipboardEvent, DragEvent } from "react";
import { useCallback, useRef, useState } from "react";

const defaultFiles: File[] = [];

type AttachmentQueueOptions = {
  files?: File[];
  disabled?: boolean;
  onChange: (files: File[]) => void;
};

export function useAttachmentQueue({ files = defaultFiles, disabled, onChange }: AttachmentQueueOptions) {
  const dragCounter = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (disabled) return;
      const nextFiles = Array.from(incoming ?? []);
      if (!nextFiles.length) return;
      onChange([...files, ...nextFiles]);
    },
    [disabled, files, onChange],
  );

  const removeFile = useCallback(
    (index: number) => {
      if (disabled) return;
      onChange(files.filter((_, i) => i !== index));
    },
    [disabled, files, onChange],
  );

  const clearFiles = useCallback(() => {
    if (disabled) return;
    onChange([]);
  }, [disabled, onChange]);

  const enqueueFiles = useCallback(
    (incoming: FileList | File[]) => {
      addFiles(incoming);
    },
    [addFiles],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      if (disabled) return;
      const pastedFiles = event.clipboardData?.files;
      if (pastedFiles && pastedFiles.length > 0) {
        event.preventDefault();
        enqueueFiles(pastedFiles);
      }
    },
    [disabled, enqueueFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      dragCounter.current = 0;
      setIsDragActive(false);
      const droppedFiles = event.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) {
        enqueueFiles(droppedFiles);
      }
    },
    [disabled, enqueueFiles],
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      dragCounter.current += 1;
      setIsDragActive(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragActive(false);
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (disabled) return;
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
  }, [disabled]);

  return {
    files,
    isDragActive,
    addFiles,
    enqueueFiles,
    removeFile,
    clearFiles,
    handlePaste,
    handleDrop,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
  };
}
