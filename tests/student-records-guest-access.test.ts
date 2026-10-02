import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { STUDENT_RECORDS_GUEST_MAX_STUDENTS, createGuestCookieValue, getStudentRecordsGuestConfig, isValidGuestInviteToken, verifyGuestCookieValue } from "@/lib/student-records/guestAccess";
import { STUDENT_RECORDS_GUEST_ALLOWED_MODELS, STUDENT_RECORDS_GUEST_DEFAULT_MODEL, resolveStudentRecordsGuestModel } from "@/lib/student-records/guestModelPolicy";
import { createStudentRecordsGuestProvider } from "@/lib/student-records/guestProviderFactory";

const env = { STUDENT_RECORDS_GUEST_ENABLED: "true", STUDENT_RECORDS_GUEST_ACCESS_TOKEN: "invite-secret", STUDENT_RECORDS_GUEST_COOKIE_SECRET: "cookie-secret", OPENAI_API_KEY: "api-key", STUDENT_RECORDS_GUEST_MODEL: STUDENT_RECORDS_GUEST_DEFAULT_MODEL };

test("guest invite accepts only the configured token and issues a signed expiring cookie", async () => {
  const config = getStudentRecordsGuestConfig(env);
  assert.equal(await isValidGuestInviteToken("wrong", config), false);
  assert.equal(await isValidGuestInviteToken("invite-secret", config), true);
  const value = await createGuestCookieValue(config, 1_000);
  assert.ok(value);
  assert.equal(await verifyGuestCookieValue(value ?? undefined, config, 1_001), true);
  assert.equal(await verifyGuestCookieValue(value ?? undefined, config, 43_201_001), false);
});

test("guest provider is unavailable without a verified cookie and guest configuration is fail-closed", () => {
  const config = getStudentRecordsGuestConfig(env);
  assert.equal(getStudentRecordsGuestConfig({ ...env, STUDENT_RECORDS_GUEST_MODEL: undefined }).model, STUDENT_RECORDS_GUEST_DEFAULT_MODEL);
  assert.equal(config.model, STUDENT_RECORDS_GUEST_DEFAULT_MODEL);
  assert.equal(getStudentRecordsGuestConfig({ STUDENT_RECORDS_GUEST_ENABLED: "true" }).configurationError, true);
  assert.equal(createStudentRecordsGuestProvider(config, false).constructor.name, "ErrorProvider");
  assert.equal(createStudentRecordsGuestProvider(config, true).constructor.name, "OpenAiStudentRecordProvider");
  assert.equal(STUDENT_RECORDS_GUEST_MAX_STUDENTS, 25);
});

test("guest model policy allows exact approved values and rejects non-exact overrides", () => {
  assert.deepEqual(STUDENT_RECORDS_GUEST_ALLOWED_MODELS, [STUDENT_RECORDS_GUEST_DEFAULT_MODEL]);
  assert.deepEqual(resolveStudentRecordsGuestModel({}), { ok: true, model: STUDENT_RECORDS_GUEST_DEFAULT_MODEL, source: "default" });
  assert.deepEqual(resolveStudentRecordsGuestModel({ STUDENT_RECORDS_GUEST_MODEL: STUDENT_RECORDS_GUEST_DEFAULT_MODEL }), { ok: true, model: STUDENT_RECORDS_GUEST_DEFAULT_MODEL, source: "environment" });
  assert.deepEqual(resolveStudentRecordsGuestModel({ STUDENT_RECORDS_GUEST_MODEL: ` ${STUDENT_RECORDS_GUEST_DEFAULT_MODEL} ` }), { ok: true, model: STUDENT_RECORDS_GUEST_DEFAULT_MODEL, source: "environment" });
  for (const model of [`${STUDENT_RECORDS_GUEST_DEFAULT_MODEL}-preview`, STUDENT_RECORDS_GUEST_DEFAULT_MODEL.toUpperCase(), "definitely-not-approved-model"]) {
    const result = resolveStudentRecordsGuestModel({ STUDENT_RECORDS_GUEST_MODEL: model });
    assert.equal(result.ok, false);
    assert.equal(getStudentRecordsGuestConfig({ ...env, STUDENT_RECORDS_GUEST_MODEL: model }).configurationError, true);
    assert.equal(createStudentRecordsGuestProvider(getStudentRecordsGuestConfig({ ...env, STUDENT_RECORDS_GUEST_MODEL: model }), true).constructor.name, "ErrorProvider");
  }
});

test("guest rate limits check visitor before global and do not reach the provider when limited", () => {
  const root = path.resolve(process.cwd());
  const guestRoute = fs.readFileSync(path.join(root, "app/api/v1/tools/student-records/generate-guest/route.ts"), "utf8");
  const visitorCheck = guestRoute.indexOf("const visitor = await checkRateLimit");
  const visitorLimit = guestRoute.indexOf("if (!visitor.ok)");
  const globalCheck = guestRoute.indexOf("const global = await checkRateLimit");
  const globalLimit = guestRoute.indexOf("if (!global.ok)");
  const providerCall = guestRoute.lastIndexOf("generateStudentRecordBatch");

  assert.ok(visitorCheck >= 0);
  assert.ok(visitorLimit > visitorCheck);
  assert.ok(globalCheck > visitorLimit);
  assert.ok(globalLimit > globalCheck);
  assert.ok(providerCall > globalLimit);
  assert.equal(guestRoute.includes("const [visitor, global] = await Promise.all"), false);
  assert.match(guestRoute, /student-records:guest:visitor:\$\{visitorKey\}.*windowSeconds: 600, limit: 50/);
  assert.match(guestRoute, /student-records:guest:global.*windowSeconds: 86_400, limit: 1_500/);
});

test("guest and authenticated routes preserve separate guards without diagnostic secrets", () => {
  const root = path.resolve(process.cwd());
  const guestRoute = fs.readFileSync(path.join(root, "app/api/v1/tools/student-records/generate-guest/route.ts"), "utf8");
  const authenticatedRoute = fs.readFileSync(path.join(root, "app/api/v1/tools/student-records/generate/route.ts"), "utf8");
  assert.match(guestRoute, /verifyGuestCookieValue/);
  assert.match(guestRoute, /rows\.length > STUDENT_RECORDS_GUEST_MAX_STUDENTS/);
  assert.match(guestRoute, /hashGuestRateLimitSubject/);
  assert.match(authenticatedRoute, /requireUserApi/);
  assert.match(authenticatedRoute, /allowedUserIds\.has/);
  assert.equal(/accessToken|cookieSecret|requestIp\(request\)|parsed\.value/.test(guestRoute.match(/console\.warn\([^\n]+/g)?.join("\n") ?? ""), false);
});
