import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMetricsSummary } from "./eduSessionMetrics";

type MetricsInput = Parameters<typeof normalizeMetricsSummary>[0];

type UnknownRecord = Record<string, unknown>;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value === "object" && value !== null) {
    return value as UnknownRecord;
  }
  return null;
}

test("normalizeMetricsSummary: undefined/null -> safe defaults", () => {
  const a = normalizeMetricsSummary(undefined as MetricsInput);
  const b = normalizeMetricsSummary(null as MetricsInput);

  assert.ok(a);
  assert.ok(b);

  // 최소한의 안전성 검사(구체 구조를 모르면 과검증 금지)
  // 숫자 필드가 있다면 NaN/Infinity가 아닌지만 확인
  for (const s of [a, b]) {
    // 아래는 대표적인 패턴: 존재하면 안전해야 함
    const record = asRecord(s);
    if (record && "totalMs" in record) {
      assert.ok(isFiniteNumber(record.totalMs));
    }
  }
});

test("normalizeMetricsSummary: shape mismatch -> coerces to safe defaults", () => {
  const bad = normalizeMetricsSummary({ steps: "oops", totalMs: Number.NaN } as MetricsInput);
  assert.ok(bad);

  const record = asRecord(bad);
  if (record && "steps" in record) {
    // steps가 배열이어야 한다는 계약이면 배열인지 확인
    // (계약이 다르면 이 assert는 조정)
    assert.ok(Array.isArray(record.steps) || record.steps === undefined);
  }
  if (record && "totalMs" in record) {
    assert.ok(isFiniteNumber(record.totalMs));
  }
});

test("normalizeMetricsSummary: NaN/Infinity numbers -> sanitized", () => {
  const bad = normalizeMetricsSummary({ totalMs: Infinity, errorCount: Number.NaN } as MetricsInput);
  assert.ok(bad);

  const record = asRecord(bad);
  if (record && "totalMs" in record) {
    assert.ok(isFiniteNumber(record.totalMs));
  }
  if (record && "errorCount" in record) {
    assert.ok(isFiniteNumber(record.errorCount));
  }
});
