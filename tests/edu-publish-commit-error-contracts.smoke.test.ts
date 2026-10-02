import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { createDeclaredPublishManifestEvidence } from "@/lib/edu/publish/declaredManifestEvidence";
import {
  signEduPublishCommitCapability,
  verifyEduPublishCommitCapability,
} from "@/lib/edu/publish/commitCapability";
import type { PublishPrepareManifestEvidenceCompatibility } from "@/lib/edu/publish/prepareManifestEvidence";
import { loadEduPublishCapabilityKeyRing } from "@/lib/server/edu/publish/commitCapabilityRuntime";
import { handleEduPublishCommit } from "@/lib/server/edu/publish/handleEduPublishCommit";
import {
  handlePublishPrepareRoute,
  type PrepareBody,
} from "@/lib/server/edu/publish/handlePublishPrepareRoute";

type Scenario = {
  publishCount: number;
  existingProjectState: string | null;
  missingFile: boolean;
  dbFunctionBug: boolean;
  dbWriteFailure: boolean;
  galleryWriteFailure: boolean;
  projectInsertConflictState: string | null;
  concurrentProjectLookupError: string | null;
  prefixSample: string[];
};

const scenario: Scenario = {
  publishCount: 0,
  existingProjectState: null,
  missingFile: false,
  dbFunctionBug: false,
  dbWriteFailure: false,
  galleryWriteFailure: false,
  prefixSample: ["bundle/index.html", "bundle/style.css"],
};

let lastProjectInsertPayload: Record<string, unknown> | null = null;
let lastAtomicPublishPayload: Record<string, unknown> | null = null;
let lastListedPrefix: string | undefined;
let projectLookupCalls = 0;
let quotaCountCalls = 0;
let atomicPublishCalls = 0;
let listObjectCalls = 0;
let headObjectCalls = 0;
let galleryUpsertCalls = 0;
let projectUpdateCalls = 0;
let recordedOpsEvents: Array<Record<string, unknown>> = [];
let recordedOpsEventOptions: unknown[] = [];
let recordedPrepareEvents: Array<{ event: Record<string, unknown>; options: unknown }> = [];
let preparePresignCalls = 0;
let preparePresignKeys: string[] = [];
let prepareSlugLookupCalls = 0;
let prepareAttemptModeLoaderCalls = 0;
let securedPrepareCoordinatorCalls = 0;
let prepareAttemptIdCalls = 0;
let prepareCapabilityKeyLoaderCalls = 0;
let prepareCapabilitySignerCalls = 0;
let prepareCapabilityClockCalls = 0;
let capabilityKeyLoaderCalls = 0;
let capabilityClockCalls = 0;
let capabilityVerifierCalls = 0;
let capabilityPolicyLoaderCalls = 0;
let commitAttemptModeLoaderCalls = 0;

const resetScenario = () => {
  scenario.publishCount = 0;
  scenario.existingProjectState = null;
  scenario.missingFile = false;
  scenario.dbFunctionBug = false;
  scenario.dbWriteFailure = false;
  scenario.galleryWriteFailure = false;
  scenario.projectInsertConflictState = null;
  scenario.concurrentProjectLookupError = null;
  scenario.prefixSample = ["bundle/index.html", "bundle/style.css"];
  lastProjectInsertPayload = null;
  lastAtomicPublishPayload = null;
  lastListedPrefix = undefined;
  projectLookupCalls = 0;
  quotaCountCalls = 0;
  atomicPublishCalls = 0;
  listObjectCalls = 0;
  headObjectCalls = 0;
  galleryUpsertCalls = 0;
  projectUpdateCalls = 0;
  recordedOpsEvents = [];
  recordedOpsEventOptions = [];
  recordedPrepareEvents = [];
  preparePresignCalls = 0;
  preparePresignKeys = [];
  prepareSlugLookupCalls = 0;
  prepareAttemptModeLoaderCalls = 0;
  securedPrepareCoordinatorCalls = 0;
  prepareAttemptIdCalls = 0;
  prepareCapabilityKeyLoaderCalls = 0;
  prepareCapabilitySignerCalls = 0;
  prepareCapabilityClockCalls = 0;
  capabilityKeyLoaderCalls = 0;
  capabilityClockCalls = 0;
  capabilityVerifierCalls = 0;
  capabilityPolicyLoaderCalls = 0;
  commitAttemptModeLoaderCalls = 0;
};

const testR2EnvDefaults = {
  R2_ACCOUNT_ID: "test-account",
  R2_BUCKET: "test-bucket",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
} as const;
const installedTestR2EnvKeys: string[] = [];

test.before(() => {
  for (const [key, value] of Object.entries(testR2EnvDefaults)) {
    if (!process.env[key]) {
      process.env[key] = value;
      installedTestR2EnvKeys.push(key);
    }
  }
});

test.after(() => {
  for (const key of installedTestR2EnvKeys) {
    delete process.env[key];
  }
});

type PrepareDependencies = NonNullable<Parameters<typeof handlePublishPrepareRoute>[0]["dependencies"]>;
type PrepareClassifier = NonNullable<PrepareDependencies["classifyPublishPrepareManifestEvidenceFn"]>;
type PrepareRecorder = NonNullable<PrepareDependencies["recordOpsEventFn"]>;
type PreparePresigner = NonNullable<PrepareDependencies["presignPutUrlFn"]>;
type PrepareAttemptModeLoader = NonNullable<PrepareDependencies["loadPrepareAttemptModeFn"]>;
type SecuredPrepareCoordinator = NonNullable<PrepareDependencies["coordinateSecuredPrepareFn"]>;
type PrepareCapabilityLoader = NonNullable<PrepareDependencies["loadPublishCapabilityKeyRingFn"]>;
type PrepareCapabilitySigner = NonNullable<PrepareDependencies["signPublishCapabilityFn"]>;
type CommitDependencies = NonNullable<Parameters<typeof handleEduPublishCommit>[1]>;
type CommitClassifier = NonNullable<CommitDependencies["classifyPublishManifestEvidenceFn"]>;
type CommitAttemptClassifier = NonNullable<CommitDependencies["classifyPublishAttemptCompatibilityFn"]>;
type CommitCapabilityLoader = NonNullable<CommitDependencies["loadPublishCapabilityKeyRingFn"]>;
type CommitCapabilityPolicyLoader = NonNullable<CommitDependencies["loadPublishCapabilityPolicyModeFn"]>;
type CommitCapabilityVerifier = NonNullable<CommitDependencies["verifyPublishCapabilityFn"]>;
type CommitAttemptModeLoader = NonNullable<CommitDependencies["loadCommitAttemptModeFn"]>;

const makePreparePayload = (overrides: Partial<PrepareBody> = {}): PrepareBody => ({
  shareCode: "abc123",
  authorName: "학생",
  title: "테스트",
  lessonId: 1,
  files: [{ path: "index.html", contentType: "text/html", sizeBytes: 120 }],
  ...overrides,
});

const makePrepareRequest = (payload: PrepareBody) =>
  new NextRequest(
    new Request("http://localhost/api/v1/edu/publish/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );

const makePrepareDependencies = (overrides: {
  classifyPublishPrepareManifestEvidenceFn?: PrepareClassifier;
  loadPrepareAttemptModeFn?: PrepareAttemptModeLoader;
  coordinateSecuredPrepareFn?: SecuredPrepareCoordinator;
  recordOpsEventFn?: PrepareRecorder;
  presignPutUrlFn?: PreparePresigner;
  createPublishAttemptIdFn?: () => string;
  loadPublishCapabilityKeyRingFn?: PrepareCapabilityLoader;
  signPublishCapabilityFn?: PrepareCapabilitySigner;
  nowSecondsFn?: () => number;
} = {}): PrepareDependencies => ({
  findAvailableSlugFn: async () => {
    prepareSlugLookupCalls += 1;
    return "abc123-123456-p1";
  },
  checkRateLimitFn: async () => ({ ok: true as const }),
  createSupabaseAdminClientFn: () => ({}) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
  classifyPublishPrepareManifestEvidenceFn: overrides.classifyPublishPrepareManifestEvidenceFn,
  loadPrepareAttemptModeFn: overrides.loadPrepareAttemptModeFn ?? (() => {
    prepareAttemptModeLoaderCalls += 1;
    return { mode: "legacy" as const, source: "configured" as const };
  }),
  coordinateSecuredPrepareFn: overrides.coordinateSecuredPrepareFn ?? (async () => {
    securedPrepareCoordinatorCalls += 1;
    throw new Error("secured coordinator must not run in legacy tests");
  }),
  createPublishAttemptIdFn: overrides.createPublishAttemptIdFn ?? (() => {
    prepareAttemptIdCalls += 1;
    return "018f47a2-4b7c-7d9e-8f01-23456789abcd";
  }),
  loadPublishCapabilityKeyRingFn: overrides.loadPublishCapabilityKeyRingFn ?? (() => {
    prepareCapabilityKeyLoaderCalls += 1;
    return loadEduPublishCapabilityKeyRing({
      EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: "current-test-kid",
      EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
    });
  }),
  signPublishCapabilityFn: overrides.signPublishCapabilityFn ?? (async (...args) => {
    prepareCapabilitySignerCalls += 1;
    return signEduPublishCommitCapability(...args);
  }),
  nowSecondsFn: overrides.nowSecondsFn ?? (() => {
    prepareCapabilityClockCalls += 1;
    return 1_760_000_000;
  }),
  recordOpsEventFn: overrides.recordOpsEventFn ?? (async (event, options) => {
    recordedPrepareEvents.push({ event: event as unknown as Record<string, unknown>, options });
    return { sampled: true, recorded: true };
  }),
  presignPutUrlFn: overrides.presignPutUrlFn ?? (async ({ key }) => {
    preparePresignCalls += 1;
    preparePresignKeys.push(key);
    return "https://presigned.invalid";
  }),
});

async function makeDeclaredPreparePayload() {
  const evidence = await createDeclaredPublishManifestEvidence([
    { path: "index.html", contentType: "text/html", bytes: new TextEncoder().encode("<h1>ok</h1>") },
    { path: "assets/style.css", contentType: "text/css", bytes: new TextEncoder().encode("body { color: red; }") },
  ]);

  return makePreparePayload({
    files: evidence.manifest.files.map(({ path, sizeBytes, contentType }) => ({ path, sizeBytes, contentType })),
    manifestSchemaVersion: evidence.manifest.schemaVersion,
    declaredManifestDigest: evidence.declaredManifestDigest,
    declaredManifest: evidence.manifest,
  });
}

type SecuredPrepareSuccess = Extract<
  Awaited<ReturnType<SecuredPrepareCoordinator>>,
  { mode: "prepared" }
>;

const makeSecuredModeLoader = (): ReturnType<PrepareAttemptModeLoader> => {
  prepareAttemptModeLoaderCalls += 1;
  return { mode: "secured_v1", source: "configured" };
};

function makeSecuredSuccess(payload: PrepareBody, overrides: Partial<SecuredPrepareSuccess> = {}): SecuredPrepareSuccess {
  return {
    mode: "prepared",
    rpcOutcome: "CREATED",
    slug: "abc123-123456-p1",
    publishAttemptId: "00000000-0000-4000-8000-000000000001",
    publishCapability: "public-capability-token",
    manifestSchemaVersion: 1,
    declaredManifestDigest: payload.declaredManifestDigest as string,
    attemptVersion: 0,
    expiresAt: "2026-12-24T01:45:00.000Z",
    ...overrides,
  };
}

function assertPrepareAttemptFieldsAllOrNone(payload: Record<string, unknown>) {
  const presentCount = ["publishAttemptId", "declaredManifestDigest", "manifestSchemaVersion"].filter((field) =>
    Object.hasOwn(payload, field),
  ).length;
  assert.ok(presentCount === 0 || presentCount === 3);
  if (Object.hasOwn(payload, "publishCapability")) {
    assert.equal(presentCount, 3);
    assert.equal(typeof payload.publishCapability, "string");
  }
}

const makeRequest = (overrides: Record<string, unknown> = {}) =>
  new NextRequest(
    new Request("http://localhost/api/v1/edu/publish/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shareCode: "abc123",
        authorName: "학생",
        title: "테스트",
        lessonId: 1,
        turnstileToken: "token",
        request_id: "rid-contract",
        files: [{ path: "index.html", contentType: "text/html", sizeBytes: 120 }],
        ...overrides,
      }),
    }),
  );

