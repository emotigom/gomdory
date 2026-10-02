import assert from "node:assert/strict";
import test from "node:test";

import { getQuickCreateFailureUi, getQuickCreateSuccessUi } from "@/app/dashboard/_components/DashboardHomeCardsV1";

test("quick create success state maps to single CTA", () => {
  assert.deepEqual(getQuickCreateSuccessUi("done", "board-1"), {
    message: "생성됨 · 보드 열기",
    ctaLabel: "열기",
    ctaHref: "/dashboard/boards/board-1",
  });

  assert.deepEqual(getQuickCreateSuccessUi("publish", "board-2"), {
    message: "생성됨 · 바로 전시 설정",
    ctaLabel: "바로 전시 설정",
    ctaHref: "/dashboard/boards/board-2/publish",
  });
});

test("quick create failure state maps request_id and ops deep link", () => {
  assert.deepEqual(
    getQuickCreateFailureUi(undefined, "req-quick-001"),
    {
      message: "잠시 후 다시 시도",
      requestId: "req-quick-001",
      ctaLabel: "재시도",
      opsAuditHref: "/dashboard/ops/system-jobs?q=req-quick-001#quick-create-audit",
    },
  );

  assert.deepEqual(
    getQuickCreateFailureUi("보드를 생성하지 못했습니다. 잠시 후 다시 시도해주세요. (요청 ID: req-quick-002)"),
    {
      message: "잠시 후 다시 시도",
      requestId: "req-quick-002",
      ctaLabel: "재시도",
      opsAuditHref: "/dashboard/ops/system-jobs?q=req-quick-002#quick-create-audit",
    },
  );
});


test("quick create failure state keeps default ops deep link without request_id", () => {
  assert.deepEqual(
    getQuickCreateFailureUi("일시적인 오류"),
    {
      message: "잠시 후 다시 시도",
      requestId: null,
      ctaLabel: "재시도",
      opsAuditHref: "/dashboard/ops/system-jobs#quick-create-audit",
    },
  );
});
