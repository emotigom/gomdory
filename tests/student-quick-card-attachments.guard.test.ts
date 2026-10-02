import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("student smart quick card uploads files after card creation and patches safe attachment previews", () => {
  const smartLayer = read("app", "s", "[code]", "_components", "StudentGuestBoardSmartLayer.tsx");
  const studentBoard = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");

  assert.match(smartLayer, /uploadFileToCard\(payload\.cardId, file/);
  assert.match(smartLayer, /routes\.api\.v1\("share", shareCode, "cards", payload\.cardId, "files", "initiate"\)/);
  assert.match(smartLayer, /routes\.api\.v1\("share", shareCode, "files", fileId, "finalize"\)/);
  assert.match(smartLayer, /normalizeUploadContentType\(\{ contentType: file\.type, filename: file\.name \}\)/);
  assert.match(smartLayer, /gom:student-card-attachments-finalized/);
  assert.match(smartLayer, /routes\.api\.v1\("share", shareCode, "files", uploadResult\.fileId, "download"\)/);

  assert.match(studentBoard, /gom:student-card-attachments-finalized/);
  assert.match(studentBoard, /mergeAttachmentPatchIntoColumns/);
  assert.match(studentBoard, /pendingAttachmentPatchesRef/);
  assert.match(studentBoard, /mode="student"/);
  assert.doesNotMatch(`${smartLayer}\n${studentBoard}`, /r2Key|r2_key|uploadUrl|signedUrl|X-Amz-Signature/);
});

test("student quick card preflights files and preserves only valid upload outcomes", () => {
  const smartLayer = read("app", "s", "[code]", "_components", "StudentGuestBoardSmartLayer.tsx");
  const feedback = read("lib", "student", "cardComposerFeedback.mjs");
  const policy = read("lib", "uploads", "cardAttachmentPolicy.ts");
  const ownershipRoute = read("app", "api", "v1", "share", "[code]", "cards", "[cardId]", "route.ts");

  assert.match(smartLayer, /validateCardAttachmentUploadPolicy/);
  assert.match(smartLayer, /preflight\.accepted/);
  assert.match(smartLayer, /preflight\.rejected/);
  assert.match(policy, /unsupported_file_type/);
  assert.match(policy, /file_too_large/);
  assert.match(smartLayer, /uploadFailures\.push/);
  assert.match(smartLayer, /attachments: uploadedAttachments/);
  assert.match(smartLayer, /if \(!text\) \{[\s\S]*"DELETE"/);
  assert.match(smartLayer, /if \(!rolledBack\) \{[\s\S]*"PATCH"/);
  assert.match(feedback, /본문 카드는 유지했어요/);
  assert.match(feedback, /일부 파일을 첨부하지 못했습니다/);
  assert.match(smartLayer, /!composer && composerFeedbackSemantics\(feedback\.kind\)\?\.role === "status"/);
  assert.match(smartLayer, /role="alert"/);
  assert.match(ownershipRoute, /row\.authorClientId !== clientId/);
  assert.doesNotMatch(smartLayer, /r2Key|r2_key|uploadUrl|signedUrl|X-Amz-Signature/);
});

test("student quick card keeps its submit footer visible while composer content scrolls", () => {
  const smartLayer = read("app", "s", "[code]", "_components", "StudentGuestBoardSmartLayer.tsx");

  assert.match(smartLayer, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(smartLayer, /maxHeight: `calc\(100dvh - \$\{state\.y\}px - max\(12px, env\(safe-area-inset-bottom\)\)\)`/);
  assert.match(smartLayer, /data-smart-student-composer-body="true"[\s\S]*?min-h-0 flex-1 overflow-y-auto/);
  assert.match(smartLayer, /data-smart-student-composer-body="true"[\s\S]*?files\.map\([\s\S]*?<TurnstileWidget/);
  assert.match(smartLayer, /data-smart-student-composer-footer="true"[\s\S]*?shrink-0[\s\S]*?"카드 작성"/);
  assert.match(smartLayer, /files\.map\([\s\S]*?setFiles\(\(prev\) => prev\.filter/);
});
