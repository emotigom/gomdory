import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("qr component and teacher gallery use gomdory public url only", () => {
  const qr = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioQrCode.tsx", "utf8");
  const teacher = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");
  assert.match(qr, /QRCode\.toDataURL/);
  assert.match(teacher, /CANONICAL_BASE_URL/);
  assert.match(teacher, /`\$\{CANONICAL_BASE_URL\}\/w\/\$\{slug\}`/);
  assert.match(teacher, /QR 보기/);
  assert.doesNotMatch(teacher, /owner email|prompt|response/i);
});
