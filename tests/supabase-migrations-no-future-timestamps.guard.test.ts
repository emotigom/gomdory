import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";

const migrationsDir = "supabase/migrations";

const futureDatedMigrations = readdirSync(migrationsDir).filter((file) => /^202[7-9]\d{10}_.*\.sql$/.test(file));

test("supabase migrations must not use future-dated timestamps", () => {
  assert.deepEqual(
    futureDatedMigrations,
    [],
    `found future-dated migration files: ${futureDatedMigrations.join(", ")}`,
  );
});
