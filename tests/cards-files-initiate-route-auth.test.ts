import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("cards files initiate route forwards trusted auth user id as ownerUserId", () => {
  const source = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  assert.match(source, /createUploadIntentForOwner\(\{[\s\S]*ownerUserId:\s*user\.id/);
});

test("cards files initiate route validates request body before helper call", () => {
  const source = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  assert.match(source, /upload_request_invalid/);
  assert.match(source, /Invalid upload request/);
});

test("cards files initiate route provides stage-specific server-safe error codes", () => {
  const source = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  assert.match(source, /upload_auth_required/);
  assert.match(source, /upload_card_not_found/);
  assert.match(source, /upload_forbidden/);
  assert.match(source, /upload_file_record_failed/);
  assert.match(source, /upload_storage_url_failed/);
  assert.match(source, /error\.stage === "create_storage_upload_url"/);
  assert.match(source, /error\.stage === "build_file_record"/);
  assert.match(source, /lastKnownStage/);
  assert.match(source, /upload_response_failed/);
  assert.match(source, /upload_initiate_unexpected/);
  assert.doesNotMatch(source, /upload_initiate_failed/);
});

test("cards files initiate route accepts browser payload size variants", () => {
  const source = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  assert.match(source, /body\.sizeBytes/);
  assert.match(source, /body\.storedBytes/);
  assert.match(source, /body\.originalSizeBytes/);
});

test("cards files initiate route always includes safe canary headers and stage metadata", () => {
  const source = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  assert.match(source, /x-gom-upload-initiate-version/);
  assert.match(source, /stage-v2/);
  assert.match(source, /x-gom-upload-initiate-route/);
  assert.match(source, /cards-files-initiate/);
  assert.match(source, /error:\s*\{\s*code,\s*message,\s*stage\s*\}/);
});

test("cards files initiate route rejects executable and oversized uploads before storage key build", () => {
  const routeSource = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  const policySource = readFileSync("lib/uploads/cardAttachmentPolicy.ts", "utf8");
  const uiSource = readFileSync("lib/uploads/uploadErrors.ts", "utf8");

  assert.match(routeSource, /validateCardAttachmentUploadPolicy/);
  assert.match(routeSource, /policyError/);
  assert.match(routeSource, /policyRejection\.status/);
  assert.match(policySource, /unsupported_file_type/);
  assert.match(policySource, /file_too_large/);
  assert.match(policySource, /application\/x-msdownload/);
  assert.match(policySource, /application\/vnd\.microsoft\.portable-executable/);
  assert.match(policySource, /"exe"/);
  assert.match(policySource, /"msi"/);
  assert.match(policySource, /"ps1"/);
  assert.match(policySource, /DEFAULT_CARD_ATTACHMENT_MAX_BYTES = 50 \* 1024 \* 1024/);
  assert.doesNotMatch(policySource, /"zip"/);
  assert.match(uiSource, /설치 파일\(\.exe\).*공식 다운로드 링크/);
  assert.match(uiSource, /파일이 너무 큽니다.*드라이브 링크/);
});


test("cards files initiate route uses user-scoped server client (not admin client)", () => {
  const source = readFileSync("app/api/v1/cards/[cardId]/files/initiate/route.ts", "utf8");
  assert.match(source, /createSupabaseServerClient\(\)/);
  assert.doesNotMatch(source, /createSupabaseAdminClient\(\)/);
});

test("upload intent authorization allows explicit board-owner match or board_role/canEditBoard", () => {
  const source = readFileSync("lib/data/files.ts", "utf8");
  assert.match(source, /if \(input\.boardOwnerId === input\.ownerId\)/);
  assert.match(source, /canEditBoard\(normalizedBoardRole\)/);
});

test("upload intent file insert payload includes canonical files columns (owner ids + card id)", () => {
  const source = readFileSync("lib/data/files.ts", "utf8");
  assert.match(source, /card_id:\s*input\.cardId/);
  assert.match(source, /owner_id:\s*input\.ownerId/);
  assert.match(source, /owner_user_id:\s*input\.ownerId/);
  assert.match(source, /mime:\s*input\.contentType/);
  assert.match(source, /original_name:\s*safeFilename/);
});

test("upload intent create_file_row failure logs safe diagnostics", () => {
  const source = readFileSync("lib/data/files.ts", "utf8");
  assert.match(source, /buildCreateFileRowDiagnostics/);
  assert.match(source, /insertColumns/);
  assert.match(source, /possible_rls_insert_policy_denial/);
  assert.match(source, /insertHasMime/);
  assert.match(source, /notNullColumn/);
});
