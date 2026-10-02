import assert from "node:assert/strict";
import test from "node:test";

import { createLaunchpadHotkeyHandler } from "@/app/dashboard/classes/[classId]/launch/useLaunchpadHotkeys";

test("launchpad hotkey toggles QR on Q press", () => {
  let toggled = 0;
  const handler = createLaunchpadHotkeyHandler({
    onToggleSession: () => {},
    onCopyLink: () => {},
    onToggleQr: () => {
      toggled += 1;
    },
    onOpenHud: () => {},
    onOpenRemote: () => {},
  });

  handler({ key: "q", target: null, preventDefault: () => undefined } as KeyboardEvent);

  assert.equal(toggled, 1);
});

test("launchpad hotkey ignores editable targets", () => {
  let copied = 0;
  const handler = createLaunchpadHotkeyHandler({
    onToggleSession: () => {},
    onCopyLink: () => {
      copied += 1;
    },
    onToggleQr: () => {},
    onOpenHud: () => {},
    onOpenRemote: () => {},
  });

  const inputTarget = { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget;

  handler({ key: "l", target: inputTarget, preventDefault: () => undefined } as KeyboardEvent);

  assert.equal(copied, 0);
});
