import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import SharedBoardShell from "@/app/s/[code]/_legacy/SharedBoardShell";
import CardPreviewModal from "@/app/s/[code]/_legacy/CardPreviewModal";
import { updateViewSearchParams } from "@/app/s/[code]/_legacy/ViewSwitcher";
import type { StudentCard } from "@/lib/student/boardModel";
import { resolveSharedBoardView } from "@/lib/boards/resolveSharedBoardView";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";

const demoCard: StudentCard = {
  id: "card-1",
  kind: "note",
  title: "Demo",
  text: "Demo text",
  createdAt: new Date().toISOString(),
  authorLabel: "학생",
};

const demoItem: StudentBoardItem = {
  id: "item-1",
  title: "Demo",
  body: "Demo text",
  kind: "note",
  searchText: "demo text",
  createdAt: new Date().toISOString(),
  author: "학생",
  attachments: [],
};

const demoModel: StudentBoardModel = {
  items: [demoItem],
  pinnedItems: [],
  columns: [{ id: "col-1", title: "게시물", items: [demoItem] }],
};

test("shared board shell renders show marker", () => {
  const router = { replace: () => undefined };
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router as never}>
      <PathnameContext.Provider value="/s/ABC123">
        <SearchParamsContext.Provider value={new URLSearchParams()}>
          <SharedBoardShell title="테스트 보드" model={demoModel} view="gallery" shareCode="ABC123" mode="show" />
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  );

  assert.ok(html.includes("data-page-marker=\"student-show\""));
});

test("shared board default view falls back to wall", () => {
  const resolved = resolveSharedBoardView(null, null);
  assert.equal(resolved, "wall");
});

test("view switcher updates query params", () => {
  const params = new URLSearchParams("view=gallery&tv=1");
  const next = updateViewSearchParams(params, "columns");
  assert.equal(next.get("view"), "columns");
  assert.equal(next.get("tv"), "1");
});

test("preview modal renders content when card is provided", () => {
  const html = renderToStaticMarkup(
    <SearchParamsContext.Provider value={new URLSearchParams()}>
      <CardPreviewModal
        items={[demoCard]}
        activeId={demoCard.id}
        onClose={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        tvMode={false}
      />
    </SearchParamsContext.Provider>,
  );

  assert.ok(html.includes("카드 프리뷰"));
  assert.ok(html.includes(demoCard.text ?? ""));
});
