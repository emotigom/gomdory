import assert from "node:assert/strict";
import test from "node:test";
import React, { useRef, useState } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import ExamplePromptPopover from "@/app/edu/_components/ExamplePromptPopover";

const findByText = (root: Node, text: string): Element | null => {
  if (root.nodeType === 1 && ((root as Element).textContent ?? "").includes(text)) {
    return root as Element;
  }

  for (const child of Array.from(root.childNodes)) {
    const found = findByText(child, text);
    if (found) return found;
  }

  return null;
};

const setupContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return {
    container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
};

test("ExamplePromptPopover renders in document.body via portal", async () => {
  const { container, cleanup } = setupContainer();

  function Wrapper() {
    const anchorRef = useRef<HTMLButtonElement | null>(null);
    return (
      <div>
        <button ref={anchorRef} type="button">
          예시 열기
        </button>
        <ExamplePromptPopover
          open
          anchorRef={anchorRef}
          prompts={["첫 번째 예시"]}
          isTeacherMode
          onSelect={() => {}}
          onClose={() => {}}
          align="right"
        />
      </div>
    );
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<Wrapper />);
  });

  assert.ok(findByText(document.body, "첫 번째 예시"));
  assert.equal(findByText(container, "첫 번째 예시"), null);

  await act(async () => {
    root.unmount();
  });
  cleanup();
});

test("ExamplePromptPopover opens on click and closes on Escape", async () => {
  const { container, cleanup } = setupContainer();

  function Wrapper() {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement | null>(null);
    return (
      <div>
        <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
          질문 예시
        </button>
        <ExamplePromptPopover
          open={open}
          anchorRef={anchorRef}
          prompts={["두 번째 예시"]}
          isTeacherMode={false}
          onSelect={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      </div>
    );
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<Wrapper />);
  });

  const button = findByText(container, "질문 예시");
  assert.ok(button);

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.ok(findByText(document.body, "두 번째 예시"));

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });

  assert.equal(findByText(document.body, "두 번째 예시"), null);

  await act(async () => {
    root.unmount();
  });
  cleanup();
});
