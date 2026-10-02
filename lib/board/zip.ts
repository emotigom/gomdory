import type { BoardImportPayload } from "@/lib/board/importer";

export type BoardZipFileEntry = {
  fileId: string;
  filename: string;
  data: Uint8Array;
};

export type BoardZipExtract = {
  boardJson: string;
  board: BoardImportPayload;
  filesById: Map<string, BoardZipFileEntry>;
  totalUncompressedBytes: number;
  entryCount: number;
};

export type BoardZipLimits = {
  maxEntries: number;
  maxTotalBytes: number;
};

type ZipCentralEntry = {
  filename: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;

function normalizeZipPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    return null;
  }
  return normalized;
}

function parseZipFileEntry(name: string): { fileId: string; filename: string } | null {
  if (!name.startsWith("files/")) {
    return null;
  }
  const suffix = name.slice("files/".length);
  if (!suffix || suffix.includes("/")) {
    return null;
  }
  const [fileId, filename] = suffix.split("__");
  if (!fileId || !filename) {
    return null;
  }
  return { fileId, filename };
}

function findEndOfCentralDirectory(data: Uint8Array): number | null {
  const minOffset = Math.max(0, data.length - 0x10000 - 22);
  for (let i = data.length - 22; i >= minOffset; i -= 1) {
    if (
      data[i] === 0x50 &&
      data[i + 1] === 0x4b &&
      data[i + 2] === 0x05 &&
      data[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return null;
}

function readUInt16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUInt32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function decodeFilename(data: Uint8Array): string {
  try {
    return new TextDecoder().decode(data);
  } catch {
    return "";
  }
}

function parseCentralDirectory(data: Uint8Array): ZipCentralEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset === null) {
    throw new Error("ZIP 중앙 디렉터리를 찾을 수 없습니다.");
  }

  const totalEntries = readUInt16(view, eocdOffset + 10);
  const centralDirOffset = readUInt32(view, eocdOffset + 16);
  let offset = centralDirOffset;
  const entries: ZipCentralEntry[] = [];

  for (let i = 0; i < totalEntries; i += 1) {
    if (readUInt32(view, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("ZIP 중앙 디렉터리 형식이 올바르지 않습니다.");
    }

    const compressionMethod = readUInt16(view, offset + 10);
    const compressedSize = readUInt32(view, offset + 20);
    const uncompressedSize = readUInt32(view, offset + 24);
    const fileNameLength = readUInt16(view, offset + 28);
    const extraLength = readUInt16(view, offset + 30);
    const commentLength = readUInt16(view, offset + 32);
    const localHeaderOffset = readUInt32(view, offset + 42);

    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const filename = decodeFilename(data.slice(nameStart, nameEnd));

    entries.push({
      filename,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

async function inflateDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("ZIP 해제를 지원하지 않는 환경입니다.");
  }

  const input = new Uint8Array(data).buffer;
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function readFileData(
  data: Uint8Array,
  entry: ZipCentralEntry,
): Promise<Uint8Array> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headerOffset = entry.localHeaderOffset;

  if (readUInt32(view, headerOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error("ZIP 로컬 헤더가 올바르지 않습니다.");
  }

  const fileNameLength = readUInt16(view, headerOffset + 26);
  const extraLength = readUInt16(view, headerOffset + 28);
  const dataStart = headerOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = data.slice(dataStart, dataEnd);

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    return inflateDeflateRaw(compressed);
  }

  throw new Error("지원하지 않는 ZIP 압축 방식입니다.");
}

export async function extractBoardZip(
  buffer: ArrayBuffer,
  limits: BoardZipLimits,
): Promise<BoardZipExtract> {
  const data = new Uint8Array(buffer);
  const centralEntries = parseCentralDirectory(data);

  if (centralEntries.length > limits.maxEntries) {
    throw new Error("ZIP 파일 안의 항목이 너무 많습니다.");
  }

  let boardJson = "";
  let board: BoardImportPayload | null = null;
  let totalUncompressedBytes = 0;
  const filesById = new Map<string, BoardZipFileEntry>();

  for (const entry of centralEntries) {
    const normalized = normalizeZipPath(entry.filename);
    if (!normalized) {
      throw new Error("ZIP 내부 경로가 올바르지 않습니다.");
    }
    if (normalized.endsWith("/")) {
      continue;
    }

    const fileData = await readFileData(data, entry);
    totalUncompressedBytes += fileData.length;
    if (totalUncompressedBytes > limits.maxTotalBytes) {
      throw new Error("ZIP 파일의 압축 해제 용량이 제한을 초과했습니다.");
    }

    if (normalized === "board.json") {
      boardJson = decodeFilename(fileData);
      try {
        board = JSON.parse(boardJson) as BoardImportPayload;
      } catch {
        throw new Error("board.json이 올바른 JSON이 아닙니다.");
      }
      continue;
    }

    const fileEntry = parseZipFileEntry(normalized);
    if (fileEntry) {
      filesById.set(fileEntry.fileId, {
        fileId: fileEntry.fileId,
        filename: fileEntry.filename,
        data: fileData,
      });
    }
  }

  if (!boardJson || !board) {
    throw new Error("zip에 board.json이 없습니다.");
  }

  return {
    boardJson,
    board,
    filesById,
    totalUncompressedBytes,
    entryCount: centralEntries.length,
  };
}
