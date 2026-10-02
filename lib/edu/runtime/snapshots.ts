import type { NormalizedFile } from "@/lib/edu/fileProtocol";

export type FileSnapshot = {
  id: string;
  ts: number;
  codeHash: string;
  files: Record<string, NormalizedFile>;
};

type SnapshotBuffer = {
  push: (snapshot: FileSnapshot) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => FileSnapshot | null;
  redo: () => FileSnapshot | null;
  peek: () => FileSnapshot | null;
  size: () => number;
  clear: () => void;
};

export function createSnapshotBuffer(limit: number): SnapshotBuffer {
  const maxSnapshots = Math.max(0, Math.floor(limit));
  let past: FileSnapshot[] = [];
  let future: FileSnapshot[] = [];
  let current: FileSnapshot | null = null;

  const trimPast = () => {
    if (maxSnapshots <= 0) {
      past = [];
      current = null;
      future = [];
      return;
    }
    const maxPast = Math.max(0, maxSnapshots - (current ? 1 : 0));
    if (past.length > maxPast) {
      past = past.slice(past.length - maxPast);
    }
  };

  const push = (snapshot: FileSnapshot) => {
    if (maxSnapshots <= 0) return;
    if (current) {
      past.push(current);
    }
    current = snapshot;
    future = [];
    trimPast();
  };

  const canUndo = () => Boolean(current && past.length > 0);
  const canRedo = () => Boolean(current && future.length > 0);

  const undo = () => {
    if (!current || past.length === 0) return null;
    future.push(current);
    current = past.pop() ?? null;
    return current;
  };

  const redo = () => {
    if (!current || future.length === 0) return null;
    past.push(current);
    current = future.pop() ?? null;
    trimPast();
    return current;
  };

  const peek = () => current;

  const size = () => past.length + future.length + (current ? 1 : 0);

  const clear = () => {
    past = [];
    future = [];
    current = null;
  };

  return { push, canUndo, canRedo, undo, redo, peek, size, clear };
}