const deps = {
  createSupabaseServerClientFn: () =>
    ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    }) as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>,
  createSupabaseAdminClientFn: () =>
    ({
      rpc: async (name: string, payload?: Record<string, unknown>) => {
        if (name === "edu_check_publish_ready") {
          return { data: { ok: true }, error: null };
        }
        if (name === "edu_atomic_publish_v2") {
          atomicPublishCalls += 1;
          lastAtomicPublishPayload = payload ?? null;
          if (scenario.dbFunctionBug) {
            return {
              data: null,
              error: {
                message: 'column reference "in_slug" is ambiguous',
                code: "42702",
              },
            };
          }
          if (scenario.dbWriteFailure) {
            return {
              data: null,
              error: {
                message: "private-database-secret-sentinel",
                code: "XX000",
              },
            };
          }
          return { data: "project-1", error: null };
        }
        throw new Error(`Unexpected rpc: ${name}`);
      },
      from: (table: string) => {
        if (table === "edu_projects") {
          return {
            select: (_columns: string, options?: { count?: string; head?: boolean }) => {
              if (options?.head) {
                quotaCountCalls += 1;
                return {
                  eq: () => ({
                    eq: () => ({
                      gte: () => ({
                        lte: async () => ({ count: scenario.publishCount, error: null }),
                      }),
                    }),
                  }),
                };
              }

              return {
                eq: () => ({
                  maybeSingle: async () => {
                    projectLookupCalls += 1;
                    if (scenario.concurrentProjectLookupError && projectLookupCalls === 3) {
                      return {
                        data: null,
                        error: { message: scenario.concurrentProjectLookupError, code: "XX000" },
                      };
                    }
                    const state =
                      scenario.projectInsertConflictState && projectLookupCalls === 3
                        ? scenario.projectInsertConflictState
                        : scenario.existingProjectState;
                    return {
                      data: state ? { id: "project-1", publish_state: state } : null,
                      error: null,
                    };
                  },
                }),
              };
            },
            insert: (payload: Record<string, unknown>) => ({
              select: () => ({
                single: async () => {
                  lastProjectInsertPayload = payload;
                  if (scenario.projectInsertConflictState) {
                    return {
                      data: null,
                      error: { message: "duplicate key value violates unique constraint edu_projects_slug_key" },
                    };
                  }
                  return { data: { id: "project-1" }, error: null };
                },
              }),
            }),
            update: () => ({
              eq: async () => {
                projectUpdateCalls += 1;
                return { error: null };
              },
            }),
          };
        }

        if (table === "publish_events") {
          return {
            insert: async () => ({ error: null }),
          };
        }

        if (table === "edu_join_codes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { board_id: null }, error: null }),
              }),
            }),
          };
        }

        if (table === "edu_gallery") {
          return {
            upsert: async () => {
              galleryUpsertCalls += 1;
              if (scenario.galleryWriteFailure) {
                return { error: { message: "gallery-write-failed" } };
              }
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
  verifyTurnstileTokenWithTelemetryFn: async () => ({ ok: true }),
  checkRateLimitFn: async () => ({ ok: true as const }),
  getRateLimitSubjectFn: async () => "smoke-subject",
  getRequestOriginFn: async () => "http://localhost",
  recordOpsEventFn: async (event: Record<string, unknown>, options: unknown) => {
    recordedOpsEvents.push(event);
    recordedOpsEventOptions.push(options);
    return { sampled: true, recorded: true };
  },
  loadPublishCapabilityPolicyModeFn: () => {
    capabilityPolicyLoaderCalls += 1;
    return { mode: "observe" as const, source: "default" as const };
  },
  loadCommitAttemptModeFn: () => {
    commitAttemptModeLoaderCalls += 1;
    return { mode: "legacy" as const, source: "configured" as const };
  },
  getR2TargetMetaFn: () => ({
    bucketName: "edu-bucket-test",
    endpoint: "https://r2.example.test",
    accountId: "acc-123",
    r2TargetKind: "rest" as const,
  }),
  listObjectKeysV2Fn: async ({ prefix }: { prefix?: string }) => {
    listObjectCalls += 1;
    lastListedPrefix = prefix;
    return {
      keys: scenario.prefixSample.map((key) => `${prefix ?? ""}${key}`),
      isTruncated: false,
    };
  },
  headObjectFn: async () => {
    headObjectCalls += 1;
    if (scenario.missingFile) {
      return { exists: false, contentLength: undefined };
    }
    return { exists: true, contentLength: 120 };
  },
};

async function makeDeclaredCommitPayload() {
  const evidence = await createDeclaredPublishManifestEvidence([
    { path: "index.html", contentType: "text/html", bytes: new Uint8Array(120) },
  ]);

  return {
    files: evidence.manifest.files.map(({ path, sizeBytes, contentType }) => ({ path, sizeBytes, contentType })),
    manifestSchemaVersion: evidence.manifest.schemaVersion,
    declaredManifestDigest: evidence.declaredManifestDigest,
    declaredManifest: evidence.manifest,
  };
}

const CAPABILITY_ATTEMPT_ID = "018f47a2-4b7c-7d9e-8f01-23456789abcd";
const CAPABILITY_SLUG = "abc123-123456-p1";
const CAPABILITY_NOW_SECONDS = 1_760_000_000;

function makeTestCapabilityKeyRing() {
  const result = loadEduPublishCapabilityKeyRing({
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: "current-test-kid",
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
  });
  if (result.mode !== "available") throw new Error("test key ring unavailable");
  return result.keyRing;
}

async function makeCapabilityCommitPayload(overrides: Record<string, unknown> = {}) {
  const declaredPayload = await makeDeclaredCommitPayload();
  const signed = await signEduPublishCommitCapability({
    keyRing: makeTestCapabilityKeyRing(),
    nowSeconds: CAPABILITY_NOW_SECONDS,
    publishAttemptId: CAPABILITY_ATTEMPT_ID,
    slug: CAPABILITY_SLUG,
    declaredManifestDigest: declaredPayload.declaredManifestDigest as string,
    manifestSchemaVersion: 1,
  });
  if (!signed.ok) throw new Error("test capability signing failed");
  return {
    ...declaredPayload,
    slug: CAPABILITY_SLUG,
    publishAttemptId: CAPABILITY_ATTEMPT_ID,
    publishCapability: signed.token,
    ...overrides,
  };
}

function makeCapabilityDependencies(overrides: {
  loadPublishCapabilityKeyRingFn?: CommitCapabilityLoader;
  loadPublishCapabilityPolicyModeFn?: CommitCapabilityPolicyLoader;
  verifyPublishCapabilityFn?: CommitCapabilityVerifier;
  loadCommitAttemptModeFn?: CommitAttemptModeLoader;
  recordOpsEventFn?: NonNullable<CommitDependencies["recordOpsEventFn"]>;
  nowSecondsFn?: () => number;
} = {}) {
  return {
    ...deps,
    loadPublishCapabilityKeyRingFn: overrides.loadPublishCapabilityKeyRingFn ?? (() => {
      capabilityKeyLoaderCalls += 1;
      return { mode: "available" as const, keyRing: makeTestCapabilityKeyRing() };
    }),
    loadPublishCapabilityPolicyModeFn: overrides.loadPublishCapabilityPolicyModeFn ?? deps.loadPublishCapabilityPolicyModeFn,
    loadCommitAttemptModeFn: overrides.loadCommitAttemptModeFn ?? deps.loadCommitAttemptModeFn,
    recordOpsEventFn: overrides.recordOpsEventFn ?? deps.recordOpsEventFn,
    verifyPublishCapabilityFn: overrides.verifyPublishCapabilityFn ?? (async (...args) => {
      capabilityVerifierCalls += 1;
      return verifyEduPublishCommitCapability(...args);
    }),
    nowSecondsFn: overrides.nowSecondsFn ?? (() => {
      capabilityClockCalls += 1;
      return CAPABILITY_NOW_SECONDS;
    }),
  };
}

function makeCommitAttemptModeLoader(mode: "legacy" | "secured_v1"): CommitAttemptModeLoader {
  return () => {
    commitAttemptModeLoaderCalls += 1;
    return { mode, source: "configured" as const };
  };
}

function findCommitObservation(component: string) {
  return recordedOpsEvents.find(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === component,
  );
}

function makeCapabilityPolicyLoader(mode: "observe" | "enforce_present"): CommitCapabilityPolicyLoader {
  return () => {
    capabilityPolicyLoaderCalls += 1;
    return { mode, source: "configured" as const };
  };
}

type CommitCapabilityVerificationResult = Awaited<ReturnType<CommitCapabilityVerifier>>;

function makeFixedCapabilityVerifier(
  mode: Exclude<CommitCapabilityVerificationResult["mode"], "valid_v2">,
): CommitCapabilityVerifier {
  return async () => {
    capabilityVerifierCalls += 1;
    return { mode } as CommitCapabilityVerificationResult;
  };
}

test.afterEach(() => {
  resetScenario();
});

test("edu publish capability runtime adapter maps the key-ring contract without exposing secrets", () => {
  const currentKey = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
  const previousKey = "Hx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA";
  const currentKid = "private-kid-sentinel";
  const previousKid = "private-previous-kid-sentinel";
  const validSource = {
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: currentKid,
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: currentKey,
  };
  const validRotationSource = {
    ...validSource,
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_PREVIOUS: previousKid,
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_PREVIOUS: previousKey,
  };

  assert.deepEqual(loadEduPublishCapabilityKeyRing({}), { mode: "configuration_unavailable" });
  const current = loadEduPublishCapabilityKeyRing(validSource);
  assert.equal(current.mode, "available");
  if (current.mode === "available") {
    assert.equal(current.keyRing.current.kid, currentKid);
    assert.deepEqual([...current.keyRing.current.keyBytes], [...new Uint8Array(32).map((_, index) => index)]);
  }
  const rotation = loadEduPublishCapabilityKeyRing(validRotationSource);
  assert.equal(rotation.mode, "available");
  assert.deepEqual(loadEduPublishCapabilityKeyRing({
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: currentKid,
  }), { mode: "configuration_unavailable" });
  assert.deepEqual(loadEduPublishCapabilityKeyRing({
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: currentKid,
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: "not-base64url",
  }), { mode: "configuration_unavailable" });
  assert.deepEqual(loadEduPublishCapabilityKeyRing({
    ...validSource,
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_PREVIOUS: previousKid,
  }), { mode: "configuration_unavailable" });
  assert.deepEqual(loadEduPublishCapabilityKeyRing({
    ...validSource,
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_PREVIOUS: currentKid,
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_PREVIOUS: previousKey,
  }), { mode: "configuration_unavailable" });

  const serializedFailure = JSON.stringify(loadEduPublishCapabilityKeyRing({
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: currentKid,
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: "private-current-capability-secret",
  }));
  assert.doesNotMatch(serializedFailure, /private-current-capability-secret|private-previous-capability-secret|private-kid-sentinel/);
  assert.deepEqual(validSource, {
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: currentKid,
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: currentKey,
  });
});

test("edu publish prepare issues a verified v2 capability only for a valid declared attempt", async () => {
  const requestId = "rid-prepare-capability-issued";
  const payload = await makeDeclaredPreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies(),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(typeof responsePayload.publishCapability, "string");
  assert.equal(prepareAttemptModeLoaderCalls, 1);
  assert.equal(securedPrepareCoordinatorCalls, 0);
  assert.equal(prepareCapabilityKeyLoaderCalls, 1);
  assert.equal(prepareCapabilityClockCalls, 1);
  assert.equal(prepareCapabilitySignerCalls, 1);
  assert.equal(preparePresignCalls, 2);

  const keyRingResult = loadEduPublishCapabilityKeyRing({
    EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT: "current-test-kid",
    EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
  });
  assert.equal(keyRingResult.mode, "available");
  if (keyRingResult.mode === "available") {
    const verification = await verifyEduPublishCommitCapability({
      token: responsePayload.publishCapability,
      keyRing: keyRingResult.keyRing,
      nowSeconds: 1_760_000_000,
      expected: {
        publishAttemptId: responsePayload.publishAttemptId,
        slug: responsePayload.slug,
        declaredManifestDigest: responsePayload.declaredManifestDigest,
        manifestSchemaVersion: responsePayload.manifestSchemaVersion,
      },
    });
    assert.equal(verification.mode, "valid_v2");
    if (verification.mode === "valid_v2") assert.equal(verification.keySlot, "current");
  }

  const issuance = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
  );
  assert.deepEqual(issuance?.event, {
    level: "info",
    kind: "api_access",
    requestId,
    route: "/api/v1/edu/publish/prepare",
    status: 200,
    meta: {
      stage: "edu_publish_prepare",
      component: "commit_capability_issuance",
      result: "observed",
      classification: "issued_v2",
    },
  });
  assert.deepEqual(issuance?.options, { sampleRate: 1, hardLimitPerMinute: 120 });
  assert.doesNotMatch(JSON.stringify(issuance), /publishCapability|token|signature|publishAttemptId|digest|kid|secret|slug/);
});

test("edu publish prepare keeps legacy success and does not evaluate capability issuance", async () => {
  const payload = makePreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-capability-legacy",
    payload,
    dependencies: makePrepareDependencies(),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishCapability"), false);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);
  const issuance = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
  );
  assert.equal((issuance?.event.meta as Record<string, unknown>).classification, "not_eligible");
  assert.deepEqual(issuance?.options, { sampleRate: 10, hardLimitPerMinute: 120 });
});

test("edu publish prepare keeps the attempt triple when capability configuration is unavailable", async () => {
  const payload = await makeDeclaredPreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-capability-missing-config",
    payload,
    dependencies: makePrepareDependencies({
      loadPublishCapabilityKeyRingFn: () => ({ mode: "configuration_unavailable" }),
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.publishAttemptId, "018f47a2-4b7c-7d9e-8f01-23456789abcd");
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishCapability"), false);
  assert.equal(prepareCapabilitySignerCalls, 0);
  const issuance = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
  );
  assert.equal((issuance?.event.meta as Record<string, unknown>).classification, "configuration_unavailable");
});

