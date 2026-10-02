import {
  createEmptyMetaverseProgressSnapshot,
  createMetaverseProgressSnapshotFromMissionResult,
  parseMetaverseProgressWriteRequest,
  parseMetaverseProgressWriteResult,
  parseMetaverseResolvedProgressSnapshot,
  type MetaverseProgressPersistencePort,
  type MetaverseProgressSource,
} from "@/lib/world-hub/progress/contracts";
import type { WorldHubMissionResultReturnPayload } from "@/lib/world-hub/mission/resultHandoff";

const DEFAULT_PROGRESS_ENDPOINT = "/world-hub/api/progress";
const DEFAULT_STORAGE_KEY = "world-hub.progress.snapshot.v1";

type BrowserProgressPersistenceOptions = {
  endpoint?: string;
  enabled?: boolean;
  fetcher?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  storageKey?: string;
};

function resolveStorage(storage: BrowserProgressPersistenceOptions["storage"]) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredSnapshot(storage: Pick<Storage, "getItem" | "setItem"> | null, storageKey: string) {
  if (!storage) {
    return null;
  }

  try {
    const text = storage.getItem(storageKey);
    if (!text) {
      return null;
    }

    return parseMetaverseResolvedProgressSnapshot(JSON.parse(text));
  } catch {
    return null;
  }
}

function writeStoredSnapshot(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  storageKey: string,
  snapshot: ReturnType<typeof parseMetaverseResolvedProgressSnapshot>,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Ignore local storage write failures and keep runtime fallback deterministic.
  }
}

function createLocalFallbackSnapshot(args: {
  payload?: WorldHubMissionResultReturnPayload;
  storageKey: string;
  endpoint: string;
  fallbackReason: MetaverseProgressSource["fallbackReason"];
  detail: string;
  readStatus: MetaverseProgressSource["diagnostics"]["readStatus"];
  writeStatus: MetaverseProgressSource["diagnostics"]["writeStatus"];
}) {
  const source: MetaverseProgressSource = {
    kind: args.payload ? "local-storage-fallback" : "empty-local",
    label: args.payload ? "Local preview progress fallback" : "Local progress fallback",
    detail: args.detail,
    fallbackReason: args.fallbackReason,
    diagnostics: {
      mode: "local-fallback",
      storageKey: args.storageKey,
      endpoint: args.endpoint,
      userScoped: false,
      readStatus: args.readStatus,
      writeStatus: args.writeStatus,
      syncedAtIso: args.payload?.completedAtIso ?? null,
    },
  };

  if (!args.payload) {
    return createEmptyMetaverseProgressSnapshot({ source });
  }

  return createMetaverseProgressSnapshotFromMissionResult({
    payload: args.payload,
    persistenceStatus: "fallback-persisted",
    source,
  });
}

async function readRemoteSnapshot(args: {
  endpoint: string;
  fetcher: typeof fetch;
}) {
  const response = await args.fetcher(args.endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Progress read failed (${response.status}).`);
  }

  return parseMetaverseResolvedProgressSnapshot(await response.json());
}

async function writeRemoteSnapshot(args: {
  endpoint: string;
  fetcher: typeof fetch;
  payload: WorldHubMissionResultReturnPayload;
}) {
  const request = parseMetaverseProgressWriteRequest({ payload: args.payload });
  const response = await args.fetcher(args.endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Progress write failed (${response.status}).`);
  }

  return parseMetaverseProgressWriteResult(await response.json());
}

export function createBrowserMetaverseProgressPersistence(
  options: BrowserProgressPersistenceOptions = {},
): MetaverseProgressPersistencePort {
  const endpoint = options.endpoint ?? DEFAULT_PROGRESS_ENDPOINT;
  const fetcher = options.fetcher ?? fetch;
  const enabled = options.enabled ?? true;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  return {
    async readSnapshot() {
      const storage = resolveStorage(options.storage);
      const localSnapshot = readStoredSnapshot(storage, storageKey);

      if (!enabled) {
        return (
          localSnapshot ??
          createLocalFallbackSnapshot({
            storageKey,
            endpoint,
            fallbackReason: "route-unavailable",
            detail: "Metaverse progress route is disabled, so the runtime stayed on deterministic local fallback.",
            readStatus: "fallback",
            writeStatus: "not-requested",
          })
        );
      }

      try {
        const snapshot = await readRemoteSnapshot({ endpoint, fetcher });
        writeStoredSnapshot(storage, storageKey, snapshot);
        return snapshot;
      } catch {
        if (localSnapshot) {
          return parseMetaverseResolvedProgressSnapshot({
            ...localSnapshot,
            source: {
              kind: "local-storage-fallback",
              label: "Local preview progress fallback",
              detail: "Stored local metaverse progress was reused because the Supabase route was unavailable.",
              fallbackReason: "read-failed",
              diagnostics: {
                mode: "local-fallback",
                storageKey,
                endpoint,
                userScoped: false,
                readStatus: "fallback",
                writeStatus: localSnapshot.source.diagnostics.writeStatus,
                syncedAtIso:
                  localSnapshot.source.diagnostics.syncedAtIso ??
                  localSnapshot.lastCompletedMission?.completedAtIso ??
                  null,
              },
            },
          });
        }

        return createLocalFallbackSnapshot({
          storageKey,
          endpoint,
          fallbackReason: "read-failed",
          detail: "Metaverse progress read failed, so the runtime fell back to an empty local snapshot.",
          readStatus: "fallback",
          writeStatus: "not-requested",
        });
      }
    },

    async persistCompletion(args) {
      const storage = resolveStorage(options.storage);

      if (!enabled) {
        const snapshot = createLocalFallbackSnapshot({
          payload: args.payload,
          storageKey,
          endpoint,
          fallbackReason: "route-unavailable",
          detail: "Metaverse progress writes stayed local because the Supabase route is disabled.",
          readStatus: "not-requested",
          writeStatus: "fallback",
        });
        writeStoredSnapshot(storage, storageKey, snapshot);
        return parseMetaverseProgressWriteResult({
          status: "fallback-persisted",
          snapshot,
        });
      }

      try {
        const writeResult = await writeRemoteSnapshot({
          endpoint,
          fetcher,
          payload: args.payload,
        });
        writeStoredSnapshot(storage, storageKey, writeResult.snapshot);
        return writeResult;
      } catch {
        const snapshot = createLocalFallbackSnapshot({
          payload: args.payload,
          storageKey,
          endpoint,
          fallbackReason: storage ? "write-failed" : "storage-unavailable",
          detail: storage
            ? "Supabase progress persistence failed, so the completion was stored in deterministic local fallback state."
            : "Supabase progress persistence failed and local storage is unavailable, so only an in-memory fallback acknowledgement remains.",
          readStatus: "not-requested",
          writeStatus: storage ? "fallback" : "failed",
        });

        writeStoredSnapshot(storage, storageKey, snapshot);
        return parseMetaverseProgressWriteResult({
          status: storage ? "fallback-persisted" : "unavailable",
          snapshot,
        });
      }
    },
  };
}
