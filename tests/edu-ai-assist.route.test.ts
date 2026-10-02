import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/edu/ai/assist/route";

test("route import is pure and invalid body 400", async () => {
  const res = await POST(new Request("http://localhost/api/edu/ai/assist", { method: "POST", body: "{}" }));
  assert.equal(res.status, 400);
});

test("empty text uses fallback and no secret leak", async () => {
  process.env.OPENAI_API_KEY = "secret-key";
  const res = await POST(new Request("http://localhost/api/edu/ai/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskKind: "explain", studentText: "" }) }));
  assert.equal(res.status, 200);
  const p = await res.json();
  assert.equal(p.ok, true);
  assert.equal(JSON.stringify(p).includes("secret-key"), false);
});
