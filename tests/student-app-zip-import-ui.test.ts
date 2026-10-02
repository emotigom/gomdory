import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studentPanel = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");
const teacherInspector = readFileSync(
  "app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector.tsx",
  "utf8",
);

test("student and teacher UI expose ZIP static site import as a secondary flow", () => {
  assert.equal(studentPanel.includes("ZIP 정적 사이트 가져오기"), true);
  assert.equal(studentPanel.includes("ZIP은 제출 전에 풀어서 정적 파일만 검증해요."), true);
  assert.equal(studentPanel.includes("React/Vite/Next.js 빌드는 실행하지 않아요."), true);
  assert.match(studentPanel, /accept="\.zip,application\/zip"/);
  assert.match(studentPanel, /importStudentStaticSiteZip/);

  assert.match(teacherInspector, /ZIP/);
  assert.equal(teacherInspector.includes("index.html, style.css, script.js"), true);
  assert.equal(teacherInspector.includes("my-app/index.html"), true);
  assert.equal(teacherInspector.includes("images/logo.png, assets/data.json"), true);
  assert.match(teacherInspector, /React\/Vite\/Next\.js/);
  assert.match(teacherInspector, /accept="\.zip,application\/zip"/);
  assert.match(teacherInspector, /importStudentStaticSiteZip/);
});

test("ZIP UI reuses manual_files submission and validation APIs", () => {
  assert.match(studentPanel, /source:\s*"manual_files"/);
  assert.match(studentPanel, /apiV1Path\("student-apps\/submit"\)/);
  assert.match(teacherInspector, /runInspectionFromManualFiles\(result\.files\)/);
  assert.match(teacherInspector, /apiV1Path\("dashboard\/student-apps\/validate"\)/);
  assert.match(teacherInspector, /apiV1Path\("dashboard\/student-apps\/store"\)/);
});

test("ZIP libraries are not statically imported by UI or server routes", () => {
  const serverRoutes = [
    "app/api/v1/dashboard/student-apps/store/route.ts",
    "app/api/v1/dashboard/student-apps/validate/route.ts",
    "app/api/v1/dashboard/student-apps/publish/route.ts",
  ].map((file) => readFileSync(file, "utf8"));
  const combined = [studentPanel, teacherInspector, ...serverRoutes].join("\n");
  assert.doesNotMatch(combined, /from\s+["']fflate["']|from\s+["']jszip["']|require\(["']fflate["']\)|require\(["']jszip["']\)/i);
});
