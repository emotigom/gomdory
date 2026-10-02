const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const scanner = import(pathToFileURL(path.join(process.cwd(), "scripts/duplication/scan.mjs")));
const fixture = path.join(process.cwd(), "app/api/fixture/route.ts");
const keys = async (source) => (await scanner).collectSnakeCaseResponseKeys(source, fixture).map(({ key }) => key);

test("response scan ignores error-code values and adjacent database/log input objects", async () => {
  assert.deepEqual(await keys(`
    const code = disabled ? "billing_disabled" : "checkout_failed";
    db.insert({ user_id: user.id });
    recordOpsEvent({ request_id: requestId });
    return jsonError(code, "message", 503, { requestId });
  `), []);
});

test("response payloads retain nested, quoted, computed-literal and shorthand key detection", async () => {
  assert.deepEqual(await keys(`
    const user_id = "id";
    jsonOk({ user_id, details: { "request_id": 1, ["board_id"]: 2 }, list: [{ wall_id: 3 }] });
    jsonOkWithRequestId({ card_id: 4 }, requestId);
    jsonError("bad_code", "message", 400, { retry_after: 5 });
    jsonErrorWithRequestId("bad_code", "message", requestId, 400, { failure_kind: 6 });
  `), ["user_id", "request_id", "board_id", "wall_id", "card_id", "retry_after", "failure_kind"]);
});

test("local payload aliases, spreads and conditional branches preserve detection outside the old window", async () => {
  assert.deepEqual(await keys(`
    const original = { user_id: 1 };
    const alias = original;
    const list = [{ file_id: 2 }];
    ${"// unrelated spacing\n".repeat(40)}
    jsonOk(flag ? ({ ...alias, list } as const) : { other_id: 3 });
  `), ["user_id", "file_id", "other_id"]);
});

test("lexical shadowing, cycles, comments and response init headers do not invent payload keys", async () => {
  assert.deepEqual(await keys(`
    const payload = { database_key: 1 };
    function handler() { const payload = { requestId: 1 }; return jsonOk(payload); }
    const a = b; const b = a; jsonOk(a);
    // jsonOk({ ignored_key: 1 });
    jsonOk({}, { headers: { header_key: "value" } });
  `), []);
});

test("allowlist identity and source location remain stable; malformed source fails", async () => {
  const { collectSnakeCaseResponseKeys } = await scanner;
  assert.deepEqual(collectSnakeCaseResponseKeys('\njsonOk({ user_id: 1 });', fixture, { snakeCaseResponseKeys: ["app/api/fixture/route.ts::user_id"] }), [
    { file: "app/api/fixture/route.ts", key: "user_id", line: 2, allowed: true },
  ]);
  assert.throws(() => collectSnakeCaseResponseKeys('jsonOk({ user_id: );', fixture), /malformed source/);
});

test("the three observed RC1 release failures are not response DTO keys", async () => {
  for (const file of ["app/api/v1/billing/checkout/handler.ts", "app/api/v1/billing/upgrade-request/handler.ts", "app/api/v1/files/upload/prepare/route.ts"]) {
    assert.deepEqual((await scanner).collectSnakeCaseResponseKeys(fs.readFileSync(file, "utf8"), path.resolve(file)), [], file);
  }
});
