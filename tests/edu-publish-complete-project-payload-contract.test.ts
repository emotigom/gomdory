import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  validateEduPublishCompleteProjectPayload,
} from "@/lib/edu/publish/completeProjectPayloadContract";
import { buildPublishQuotaIdentity } from "@/lib/edu/publish/quota";

const PROJECT_ID =
  "00000000-0000-4000-8000-000000000003";
const BOARD_ID =
  "00000000-0000-4000-8000-000000000004";
const USER_ID =
  "00000000-0000-4000-8000-000000000005";
const SLUG = "ab12cd-a1b2c3-p1";
const PUBLIC_ORIGIN = "https://example.com";
const GUEST_QUOTA_KEY = buildPublishQuotaIdentity({
  userId: null,
  shareCode: "ab12cd",
  lessonId: 1,
  authorName: "학생",
}).quotaKey;
const AUTHENTICATED_QUOTA_KEY = `uid:${USER_ID}:ab12cd:p1`;
const VALID_PAYLOAD = {
  projectId: PROJECT_ID,
  slug: SLUG,
  shareCode: "ab12cd",
  lessonId: 1,
  authorName: "학생",
  title: "나의 작품",
  anonId: "anon-123",
  boardId: BOARD_ID,
  expiresAt: "2026-12-24T01:45:00.123456+00:00",
  files: [
    {
      path: "index.html",
      contentType: "text/html",
      sizeBytes: 100,
    },
  ],
  previewUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?preview=1`,
  galleryPreviewUrl: `https://assets.example.com/v1/${SLUG}/thumb.png`,
  publicUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/`,
  classroomUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?classroom=1`,
  requestId: "request-123",
  publishQuotaKey: GUEST_QUOTA_KEY,
};