for (const [label, signResult] of [
  ["invalid_input", { ok: false, reason: "invalid_input" }],
  ["evaluation_failed", { ok: false, reason: "evaluation_failed" }],
] as const) {
  test(`edu publish prepare keeps the attempt triple when signer returns ${label}`, async () => {
    const payload = await makeDeclaredPreparePayload();
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: `rid-prepare-capability-${label}`,
      payload,
      dependencies: makePrepareDependencies({
        signPublishCapabilityFn: async () => signResult,
      }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 200);
    assertPrepareAttemptFieldsAllOrNone(responsePayload);
    assert.equal(Object.hasOwn(responsePayload, "publishCapability"), false);
    const issuance = recordedPrepareEvents.find(
      ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
    );
    assert.equal((issuance?.event.meta as Record<string, unknown>).classification, label);
  });
}

test("edu publish prepare maps capability loader and signer failures to evaluation_failed", async () => {
  const payload = await makeDeclaredPreparePayload();
  const loaderThrowResponse = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-capability-loader-throw",
    payload,
    dependencies: makePrepareDependencies({
      loadPublishCapabilityKeyRingFn: () => {
        throw new Error("private-loader-secret");
      },
    }),
  });
  const loaderThrowPayload = await loaderThrowResponse.json();
  assert.equal(loaderThrowResponse.status, 200);
  assertPrepareAttemptFieldsAllOrNone(loaderThrowPayload);
  assert.doesNotMatch(JSON.stringify(loaderThrowPayload), /private-loader-secret/);

  resetScenario();
  const signerThrowResponse = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-capability-signer-throw",
    payload,
    dependencies: makePrepareDependencies({
      signPublishCapabilityFn: async () => {
        throw new Error("private-signer-secret");
      },
    }),
  });
  const signerThrowPayload = await signerThrowResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(signerThrowResponse.status, 200);
  assertPrepareAttemptFieldsAllOrNone(signerThrowPayload);
  assert.doesNotMatch(JSON.stringify(signerThrowPayload), /private-signer-secret/);
  const issuance = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
  );
  assert.equal((issuance?.event.meta as Record<string, unknown>).classification, "evaluation_failed");
});

for (const nowSeconds of [0, Number.NaN, 1.5]) {
  test(`edu publish prepare maps invalid capability clock ${String(nowSeconds)} to invalid_input`, async () => {
    const payload = await makeDeclaredPreparePayload();
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: "rid-prepare-capability-clock-invalid",
      payload,
      dependencies: makePrepareDependencies({ nowSecondsFn: () => nowSeconds }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 200);
    assertPrepareAttemptFieldsAllOrNone(responsePayload);
    assert.equal(Object.hasOwn(responsePayload, "publishCapability"), false);
    const issuance = recordedPrepareEvents.find(
      ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
    );
    assert.equal((issuance?.event.meta as Record<string, unknown>).classification, "invalid_input");
  });
}

test("edu publish prepare maps a throwing capability clock to evaluation_failed", async () => {
  const payload = await makeDeclaredPreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-capability-clock-throw",
    payload,
    dependencies: makePrepareDependencies({
      nowSecondsFn: () => {
        throw new Error("private-clock-secret");
      },
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishCapability"), false);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-clock-secret/);
  const issuance = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
  );
  assert.equal((issuance?.event.meta as Record<string, unknown>).classification, "evaluation_failed");
});

test("edu publish prepare isolates issuance logger rejection and keeps the issued response", async () => {
  const payload = await makeDeclaredPreparePayload();
  const sentinel = "private-issuance-logger-secret";
  const recordOpsEventFn: PrepareRecorder = async (event, options) => {
    recordedPrepareEvents.push({ event: event as unknown as Record<string, unknown>, options });
    if ((event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance") {
      throw new Error(sentinel);
    }
    return { sampled: true, recorded: true };
  };
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-capability-logger",
    payload,
    dependencies: makePrepareDependencies({ recordOpsEventFn }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(typeof responsePayload.publishCapability, "string");
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-issuance-logger-secret/);
  assert.equal(recordedPrepareEvents.some(({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence"), true);
  assert.equal(recordedPrepareEvents.some(({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance"), true);
});

test("edu publish commit FILE_MISSING includes bucket/endpoint/checkedKey/prefixSample", async () => {
  scenario.missingFile = true;
  scenario.prefixSample = ["bundle/index.html", "bundle/style.css", "bundle/readme.txt"];

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "FILE_MISSING");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(payload.meta.bucketName, "edu-bucket-test");
  assert.equal(payload.meta.endpoint, "https://r2.example.test");
  assert.match(String(payload.meta.checkedKey), /index\.html$/);
  assert.deepEqual(payload.meta.prefixSample, ["bundle/index.html", "bundle/style.css", "bundle/readme.txt"]);
});

test("edu publish commit DB_FUNCTION_BUG includes requestId/supabaseRef/detail", async () => {
  scenario.dbFunctionBug = true;

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "DB_FUNCTION_BUG");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(typeof payload.supabaseRef, "string");
  assert.match(String(payload.detail), /ambiguous/i);
});

for (const state of ["VALIDATING", "PUBLISHING"] as const) {
  test(`edu publish commit blocks duplicate ${state} without publish side effects`, async () => {
    scenario.existingProjectState = state;

    const response = await handleEduPublishCommit(makeRequest(), deps);
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.error.code, "PUBLISH_IN_PROGRESS");
    assert.equal(payload.requestId, "rid-contract");
    assert.equal(payload.retryAfterSeconds, 2);
    assert.equal(response.headers.get("retry-after"), "2");
    assert.equal(response.headers.get("x-request-id"), "rid-contract");
    assert.equal(response.headers.get("x-gom-request-id"), "rid-contract");
    assert.equal(atomicPublishCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(headObjectCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    assert.equal(lastProjectInsertPayload, null);
  });
}

test("edu publish commit rejects an existing FAILED project without side effects", async () => {
  scenario.existingProjectState = "FAILED";

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "PUBLISH_RESTART_REQUIRED");
  assert.equal(payload.error.message, "이전 게시 시도가 실패했어요. 새 게시를 시작한 뒤 다시 시도해 주세요.");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(response.headers.get("x-request-id"), "rid-contract");
  assert.equal(response.headers.get("x-gom-request-id"), "rid-contract");
  assert.equal(response.headers.get("retry-after"), null);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
  assert.equal(lastProjectInsertPayload, null);
  assert.equal(projectUpdateCalls, 0);
});

test("edu publish commit maps a concurrent slug reservation to PUBLISH_IN_PROGRESS", async () => {
  scenario.projectInsertConflictState = "VALIDATING";

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "PUBLISH_IN_PROGRESS");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(payload.retryAfterSeconds, 2);
  assert.equal(response.headers.get("retry-after"), "2");
  assert.equal(atomicPublishCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
});

test("edu publish commit rejects FAILED after duplicate slug reservation without advancing version", async () => {
  scenario.projectInsertConflictState = "FAILED";

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "PUBLISH_RESTART_REQUIRED");
  assert.equal(payload.error.message, "이전 게시 시도가 실패했어요. 새 게시를 시작한 뒤 다시 시도해 주세요.");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(response.headers.get("retry-after"), null);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
  assert.equal(projectUpdateCalls, 0);
  assert.equal(projectLookupCalls, 3);
});

test("edu publish commit hides concurrent project lookup database errors", async () => {
  scenario.projectInsertConflictState = "VALIDATING";
  scenario.concurrentProjectLookupError = "private-database-constraint-secret-sentinel";

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();
  const event = recordedOpsEvents[0];

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "SLUG_LOOKUP_FAILED");
  assert.equal(payload.error.message, "게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(response.headers.get("x-request-id"), "rid-contract");
  assert.equal(response.headers.get("x-gom-request-id"), "rid-contract");
  assert.doesNotMatch(JSON.stringify(payload), /private-database-constraint-secret-sentinel|constraint|table|column/i);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
  assert.equal(lastProjectInsertPayload !== null, true);
  assert.equal(event?.request_id, "rid-contract");
  assert.equal(event?.route, "/api/v1/edu/publish/commit");
  assert.equal(event?.status, 500);
  assert.deepEqual(event?.meta, {
    stage: "edu_publish",
    component: "database",
    result: "failed",
    mapped_reason: "concurrent_project_lookup_failed",
  });
  assert.doesNotMatch(JSON.stringify(event), /private-database-constraint-secret-sentinel|abc123|slug|share[_ ]code/i);
});

test("edu publish commit keeps lookup failure response when its logger rejects", async () => {
  scenario.projectInsertConflictState = "VALIDATING";
  scenario.concurrentProjectLookupError = "private-database-constraint-secret-sentinel";
  const rejectingDeps = { ...deps, recordOpsEventFn: async () => { throw new Error("ops logger down"); } };

  const response = await handleEduPublishCommit(makeRequest(), rejectingDeps);
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "SLUG_LOOKUP_FAILED");
  assert.equal(payload.error.message, "게시 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(payload.requestId, "rid-contract");
});

test("edu publish prepare hides slug lookup details and isolates logger rejection", async () => {
  const events: Array<Record<string, unknown>> = [];
  let presignCalls = 0;
  const requestId = "rid-prepare-lookup";
  const request = new NextRequest(
    new Request("http://localhost/api/v1/edu/publish/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shareCode: "abc123",
        authorName: "학생",
        title: "테스트",
        lessonId: 1,
        files: [{ path: "index.html", contentType: "text/html", sizeBytes: 120 }],
      }),
    }),
  );

  const response = await handlePublishPrepareRoute({
    request,
    requestId,
    payload: {
      shareCode: "abc123",
      authorName: "학생",
      title: "테스트",
      lessonId: 1,
      files: [{ path: "index.html", contentType: "text/html", sizeBytes: 120 }],
    },
    dependencies: {
      findAvailableSlugFn: async () => {
        throw new Error("private-storage-database-secret-sentinel: constraint table bucket endpoint");
      },
      checkRateLimitFn: async () => ({ ok: true as const }),
      createSupabaseAdminClientFn: () => ({}) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
      loadPrepareAttemptModeFn: () => {
        prepareAttemptModeLoaderCalls += 1;
        return { mode: "legacy" as const, source: "configured" as const };
      },
      coordinateSecuredPrepareFn: async () => {
        securedPrepareCoordinatorCalls += 1;
        throw new Error("secured coordinator must not run in legacy tests");
      },
      presignPutUrlFn: async () => {
        presignCalls += 1;
        return "https://presigned.invalid";
      },
      recordOpsEventFn: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
        throw new Error("ops logger down");
      },
    },
  });
  const payload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "SLUG_LOOKUP_FAILED");
  assert.equal(payload.error.message, "게시 주소를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(payload.requestId, requestId);
  assert.equal(response.headers.get("x-request-id"), requestId);
  assert.equal(response.headers.get("x-gom-request-id"), requestId);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  assert.doesNotMatch(JSON.stringify(payload), /private-storage-database-secret-sentinel|constraint|table|bucket|endpoint/i);
  assert.equal(presignCalls, 0);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    level: "error",
    kind: "api_error",
    requestId,
    route: "/api/v1/edu/publish/prepare",
    status: 500,
    meta: {
      stage: "edu_publish_prepare",
      component: "slug_availability",
      result: "failed",
      mappedReason: "slug_lookup_failed",
    },
  });
  assert.doesNotMatch(JSON.stringify(events), /private-storage-database-secret-sentinel|abc123|lesson|bucket|endpoint/i);
});

test("edu publish prepare keeps legacy success and observes legacy evidence", async () => {
  const requestId = "rid-prepare-legacy";
  const payload = makePreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies(),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.requestId, requestId);
  assert.equal(responsePayload.slug, "abc123-123456-p1");
  assert.equal(responsePayload.uploads.length, 1);
  assert.equal(prepareAttemptModeLoaderCalls, 1);
  assert.equal(securedPrepareCoordinatorCalls, 0);
  assert.equal(prepareSlugLookupCalls, 1);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
  assert.equal(Object.hasOwn(responsePayload, "manifestSchemaVersion"), false);
  assert.equal(Object.hasOwn(responsePayload, "declaredManifestDigest"), false);
  assert.equal(Object.hasOwn(responsePayload, "declaredManifest"), false);
  assert.equal(preparePresignCalls, 1);
  assert.equal(prepareAttemptIdCalls, 0);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);

  const observation = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.deepEqual(observation?.event, {
    level: "info",
    kind: "api_access",
    requestId,
    route: "/api/v1/edu/publish/prepare",
    status: 200,
    meta: {
      stage: "edu_publish_prepare",
      component: "manifest_evidence",
      result: "observed",
      classification: "legacy",
    },
  });
  assert.deepEqual(observation?.options, { sampleRate: 10, hardLimitPerMinute: 120 });
});

test("edu publish prepare observes declared_v1 when manifest metadata matches", async () => {
  const requestId = "rid-prepare-declared";
  const payload = await makeDeclaredPreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies(),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.requestId, requestId);
  assert.equal(responsePayload.uploads.length, 2);
  assert.equal(prepareAttemptModeLoaderCalls, 1);
  assert.equal(securedPrepareCoordinatorCalls, 0);
  assert.equal(prepareSlugLookupCalls, 1);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(responsePayload.publishAttemptId, "018f47a2-4b7c-7d9e-8f01-23456789abcd");
  assert.equal(responsePayload.declaredManifestDigest, payload.declaredManifestDigest);
  assert.equal(responsePayload.manifestSchemaVersion, 1);
  assert.equal(response.headers.get("x-request-id"), requestId);
  assert.equal(response.headers.get("x-gom-request-id"), requestId);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  assert.equal(prepareAttemptIdCalls, 1);
  assert.equal(prepareCapabilityKeyLoaderCalls, 1);
  assert.equal(prepareCapabilityClockCalls, 1);
  assert.equal(prepareCapabilitySignerCalls, 1);

  const observation = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.event.meta as Record<string, unknown>).classification, "declared_v1");
  assert.deepEqual(observation?.options, { sampleRate: 1, hardLimitPerMinute: 120 });
});

