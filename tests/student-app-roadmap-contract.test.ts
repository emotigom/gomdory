import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roadmap = readFileSync("docs/student-app-deployment-roadmap.md", "utf8");
const staticSample = readFileSync("docs/student-app-static-sample.md", "utf8");

test("roadmap documents Level 1 static HTML/CSS/JS contract", () => {
  for (const text of [
    "Level 1: Static HTML/CSS/JS app deploy",
    'Level 1 accepts `source: "manual_files"` only.',
    "`index.html` at the normalized app root",
    "CSS files such as `style.css`",
    "JS files such as `script.js`",
    "Validated total app size: 10 MiB",
    "Validated file count: 100 files",
  ]) {
    assert.equal(roadmap.includes(text), true);
  }
});

test("roadmap explicitly closes SSR OpenNext and source execution", () => {
  for (const text of [
    "Next.js SSR/OpenNext user source deployment is not supported now.",
    "User-provided `package.json` dependency install",
    "`npm install`, `pnpm install`, `vite build`, `next build`",
    "User code running inside the Gomdory Worker or server process",
    "Level 5 must use new build/deploy APIs and schema",
  ]) {
    assert.equal(roadmap.includes(text), true);
  }
});

test("roadmap documents sandbox, Cloudflare, and local Codex workflow", () => {
  for (const text of [
    "Current sandbox allow list: `allow-scripts`.",
    "`allow-same-origin` is intentionally not included.",
    "Cloudflare Worker Size And Bundle Limits",
    "Do not bundle student apps into the main Gomdory Worker.",
    "Create a local git commit after verification.",
    "Do not create a PR from Codex in this local workflow.",
  ]) {
    assert.equal(roadmap.includes(text), true);
  }
});

test("roadmap documents Level 1.5 client-only ZIP static site import", () => {
  for (const text of [
    "Level 1.5: ZIP static site import for simple HTML/CSS/JS sites",
    "`ZIP 정적 사이트 가져오기`",
    "Recommended ZIP structures",
    "my-app/",
    "images/logo.png",
    "assets/data.json",
    "inside one single top-level folder",
    "Mixed top-level folders with no clear root are rejected",
    "Browser/client-side ZIP inspection and extraction only.",
    "Server-side unzip in API routes, server actions, middleware, or storage services.",
    "React/Vite/Next.js source project ZIPs; `vite.config.*` and `next.config.*` are rejected with specific guidance.",
    "`vite.config.*` and `next.config.*` are rejected with specific guidance.",
    "Path traversal (`../`), absolute paths, Windows drive paths, and control characters",
    "ZIP file size and decompressed total size: 10 MiB.",
    "Extracted file count: 100 files.",
    "`docs/student-app-static-sample.md`",
    "Current helper uses a small client-only ZIP parser plus browser/Node `DecompressionStream`",
    "이 브라우저에서는 ZIP 가져오기를 사용할 수 없어요. HTML/CSS/JS를 직접 붙여넣어 주세요.",
    "The normal folder/file direct input flow must remain available regardless of ZIP support.",
    "ZIP libraries such as `fflate` or `jszip` must not be statically imported by server routes.",
    'existing `source: "manual_files"` payload',
    "OpenNext Worker bundle size must be checked after dependency changes",
  ]) {
    assert.equal(roadmap.includes(text), true);
  }
});

test("roadmap documents teacher review and published deployment gallery policy", () => {
  for (const text of [
    "Level 1/1.5 Teacher Review And Gallery Policy",
    "`submitted` means the student uploaded a static app for teacher review.",
    "`needs_fix` means the teacher marked the latest submission as needing changes.",
    "`accepted` means the teacher approved the submission during review.",
    "It still must not appear in the student gallery until the teacher publishes a deployment.",
    "`archived` means the teacher hid or closed the submission.",
    "Published `student_app_deployments` rows with `status = published` and `published_at is not null` are required for student gallery visibility",
    "학생 제출 앱 검토",
    "최신 제출물 보기",
    "수정 필요 표시",
    "갤러리에 공개",
    "공개 해제",
    "Gallery list responses are metadata-only",
    "`app/api/v1/student-apps/gallery/list/route.ts` returns only `student_app_deployments` rows for the current board with `status = published`, `published_at is not null`, and `deleted_at is null`.",
    "`app/api/v1/student-apps/gallery/detail/route.ts` must not return private submission files",
    "Teacher dashboard list/review routes may include review metadata, but they remain teacher-only",
  ]) {
    assert.equal(roadmap.includes(text), true);
  }
});

test("static sample template documents copyable HTML CSS JS structure", () => {
  for (const text of [
    "학생 앱 정적 사이트 샘플",
    "my-app/",
    "index.html",
    "style.css",
    "script.js",
    "images/logo.svg",
    "assets/data.json",
    "외부 API 없이 브라우저 안에서만 동작합니다",
    "package.json",
    "vite.config.ts",
    "next.config.js",
    "node_modules/",
    ".env",
    "100개를 넘는 파일 또는 10MB를 넘는 파일 묶음",
  ]) {
    assert.equal(staticSample.includes(text), true);
  }
});
