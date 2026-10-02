import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import DemoOverlaySlot from "@/app/s/[code]/present/_components/DemoOverlaySlot";
import { DEMO_SCENARIO } from "@/lib/onboarding/demoScenario";

test("demo overlay renders when demo=1", () => {
  const html = renderToStaticMarkup(
    <DemoOverlaySlot
      demoEnabled
      steps={DEMO_SCENARIO.steps}
      stepIndex={0}
      onNext={() => {}}
    />,
  );

  assert.match(html, /Demo Step/);
  assert.match(html, /Step 1\/3/);
});
