import test from "node:test";
import assert from "node:assert/strict";

import { isOwnGuestCard } from "@/lib/student/guestCardOwnership";

test("isOwnGuestCard returns true when guest identity matches", () => {
  assert.equal(
    isOwnGuestCard({ authorType: "student", authorClientId: "guest-1" }, "guest-1"),
    true,
  );
});

test("isOwnGuestCard returns false for different guest identity", () => {
  assert.equal(
    isOwnGuestCard({ authorType: "student", authorClientId: "guest-1" }, "guest-2"),
    false,
  );
});

test("isOwnGuestCard does not rely on author name", () => {
  assert.equal(
    isOwnGuestCard({ authorType: "student", authorClientId: "guest-1" }, "guest-2"),
    false,
  );
});

test("isOwnGuestCard returns false when owner identity is missing", () => {
  assert.equal(
    isOwnGuestCard({ authorType: "student", authorClientId: null }, "guest-1"),
    false,
  );
});
