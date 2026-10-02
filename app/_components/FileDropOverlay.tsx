"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WallOption = {
  id: string;
  title: string;
};

type FileDropOverlayProps = {
  walls?: WallOption[];
  onDropFiles: (files: File[], wallId: string | null) => void;
  onTargetWallChange?: (wallId: string | null) => void;
  blocked?: boolean;
  blockedMessage?: string;
  onBlockedDrop?: () => void;
  enabled?: boolean;
};

const defaultWalls: WallOption[] = [];

const hasFileTransfer = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) return false;
  if (dataTransfer.files && dataTransfer.files.length > 0) return true;
  return Array.from(dataTransfer.types).includes("Files");
};

const getWallIdFromElement = (element: Element | null) => {
  let current: Element | null = element;
  while (current) {
    if (current instanceof HTMLElement && current.dataset.wallId) {
      return current.dataset.wallId;
    }
    current = current.parentElement;
  }
  return null;
};

export default function FileDropOverlay({
  walls = defaultWalls,
  onDropFiles,
  onTargetWallChange,
  blocked = false,
  blockedMessage,
  onBlockedDrop,
  enabled = true,
}: FileDropOverlayProps) {
  const [isActive, setIsActive] = useState(false);
  const [targetWallId, setTargetWallId] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const blockedDropRef = useRef(onBlockedDrop);

  useEffect(() => {
    blockedDropRef.current = onBlockedDrop;
  }, [onBlockedDrop]);

  const wallTitles = useMemo(
    () => new Map(walls.map((wall) => [wall.id, wall.title])),
    [walls],
  );

  const updateTarget = useCallback(
    (wallId: string | null) => {
      setTargetWallId(wallId);
      onTargetWallChange?.(wallId);
    },
    [onTargetWallChange],
  );

  const updateTargetFromPoint = useCallback(
    (x: number, y: number) => {
      if (typeof document === "undefined") return;
      const element = document.elementFromPoint(x, y);
      updateTarget(getWallIdFromElement(element));
    },
    [updateTarget],
  );

  useEffect(() => {
    if (!enabled) return;
    const handleDragEnter = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      dragCounter.current += 1;
      setIsActive(true);
      updateTargetFromPoint(event.clientX, event.clientY);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsActive(false);
        updateTarget(null);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      setIsActive(true);
      updateTargetFromPoint(event.clientX, event.clientY);
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      dragCounter.current = 0;
      setIsActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      const wallId = getWallIdFromElement(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      updateTarget(null);
      if (!files.length) return;
      if (blocked) {
        blockedDropRef.current?.();
        return;
      }
      onDropFiles(files, wallId);
    };

    const handleDragEnd = () => {
      dragCounter.current = 0;
      setIsActive(false);
      updateTarget(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dragCounter.current = 0;
      setIsActive(false);
      updateTarget(null);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", handleDragEnd);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [blocked, enabled, onDropFiles, updateTarget, updateTargetFromPoint]);

  if (!isActive) return null;

  const targetTitle = targetWallId ? wallTitles.get(targetWallId) : null;
  const subtitle = blocked
    ? blockedMessage ?? "지금은 글쓰기가 잠겨있어요."
    : targetTitle
      ? `이 담벼락에 추가: ${targetTitle}`
      : "담벼락 위로 이동하면 안내가 표시됩니다.";

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="rounded-2xl border border-white/30 bg-white/20 px-8 py-6 text-center text-white shadow-xl backdrop-blur">
        <p className="text-lg font-semibold">파일을 놓아 업로드</p>
        <p className="mt-2 text-sm text-white/80">{subtitle}</p>
      </div>
    </div>
  );
}