test("edu publish prepare falls back to legacy when rollout mode loading throws", async () => {
  const payload = makePreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-mode-loader-throw",
    payload,
    dependencies: makePrepareDependencies({
      loadPrepareAttemptModeFn: () => {
        prepareAttemptModeLoaderCalls += 1;
        throw new Error("private-rollout-mode-secret");
      },
    }),
  });
  const responsePayload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(responsePayload.slug, "abc123-123456-p1");
  assert.equal(prepareAttemptModeLoaderCalls, 1);
  assert.equal(securedPrepareCoordinatorCalls, 0);
  assert.equal(prepareSlugLookupCalls, 1);
  assert.equal(preparePresignCalls, 1);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-rollout-mode-secret/);
});

test("edu publish prepare secured success uses full evidence and presigns only after coordination", async () => {
  const declaredPayload = await makeDeclaredPreparePayload();
  const payload: PrepareBody = {
    ...declaredPayload,
    files: [...(declaredPayload.files ?? [])].reverse(),
  };
  let coordinatorInput: Parameters<SecuredPrepareCoordinator>[0] | undefined;
  const order: string[] = [];
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-123456",
    payload,
    dependencies: makePrepareDependencies({
      loadPrepareAttemptModeFn: () => {
        order.push("mode");
        return makeSecuredModeLoader();
      },
      coordinateSecuredPrepareFn: async (input) => {
        securedPrepareCoordinatorCalls += 1;
        coordinatorInput = input;
        order.push("coordinator:start");
        const result = makeSecuredSuccess(payload);
        order.push("coordinator:success");
        return result;
      },
      presignPutUrlFn: async ({ key }) => {
        preparePresignCalls += 1;
        preparePresignKeys.push(key);
        order.push(`presign:${key.endsWith("/index.html") ? "index.html" : "assets/style.css"}`);
        return `https://presigned.invalid/${preparePresignCalls}`;
      },
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  order.push("response");

  assert.equal(response.status, 200);
  assert.equal(prepareAttemptModeLoaderCalls, 1);
  assert.equal(securedPrepareCoordinatorCalls, 1);
  assert.equal(prepareSlugLookupCalls, 0);
  assert.equal(preparePresignCalls, 2);
  assert.equal(prepareAttemptIdCalls, 0);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.deepEqual(order, [
    "mode",
    "coordinator:start",
    "coordinator:success",
    "presign:index.html",
    "presign:assets/style.css",
    "response",
  ]);
  assert.equal(coordinatorInput?.baseSlug, "abc123-123456-p1");
  assert.equal(coordinatorInput?.lessonId, 1);
  assert.deepEqual(coordinatorInput?.evidence, {
    manifestSchemaVersion: 1,
    declaredManifestDigest: payload.declaredManifestDigest,
    declaredManifest: payload.declaredManifest,
    serializedManifest: JSON.stringify(payload.declaredManifest),
  });
  assert.equal(responsePayload.slug, "abc123-123456-p1");
  assert.equal(responsePayload.publishAttemptId, "00000000-0000-4000-8000-000000000001");
  assert.equal(responsePayload.publishCapability, "public-capability-token");
  assert.equal(responsePayload.declaredManifestDigest, payload.declaredManifestDigest);
  assert.equal(responsePayload.manifestSchemaVersion, 1);
  for (const field of ["rpcOutcome", "attemptVersion", "expiresAt", "mode", "source"]) {
    assert.equal(Object.hasOwn(responsePayload, field), false, field);
  }
  const successEvent = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.result === "success",
  );
  assert.equal((successEvent?.event.meta as Record<string, unknown>).slug, "abc123-123456-p1");
  const issuance = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_issuance",
  );
  assert.equal((issuance?.event.meta as Record<string, unknown>).classification, "issued_v2");
  assert.doesNotMatch(JSON.stringify(recordedPrepareEvents), /public-capability-token|00000000-0000-4000-8000-000000000001|private/);
  assert.equal(response.headers.get("x-request-id"), "rid-123456");
  assert.equal(response.headers.get("x-gom-request-id"), "rid-123456");
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
});

for (const classification of [
  "legacy",
  "partial",
  "invalid",
  "unsupported_schema",
  "digest_mismatch",
  "metadata_mismatch",
] as const) {
  test(`edu publish prepare secured mode requires declared evidence for ${classification}`, async () => {
    const payload = makePreparePayload();
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: `rid-prepare-secured-evidence-${classification}`,
      payload,
      dependencies: makePrepareDependencies({
        loadPrepareAttemptModeFn: makeSecuredModeLoader,
        classifyPublishPrepareManifestEvidenceFn: async () => ({ mode: classification } as PublishPrepareManifestEvidenceCompatibility),
      }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 400);
    assert.equal(responsePayload.error.code, "SECURED_PREPARE_EVIDENCE_REQUIRED");
    assert.equal(responsePayload.error.message, "게시 파일 정보를 확인할 수 없어요. 파일을 다시 준비해 주세요.");
    assert.equal(prepareAttemptModeLoaderCalls, 1);
    assert.equal(securedPrepareCoordinatorCalls, 0);
    assert.equal(prepareSlugLookupCalls, 0);
    assert.equal(preparePresignCalls, 0);
    assert.doesNotMatch(JSON.stringify(responsePayload.error), /classification|private|digest|manifest/);
    const failure = recordedPrepareEvents.find(
      ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "secured_prepare",
    );
    assert.equal((failure?.event.meta as Record<string, unknown>).mappedReason, "evidence_required");
  });
}

test("edu publish prepare secured mode maps evidence evaluation failure without side effects", async () => {
  const payload = makePreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-secured-evidence-evaluation",
    payload,
    dependencies: makePrepareDependencies({
      loadPrepareAttemptModeFn: makeSecuredModeLoader,
      classifyPublishPrepareManifestEvidenceFn: async () => {
        throw new Error("private-manifest-digest-sentinel");
      },
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 500);
  assert.equal(responsePayload.error.code, "PUBLISH_PREPARE_CONTRACT_FAILED");
  assert.equal(securedPrepareCoordinatorCalls, 0);
  assert.equal(prepareSlugLookupCalls, 0);
  assert.equal(preparePresignCalls, 0);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-manifest-digest-sentinel|classification|digest|manifest/);
  const failure = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "secured_prepare",
  );
  assert.equal((failure?.event.meta as Record<string, unknown>).mappedReason, "evidence_evaluation_failed");
});

for (const lessonId of [0, 1.5, 5] as const) {
  test(`edu publish prepare secured mode rejects lesson ${lessonId}`, async () => {
    const declaredPayload = await makeDeclaredPreparePayload();
    const payload = makePreparePayload({ ...declaredPayload, lessonId });
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: `rid-prepare-secured-lesson-${String(lessonId)}`,
      payload,
      dependencies: makePrepareDependencies({ loadPrepareAttemptModeFn: makeSecuredModeLoader }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 400);
    assert.equal(responsePayload.error.code, "INVALID_LESSON_ID");
    assert.equal(
      responsePayload.error.message,
      lessonId === 5 ? "lessonId is required" : "lessonId must be between 1 and 4",
    );
    assert.equal(securedPrepareCoordinatorCalls, 0);
    assert.equal(prepareSlugLookupCalls, 0);
    assert.equal(preparePresignCalls, 0);
  });
}

for (const [reason, expected] of [
  ["slug_exhausted", { status: 409, code: "SLUG_EXHAUSTED", mappedReason: "slug_exhausted" }],
  ["prefix_lookup_failed", { status: 500, code: "SLUG_LOOKUP_FAILED", mappedReason: "prefix_lookup_failed" }],
  ["capability_configuration_unavailable", { status: 503, code: "PUBLISH_PREPARE_UNAVAILABLE", mappedReason: "unavailable" }],
  ["capability_signing_failed", { status: 503, code: "PUBLISH_PREPARE_UNAVAILABLE", mappedReason: "unavailable" }],
  ["rpc_unavailable", { status: 503, code: "PUBLISH_PREPARE_UNAVAILABLE", mappedReason: "unavailable" }],
  ["invalid_input", { status: 500, code: "PUBLISH_PREPARE_CONTRACT_FAILED", mappedReason: "contract_failure" }],
  ["contract_failure", { status: 500, code: "PUBLISH_PREPARE_CONTRACT_FAILED", mappedReason: "contract_failure" }],
] as const) {
  test(`edu publish prepare maps secured coordinator ${reason}`, async () => {
    const payload = await makeDeclaredPreparePayload();
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: `rid-prepare-secured-${reason}`,
      payload,
      dependencies: makePrepareDependencies({
        loadPrepareAttemptModeFn: makeSecuredModeLoader,
        coordinateSecuredPrepareFn: async () => {
          securedPrepareCoordinatorCalls += 1;
          return { mode: "failed", reason };
        },
      }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, expected.status);
    assert.equal(responsePayload.error.code, expected.code);
    assert.equal(securedPrepareCoordinatorCalls, 1);
    assert.equal(prepareSlugLookupCalls, 0);
    assert.equal(preparePresignCalls, 0);
    for (const field of ["slug", "publishAttemptId", "publishCapability", "manifest", "digest", "kid", "rpcOutcome"]) {
      assert.equal(Object.hasOwn(responsePayload, field), false, field);
    }
    const failure = recordedPrepareEvents.find(
      ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "secured_prepare",
    );
    assert.equal((failure?.event.meta as Record<string, unknown>).mappedReason, expected.mappedReason);
  });
}

test("edu publish prepare maps a secured coordinator throw to a contract failure", async () => {
  const payload = await makeDeclaredPreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId: "rid-prepare-secured-coordinator-throw",
    payload,
    dependencies: makePrepareDependencies({
      loadPrepareAttemptModeFn: makeSecuredModeLoader,
      coordinateSecuredPrepareFn: async () => {
        securedPrepareCoordinatorCalls += 1;
        throw new Error("private-coordinator-error-sentinel");
      },
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 500);
  assert.equal(responsePayload.error.code, "PUBLISH_PREPARE_CONTRACT_FAILED");
  assert.equal(securedPrepareCoordinatorCalls, 1);
  assert.equal(preparePresignCalls, 0);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-coordinator-error-sentinel/);
  assert.doesNotMatch(JSON.stringify(recordedPrepareEvents), /private-coordinator-error-sentinel/);
});

const malformedSecuredResults: Array<[string, unknown]> = [
  ["empty slug", { ...makeSecuredSuccess(makePreparePayload()), slug: "" }],
  ["empty capability", { ...makeSecuredSuccess(makePreparePayload()), publishCapability: "" }],
  ["digest mismatch", { ...makeSecuredSuccess(makePreparePayload()), declaredManifestDigest: "f".repeat(64) }],
  ["schema mismatch", { ...makeSecuredSuccess(makePreparePayload()), manifestSchemaVersion: 2 }],
  ["negative attempt version", { ...makeSecuredSuccess(makePreparePayload()), attemptVersion: -1 }],
  ["unknown rpc outcome", { ...makeSecuredSuccess(makePreparePayload()), rpcOutcome: "UNKNOWN" }],
];

for (const [label, malformedResult] of malformedSecuredResults) {
  test(`edu publish prepare rejects malformed secured success: ${label}`, async () => {
    const payload = await makeDeclaredPreparePayload();
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: `rid-prepare-secured-malformed-${label.replaceAll(" ", "-")}`,
      payload,
      dependencies: makePrepareDependencies({
        loadPrepareAttemptModeFn: makeSecuredModeLoader,
        coordinateSecuredPrepareFn: async () => {
          securedPrepareCoordinatorCalls += 1;
          return malformedResult as Awaited<ReturnType<SecuredPrepareCoordinator>>;
        },
      }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 500);
    assert.equal(responsePayload.error.code, "PUBLISH_PREPARE_CONTRACT_FAILED");
    assert.equal(securedPrepareCoordinatorCalls, 1);
    assert.equal(preparePresignCalls, 0);
  });
}

