import assert from "node:assert/strict";
import test from "node:test";

import {
  getRequestHost,
  getRequestOrigin,
  getRequestProto,
  parseForwardedHost,
  resolveProto,
} from "@/lib/http/requestHost";

test("x-forwarded-host uses the first entry", async () => {
  const headerList = new Headers({
    "x-forwarded-host": "a.com, b.com",
    host: "ignored.example.com",
  });

  const host = await getRequestHost(headerList);

  assert.equal(host, "a.com");
});

test("missing x-forwarded-proto defaults to https", async () => {
  const headerList = new Headers({
    host: "example.com",
  });

  const proto = await getRequestProto(headerList);

  assert.equal(proto, "https");
});

test("parseForwardedHost returns the first entry", () => {
  assert.equal(parseForwardedHost("a.com, b.com"), "a.com");
});

test("resolveProto defaults to https", () => {
  assert.equal(resolveProto(undefined), "https");
});

test("origin uses forwarded proto and host", async () => {
  const headerList = new Headers({
    host: "gkrry.com",
    "x-forwarded-proto": "https",
  });

  const origin = await getRequestOrigin(headerList);

  assert.equal(origin, "https://gkrry.com");
});

test("x-forwarded-proto takes precedence over cf-visitor", async () => {
  const headerList = new Headers({
    host: "gomdory.com",
    "x-forwarded-proto": "https",
    "cf-visitor": JSON.stringify({ scheme: "http" }),
  });

  const origin = await getRequestOrigin(headerList);

  assert.equal(origin, "https://gomdory.com");
});

test("origin normalizes forwarded host casing", async () => {
  const headerList = new Headers({
    "x-forwarded-host": "WWW.GOMDORY.COM",
    "x-forwarded-proto": "https",
  });

  const origin = await getRequestOrigin(headerList);

  assert.equal(origin, "https://www.gomdory.com");
});

test("cf-visitor header influences proto", async () => {
  const headerList = new Headers({
    host: "www.gomdory.com",
    "cf-visitor": JSON.stringify({ scheme: "http" }),
  });

  const proto = await getRequestProto(headerList);

  assert.equal(proto, "http");
});

test("origin falls back to https when headers are empty", async () => {
  const origin = await getRequestOrigin(new Headers());

  assert.equal(origin, "https://");
});
