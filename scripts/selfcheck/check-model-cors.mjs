#!/usr/bin/env node

const BASE_URL = "https://models.gomdory.com"; // hardcoded-allow exact model origin probe
const ORIGIN = process.env.CORS_CHECK_ORIGIN ?? "https://gomdory.com"; // hardcoded-allow exact default CORS probe origin
const TARGETS = [
  "/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json",
  "/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/Qwen2.5-0.5B-Instruct-q4f16_1-MLC.wasm",
];

const requests = [
  { label: "HEAD", init: { method: "HEAD" } },
  { label: "GET", init: { method: "GET" } },
  { label: "GET_RANGE", init: { method: "GET", headers: { Range: "bytes=0-0" } } },
];

const read = (res, name) => res.headers.get(name.toLowerCase());
const isAllowedOrigin = (acao) => {
  if (!acao) return false;
  const v = acao.trim().toLowerCase();
  return v === "*" || v === ORIGIN.toLowerCase() || /^https?:\/\//i.test(v);
};

let failed = false;
for (const target of TARGETS) {
  const url = `${BASE_URL}${target}`;
  console.log(`\n# ${url}`);
  for (const req of requests) {
    const headers = new Headers(req.init.headers ?? {});
    headers.set("Origin", ORIGIN);
    const res = await fetch(url, { ...req.init, headers, cache: "no-store" }).catch(() => null);
    if (!res) {
      failed = true;
      console.log(`- ${req.label}: fetch_failed`);
      continue;
    }
    const acao = read(res, "access-control-allow-origin");
    const acam = read(res, "access-control-allow-methods");
    const acah = read(res, "access-control-allow-headers");
    const vary = read(res, "vary");
    const pass = isAllowedOrigin(acao);
    if (!pass) failed = true;
    console.log(
      `- ${req.label}: status=${res.status} ACAO=${acao ?? "-"} ACAM=${acam ?? "-"} ACAH=${acah ?? "-"} Vary=${vary ?? "-"} ${pass ? "OK" : "MISSING_ACAO"}`,
    );
  }
}

if (failed) {
  console.error("\nCORS consistency check failed.");
  process.exit(1);
}

console.log("\nCORS consistency check passed.");
