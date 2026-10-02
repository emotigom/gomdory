import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { useNetworkStatus } from "@/app/dashboard/useNetworkStatus";

function withWindow<T>(windowStub: object, runner: () => T): T {
  const previousWindow = globalThis.window;
  // @ts-expect-error - test stub
  globalThis.window = windowStub;
  try {
    return runner();
  } finally {
    globalThis.window = previousWindow;
  }
}

test("useNetworkStatus reflects navigator.onLine", () => {
  const html = withWindow(
    {
      navigator: { onLine: false },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    () =>
      renderToStaticMarkup(
        createElement(() => {
          const { online } = useNetworkStatus();
          return createElement("span", null, online ? "online" : "offline");
        }),
      ),
  );

  assert.match(html, /offline/);
});