for (const failAt of [1, 2] as const) {
  test(`edu publish prepare keeps secured attempt prepared when presign ${failAt} fails`, async () => {
    const payload = await makeDeclaredPreparePayload();
    let presignCalls = 0;
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId: `rid-prepare-secured-presign-${failAt}`,
      payload,
      dependencies: makePrepareDependencies({
        loadPrepareAttemptModeFn: makeSecuredModeLoader,
        coordinateSecuredPrepareFn: async () => {
          securedPrepareCoordinatorCalls += 1;
          return makeSecuredSuccess(payload, {
            publishAttemptId: "private-rpc-owner-attempt-sentinel",
            publishCapability: "private-capability-token-sentinel",
          });
        },
        presignPutUrlFn: async () => {
          presignCalls += 1;
          preparePresignCalls += 1;
          if (presignCalls === failAt) throw new Error("private-presign-error-sentinel");
          return "https://presigned.invalid";
        },
      }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 500);
    assert.equal(responsePayload.error.code, "UPLOAD_URL_FAILED");
    assert.equal(securedPrepareCoordinatorCalls, 1);
    assert.equal(prepareSlugLookupCalls, 0);
    assert.equal(Object.hasOwn(responsePayload, "slug"), false);
    assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
    assert.equal(Object.hasOwn(responsePayload, "publishCapability"), false);
    assert.equal(Object.hasOwn(responsePayload, "declaredManifestDigest"), false);
    assert.doesNotMatch(JSON.stringify(responsePayload), /private-rpc-owner-attempt-sentinel|private-capability-token-sentinel|private-presign-error-sentinel/);
    assert.doesNotMatch(JSON.stringify(recordedPrepareEvents), /private-rpc-owner-attempt-sentinel|private-capability-token-sentinel|private-presign-error-sentinel/);
    const failure = recordedPrepareEvents.find(
      ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "secured_prepare",
    );
    assert.equal((failure?.event.meta as Record<string, unknown>).mappedReason, "upload_url_failed");
  });
}

test("edu publish prepare does not trust a client-provided digest", async () => {
  const requestId = "rid-prepare-digest-mismatch";
  const declaredPayload = await makeDeclaredPreparePayload();
  const payload = makePreparePayload({
    ...declaredPayload,
    declaredManifestDigest: "0".repeat(64),
  });
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies(),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
  assert.equal(prepareAttemptIdCalls, 0);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);
  const observation = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.event.meta as Record<string, unknown>).classification, "digest_mismatch");
});

test("edu publish prepare observes metadata_mismatch and presigns payload files", async () => {
  const requestId = "rid-prepare-metadata-mismatch";
  const declaredPayload = await makeDeclaredPreparePayload();
  const payload = makePreparePayload({
    ...declaredPayload,
    files: declaredPayload.files?.map((file) =>
      file.path === "assets/style.css" ? { ...file, path: "assets/other.css" } : file,
    ),
  });
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies(),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(preparePresignCalls, 2);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
  assert.equal(prepareAttemptIdCalls, 0);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);
  assert.equal(preparePresignKeys.some((key) => key.endsWith("/assets/other.css")), true);
  const observation = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.event.meta as Record<string, unknown>).classification, "metadata_mismatch");
});

test("edu publish prepare fails open when attempt ID generation throws", async () => {
  const requestId = "rid-prepare-attempt-throw";
  const payload = await makeDeclaredPreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies({
      createPublishAttemptIdFn: () => {
        prepareAttemptIdCalls += 1;
        throw new Error("private-attempt-generation-secret");
      },
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.slug, "abc123-123456-p1");
  assert.equal(responsePayload.uploads.length, 2);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
  assert.equal(prepareAttemptIdCalls, 1);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-attempt-generation-secret/);
  assert.equal(recordedPrepareEvents.some(({ event }) => (event.meta as Record<string, unknown> | null)?.result === "success"), true);
});

for (const generatedId of ["018F47A2-4B7C-7D9E-8F01-23456789ABCD", "not-a-uuid"] as const) {
  test(`edu publish prepare omits attempt fields for invalid generated ID: ${generatedId}`, async () => {
    const requestId = "rid-prepare-attempt-invalid";
    const payload = await makeDeclaredPreparePayload();
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId,
      payload,
      dependencies: makePrepareDependencies({
        createPublishAttemptIdFn: () => {
          prepareAttemptIdCalls += 1;
          return generatedId;
        },
      }),
    });
    const responsePayload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(responsePayload.ok, true);
    assertPrepareAttemptFieldsAllOrNone(responsePayload);
    assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
    assert.equal(prepareAttemptIdCalls, 1);
    assert.equal(prepareCapabilityKeyLoaderCalls, 0);
    assert.equal(prepareCapabilityClockCalls, 0);
    assert.equal(prepareCapabilitySignerCalls, 0);
  });
}

for (const mode of ["partial", "invalid", "unsupported_schema", "digest_mismatch"] as const) {
  test(`edu publish prepare observes ${mode} and keeps the existing success flow`, async () => {
    const requestId = `rid-prepare-${mode}`;
    const payload = makePreparePayload();
    const classifierResult = { mode } as PublishPrepareManifestEvidenceCompatibility;
    const response = await handlePublishPrepareRoute({
      request: makePrepareRequest(payload),
      requestId,
      payload,
      dependencies: makePrepareDependencies({
        classifyPublishPrepareManifestEvidenceFn: async () => classifierResult,
      }),
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 200);
    assert.equal(responsePayload.ok, true);
    assert.equal(responsePayload.requestId, requestId);
    assert.equal(preparePresignCalls, 1);
    assertPrepareAttemptFieldsAllOrNone(responsePayload);
    assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
    assert.equal(prepareAttemptIdCalls, 0);
    assert.equal(prepareCapabilityKeyLoaderCalls, 0);
    assert.equal(prepareCapabilityClockCalls, 0);
    assert.equal(prepareCapabilitySignerCalls, 0);
    const observation = recordedPrepareEvents.find(
      ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
    );
    assert.equal((observation?.event.meta as Record<string, unknown>).classification, mode);
  });
}

test("edu publish prepare fails open when manifest evidence evaluation rejects", async () => {
  const requestId = "rid-prepare-evaluation-failed";
  const payload = makePreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies({
      classifyPublishPrepareManifestEvidenceFn: async () => {
        throw new Error("private-manifest-evaluation-secret");
      },
    }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.requestId, requestId);
  assertPrepareAttemptFieldsAllOrNone(responsePayload);
  assert.equal(Object.hasOwn(responsePayload, "publishAttemptId"), false);
  assert.equal(prepareAttemptIdCalls, 0);
  assert.equal(prepareCapabilityKeyLoaderCalls, 0);
  assert.equal(prepareCapabilityClockCalls, 0);
  assert.equal(prepareCapabilitySignerCalls, 0);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-manifest-evaluation-secret/);
  const observation = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.event.meta as Record<string, unknown>).classification, "evaluation_failed");
  assert.doesNotMatch(JSON.stringify(observation), /private-manifest-evaluation-secret/);
});

test("edu publish prepare isolates observation logger rejection", async () => {
  const requestId = "rid-prepare-observation-logger";
  const sentinel = "private-observation-logger-secret";
  const payload = makePreparePayload();
  const recordOpsEventFn: PrepareRecorder = async (event, options) => {
    recordedPrepareEvents.push({ event: event as unknown as Record<string, unknown>, options });
    const meta = event.meta as Record<string, unknown> | null | undefined;
    if (meta?.component === "manifest_evidence") {
      throw new Error(sentinel);
    }
    return { sampled: true, recorded: true };
  };

  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies({ recordOpsEventFn }),
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.requestId, requestId);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-observation-logger-secret/);
  assert.equal(recordedPrepareEvents.some(({ event }) => (event.meta as Record<string, unknown> | null)?.component === "manifest_evidence"), true);
  assert.equal(recordedPrepareEvents.some(({ event }) => (event.meta as Record<string, unknown> | null)?.result === "success"), true);
});

