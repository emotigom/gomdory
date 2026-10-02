import "server-only";

import { StudentRecordsProviderError } from "@/lib/student-records/providerErrors";
import type { StudentRecordProvider } from "@/lib/student-records/provider";
import type { ProviderGeneratedRecord, ProviderRecordInput, RecordGenerationOptions } from "@/lib/student-records/contracts";
import { isQ2B9ELlmFixtureEnabled } from "@/lib/q2/browser/studentEntryFixture";

const MODE = "llm-integration-v1";
const AUTHORIZATION_HEADER = "x-q2-browser-fixture-authorized";
type FixtureState = { providerCalls: number; rateLimitChecks: number; piiDetected: boolean; behavior: "success" | "timeout" };

function env(name: string) { return process.env[name]; }
function state(): FixtureState {
  const key = Symbol.for("gomdory.q2.b9.e.llm-integration-store");
  const target = globalThis as typeof globalThis & { [key: symbol]: FixtureState | undefined };
  return target[key] ?? (target[key] = { providerCalls: 0, rateLimitChecks: 0, piiDetected: false, behavior: "success" });
}

export function isQ2B9ELlmFixtureRequest(request: Request) {
  return process.env.NODE_ENV !== "production" && env("Q2_BROWSER_FIXTURE_MODE") === MODE && isQ2B9ELlmFixtureEnabled(request.headers.get(AUTHORIZATION_HEADER));
}

export function resetQ2B9ELlmFixture(behavior: FixtureState["behavior"] = "success") {
  const current = state(); current.providerCalls = 0; current.rateLimitChecks = 0; current.piiDetected = false; current.behavior = behavior;
}

export function q2B9ELlmFixtureSnapshot() { const current = state(); return { providerCalls: current.providerCalls, rateLimitChecks: current.rateLimitChecks, piiDetected: current.piiDetected, behavior: current.behavior }; }

function containsPii(rows: ReadonlyArray<ProviderRecordInput>) {
  return rows.some((row) => /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?<!\d)(?:01[016789]|0[2-6]\d?)[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/.test([row.activity, row.strength, row.attitude, row.observation].join(" ")));
}

class Q2B9ELocalProvider implements StudentRecordProvider {
  async generateBatch(input: { requestId: string; batchId: string; rows: ReadonlyArray<ProviderRecordInput>; options: RecordGenerationOptions }): Promise<ReadonlyArray<ProviderGeneratedRecord>> {
    void input.requestId; void input.batchId; void input.options;
    const current = state(); current.providerCalls += 1; current.piiDetected ||= containsPii(input.rows);
    if (current.behavior === "timeout") throw new StudentRecordsProviderError("PROVIDER_TIMEOUT_UNKNOWN");
    return input.rows.map((row) => ({ rowId: row.rowId, generatedText: "생성형 AI의 기본 원리를 이해하고 수업 활동에 참여한 내용을 자신의 말로 설명하며 핵심 개념을 정리하고 간단한 예시를 바탕으로 학습 내용을 다시 되짚어 봄." }));
  }
}

export function createQ2B9ELlmFixtureProvider(): StudentRecordProvider { return new Q2B9ELocalProvider(); }
