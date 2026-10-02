import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const turnstile = readFileSync(resolve(root, "lib/turnstile.ts"), "utf8");
const bypass = readFileSync(resolve(root, "lib/auth/turnstileBypass.ts"), "utf8");
assert.match(turnstile, /if \(!secret\)[\s\S]*readTurnstileFailOpen/);
assert.match(turnstile, /siteverify/);
assert.match(bypass, /httpOnly: true[\s\S]*secure: true/);
assert.match(bypass, /timingSafeEqual/);
