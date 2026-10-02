import assert from "node:assert/strict";
import test from "node:test";

test("network guard blocks non-allowlisted outbound requests", async () => {
  await assert.rejects(
    () => fetch("https://example.com"),
    (error: unknown) => {
      const blockedError = error as { code?: string; name?: string; message?: string };
      return (
        blockedError?.code === "TEST_NETWORK_BLOCKED" &&
        blockedError?.name === "TEST_NETWORK_BLOCKED" &&
        blockedError?.message?.includes("https://example.com")
      );
    },
  );
});
