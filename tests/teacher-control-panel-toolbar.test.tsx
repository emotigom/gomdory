import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import TeacherControlPanel from "@/app/edu/_components/TeacherControlPanel";
import type { LessonLock } from "@/lib/edu/lesson/lessonLock";
import { normalizeMetricsSummary } from "@/lib/edu/telemetry/eduSessionMetrics";

const createLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  } as Storage;
};

const setupWindow = () => {
  const localStorage = createLocalStorage();
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  globalThis.window = { localStorage } as Window & typeof globalThis;
  globalThis.localStorage = localStorage;
  return {
    localStorage,
    cleanup: () => {
      globalThis.window = previousWindow;
      globalThis.localStorage = previousStorage as Storage;
    },
  };
};

const lessonLock: LessonLock = { enabled: false, lessonId: "P1", version: 1 };
const metricsSummary = normalizeMetricsSummary();

const renderPanel = () =>
  renderToStaticMarkup(
    <TeacherControlPanel
      isTeacherMode
      lessonLock={lessonLock}
      metricsSummary={metricsSummary}
      onSetLessonId={() => {}}
      onToggleLessonLock={() => {}}
      onHardReset={() => {}}
      onResetEngine={() => {}}
      onAbortAll={() => {}}
      onExportDiagnostics={() => {}}
      onWarmupWebLLM={() => {}}
      autosaveEnabled={false}
      onToggleAutosave={() => {}}
      undoEnabled={false}
      redoEnabled={false}
      onUndo={() => {}}
      onRedo={() => {}}
      presentationMode={false}
      onTogglePresentationMode={() => {}}
      status={{ coachRunning: false, genRunning: false, dirty: false }}
    />,
  );

test("TeacherControlPanel defaults to collapsed toolbar", () => {
  const { cleanup } = setupWindow();
  const html = renderPanel();

  assert.match(html, /data-toolbar-expanded="false"/);
  assert.match(html, /도구 펼치기/);

  cleanup();
});

test("TeacherControlPanel reads toolbar state from localStorage", () => {
  const { localStorage, cleanup } = setupWindow();
  localStorage.setItem("coach.toolbarExpanded", "true");

  const html = renderPanel();

  assert.match(html, /data-toolbar-expanded="true"/);
  assert.match(html, /도구 접기/);

  cleanup();
});
