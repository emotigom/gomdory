import type { DemoScenario } from "./demoScenario";

const SCENARIO_PREFIX = "gomdory:demo:scenario:";
const STEP_PREFIX = "gomdory:demo:step:";

function getScenarioKey(boardId: string) {
  return `${SCENARIO_PREFIX}${boardId}`;
}

function getStepKey(boardId: string) {
  return `${STEP_PREFIX}${boardId}`;
}

export function readDemoStepIndex(boardId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStepKey(boardId));
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDemoStepIndex(boardId: string, stepIndex: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStepKey(boardId), String(stepIndex));
  } catch {
    // ignore storage errors
  }
}

export function writeDemoScenario(boardId: string, scenario: DemoScenario) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getScenarioKey(boardId), JSON.stringify(scenario));
  } catch {
    // ignore storage errors
  }
}

export function readDemoScenario(boardId: string): DemoScenario | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getScenarioKey(boardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoScenario;
    if (!parsed || typeof parsed.scenarioId !== "string" || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch {
    return null;
  }
}