test("edu publish prepare observation event contains only safe adoption fields", async () => {
  const requestId = "rid-prepare-safe-event";
  const payload = makePreparePayload();
  const response = await handlePublishPrepareRoute({
    request: makePrepareRequest(payload),
    requestId,
    payload,
    dependencies: makePrepareDependencies(),
  });
  await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  const observation = recordedPrepareEvents.find(
    ({ event }) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  const event = observation?.event as {
    requestId?: string;
    route?: string;
    status?: number;
    meta?: Record<string, unknown>;
  } | undefined;
  assert.equal(event?.requestId, requestId);
  assert.equal(event?.route, "/api/v1/edu/publish/prepare");
  assert.equal(event?.status, 200);
  assert.deepEqual(event?.meta, {
    stage: "edu_publish_prepare",
    component: "manifest_evidence",
    result: "observed",
    classification: "legacy",
  });
  for (const forbiddenField of [
    "shareCode",
    "slug",
    "baseSlug",
    "lessonId",
    "anonId",
    "path",
    "manifest",
    "serializedManifest",
    "declaredManifestDigest",
    "sha256",
    "objectKey",
    "bucket",
    "endpoint",
    "error",
  ]) {
    assert.equal(Object.hasOwn(event?.meta ?? {}, forbiddenField), false, forbiddenField);
  }
});

test("edu publish commit keeps legacy success and observes legacy evidence", async () => {
  const response = await handleEduPublishCommit(makeRequest(), deps);
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.reused, false);
  assert.equal(commitAttemptModeLoaderCalls, 1);
  assert.equal(Object.hasOwn(responsePayload, "manifestSchemaVersion"), false);
  assert.equal(Object.hasOwn(responsePayload, "declaredManifestDigest"), false);
  assert.equal(Object.hasOwn(responsePayload, "declaredManifest"), false);
  assert.equal(Object.hasOwn(responsePayload, "manifestEvidenceClassification"), false);
  assert.equal(projectLookupCalls, 2);
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(galleryUpsertCalls, 1);

  const observationIndex = recordedOpsEvents.findIndex(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.notEqual(observationIndex, -1);
  assert.deepEqual(recordedOpsEvents[observationIndex], {
    level: "info",
    kind: "api_access",
    requestId: "rid-contract",
    route: "/api/v1/edu/publish/commit",
    status: 200,
    meta: {
      stage: "edu_publish_commit",
      component: "manifest_evidence",
      result: "observed",
      classification: "legacy",
      outcome: "published",
    },
  });
  assert.deepEqual(recordedOpsEventOptions[observationIndex], { sampleRate: 10, hardLimitPerMinute: 120 });
  const attemptObservation = findCommitObservation("attempt_identity");
  assert.deepEqual(attemptObservation, {
    level: "info",
    kind: "api_access",
    requestId: "rid-contract",
    route: "/api/v1/edu/publish/commit",
    status: 200,
    meta: {
      stage: "edu_publish_commit",
      component: "attempt_identity",
      result: "observed",
      classification: "legacy",
      outcome: "published",
    },
  });
  const attemptObservationIndex = recordedOpsEvents.indexOf(attemptObservation as Record<string, unknown>);
  assert.deepEqual(recordedOpsEventOptions[attemptObservationIndex], { sampleRate: 10, hardLimitPerMinute: 120 });
  const capabilityObservation = findCommitObservation("commit_capability_verification");
  assert.deepEqual(capabilityObservation, {
    level: "info",
    kind: "api_access",
    requestId: "rid-contract",
    route: "/api/v1/edu/publish/commit",
    status: 200,
    meta: {
      stage: "edu_publish_commit",
      component: "commit_capability_verification",
      result: "observed",
      classification: "missing",
      outcome: "published",
    },
  });
  const capabilityObservationIndex = recordedOpsEvents.indexOf(capabilityObservation as Record<string, unknown>);
  assert.deepEqual(recordedOpsEventOptions[capabilityObservationIndex], { sampleRate: 10, hardLimitPerMinute: 120 });
  assert.equal(capabilityKeyLoaderCalls, 0);
  assert.equal(capabilityClockCalls, 0);
  assert.equal(capabilityVerifierCalls, 0);
  for (const forbiddenField of [
    "shareCode",
    "slug",
    "projectId",
    "version",
    "lessonId",
    "anonId",
    "authorName",
    "title",
    "path",
    "manifest",
    "serializedManifest",
    "declaredManifestDigest",
    "sha256",
    "objectKey",
    "bucket",
    "endpoint",
    "capability",
    "error",
  ]) {
    assert.equal(Object.hasOwn((recordedOpsEvents[observationIndex].meta ?? {}) as Record<string, unknown>, forbiddenField), false, forbiddenField);
  }
  for (const forbiddenField of [
    "publishAttemptId",
    "attempt",
    "digest",
    "shareCode",
    "slug",
    "projectId",
    "lessonId",
    "path",
    "manifest",
    "objectKey",
    "error",
  ]) {
    assert.equal(Object.hasOwn((attemptObservation?.meta ?? {}) as Record<string, unknown>, forbiddenField), false, forbiddenField);
  }
});

test("edu publish commit falls back to legacy when the commit mode loader throws", async () => {
  const sentinel = "private-commit-mode-loader-secret";
  const response = await handleEduPublishCommit(makeRequest(), {
    ...deps,
    loadCommitAttemptModeFn: () => {
      commitAttemptModeLoaderCalls += 1;
      throw new Error(sentinel);
    },
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(commitAttemptModeLoaderCalls, 1);
  assert.equal(quotaCountCalls, 1);
  assert.equal(projectLookupCalls, 2);
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.doesNotMatch(JSON.stringify(responsePayload), new RegExp(sentinel));
  assert.doesNotMatch(JSON.stringify(recordedOpsEvents), new RegExp(sentinel));
});

test("edu publish commit treats an invalid runtime mode result as legacy", async () => {
  const response = await handleEduPublishCommit(makeRequest(), {
    ...deps,
    loadCommitAttemptModeFn: () => {
      commitAttemptModeLoaderCalls += 1;
      return { mode: "legacy", source: "invalid_fallback" };
    },
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(commitAttemptModeLoaderCalls, 1);
  assert.equal(quotaCountCalls, 1);
  assert.equal(listObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.doesNotMatch(JSON.stringify(responsePayload), /invalid_fallback/);
  assert.doesNotMatch(JSON.stringify(recordedOpsEvents), /invalid_fallback/);
});

test("edu publish commit observes a valid capability without changing publish side effects", async () => {
  const payload = await makeCapabilityCommitPayload();
  const response = await handleEduPublishCommit(makeRequest(payload), makeCapabilityDependencies());
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.reused, false);
  assert.equal(capabilityKeyLoaderCalls, 1);
  assert.equal(capabilityClockCalls, 1);
  assert.equal(capabilityVerifierCalls, 1);
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(galleryUpsertCalls, 1);
  const event = findCommitObservation("commit_capability_verification");
  assert.deepEqual(event, {
    level: "info",
    kind: "api_access",
    requestId: "rid-contract",
    route: "/api/v1/edu/publish/commit",
    status: 200,
    meta: {
      stage: "edu_publish_commit",
      component: "commit_capability_verification",
      result: "observed",
      classification: "valid_v2",
      outcome: "published",
    },
  });
  assert.deepEqual(
    recordedOpsEventOptions[recordedOpsEvents.indexOf(event as Record<string, unknown>)],
    { sampleRate: 1, hardLimitPerMinute: 120 },
  );
  for (const sentinel of [
    "private-capability-token-sentinel",
    "private-capability-secret-sentinel",
    "private-capability-kid-sentinel",
    "private-capability-claim-sentinel",
  ]) {
    assert.doesNotMatch(JSON.stringify(event), new RegExp(sentinel));
  }
  for (const forbiddenField of [
    "publishCapability",
    "token",
    "claims",
    "publishAttemptId",
    "declaredManifestDigest",
    "kid",
    "iat",
    "exp",
    "slug",
    "projectId",
    "lessonId",
    "shareCode",
    "authorName",
    "title",
    "manifest",
    "error",
  ]) {
    assert.equal(Object.hasOwn((event?.meta ?? {}) as Record<string, unknown>, forbiddenField), false, forbiddenField);
  }
});

test("edu publish commit fails open for a malformed capability", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest({
      ...declaredPayload,
      slug: CAPABILITY_SLUG,
      publishAttemptId: CAPABILITY_ATTEMPT_ID,
      publishCapability: "not-a-capability",
    }),
    makeCapabilityDependencies(),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "malformed");
  assert.equal(capabilityKeyLoaderCalls, 1);
  assert.equal(capabilityClockCalls, 1);
  assert.equal(capabilityVerifierCalls, 1);
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit falls back to observe when the policy mode loader throws", async () => {
  const payload = await makeCapabilityCommitPayload({ publishCapability: "not-a-capability" });
  const sentinel = "private-policy-loader-sentinel";
  const response = await handleEduPublishCommit(
    makeRequest(payload),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: () => {
        capabilityPolicyLoaderCalls += 1;
        throw new Error(sentinel);
      },
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(capabilityPolicyLoaderCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(findCommitObservation("commit_capability_policy"), undefined);
  assert.doesNotMatch(JSON.stringify(responsePayload), new RegExp(sentinel));
});

test("edu publish commit enforce_present allows a legacy request without a capability", async () => {
  const response = await handleEduPublishCommit(
    makeRequest(),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(capabilityPolicyLoaderCalls, 1);
  assert.equal(findCommitObservation("commit_capability_policy"), undefined);
  assert.equal(projectLookupCalls, 2);
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(galleryUpsertCalls, 1);
});

test("edu publish commit enforce_present allows a valid v2 capability", async () => {
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(capabilityPolicyLoaderCalls, 1);
  assert.equal(findCommitObservation("commit_capability_policy"), undefined);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "valid_v2");
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).outcome, "published");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit blocks valid secured activation before the incomplete lifecycle", async () => {
  const payload = await makeCapabilityCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest(payload),
    makeCapabilityDependencies({ loadCommitAttemptModeFn: makeCommitAttemptModeLoader("secured_v1") }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 503);
  assert.equal(responsePayload.ok, false);
  assert.equal(responsePayload.error.code, "PUBLISH_COMMIT_LIFECYCLE_UNAVAILABLE");
  assert.equal(responsePayload.error.message, "보안 게시 완료 기능이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(response.headers.get("x-request-id"), "rid-contract");
  assert.equal(response.headers.get("x-gom-request-id"), "rid-contract");
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  assert.equal(response.headers.get("retry-after"), null);
  assert.equal(commitAttemptModeLoaderCalls, 1);
  assert.equal(capabilityKeyLoaderCalls, 1);
  assert.equal(capabilityClockCalls, 1);
  assert.equal(capabilityVerifierCalls, 1);
  assert.equal(quotaCountCalls, 0);
  assert.equal(projectLookupCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(galleryUpsertCalls, 0);

  const event = findCommitObservation("commit_attempt_rollout");
  assert.deepEqual(event, {
    level: "warn",
    kind: "api_error",
    requestId: "rid-contract",
    route: "/api/v1/edu/publish/commit",
    status: 503,
    meta: {
      stage: "edu_publish_commit",
      component: "commit_attempt_rollout",
      result: "blocked",
      mode: "secured_v1",
      mappedReason: "lifecycle_incomplete",
      classification: "valid_v2",
    },
  });
  for (const forbiddenField of [
    "publishAttemptId",
    "declaredManifestDigest",
    "publishCapability",
    "capability",
    "kid",
    "slug",
    "leaseOwner",
    "projectId",
  ]) {
    assert.equal(Object.hasOwn(responsePayload, forbiddenField), false, forbiddenField);
    assert.equal(Object.hasOwn((event?.meta ?? {}) as Record<string, unknown>, forbiddenField), false, forbiddenField);
  }
});

test("edu publish commit rejects a missing capability in secured mode", async () => {
  const payload = await makeCapabilityCommitPayload();
  const { publishCapability: _publishCapability, ...payloadWithoutCapability } = payload;
  const response = await handleEduPublishCommit(
    makeRequest(payloadWithoutCapability),
    makeCapabilityDependencies({ loadCommitAttemptModeFn: makeCommitAttemptModeLoader("secured_v1") }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 401);
  assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_INVALID");
  assert.equal(responsePayload.error.message, "게시 권한 증명이 유효하지 않습니다. 다시 게시를 시작해 주세요.");
  assert.equal(response.headers.get("retry-after"), null);
  assert.equal(commitAttemptModeLoaderCalls, 1);
  assert.equal(capabilityKeyLoaderCalls, 0);
  assert.equal(capabilityClockCalls, 0);
  assert.equal(capabilityVerifierCalls, 0);
  assert.equal(quotaCountCalls, 0);
  assert.equal(projectLookupCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
  assert.equal((findCommitObservation("commit_attempt_rollout")?.meta as Record<string, unknown>).mappedReason, "capability_rejected");
  assert.equal((findCommitObservation("commit_attempt_rollout")?.meta as Record<string, unknown>).classification, "missing");
  assert.doesNotMatch(JSON.stringify(responsePayload), /publishCapability|publishAttemptId|declaredManifestDigest/);
});

for (const [name, makePayload] of [
  ["attempt identity", async () => ({ ...(await makeDeclaredCommitPayload()), publishCapability: "submitted-without-attempt" })],
  ["manifest evidence", async () => makeCapabilityCommitPayload({ declaredManifestDigest: "0".repeat(64) })],
] as const) {
  test(`edu publish commit rejects a secured ${name} mismatch before publish side effects`, async () => {
    const response = await handleEduPublishCommit(
      makeRequest(await makePayload()),
      makeCapabilityDependencies({ loadCommitAttemptModeFn: makeCommitAttemptModeLoader("secured_v1") }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 409);
    assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_MISMATCH");
    assert.equal(responsePayload.error.message, "게시 정보가 달라 다시 게시를 시작해 주세요.");
    assert.equal(response.headers.get("retry-after"), null);
    assert.equal(commitAttemptModeLoaderCalls, 1);
    assert.equal(capabilityKeyLoaderCalls, 0);
    assert.equal(capabilityClockCalls, 0);
    assert.equal(capabilityVerifierCalls, 0);
    assert.equal(quotaCountCalls, 0);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(headObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    const event = findCommitObservation("commit_attempt_rollout");
    assert.equal((event?.meta as Record<string, unknown>).mappedReason, "capability_rejected");
    assert.equal((event?.meta as Record<string, unknown>).classification, "attempt_unconfirmed");
    assert.doesNotMatch(JSON.stringify(responsePayload), /attempt_unconfirmed|evidence_unconfirmed|publishAttemptId|declaredManifestDigest/);
  });
}

for (const [classification, expected] of [
  ["malformed", { status: 401, code: "PUBLISH_CAPABILITY_INVALID", retryAfter: null }],
  ["invalid_signature", { status: 401, code: "PUBLISH_CAPABILITY_INVALID", retryAfter: null }],
  ["expired", { status: 401, code: "PUBLISH_CAPABILITY_EXPIRED", retryAfter: null }],
  ["claim_mismatch", { status: 409, code: "PUBLISH_CAPABILITY_MISMATCH", retryAfter: null }],
  ["configuration_unavailable", { status: 503, code: "PUBLISH_CAPABILITY_UNAVAILABLE", retryAfter: "30" }],
  ["evaluation_failed", { status: 503, code: "PUBLISH_CAPABILITY_UNAVAILABLE", retryAfter: "30" }],
] as const) {
  test(`edu publish commit maps secured capability ${classification}`, async () => {
    const response = await handleEduPublishCommit(
      makeRequest(await makeCapabilityCommitPayload()),
      makeCapabilityDependencies({
        loadCommitAttemptModeFn: makeCommitAttemptModeLoader("secured_v1"),
        verifyPublishCapabilityFn: makeFixedCapabilityVerifier(classification),
      }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, expected.status);
    assert.equal(responsePayload.error.code, expected.code);
    assert.equal(response.headers.get("Retry-After"), expected.retryAfter);
    assert.equal(commitAttemptModeLoaderCalls, 1);
    assert.equal(capabilityKeyLoaderCalls, 1);
    assert.equal(capabilityClockCalls, 1);
    assert.equal(capabilityVerifierCalls, 1);
    assert.equal(quotaCountCalls, 0);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(headObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    const event = findCommitObservation("commit_attempt_rollout");
    assert.equal((event?.meta as Record<string, unknown>).mappedReason, "capability_rejected");
    assert.equal((event?.meta as Record<string, unknown>).classification, classification);
    assert.doesNotMatch(JSON.stringify(responsePayload), /publishAttemptId|declaredManifestDigest|publishCapability|kid|slug/);
  });
}

test("edu publish commit orders secured capability checks before the lifecycle guard", async () => {
  const order: string[] = [];
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityKeyRingFn: () => {
        order.push("capability:key");
        return { mode: "available" as const, keyRing: makeTestCapabilityKeyRing() };
      },
      nowSecondsFn: () => {
        order.push("capability:clock");
        return CAPABILITY_NOW_SECONDS;
      },
      verifyPublishCapabilityFn: async (...args) => {
        order.push("capability:verify");
        return verifyEduPublishCommitCapability(...args);
      },
      loadPublishCapabilityPolicyModeFn: () => {
        order.push("capability:policy");
        return { mode: "observe" as const, source: "configured" as const };
      },
      loadCommitAttemptModeFn: () => {
        order.push("commit-mode");
        return { mode: "secured_v1" as const, source: "configured" as const };
      },
      recordOpsEventFn: async (event, options) => {
        if ((event.meta as Record<string, unknown> | undefined)?.mappedReason === "lifecycle_incomplete") {
          order.push("secured:block");
        }
        recordedOpsEvents.push(event as unknown as Record<string, unknown>);
        recordedOpsEventOptions.push(options);
        return { sampled: true, recorded: true };
      },
    }),
  );
  await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 503);
  assert.deepEqual(order, [
    "capability:key",
    "capability:clock",
    "capability:verify",
    "capability:policy",
    "commit-mode",
    "secured:block",
  ]);
  assert.equal(quotaCountCalls, 0);
  assert.equal(projectLookupCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(atomicPublishCalls, 0);
});

for (const loggerFailure of ["throw", "reject"] as const) {
  test(`edu publish commit keeps the secured lifecycle response when its logger ${loggerFailure}s`, async () => {
    const sentinel = `private-secured-rollout-${loggerFailure}-sentinel`;
    const recordOpsEventFn: NonNullable<CommitDependencies["recordOpsEventFn"]> = (event, options) => {
      recordedOpsEvents.push(event as unknown as Record<string, unknown>);
      recordedOpsEventOptions.push(options);
      if ((event.meta as Record<string, unknown> | undefined)?.component === "commit_attempt_rollout") {
        if (loggerFailure === "throw") throw new Error(sentinel);
        return Promise.reject(new Error(sentinel));
      }
      return Promise.resolve({ sampled: true, recorded: true });
    };
    const response = await handleEduPublishCommit(
      makeRequest(await makeCapabilityCommitPayload()),
      makeCapabilityDependencies({
        loadCommitAttemptModeFn: makeCommitAttemptModeLoader("secured_v1"),
        recordOpsEventFn,
      }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 503);
    assert.equal(responsePayload.error.code, "PUBLISH_COMMIT_LIFECYCLE_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(responsePayload), new RegExp(sentinel));
    assert.equal(quotaCountCalls, 0);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
  });
}

for (const classification of [
  "malformed",
  "invalid_signature",
  "unsupported_version",
  "unknown_kid",
  "not_yet_valid",
  "invalid_lifetime",
  "invalid_claim",
] as const) {
  test(`edu publish commit enforce_present rejects ${classification} before publish side effects`, async () => {
    const response = await handleEduPublishCommit(
      makeRequest(await makeCapabilityCommitPayload()),
      makeCapabilityDependencies({
        loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
        verifyPublishCapabilityFn: makeFixedCapabilityVerifier(classification),
      }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 401);
    assert.equal(responsePayload.ok, false);
    assert.equal(responsePayload.requestId, "rid-contract");
    assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_INVALID");
    assert.equal(responsePayload.error.message, "게시 권한 증명이 유효하지 않습니다. 다시 게시를 시작해 주세요.");
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
    assert.equal(response.headers.get("x-request-id"), "rid-contract");
    assert.equal(capabilityPolicyLoaderCalls, 1);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(headObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    assert.equal(projectUpdateCalls, 0);
    assert.equal(findCommitObservation("commit_capability_verification"), undefined);
    assert.equal(findCommitObservation("commit_capability_policy") !== undefined, true);
  });
}

test("edu publish commit enforce_present rejects an expired capability before publish side effects", async () => {
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
      verifyPublishCapabilityFn: makeFixedCapabilityVerifier("expired"),
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 401);
  assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_EXPIRED");
  assert.equal(responsePayload.error.message, "게시 권한 증명이 만료되었습니다. 다시 게시를 시작해 주세요.");
  assert.equal(capabilityPolicyLoaderCalls, 1);
  assert.equal(projectLookupCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
  assert.equal(findCommitObservation("commit_capability_verification"), undefined);
});

for (const classification of ["claim_mismatch", "attempt_unconfirmed", "evidence_unconfirmed"] as const) {
  test(`edu publish commit enforce_present rejects ${classification} as a mismatch`, async () => {
    const requestPayload =
      classification === "attempt_unconfirmed"
        ? { publishCapability: "submitted-without-attempt" }
        : classification === "evidence_unconfirmed"
          ? await makeCapabilityCommitPayload({ declaredManifestDigest: "0".repeat(64) })
          : await makeCapabilityCommitPayload();
    const response = await handleEduPublishCommit(
      makeRequest(requestPayload),
      makeCapabilityDependencies({
        loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
        ...(classification === "claim_mismatch"
          ? { verifyPublishCapabilityFn: makeFixedCapabilityVerifier("claim_mismatch") }
          : {}),
      }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 409);
    assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_MISMATCH");
    assert.equal(responsePayload.error.message, "게시 정보가 달라 다시 게시를 시작해 주세요.");
    assert.equal(capabilityPolicyLoaderCalls, 1);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    assert.equal(findCommitObservation("commit_capability_verification"), undefined);
    assert.equal((findCommitObservation("commit_capability_policy")?.meta as Record<string, unknown>).classification, classification);
  });
}

for (const classification of ["configuration_unavailable", "evaluation_failed"] as const) {
  test(`edu publish commit enforce_present rejects ${classification} as unavailable`, async () => {
    const response = await handleEduPublishCommit(
      makeRequest(await makeCapabilityCommitPayload()),
      makeCapabilityDependencies({
        loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
        verifyPublishCapabilityFn: makeFixedCapabilityVerifier(classification),
      }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 503);
    assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_UNAVAILABLE");
    assert.equal(responsePayload.error.message, "서버 게시 기능이 잠시 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
    assert.equal(responsePayload.retryAfterSeconds, 30);
    assert.equal(response.headers.get("Retry-After"), "30");
    assert.equal(capabilityPolicyLoaderCalls, 1);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    assert.equal(findCommitObservation("commit_capability_verification"), undefined);
  });
}

test("edu publish commit observes an unavailable capability when policy mode is observe", async () => {
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("observe"),
      verifyPublishCapabilityFn: makeFixedCapabilityVerifier("configuration_unavailable"),
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(capabilityPolicyLoaderCalls, 1);
  assert.equal(findCommitObservation("commit_capability_policy"), undefined);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "configuration_unavailable");
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).outcome, "published");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit observes invalid signature and keeps the existing success response", async () => {
  const payload = await makeCapabilityCommitPayload();
  const invalidSignature = await signEduPublishCommitCapability({
    keyRing: {
      current: { kid: "current-test-kid", keyBytes: new Uint8Array(32).fill(9) },
    },
    nowSeconds: CAPABILITY_NOW_SECONDS,
    publishAttemptId: CAPABILITY_ATTEMPT_ID,
    slug: CAPABILITY_SLUG,
    declaredManifestDigest: payload.declaredManifestDigest as string,
    manifestSchemaVersion: 1,
  });
  if (!invalidSignature.ok) throw new Error("test invalid signature signing failed");
  payload.publishCapability = invalidSignature.token;

  const response = await handleEduPublishCommit(makeRequest(payload), makeCapabilityDependencies());
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "invalid_signature");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit observes expired capability with a fixed clock", async () => {
  const payload = await makeCapabilityCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest(payload),
    makeCapabilityDependencies({ nowSecondsFn: () => CAPABILITY_NOW_SECONDS + 2700 }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "expired");
  assert.equal(capabilityVerifierCalls, 1);
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit observes a capability claim mismatch", async () => {
  const payload = await makeCapabilityCommitPayload();
  const mismatched = await signEduPublishCommitCapability({
    keyRing: makeTestCapabilityKeyRing(),
    nowSeconds: CAPABILITY_NOW_SECONDS,
    publishAttemptId: CAPABILITY_ATTEMPT_ID,
    slug: "abc123-123456-p2",
    declaredManifestDigest: payload.declaredManifestDigest as string,
    manifestSchemaVersion: 1,
  });
  if (!mismatched.ok) throw new Error("test mismatch signing failed");
  payload.publishCapability = mismatched.token;

  const response = await handleEduPublishCommit(makeRequest(payload), makeCapabilityDependencies());
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "claim_mismatch");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit maps capability configuration and evaluation failures without rejecting", async () => {
  const payload = await makeCapabilityCommitPayload();
  const configurationResponse = await handleEduPublishCommit(
    makeRequest(payload),
    makeCapabilityDependencies({
      loadPublishCapabilityKeyRingFn: () => ({ mode: "configuration_unavailable" as const }),
      verifyPublishCapabilityFn: async () => {
        throw new Error("private-capability-verifier-sentinel");
      },
    }),
  );
  const configurationPayload = await configurationResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(configurationResponse.status, 200);
  assert.equal(configurationPayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "configuration_unavailable");
  assert.equal(capabilityVerifierCalls, 0);

  resetScenario();
  const throwingResponse = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityKeyRingFn: () => {
        throw new Error("private-capability-loader-sentinel");
      },
    }),
  );
  const throwingPayload = await throwingResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(throwingResponse.status, 200);
  assert.equal(throwingPayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "evaluation_failed");
  assert.doesNotMatch(JSON.stringify(throwingPayload), /private-capability-loader-sentinel/);
  assert.equal(capabilityVerifierCalls, 0);
});

test("edu publish commit maps a throwing clock and verifier to evaluation_failed", async () => {
  const clockResponse = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      nowSecondsFn: () => {
        throw new Error("private-capability-clock-sentinel");
      },
    }),
  );
  const clockPayload = await clockResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(clockResponse.status, 200);
  assert.equal(clockPayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "evaluation_failed");
  assert.equal(capabilityVerifierCalls, 0);

  resetScenario();
  const verifierResponse = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      verifyPublishCapabilityFn: async () => {
        throw new Error("private-capability-verifier-sentinel");
      },
    }),
  );
  const verifierPayload = await verifierResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(verifierResponse.status, 200);
  assert.equal(verifierPayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "evaluation_failed");
  assert.doesNotMatch(JSON.stringify(verifierPayload), /private-capability-verifier-sentinel/);
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit does not evaluate a capability without confirmed attempt or evidence", async () => {
  const signedPayload = await makeCapabilityCommitPayload();
  const attemptResponse = await handleEduPublishCommit(
    makeRequest({ publishCapability: signedPayload.publishCapability }),
    makeCapabilityDependencies(),
  );
  const attemptPayload = await attemptResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(attemptResponse.status, 200);
  assert.equal(attemptPayload.ok, true);
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "attempt_unconfirmed");
  assert.equal(capabilityKeyLoaderCalls, 0);
  assert.equal(capabilityClockCalls, 0);
  assert.equal(capabilityVerifierCalls, 0);

  resetScenario();
  const evidenceResponse = await handleEduPublishCommit(
    makeRequest({
      ...signedPayload,
      declaredManifestDigest: "0".repeat(64),
    }),
    makeCapabilityDependencies(),
  );
  const evidencePayload = await evidenceResponse.json();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(evidenceResponse.status, 200);
  assert.equal(evidencePayload.ok, true);
  assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).classification, "evidence_unconfirmed");
  assert.equal((findCommitObservation("commit_capability_verification")?.meta as Record<string, unknown>).classification, "evidence_unconfirmed");
  assert.equal(capabilityKeyLoaderCalls, 0);
  assert.equal(capabilityClockCalls, 0);
  assert.equal(capabilityVerifierCalls, 0);
});

