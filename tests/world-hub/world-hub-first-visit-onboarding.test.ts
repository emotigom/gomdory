import assert from "node:assert/strict";
import test from "node:test";

import {
  WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY,
  resolveWorldHubFirstVisitOnboardingPhase,
} from "@/lib/world-hub/runtime/worldHubFirstVisitOnboarding";

test("first visit starts with expanded onboarding band", () => {
  const phase = resolveWorldHubFirstVisitOnboardingPhase({
    isFirstVisit: true,
    settled: false,
    dismissed: false,
  });

  assert.equal(phase, "expanded");
});

test("settled first visit collapses to compact hint", () => {
  const phase = resolveWorldHubFirstVisitOnboardingPhase({
    isFirstVisit: true,
    settled: true,
    dismissed: false,
  });

  assert.equal(phase, "compact");
});

test("dismissed onboarding is hidden and does not resurface", () => {
  const phase = resolveWorldHubFirstVisitOnboardingPhase({
    isFirstVisit: true,
    settled: false,
    dismissed: true,
  });

  assert.equal(phase, "hidden");
});

test("non-first visit keeps onboarding hidden", () => {
  const phase = resolveWorldHubFirstVisitOnboardingPhase({
    isFirstVisit: false,
    settled: false,
    dismissed: false,
  });

  assert.equal(phase, "hidden");
});

test("first-visit onboarding copy remains concise Korean guidance", () => {
  assert.match(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.title, /숲속 모험 베이스캠프/);
  assert.match(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.body, /여기서 준비하고/);
  assert.equal(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.controls[0], "WASD / 방향키로 이동");
  assert.match(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.controls[1], /가까이 가면/);
  assert.match(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.controls[2], /Enter/);
});
