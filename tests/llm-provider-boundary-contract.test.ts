import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const config = readFileSync(resolve(root, "lib/student-records/providerConfig.ts"), "utf8");
const provider = readFileSync(resolve(root, "lib/student-records/openAiProvider.ts"), "utf8");
assert.match(config, /"disabled" \| "mock" \| "openai"/);
assert.match(config, /STUDENT_RECORDS_LLM_TIMEOUT_MS[\s\S]*STUDENT_RECORDS_LLM_MAX_OUTPUT_TOKENS/);
assert.match(config, /STUDENT_RECORDS_OPENAI_ALLOWED_USER_IDS/);
assert.match(provider, /AbortController/);
assert.match(provider, /store: false[\s\S]*max_output_tokens/);
