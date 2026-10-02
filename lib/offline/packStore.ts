"use client";

export type OfflineBoardPack = {
  boardId: string;
  title: string;
  savedAt: string;
  sizeBytes: number;
  blob: Blob;
};

const DB_NAME = "gom-offline";
const STORE_NAME = "boards";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open DB"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    runner(store)
      .then((result) => {
        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("IDB transaction failed"));
        };
      })
      .catch((error) => {
        db.close();
        reject(error);
      });
  });
}

export async function saveOfflineBoardPack(input: {
  boardId: string;
  title: string;
  blob: Blob;
}): Promise<OfflineBoardPack> {
  const pack: OfflineBoardPack = {
    boardId: input.boardId,
    title: input.title,
    savedAt: new Date().toISOString(),
    sizeBytes: input.blob.size,
    blob: input.blob,
  };

  await withStore("readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.put(pack, input.boardId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  });

  return pack;
}

export async function getOfflineBoardPack(boardId: string) {
  return withStore("readonly", (store) => {
    return new Promise<OfflineBoardPack | undefined>((resolve, reject) => {
      const request = store.get(boardId);
      request.onsuccess = () => resolve(request.result as OfflineBoardPack | undefined);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function listOfflineBoardPacks(): Promise<OfflineBoardPack[]> {
  return withStore("readonly", (store) => {
    return new Promise<OfflineBoardPack[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const result = (request.result as OfflineBoardPack[]) ?? [];
        resolve(result.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function deleteOfflineBoardPack(boardId: string) {
  return withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(boardId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}