const OUTPUT_KEYS = [
  "projectId",
  "slug",
  "shareCode",
  "lessonId",
  "authorName",
  "title",
  "anonId",
  "boardId",
  "expiresAt",
  "files",
  "previewUrl",
  "galleryPreviewUrl",
  "publicUrl",
  "classroomUrl",
  "requestId",
  "publishQuotaKey",
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function payloadWith(overrides: Record<string, unknown> = {}) {
  return { ...clone(VALID_PAYLOAD), ...overrides };
}

function payloadForSlug(slug: string, overrides: Record<string, unknown> = {}) {
  return payloadWith({
    slug,
    previewUrl: `${PUBLIC_ORIGIN}/edu/view/${slug}/?preview=1`,
    galleryPreviewUrl: `https://assets.example.com/v1/${slug}/thumb.png`,
    publicUrl: `${PUBLIC_ORIGIN}/edu/view/${slug}/`,
    classroomUrl: `${PUBLIC_ORIGIN}/edu/view/${slug}/?classroom=1`,
    ...overrides,
  });
}

function validResult(value: unknown) {
  const result = validateEduPublishCompleteProjectPayload(value);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected a valid project payload");
  return result.payload;
}

function assertInvalid(value: unknown, reason: string) {
  assert.deepEqual(validateEduPublishCompleteProjectPayload(value), {
    ok: false,
    reason,
  });
}

test("valid payload returns exact normalized keys and copied values", () => {
  const input = payloadWith({
    shareCode: "  AB12CD  ",
    authorName: " 학생 ",
    title: " 나의 작품 ",
    files: [
      {
        path: " index.html ",
        contentType: " text/html ",
        sizeBytes: 100,
      },
    ],
    requestId: " request-123 ",
  });
  const before = clone(input);
  const payload = validResult(input);

  assert.deepEqual(Object.keys(payload), OUTPUT_KEYS);
  assert.equal(payload.projectId, PROJECT_ID);
  assert.equal(payload.shareCode, "ab12cd");
  assert.equal(payload.authorName, "학생");
  assert.equal(payload.title, "나의 작품");
  assert.equal(payload.requestId, "request-123");
  assert.equal(payload.publishQuotaKey, GUEST_QUOTA_KEY);
  assert.deepEqual(payload.files, [
    { path: "index.html", contentType: "text/html", sizeBytes: 100 },
  ]);
  assert.equal(payload.previewUrl, `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?preview=1`);
  assert.equal(payload.publicUrl, `${PUBLIC_ORIGIN}/edu/view/${SLUG}/`);
  assert.equal(payload.classroomUrl, `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?classroom=1`);
  assert.equal(payload.galleryPreviewUrl, `https://assets.example.com/v1/${SLUG}/thumb.png`);
  assert.notStrictEqual(payload, input);
  assert.notStrictEqual(payload.files, input.files);
  assert.notStrictEqual(payload.files[0], input.files[0]);
  assert.deepEqual(input, before);
});

test("guest quota key uses the existing normalized identity helper", () => {
  const input = payloadForSlug("ab12cd-a1b2c3-p1", {
    shareCode: " AB12CD ",
    authorName: "  Student   One  ",
    publishQuotaKey: buildPublishQuotaIdentity({
      userId: null,
      shareCode: "ab12cd",
      lessonId: 1,
      authorName: "Student   One",
    }).quotaKey,
  });

  const payload = validResult(input);
  assert.equal(payload.shareCode, "ab12cd");
  assert.equal(payload.authorName, "Student   One");
  assert.equal(
    payload.publishQuotaKey,
    "guest:ab12cd:p1:nick:student one",
  );
});

test("authenticated quota key validates canonical identity bindings and preserves the exact key", () => {
  const payload = validResult(payloadWith({
    publishQuotaKey: AUTHENTICATED_QUOTA_KEY,
  }));

  assert.equal(payload.publishQuotaKey, AUTHENTICATED_QUOTA_KEY);
  assert.equal(Object.hasOwn(payload, "userId"), false);
});

test("invalid guest quota keys fail closed across identity bindings and formatting", () => {
  for (const publishQuotaKey of [
    "guest:zz12cd:p1:nick:학생",
    "guest:ab12cd:p2:nick:학생",
    "GUEST:ab12cd:p1:nick:학생",
    "guest:ab12cd:p1:nick:학생:extra",
    " guest:ab12cd:p1:nick:학생",
    "guest:ab12cd:p1:nick:학생 ",
    "guest:ab12cd:p1:nick:다른 학생",
  ]) {
    assertInvalid(payloadWith({ publishQuotaKey }), "invalid_quota_key");
  }
});

test("invalid authenticated quota keys reject malformed UUIDs and exact segment mismatches", () => {
  for (const publishQuotaKey of [
    "uid:00000000-0000-4000-8000-00000000000A:ab12cd:p1",
    "uid:not-a-uuid:ab12cd:p1",
    "uid::ab12cd:p1",
    `uid:${USER_ID}:zz12cd:p1`,
    `uid:${USER_ID}:ab12cd:p2`,
    `uid:${USER_ID}:ab12cd:p01`,
    `uid:${USER_ID}:ab12cd:p0`,
    `uid:${USER_ID}:ab12cd:p5`,
    `uid:${USER_ID}:ab12cd:p1:extra`,
    `${USER_ID}:ab12cd:p1`,
    `UID:${USER_ID}:ab12cd:p1`,
  ]) {
    assertInvalid(payloadWith({ publishQuotaKey }), "invalid_quota_key");
  }
});

test("quota key type and exact-key presence are validated separately", () => {
  for (const publishQuotaKey of [
    null,
    undefined,
    1,
    false,
    {},
    [],
    "",
    "   ",
    "\tguest:ab12cd:p1:nick:학생",
    "guest:ab12cd:p1:nick:학생\t",
    "arbitrary-quota-key",
  ]) {
    assertInvalid(payloadWith({ publishQuotaKey }), "invalid_quota_key");
  }

  const missingQuotaKey = { ...VALID_PAYLOAD };
  delete (missingQuotaKey as Partial<typeof VALID_PAYLOAD>).publishQuotaKey;
  assertInvalid(missingQuotaKey, "invalid_payload");
});

test("quota key bindings follow guest author identity but not authenticated author display", () => {
  assertInvalid(
    payloadWith({ authorName: "다른 학생" }),
    "invalid_quota_key",
  );
  assert.equal(
    validResult(payloadWith({
      authorName: "다른 학생",
      publishQuotaKey: AUTHENTICATED_QUOTA_KEY,
    })).publishQuotaKey,
    AUTHENTICATED_QUOTA_KEY,
  );

  assertInvalid(
    payloadForSlug("cd34ef-a1b2c3-p1", { shareCode: "cd34ef" }),
    "invalid_quota_key",
  );
  assertInvalid(
    payloadForSlug("ab12cd-a1b2c3-p2", { lessonId: 2 }),
    "invalid_quota_key",
  );
});

test("payload shape accepts null prototypes but rejects non-plain and exact-key violations", () => {
  const nullPrototype = Object.assign(Object.create(null), VALID_PAYLOAD);
  assert.equal(validResult(nullPrototype).projectId, PROJECT_ID);

  class PayloadInstance {
    projectId = PROJECT_ID;
    slug = SLUG;
    shareCode = "ab12cd";
    lessonId = 1;
    authorName = "학생";
    title = "나의 작품";
    anonId = "anon-123";
    boardId = BOARD_ID;
    expiresAt = VALID_PAYLOAD.expiresAt;
    files = clone(VALID_PAYLOAD.files);
    previewUrl = VALID_PAYLOAD.previewUrl;
    galleryPreviewUrl = VALID_PAYLOAD.galleryPreviewUrl;
    publicUrl = VALID_PAYLOAD.publicUrl;
    classroomUrl = VALID_PAYLOAD.classroomUrl;
    requestId = "request-123";
    publishQuotaKey = VALID_PAYLOAD.publishQuotaKey;
  }

  const missingProject = { ...VALID_PAYLOAD };
  delete (missingProject as Partial<typeof VALID_PAYLOAD>).projectId;
  const missingFiles = { ...VALID_PAYLOAD };
  delete (missingFiles as Partial<typeof VALID_PAYLOAD>).files;

  for (const value of [
    missingProject,
    missingFiles,
    { ...VALID_PAYLOAD, attemptId: "private-attempt" },
    { ...VALID_PAYLOAD, declaredManifestDigest: "private-digest" },
    { ...VALID_PAYLOAD, privateField: "private-value" },
    { ...VALID_PAYLOAD, [Symbol("private")]: "private-symbol" },
    new PayloadInstance(),
    [],
    new Date("2026-12-24T00:00:00Z"),
    null,
    "primitive",
    1,
    true,
    () => VALID_PAYLOAD,
  ]) {
    assertInvalid(value, "invalid_payload");
  }
});

test("project UUID accepts versions 1 through 8 and rejects non-canonical values", () => {
  for (let version = 1; version <= 8; version += 1) {
    const projectId = `00000000-0000-${version}000-8000-000000000003`;
    assert.equal(validResult(payloadWith({ projectId })).projectId, projectId);
  }

  for (const projectId of [
    "ABCDEF12-0000-4000-8000-000000000003",
    "00000000-0000-0000-8000-000000000003",
    "00000000-0000-9000-8000-000000000003",
    "not-a-uuid",
    "",
    1,
    null,
  ]) {
    assertInvalid(payloadWith({ projectId }), "invalid_project");
  }
});

test("share code normalizes case and surrounding whitespace but preserves its contract", () => {
  assert.equal(validResult(payloadWith({ shareCode: "ab12cd" })).shareCode, "ab12cd");
  assert.equal(validResult(payloadWith({ shareCode: " AB12CD " })).shareCode, "ab12cd");

  for (const shareCode of [
    "abc",
    "abcdefghi",
    "dashboard",
    "ab12-cd",
    "ab12_cd",
    "ab12 cd",
    "ab12.cd",
    "공유코드",
    "",
    123456,
    null,
  ]) {
    assertInvalid(payloadWith({ shareCode }), "invalid_share_code");
  }
});

test("lesson and slug validation is bound to the normalized share code and lesson", () => {
  for (let lessonId = 1; lessonId <= 4; lessonId += 1) {
    const slug = `ab12cd-a1b2c3-p${lessonId}`;
    assert.equal(
      validResult(payloadForSlug(slug, {
        lessonId,
        publishQuotaKey: buildPublishQuotaIdentity({
          userId: null,
          shareCode: "ab12cd",
          lessonId,
          authorName: "학생",
        }).quotaKey,
      })).lessonId,
      lessonId,
    );
  }

  for (const lessonId of [0, 5, -1, 1.5, "1", null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInvalid(payloadWith({ lessonId }), "invalid_lesson");
  }

  for (const slug of [
    "ab12cd-a1b2c3-p1-v2",
    "ab12cd-a1b2c3-p1-v200",
  ]) {
    assert.equal(validResult(payloadForSlug(slug)).slug, slug);
  }

  for (const slug of [
    "ab12cd-a1b2c3-p1-v1",
    "ab12cd-a1b2c3-p1-v0",
    "ab12cd-a1b2c3-p1-v201",
    "ab12cd-a1b2c3-p1-v02",
    "ab12cd-a1b2c3-p1-v000",
    "zz12cd-a1b2c3-p1",
    "ab12cd-a1b2c3-p2",
    "AB12CD-a1b2c3-p1",
    "ab12cd-a1b2c3-p1-extra",
    "ab12cd-a1b2c3-p1 ",
    "ab12cd-a1b2c3-p1-",
  ]) {
    assertInvalid(payloadWith({ slug }), "invalid_slug");
  }
});

test("author, title, anonymous identity, board identity, and request ID normalize strictly", () => {
  const payload = validResult(payloadWith({
    authorName: " 학생 ",
    title: " 작품 제목 ",
    anonId: " anon-123 ",
    boardId: BOARD_ID,
    requestId: " request-123 ",
  }));
  assert.equal(payload.authorName, "학생");
  assert.equal(payload.title, "작품 제목");
  assert.equal(payload.anonId, "anon-123");
  assert.equal(payload.boardId, BOARD_ID);
  assert.equal(payload.requestId, "request-123");
  assert.equal(validResult(payloadWith({ anonId: null })).anonId, null);
  assert.equal(validResult(payloadWith({ boardId: null })).boardId, null);

  for (const authorName of ["", "   ", null, 1]) {
    assertInvalid(payloadWith({ authorName }), "invalid_author");
  }
  for (const title of ["", "   ", null, 1]) {
    assertInvalid(payloadWith({ title }), "invalid_title");
  }
  for (const anonId of ["", "   ", 1, false, undefined]) {
    assertInvalid(payloadWith({ anonId }), "invalid_anon");
  }
  for (const boardId of [
    "ABCDEF12-0000-4000-8000-000000000004",
    "not-a-uuid",
    "",
    "   ",
    1,
    undefined,
  ]) {
    assertInvalid(payloadWith({ boardId }), "invalid_board");
  }
  for (const requestId of ["", "   ", null, 1, undefined]) {
    assertInvalid(payloadWith({ requestId }), "invalid_request");
  }
});

test("expiry accepts explicit UTC zones and fractional precision without using the current clock", () => {
  for (const expiresAt of [
    "2026-12-24T01:45:00Z",
    "2026-12-24T01:45:00.123Z",
    "2026-12-24T01:45:00.123456+00:00",
    "2026-12-24T10:45:00.123456+09:00",
  ]) {
    assert.equal(validResult(payloadWith({ expiresAt })).expiresAt, expiresAt);
  }

  for (const expiresAt of [
    "2026-12-24T01:45:00",
    "2026-12-24T01:45:00.123456",
    "not-a-dateZ",
    "2026-12-24T01:45:00+99:00",
    "",
    1,
    null,
  ]) {
    assertInvalid(payloadWith({ expiresAt }), "invalid_expiry");
  }

  const source = readFileSync(
    resolve(process.cwd(), "lib/edu/publish/completeProjectPayloadContract.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /milliseconds\s*%\s*1000/);
});

test("files reuse the existing validator, explicit defaults, order, and copied normalized metadata", () => {
  const multiple = [
    { path: "index.html", contentType: " text/html ", sizeBytes: 100 },
    { path: "styles/main.css", contentType: "text/css", sizeBytes: 200 },
    { path: "app.js", contentType: "application/javascript", sizeBytes: 300 },
  ];
  const result = validResult(payloadWith({ files: multiple }));
  assert.deepEqual(result.files, [
    { path: "index.html", contentType: "text/html", sizeBytes: 100 },
    { path: "styles/main.css", contentType: "text/css", sizeBytes: 200 },
    { path: "app.js", contentType: "application/javascript", sizeBytes: 300 },
  ]);

  const invalidFiles: Array<[unknown, string]> = [
    [[], "empty files"],
    [[{ path: "style.css", contentType: "text/css", sizeBytes: 1 }], "missing index"],
    [[
      { path: "index.html", contentType: "text/html", sizeBytes: 1 },
      { path: "INDEX.HTML", contentType: "text/html", sizeBytes: 1 },
    ], "duplicate path"],
    [[{ path: "index.exe", contentType: "application/octet-stream", sizeBytes: 1 }], "invalid extension"],
    [[{ path: "index.html", contentType: "", sizeBytes: 1 }], "invalid content type"],
    [[{ path: "index.html", contentType: "text/html", sizeBytes: -1 }], "negative size"],
    [[{ path: "index.html", contentType: "text/html", sizeBytes: 1.5 }], "fractional size"],
    [[{ path: "index.html", contentType: "text/html", sizeBytes: Number.MAX_SAFE_INTEGER + 1 }], "unsafe size"],
    [Array.from({ length: 31 }, (_, index) => ({
      path: index === 0 ? "index.html" : `file-${index}.txt`,
      contentType: "text/plain",
      sizeBytes: 0,
    })), "too many files"],
    [[{ path: "index.html", contentType: "text/html", sizeBytes: 2 * 1024 * 1024 + 1 }], "single file too large"],
    [Array.from({ length: 5 }, (_, index) => ({
      path: index === 0 ? "index.html" : `file-${index}.txt`,
      contentType: "text/plain",
      sizeBytes: 2 * 1024 * 1024,
    })), "total too large"],
  ];

  for (const [files, label] of invalidFiles) {
    assertInvalid(payloadWith({ files }), "invalid_files");
    assert.ok(label.length > 0);
  }

  const source = readFileSync(
    resolve(process.cwd(), "lib/edu/publish/completeProjectPayloadContract.ts"),
    "utf8",
  );
  assert.match(source, /validateEduPublishFiles/);
  assert.match(source, /EDU_PUBLISH_DEFAULT_MAX_FILES/);
  assert.match(source, /EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES/);
  assert.match(source, /EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES/);
  assert.doesNotMatch(source, /process\.env/);
});

test("public, preview, and classroom URLs share an origin and exact slug-bound paths", () => {
  assert.equal(validResult(VALID_PAYLOAD).publicUrl, VALID_PAYLOAD.publicUrl);
  assert.equal(
    validResult(payloadWith({
      publicUrl: "https://viewer.example/edu/view/ab12cd-a1b2c3-p1/",
      previewUrl: "https://viewer.example/edu/view/ab12cd-a1b2c3-p1/?preview=1",
      classroomUrl: "https://viewer.example/edu/view/ab12cd-a1b2c3-p1/?classroom=1",
    })).publicUrl,
    "https://viewer.example/edu/view/ab12cd-a1b2c3-p1/",
  );

  const invalidUrls: Array<[Record<string, unknown>, string]> = [
    [{ publicUrl: "https://example.com/wrong/ab12cd-a1b2c3-p1/" }, "wrong public pathname"],
    [{ publicUrl: "https://example.com/edu/view/other-slug/" }, "wrong public slug"],
    [{ previewUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/` }, "missing preview query"],
    [{ previewUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?preview=1&extra=1` }, "extra preview query"],
    [{ classroomUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?preview=1` }, "wrong classroom query"],
    [{ publicUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/?public=1` }, "public query"],
    [{ publicUrl: `${PUBLIC_ORIGIN}/edu/view/${SLUG}/#fragment` }, "public hash"],
    [{ publicUrl: `https://user:password@example.com/edu/view/${SLUG}/` }, "credentials"],
    [{ publicUrl: `javascript:alert(1)` }, "unsafe protocol"],
    [{ publicUrl: "not a url" }, "invalid URL"],
    [{ previewUrl: `https://other.example/edu/view/${SLUG}/?preview=1` }, "preview origin"],
  ];

  for (const [overrides, label] of invalidUrls) {
    const expectedReason = "publicUrl" in overrides
      ? "invalid_public_url"
      : "previewUrl" in overrides
        ? "invalid_preview_url"
        : "invalid_classroom_url";
    assertInvalid(payloadWith(overrides), expectedReason);
    assert.ok(label.length > 0);
  }
});

test("gallery preview URL uses an exact slug-bound thumbnail path on any origin", () => {
  assert.equal(
    validResult(VALID_PAYLOAD).galleryPreviewUrl,
    `https://assets.example.com/v1/${SLUG}/thumb.png`,
  );

  for (const galleryPreviewUrl of [
    `https://assets.example.com/v1/other-slug/thumb.png`,
    `https://assets.example.com/v1/${SLUG}/wrong.png`,
    `https://assets.example.com/v1/${SLUG}/thumb.png?size=small`,
    `https://assets.example.com/v1/${SLUG}/thumb.png#fragment`,
    `ftp://assets.example.com/v1/${SLUG}/thumb.png`,
    "not a url",
  ]) {
    assertInvalid(payloadWith({ galleryPreviewUrl }), "invalid_gallery_url");
  }
});

test("every validation failure is private and returns only ok and reason", () => {
  const cases: Array<[unknown, string]> = [
    [null, "invalid_payload"],
    [payloadWith({ projectId: "private-project-sentinel" }), "invalid_project"],
    [payloadWith({ slug: "private-slug-sentinel" }), "invalid_slug"],
    [payloadWith({ shareCode: "private-share-sentinel" }), "invalid_share_code"],
    [payloadWith({ lessonId: 0 }), "invalid_lesson"],
    [payloadWith({ authorName: { sentinel: "private-author-sentinel" } }), "invalid_author"],
    [payloadWith({ title: "" }), "invalid_title"],
    [payloadWith({ anonId: "" }), "invalid_anon"],
    [payloadWith({ boardId: "private-board-sentinel" }), "invalid_board"],
    [payloadWith({ expiresAt: "private-expiry-sentinel" }), "invalid_expiry"],
    [payloadWith({ files: [{ path: "private-file-sentinel.exe", contentType: "text/plain", sizeBytes: 1 }] }), "invalid_files"],
    [payloadWith({ previewUrl: "https://private-url-sentinel.example/" }), "invalid_preview_url"],
    [payloadWith({ galleryPreviewUrl: "https://private-url-sentinel.example/" }), "invalid_gallery_url"],
    [payloadWith({ publicUrl: "https://private-url-sentinel.example/" }), "invalid_public_url"],
    [payloadWith({ classroomUrl: "https://private-url-sentinel.example/" }), "invalid_classroom_url"],
    [payloadWith({ requestId: { sentinel: "private-request-sentinel" } }), "invalid_request"],
    [payloadWith({ publishQuotaKey: "uid:private-user-sentinel:private-share-sentinel:p1" }), "invalid_quota_key"],
  ];

  for (const [value, reason] of cases) {
    const result = validateEduPublishCompleteProjectPayload(value);
    assert.deepEqual(Object.keys(result).sort(), ["ok", "reason"]);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.doesNotMatch(JSON.stringify(result), /private-(?:project|slug|author|request|file|url|user|quota|share)-sentinel/);
  }
});

test("invalid quota key failures expose no private quota identity values", () => {
  const result = validateEduPublishCompleteProjectPayload(payloadWith({
    publishQuotaKey: "uid:private-user-sentinel:private-share-sentinel:p1",
  }));

  assert.deepEqual(result, { ok: false, reason: "invalid_quota_key" });
  assert.deepEqual(Object.keys(result).sort(), ["ok", "reason"]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-(?:user|quota|author|share)-sentinel/,
  );
});

test("validation is deterministic and output mutation is isolated", () => {
  const input = clone(VALID_PAYLOAD);
  const first = validResult(input);
  const second = validResult(input);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.files, second.files);
  assert.notStrictEqual(first.files[0], second.files[0]);

  first.authorName = "mutated";
  first.publishQuotaKey = "mutated";
  first.files[0]!.path = "mutated.txt";
  first.files.push({ path: "extra.txt", contentType: "text/plain", sizeBytes: 0 });

  const afterMutation = validResult(input);
  assert.equal(afterMutation.authorName, "학생");
  assert.equal(afterMutation.publishQuotaKey, GUEST_QUOTA_KEY);
  assert.deepEqual(afterMutation.files, VALID_PAYLOAD.files);
  assert.deepEqual(input, VALID_PAYLOAD);
});

test("product source remains DB-independent and free of runtime side effects", () => {
  const source = readFileSync(
    resolve(process.cwd(), "lib/edu/publish/completeProjectPayloadContract.ts"),
    "utf8",
  );

  for (const forbidden of [
    "NextRequest",
    "NextResponse",
    "Response",
    "Supabase",
    "createSupabaseAdminClient",
    "edu_atomic_publish_v2",
    "complete_edu_publish_commit_v1",
    "R2",
    "headObject",
    "listObjectKeysV2",
    "recordOpsEvent",
    "Date.now",
    "Math.random",
    "randomUUID",
    "process.env",
    "node:crypto",
    "publish_quota_key",
    "Database",
    "handleEduPublishCommit",
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected source dependency: ${forbidden}`);
  }

  for (const required of [
    "validateEduPublishFiles",
    "EDU_PUBLISH_DEFAULT_MAX_FILES",
    "EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES",
    "EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES",
    "normalizeShareCode",
    "isLikelyShareCode",
    "buildPublishQuotaIdentity",
    "publishQuotaKey",
    "invalid_quota_key",
  ]) {
    assert.equal(source.includes(required), true, `missing source dependency: ${required}`);
  }
});
