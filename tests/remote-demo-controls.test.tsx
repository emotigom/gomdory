import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import DemoRemoteControls from "@/app/dashboard/boards/[boardId]/remote/DemoRemoteControls";
import { DEMO_SCENARIO } from "@/lib/onboarding/demoScenario";

test("remote demo controls render when demo=1", () => {
  const html = renderToStaticMarkup(
    <DemoRemoteControls
      demoEnabled
      steps={DEMO_SCENARIO.steps}
      stepIndex={0}
      onNextStep={() => {}}
      onSendAnnouncement={() => {}}
      onCopyStudentLink={() => {}}
      studentUrl="https://gkrry.com/s/abc123"
    />,
  );

  assert.match(html, /다음 단계/);
});
