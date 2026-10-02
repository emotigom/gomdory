import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const boardQuery = fs.readFileSync("lib/website-studio/websiteStudioPublishedBoard.ts", "utf8");
const teacher = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");
const unpublishApi = fs.readFileSync("app/api/website-studio/publish/[id]/unpublish/route.ts", "utf8");

test("teacher gallery query is board scoped and excludes unpublished sites", () => {
  assert.match(boardQuery, /\.eq\("status", "published"\)/);
  assert.match(boardQuery, /\.eq\("origin_board_id", normalizedBoardId\)/);
});

test("teacher gallery exposes safe fields and hides snapshot/private fields", () => {
  assert.match(boardQuery, /select\("id,title,slug,template_id,origin_day,published_at,updated_at,safety_status"\)/);
  assert.doesNotMatch(boardQuery, /select\([^\)]*(owner_user_id|full_document|prompt|response|email)/i);
});

test("teacher gallery uses canonical share URL and handles unpublish requestId", () => {
  assert.match(teacher, /import \{ CANONICAL_BASE_URL \} from "@\/lib\/http\/siteConfig"/);
  assert.match(teacher, /\$\{CANONICAL_BASE_URL\}\/w\/\$\{slug\}/);
  assert.match(fs.readFileSync("lib/http/siteConfig.ts", "utf8"), /DEFAULT_CANONICAL_URL\s*=\s*["']https:\/\/www\.gomdory\.com["']/);
  assert.match(teacher, /payload\?\.requestId/);
  assert.match(unpublishApi, /requestId/);
});
