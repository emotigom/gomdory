import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { generateJoinCode, parseJoinCode } from "../lib/edu/courseware/session/aiCoursewareJoinCode";
import { validateSessionCreateInput } from "../lib/edu/courseware/session/aiCoursewareSessionValidation";

test('join code generator/parser',()=>{ const c=generateJoinCode(); assert.equal(c.length,7); assert.equal(parseJoinCode(' ab12cd3 '),'AB12CD3'); assert.equal(parseJoinCode('abc!'),null);});
test('day validation',()=>{ assert.equal(validateSessionCreateInput(0),null); assert.equal(validateSessionCreateInput(17),null); assert.ok(validateSessionCreateInput(1));});
test('route markers and manual collector preserved',()=>{ const join=fs.readFileSync('app/edu/lesson/join/CoursewareSessionJoinClient.tsx','utf8'); assert.match(join,/data-courseware-session-join="ai-courseware-session-join"/); const teacher=fs.readFileSync('app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx','utf8'); assert.match(teacher,/학생 발표 링크 모음/); assert.doesNotMatch(join,/dangerouslySetInnerHTML/);});