test("edu publish commit observes partial attempt identity for the transitional client", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(makeRequest(declaredPayload), deps);
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.reused, false);
  assert.equal((findCommitObservation("manifest_evidence")?.meta as Record<string, unknown>).classification, "declared_v1");
  assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).classification, "partial");
  assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).outcome, "published");
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(galleryUpsertCalls, 1);
});

test("edu publish commit observes declared_v1 when manifest metadata matches", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest({ ...declaredPayload, publishAttemptId: "018f47a2-4b7c-7d9e-8f01-23456789abcd" }),
    deps,
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.reused, false);
  assert.equal(Object.hasOwn(responsePayload, "declaredManifestDigest"), false);
  assert.equal(lastProjectInsertPayload?.manifestSchemaVersion, undefined);
  assert.equal(lastAtomicPublishPayload?.declaredManifest, undefined);
  const observation = recordedOpsEvents.find(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.meta as Record<string, unknown>).classification, "declared_v1");
  assert.equal((observation?.meta as Record<string, unknown>).outcome, "published");
  const attemptObservation = findCommitObservation("attempt_identity");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).classification, "attempt_v1");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).outcome, "published");
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(galleryUpsertCalls, 1);
});

for (const publishAttemptId of ["018F47A2-4B7C-7D9E-8F01-23456789ABCD", "not-a-uuid"] as const) {
  test(`edu publish commit observes invalid attempt ID ${publishAttemptId} and keeps success`, async () => {
    const declaredPayload = await makeDeclaredCommitPayload();
    const response = await handleEduPublishCommit(
      makeRequest({ ...declaredPayload, publishAttemptId }),
      deps,
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 200);
    assert.equal(responsePayload.ok, true);
    assert.equal(responsePayload.reused, false);
    assert.equal((findCommitObservation("manifest_evidence")?.meta as Record<string, unknown>).classification, "declared_v1");
    assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).classification, "invalid");
    assert.equal(atomicPublishCalls, 1);
    assert.equal(listObjectCalls, 1);
    assert.equal(headObjectCalls, 1);
    assert.equal(galleryUpsertCalls, 1);
  });
}

test("edu publish commit observes unsupported attempt schema and keeps success", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest({
      ...declaredPayload,
      publishAttemptId: "018f47a2-4b7c-7d9e-8f01-23456789abcd",
      manifestSchemaVersion: 2,
    }),
    deps,
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("manifest_evidence")?.meta as Record<string, unknown>).classification, "unsupported_schema");
  assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).classification, "unsupported_schema");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit observes evidence_unconfirmed for a digest mismatch", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest({
      ...declaredPayload,
      publishAttemptId: "018f47a2-4b7c-7d9e-8f01-23456789abcd",
      declaredManifestDigest: "0".repeat(64),
    }),
    deps,
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("manifest_evidence")?.meta as Record<string, unknown>).classification, "digest_mismatch");
  assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).classification, "evidence_unconfirmed");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit observes evidence_unconfirmed for metadata mismatch", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest({
      ...declaredPayload,
      publishAttemptId: "018f47a2-4b7c-7d9e-8f01-23456789abcd",
      files: [{ path: "index.html", contentType: "text/plain", sizeBytes: 120 }],
    }),
    deps,
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal((findCommitObservation("manifest_evidence")?.meta as Record<string, unknown>).classification, "metadata_mismatch");
  assert.equal((findCommitObservation("attempt_identity")?.meta as Record<string, unknown>).classification, "evidence_unconfirmed");
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit fails open when attempt compatibility evaluation rejects", async () => {
  const sentinel = "private-attempt-classifier-secret";
  const classifyPublishAttemptCompatibilityFn: CommitAttemptClassifier = () => {
    throw new Error(sentinel);
  };
  const response = await handleEduPublishCommit(makeRequest(), {
    ...deps,
    classifyPublishAttemptCompatibilityFn,
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-attempt-classifier-secret/);
  const attemptObservation = findCommitObservation("attempt_identity");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).classification, "evaluation_failed");
  assert.doesNotMatch(JSON.stringify(attemptObservation), /private-attempt-classifier-secret/);
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit observes metadata_mismatch and keeps the existing publish flow", async () => {
  const declaredPayload = await makeDeclaredCommitPayload();
  const response = await handleEduPublishCommit(
    makeRequest({
      ...declaredPayload,
      files: [{ path: "index.html", contentType: "text/plain", sizeBytes: 120 }],
    }),
    deps,
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  const observation = recordedOpsEvents.find(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.meta as Record<string, unknown>).classification, "metadata_mismatch");
  assert.equal(Object.hasOwn(lastAtomicPublishPayload ?? {}, "manifestSchemaVersion"), false);
  assert.equal(Object.hasOwn(lastAtomicPublishPayload ?? {}, "declaredManifestDigest"), false);
  assert.equal(Object.hasOwn(lastAtomicPublishPayload ?? {}, "declaredManifest"), false);
  assert.equal(listObjectCalls, 1);
  assert.equal(headObjectCalls, 1);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(galleryUpsertCalls, 1);
});

