import assert from "node:assert/strict";
import test from "node:test";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { TemplateCard, TemplateUpgradeModal } from "@/app/dashboard/templates/TemplateGalleryClient";

function findByTestId(root: Node, testId: string): Element | null {
  if (root.nodeType === 1) {
    const attributes = (
      root as unknown as {
        attributes?: Map<string, string>;
      }
    ).attributes;

    if (
      attributes instanceof Map &&
      attributes.get("data-testid") === testId
    ) {
      return root as Element;
    }
  }

  for (const child of Array.from(root.childNodes)) {
    const found = findByTestId(child, testId);
    if (found) return found;
  }

  return null;
}

function containsText(root: Node, expected: string): boolean {
  if (
    typeof root.textContent === "string" &&
    root.textContent.includes(expected)
  ) {
    return true;
  }

  return Array.from(root.childNodes).some((child) =>
    containsText(child, expected),
  );
}

test("pro template card install opens upgrade modal", async () => {
  const originalFocus = HTMLElement.prototype.focus;
  if (typeof originalFocus !== "function") {
    HTMLElement.prototype.focus = function focus() {
      (document as unknown as { activeElement: Element | null }).activeElement = this;
    };
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Wrapper() {
    const [open, setOpen] = useState(false);

    return (
      <>
        <TemplateCard
          template={{
            id: "template-1",
            title: "Pro 템플릿",
            description: null,
            tags: [],
            coverUrl: null,
            installCount: 0,
            createdAt: new Date().toISOString(),
            accessLevel: "pro",
            isFeatured: false,
            featuredRank: null,
          }}
          onPreview={() => {}}
          onInstall={() => {}}
          onUpgrade={() => setOpen(true)}
          locked
        />

        {open ? (
          <TemplateUpgradeModal
            onClose={() => setOpen(false)}
            linkComponent={({ href, className, children }) => (
              <a href={href} className={className}>
                {children}
              </a>
            )}
          />
        ) : null}
      </>
    );
  }

  try {
    await act(async () => {
      root.render(<Wrapper />);
    });

    const button = findByTestId(
      container,
      "template-install-template-1",
    );
    assert.ok(button);

    await act(async () => {
      button.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    assert.equal(
      containsText(container, "Pro 템플릿입니다"),
      true,
    );
    const activeAttributes = (
      document.activeElement as unknown as { attributes?: Map<string, string> }
    )?.attributes;
    assert.equal(activeAttributes?.get("aria-label"), "Pro 안내 닫기");
  } finally {
    await act(async () => {
      root.unmount();
    });
    container.parentNode?.removeChild(container);
    if (typeof originalFocus !== "function") {
      delete (HTMLElement.prototype as unknown as { focus?: () => void }).focus;
    }
  }
});
