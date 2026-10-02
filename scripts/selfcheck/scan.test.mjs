import assert from "node:assert/strict";
import test from "node:test";

import { collectRouteMethods } from "./scan.mjs";

test("recognizes async function route handlers, including whitespace variants", () => {
  assert.deepEqual(
    collectRouteMethods(`
      export async function GET() {}
      export   async\n function\n POST() {}
      export async function PUT() {}
      export async function PATCH() {}
      export async function DELETE() {}
      export async function OPTIONS() {}
      export async function HEAD() {}
    `),
    ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
  );
});

test("keeps non-async function and const handler recognition", () => {
  assert.deepEqual(
    collectRouteMethods(`
      export function GET() {}
      export const POST: RouteHandler = withContext(handler);
    `),
    ["GET", "POST"]
  );
});

test("records each supported method once and ignores unsupported names", () => {
  assert.deepEqual(
    collectRouteMethods(`
      export async function GET() {}
      export async function GET() {}
      export function CONNECT() {}
      export const handler = () => {};
    `),
    ["GET"]
  );
});

test("does not treat comments or strings as route handler exports", () => {
  assert.deepEqual(
    collectRouteMethods(`
      // export async function GET() {}
      /* export const POST = handler; */
      const example = "export async function DELETE() {}";
      const template = \`export async function PATCH() {}\`;
      export async function HEAD() {}
    `),
    ["HEAD"]
  );
});
