type ChunkMeta = {
  url: string;
  chunkSize: number;
  totalSize: number;
  contentType?: string | null;
  complete: boolean;
};

type ChunkEntry = {
  key: string;
  url: string;
  index: number;
  data: ArrayBuffer;
};

const DB_NAME = "edu-p2p";
const DB_VERSION = 1;
const CHUNK_STORE = "chunks";
const META_STORE = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: "key" });
        store.createIndex("by_url", "url", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "url" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

function chunkKey(url: string, index: number) {
  return `${url}::${index}`;
}

export async function getChunkMeta(url: string): Promise<ChunkMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const request = store.get(url);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB meta error"));
  });
}

export async function setChunkMeta(meta: ChunkMeta): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    const request = store.put(meta);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB meta error"));
  });
}

export async function markComplete(url: string): Promise<void> {
  const meta = await getChunkMeta(url);
  if (!meta) return;
  await setChunkMeta({ ...meta, complete: true });
}

export async function getChunk(url: string, index: number): Promise<ArrayBuffer | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, "readonly");
    const store = tx.objectStore(CHUNK_STORE);
    const request = store.get(chunkKey(url, index));
    request.onsuccess = () => resolve((request.result as ChunkEntry | undefined)?.data ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB chunk error"));
  });
}

export async function putChunk(url: string, index: number, data: ArrayBuffer) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, "readwrite");
    const store = tx.objectStore(CHUNK_STORE);
    const entry: ChunkEntry = { key: chunkKey(url, index), url, index, data };
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB chunk error"));
  });
}

export async function assembleResponse(url: string, meta: ChunkMeta): Promise<Response | null> {
  if (!meta.complete) return null;
  const totalChunks = Math.ceil(meta.totalSize / meta.chunkSize);
  const chunks: ArrayBuffer[] = [];
  for (let i = 0; i < totalChunks; i += 1) {
    const chunk = await getChunk(url, i);
    if (!chunk) return null;
    chunks.push(chunk);
  }
  const blob = new Blob(chunks, {
    type: meta.contentType ?? "application/octet-stream",
  });
  return new Response(blob, {
    headers: {
      "content-type": meta.contentType ?? "application/octet-stream",
    },
  });
}