for (const mode of ["partial", "invalid", "unsupported_schema", "digest_mismatch"] as const) {
  test(`edu publish commit observes ${mode} and keeps the existing success flow`, async () => {
    const classifierResult = { mode } as PublishPrepareManifestEvidenceCompatibility;
    const classifyPublishManifestEvidenceFn: CommitClassifier = async () => classifierResult;
    const response = await handleEduPublishCommit(makeRequest(), {
      ...deps,
      classifyPublishManifestEvidenceFn,
    });
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 200);
    assert.equal(responsePayload.ok, true);
    assert.equal(responsePayload.reused, false);
    assert.equal(listObjectCalls, 1);
    assert.equal(headObjectCalls, 1);
    assert.equal(atomicPublishCalls, 1);
    assert.equal(galleryUpsertCalls, 1);
    const observation = recordedOpsEvents.find(
      (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
    );
    assert.equal((observation?.meta as Record<string, unknown>).classification, mode);
  });
}

test("edu publish commit fails open when manifest evidence evaluation rejects", async () => {
  const sentinel = "private-commit-manifest-evaluation-secret";
  const classifyPublishManifestEvidenceFn: CommitClassifier = async () => {
    throw new Error(sentinel);
  };
  const response = await handleEduPublishCommit(makeRequest(), {
    ...deps,
    classifyPublishManifestEvidenceFn,
  });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-commit-manifest-evaluation-secret/);
  const observation = recordedOpsEvents.find(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.meta as Record<string, unknown>).classification, "evaluation_failed");
  assert.doesNotMatch(JSON.stringify(observation), /private-commit-manifest-evaluation-secret/);
});

test("edu publish commit isolates observation logger rejection", async () => {
  const sentinel = "private-commit-observation-logger-secret";
  const recordOpsEventFn = async (event: Record<string, unknown>, options: unknown) => {
    recordedOpsEvents.push(event);
    recordedOpsEventOptions.push(options);
    if ((event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence") {
      throw new Error(sentinel);
    }
    return { sampled: true, recorded: true };
  };
  const response = await handleEduPublishCommit(makeRequest(), { ...deps, recordOpsEventFn });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-commit-observation-logger-secret/);
  assert.equal(
    recordedOpsEvents.some(
      (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
    ),
    true,
  );
});

test("edu publish commit isolates attempt identity observation logger rejection", async () => {
  const sentinel = "private-attempt-observation-logger-secret";
  const recordOpsEventFn = async (event: Record<string, unknown>, options: unknown) => {
    recordedOpsEvents.push(event);
    recordedOpsEventOptions.push(options);
    if ((event.meta as Record<string, unknown> | undefined)?.component === "attempt_identity") {
      throw new Error(sentinel);
    }
    return { sampled: true, recorded: true };
  };
  const response = await handleEduPublishCommit(makeRequest(), { ...deps, recordOpsEventFn });
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-attempt-observation-logger-secret/);
  assert.equal(findCommitObservation("manifest_evidence") !== undefined, true);
  assert.equal(findCommitObservation("attempt_identity") !== undefined, true);
  assert.equal(atomicPublishCalls, 1);
});

test("edu publish commit isolates capability observation logger rejection", async () => {
  const sentinel = "private-capability-observation-logger-secret";
  const recordOpsEventFn = async (event: Record<string, unknown>, options: unknown) => {
    recordedOpsEvents.push(event);
    recordedOpsEventOptions.push(options);
    if ((event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_verification") {
      throw new Error(sentinel);
    }
    return { sampled: true, recorded: true };
  };
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    { ...makeCapabilityDependencies(), recordOpsEventFn },
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.doesNotMatch(JSON.stringify(responsePayload), /private-capability-observation-logger-secret/);
  assert.equal(findCommitObservation("manifest_evidence") !== undefined, true);
  assert.equal(findCommitObservation("attempt_identity") !== undefined, true);
  assert.equal(findCommitObservation("commit_capability_verification") !== undefined, true);
  assert.equal(atomicPublishCalls, 1);
});

for (const loggerFailure of ["throw", "reject"] as const) {
  test(`edu publish commit keeps a policy rejection response when the logger ${loggerFailure}s`, async () => {
    const sentinel = `private-policy-${loggerFailure}-sentinel`;
    const recordOpsEventFn: NonNullable<CommitDependencies["recordOpsEventFn"]> = (event, options) => {
      recordedOpsEvents.push(event as unknown as Record<string, unknown>);
      recordedOpsEventOptions.push(options);
      if ((event.meta as Record<string, unknown> | undefined)?.component === "commit_capability_policy") {
        if (loggerFailure === "throw") throw new Error(sentinel);
        return Promise.reject(new Error(sentinel));
      }
      return Promise.resolve({ sampled: true, recorded: true });
    };
    const response = await handleEduPublishCommit(
      makeRequest(await makeCapabilityCommitPayload()),
      makeCapabilityDependencies({
        loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
        verifyPublishCapabilityFn: makeFixedCapabilityVerifier("invalid_signature"),
        recordOpsEventFn,
      }),
    );
    const responsePayload = await response.json();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(response.status, 401);
    assert.equal(responsePayload.error.code, "PUBLISH_CAPABILITY_INVALID");
    assert.equal(responsePayload.error.message, "게시 권한 증명이 유효하지 않습니다. 다시 게시를 시작해 주세요.");
    assert.equal(responsePayload.requestId, "rid-contract");
    assert.equal(capabilityPolicyLoaderCalls, 1);
    assert.equal(projectLookupCalls, 0);
    assert.equal(listObjectCalls, 0);
    assert.equal(atomicPublishCalls, 0);
    assert.equal(galleryUpsertCalls, 0);
    assert.equal(findCommitObservation("commit_capability_verification"), undefined);
    assert.doesNotMatch(JSON.stringify(responsePayload), new RegExp(sentinel));
  });
}

test("edu publish commit observes PUBLISHED reuse without publish side effects", async () => {
  scenario.existingProjectState = "PUBLISHED";
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.reused, true);
  assert.equal(atomicPublishCalls, 0);
  assert.equal(listObjectCalls, 0);
  assert.equal(headObjectCalls, 0);
  assert.equal(galleryUpsertCalls, 0);
  assert.equal(lastProjectInsertPayload, null);
  const observation = recordedOpsEvents.find(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.meta as Record<string, unknown>).classification, "declared_v1");
  assert.equal((observation?.meta as Record<string, unknown>).outcome, "reused");
  const attemptObservation = findCommitObservation("attempt_identity");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).classification, "attempt_v1");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).outcome, "reused");
  const capabilityObservation = findCommitObservation("commit_capability_verification");
  assert.equal((capabilityObservation?.meta as Record<string, unknown>).classification, "valid_v2");
  assert.equal((capabilityObservation?.meta as Record<string, unknown>).outcome, "reused");
  assert.equal(capabilityKeyLoaderCalls, 1);
  assert.equal(capabilityClockCalls, 1);
  assert.equal(capabilityVerifierCalls, 1);
  assert.equal(capabilityPolicyLoaderCalls, 1);
});

test("edu publish commit observes degraded success when gallery correction fails", async () => {
  scenario.galleryWriteFailure = true;
  const response = await handleEduPublishCommit(
    makeRequest(await makeCapabilityCommitPayload()),
    makeCapabilityDependencies({
      loadPublishCapabilityPolicyModeFn: makeCapabilityPolicyLoader("enforce_present"),
    }),
  );
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.equal(responsePayload.ok, true);
  assert.equal(galleryUpsertCalls, 1);
  const observation = recordedOpsEvents.find(
    (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
  );
  assert.equal((observation?.meta as Record<string, unknown>).outcome, "degraded");
  const attemptObservation = findCommitObservation("attempt_identity");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).classification, "attempt_v1");
  assert.equal((attemptObservation?.meta as Record<string, unknown>).outcome, "degraded");
  const capabilityObservation = findCommitObservation("commit_capability_verification");
  assert.equal((capabilityObservation?.meta as Record<string, unknown>).classification, "valid_v2");
  assert.equal((capabilityObservation?.meta as Record<string, unknown>).outcome, "degraded");
  assert.equal(capabilityPolicyLoaderCalls, 1);
});

test("edu publish commit emits no success observation for an in-progress failure", async () => {
  scenario.existingProjectState = "PUBLISHING";
  const response = await handleEduPublishCommit(makeRequest(), deps);
  const responsePayload = await response.json();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(response.status, 409);
  assert.equal(responsePayload.error.code, "PUBLISH_IN_PROGRESS");
  assert.equal(
    recordedOpsEvents.some(
      (event) => (event.meta as Record<string, unknown> | undefined)?.component === "manifest_evidence",
    ),
    false,
  );
  assert.equal(findCommitObservation("attempt_identity"), undefined);
});

test("edu publish commit records safe orphan evidence when DB write fails after R2 success", async () => {
  scenario.dbWriteFailure = true;

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();
  const event = recordedOpsEvents.find((candidate) => candidate.meta && typeof candidate.meta === "object") as
    | { request_id?: string; route?: string; status?: number; meta?: Record<string, unknown> }
    | undefined;

  assert.equal(response.status, 500);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "PUBLISH_FAILED");
  assert.equal(payload.error.message, "publish_failed");
  assert.equal(payload.requestId, "rid-contract");
  assert.doesNotMatch(JSON.stringify(payload), /private-database-secret-sentinel|stack/i);
  assert.equal(atomicPublishCalls, 1);
  assert.equal(event?.request_id, "rid-contract");
  assert.equal(event?.route, "/api/v1/edu/publish/commit");
  assert.equal(event?.status, 500);
  assert.deepEqual(event?.meta, {
    stage: "edu_publish",
    component: "r2_database_boundary",
    result: "failed",
    mapped_reason: "database_write_failed_after_object_store",
    object_write_completed: true,
    orphan_candidate: true,
  });
  assert.doesNotMatch(JSON.stringify(event), /abc123|object[_ ]key|share[_ ]code|private-database-secret-sentinel/i);
});

test("edu publish commit keeps DB failure response when orphan evidence logger rejects", async () => {
  scenario.dbWriteFailure = true;
  const rejectingDeps = { ...deps, recordOpsEventFn: async () => { throw new Error("ops logger down"); } };

  const response = await handleEduPublishCommit(makeRequest(), rejectingDeps);
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.error.code, "PUBLISH_FAILED");
  assert.equal(payload.error.message, "publish_failed");
  assert.equal(payload.requestId, "rid-contract");
});

test("edu publish commit PUBLISH_LIMIT_REACHED includes remaining quota metadata", async () => {
  scenario.publishCount = 7;

  const response = await handleEduPublishCommit(makeRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "PUBLISH_LIMIT_REACHED");
  assert.equal(payload.requestId, "rid-contract");
  assert.equal(payload.remainingQuota, 0);
  assert.equal(payload.countedSuccessesToday, 7);
  assert.equal(typeof payload.quotaKey, "string");
  assert.equal(typeof payload.keyType, "string");
});

test("edu publish commit normalizes free-mode lessonId(0) to null for DB/RPC payloads", async () => {
  const request = new NextRequest(
    new Request("http://localhost/api/v1/edu/publish/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shareCode: "abc123",
        authorName: "학생",
        title: "자유모드",
        lessonId: 0,
        turnstileToken: "token",
        request_id: "rid-contract",
        files: [{ path: "index.html", contentType: "text/html", sizeBytes: 120 }],
      }),
    }),
  );

  const response = await handleEduPublishCommit(request, deps);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(lastProjectInsertPayload?.lesson_id, null);
  assert.equal(lastAtomicPublishPayload?.lesson_id, null);
});


test("edu publish commit uses provided slug for R2 prefix lookup", async () => {
  scenario.missingFile = true;
  const providedSlug = "abc123-493513-p0";

  const request = new NextRequest(
    new Request("http://localhost/api/v1/edu/publish/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: providedSlug,
        shareCode: "abc123",
        authorName: "학생",
        title: "자유모드",
        lessonId: 0,
        turnstileToken: "token",
        request_id: "rid-contract",
        files: [{ path: "index.html", contentType: "text/html", sizeBytes: 120 }],
      }),
    }),
  );

  const response = await handleEduPublishCommit(request, deps);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "FILE_MISSING");
  assert.match(String(payload.meta.checkedKey), new RegExp(`edu/v1/${providedSlug}/`));
  assert.equal(lastListedPrefix, `edu/v1/${providedSlug}/`);
});
