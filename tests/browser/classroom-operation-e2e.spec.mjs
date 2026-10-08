import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.CLASSROOM_E2E_BASE_URL;
const token = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const telemetryPath = process.env.CLASSROOM_E2E_TELEMETRY_PATH;
const screenshotDir = process.env.CLASSROOM_E2E_SCREENSHOT_DIR;
const boardId = "00000000-0000-4000-8000-0000000000ba";
const wallId = "00000000-0000-4000-8000-0000000000bc";
const statePath = "/api/q2/browser/multi-user-polling-fixture/state";
const auth = { "x-q2-browser-fixture-token": token };
const telemetry = {
  contexts: [],
  scenarios: {},
  transitions: [],
  requests: [],
  console: [],
  pageErrors: [],
  failedRequests: [],
  duplicateKeyWarnings: [],
  clientOpsLogs: [],
  blockedExternalRequests: [],
  friction: {},
};

function now() {
  return Date.now();
}

function recordTransition(name, startedAt, details = {}) {
  telemetry.transitions.push({ name, durationMs: now() - startedAt, ...details });
}

function recordPage(page, label) {
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === base) {
      telemetry.requests.push({
        label,
        method: response.request().method(),
        path: url.pathname,
        status: response.status(),
      });
    }
  });
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") telemetry.console.push({ label, type: message.type(), text });
    if (/hydration|server rendered HTML/i.test(text)) {
      telemetry.console.push({ label, type: "hydration", text });
    }
    if (/unique.*key|duplicate.*key/i.test(text)) telemetry.duplicateKeyWarnings.push({ label, text });
  });
  page.on("pageerror", (error) => telemetry.pageErrors.push({ label, message: error.message }));
  page.on("requestfailed", (request) => telemetry.failedRequests.push({
    label,
    path: new URL(request.url()).pathname,
    failure: request.failure()?.errorText ?? "unknown",
  }));
}

async function allow(context, label) {
  telemetry.contexts.push(label);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base) {
      if (label === "teacher" && url.pathname === "/api/v1/me/ui-prefs") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ classPrefs: {} }),
        });
      }
      if (label === "teacher" && url.pathname === "/api/v1/dashboard/student-apps/session") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, session: null }),
        });
      }
      if (url.pathname === "/api/v1/ops/log") {
        const request = route.request();
        let payload = null;
        try {
          payload = request.postDataJSON();
        } catch {
          payload = null;
        }
        const message = typeof payload?.message === "string" ? payload.message : null;
        telemetry.clientOpsLogs.push({
          label,
          message,
          expected: message === "slow_ui",
        });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, requestId: null, reasons: [] }),
        });
      }
      return route.continue({
        headers: {
          ...route.request().headers(),
          ...auth,
          "x-q2-browser-client-label": label,
        },
      });
    }
    telemetry.blockedExternalRequests.push({
      label,
      method: route.request().method(),
      url: url.origin + url.pathname,
    });
    return route.fulfill({ status: 204, body: "" });
  });
}

async function reset(page) {
  const response = await page.request.post(
    `${base}/api/q2/browser/multi-user-polling-fixture/reset`,
    { headers: auth },
  );
  expect(response.status()).toBe(200);
}

async function snapshot(page) {
  const response = await page.request.get(
    `${base}/api/q2/browser/multi-user-polling-fixture/snapshot`,
    { headers: auth },
  );
  expect(response.status()).toBe(200);
  return response.json();
}

async function setClassState(page, classState) {
  const response = await page.request.post(`${base}${statePath}`, {
    headers: auth,
    data: { classState },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function openStudent(page) {
  await page.goto(`${base}/s/q2b10a`);
  const smartLayer = page.getByTestId("student-smart-layer");
  await expect(smartLayer).toBeVisible();
  await expect(smartLayer).toHaveAttribute("data-compose-handler-ready", "true");
}

async function openComposer(page) {
  await page.keyboard.press("n");
  const field = page.getByTestId("student-card-composer-text");
  await expect(field).toBeVisible();
  return field;
}

async function submitTextCard(page, text) {
  const startedAt = now();
  const field = await openComposer(page);
  await field.fill(text);
  await page.getByTestId("student-card-composer-submit").click();
  await expect(field).toHaveCount(0, { timeout: 15_000 });
  recordTransition("student-text-submit", startedAt, { text });
}

async function submitFileCard(page, text, filename) {
  const startedAt = now();
  const field = await openComposer(page);
  await field.fill(text);
  await page.locator('input[type="file"]').last().setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from("gom-clean classroom E2E attachment\n", "utf8"),
  });
  await expect(page.getByText(filename, { exact: false })).toBeVisible();

  const finalizeStartedAt = now();
  const finalizeResponsePromise = waitForStudentFileFinalizeResponse(page);
  await page.getByTestId("student-card-composer-submit").click();
  const finalizeResponse = await finalizeResponsePromise;
  expect(finalizeResponse.status()).toBe(200);

  await expect.poll(async () => {
    const current = await snapshot(page);
    return current.finalizedUploadCount ?? 0;
  }, { timeout: 5_000 }).toBe(1);
  await expect(field).toHaveCount(0, { timeout: 5_000 });

  recordTransition("student-file-finalize", finalizeStartedAt, {
    filename,
    status: finalizeResponse.status(),
  });
  recordTransition("student-file-submit", startedAt, { text, filename });
}

async function waitForCardVisible(page, text, timeout = 12_000) {
  const startedAt = now();
  await expect.poll(
    async () => page.locator("[data-card-id]").filter({ hasText: text }).count(),
    { timeout },
  ).toBe(1);
  return now() - startedAt;
}

async function waitForCardHidden(page, text, timeout = 12_000) {
  const startedAt = now();
  await expect.poll(
    async () => page.locator("[data-card-id]").filter({ hasText: text }).count(),
    { timeout },
  ).toBe(0);
  return now() - startedAt;
}

async function expectStudentFileAttachment(page, cardText, baseName, extension, timeout = 12_000) {
  const card = page.locator("[data-card-id]").filter({ hasText: cardText });
  await expect(card.getByTestId("attachment-filename").filter({ hasText: baseName })).toBeVisible({ timeout });
  await expect(card.locator('[data-attachment-extension-badge="true"]').filter({ hasText: extension })).toBeVisible({ timeout });
}

async function expectTeacherFileAttachment(page, cardText, filename, timeout = 12_000) {
  const card = page.locator("[data-card-id]").filter({ hasText: cardText });
  await expect(card.getByText(filename, { exact: true })).toBeVisible({ timeout });
  await expect(card.getByRole("link", { name: `${filename} 다운로드` })).toBeVisible({ timeout });
}

function waitForStudentSyncResponse(page) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET" &&
      url.pathname === "/api/v1/share/q2b10a/sync" &&
      response.status() === 200;
  });
}

function waitForStudentFileFinalizeResponse(page, timeout = 45_000) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" &&
      /^\/api\/v1\/share\/q2b10a\/files\/[^/]+\/finalize$/.test(url.pathname);
  }, { timeout });
}

async function forceVisibility(page, state) {
  await page.evaluate((next) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => next,
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => next === "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function screenshot(page, name) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

test.afterAll(async () => {
  if (telemetryPath) {
    await fs.writeFile(telemetryPath, `${JSON.stringify(telemetry, null, 2)}\n`);
  }
});

test("canonical classroom operation regression preserves class-end authority and draft safety", async ({ browser }) => {
  test.setTimeout(180_000);
  const studentContext = await browser.newContext();
  const teacherContext = await browser.newContext();

  try {
    await allow(studentContext, "student");
    await allow(teacherContext, "teacher");

    const student = await studentContext.newPage();
    const teacher = await teacherContext.newPage();
    recordPage(student, "student");
    recordPage(teacher, "teacher");

    await reset(student);

    await teacher.goto(`${base}/dashboard/boards/${boardId}/board`);
    await expect(teacher.getByTestId("canonical-board-content")).toBeVisible();
    const teacherDraft = teacher.getByLabel("새 카드 내용").first();
    await teacherDraft.fill("수업 중 교사 초안");

    await openStudent(student);
    telemetry.scenarios.C1 = "PASS";

    await submitTextCard(student, "E2E 학생 텍스트 카드");
    await submitFileCard(student, "E2E 학생 첨부 카드", "classroom-note.txt");

    const teacherTextLatency = await waitForCardVisible(teacher, "E2E 학생 텍스트 카드");
    const teacherFileLatency = await waitForCardVisible(teacher, "E2E 학생 첨부 카드");
    await expectTeacherFileAttachment(teacher, "E2E 학생 첨부 카드", "classroom-note.txt");
    await expect(teacherDraft).toHaveValue("수업 중 교사 초안");
    telemetry.scenarios.C2 = "PASS";
    recordTransition("teacher-convergence", now() - Math.max(teacherTextLatency, teacherFileLatency), {
      textLatencyMs: teacherTextLatency,
      fileLatencyMs: teacherFileLatency,
    });

    await expectStudentFileAttachment(student, "E2E 학생 첨부 카드", "classroom-note", "txt");

    const afterCreate = await snapshot(student);
    expect(afterCreate.createCount).toBe(2);
    expect(afterCreate.attachmentCount).toBe(1);
    expect(afterCreate.finalizedUploadCount).toBe(1);
    telemetry.scenarios.C3 = "PASS";
    await screenshot(student, "01-student-after-submit");
    await screenshot(teacher, "02-teacher-after-convergence");

    await new Promise((resolve) => setTimeout(resolve, 500));
    const beforeVisibleReset = await snapshot(student);
    const pollsBeforeVisibleReset = beforeVisibleReset.pollCounts?.student ?? 0;
    const visibleResetResponse = waitForStudentSyncResponse(student);
    await forceVisibility(student, "visible");
    await visibleResetResponse;
    await expect.poll(async () => {
      const current = await snapshot(student);
      return current.pollCounts?.student ?? 0;
    }, { timeout: 5_000 }).toBeGreaterThan(pollsBeforeVisibleReset);

    const beforeHidden = await snapshot(student);
    const studentPollsBeforeHidden = beforeHidden.pollCounts?.student ?? 0;
    await forceVisibility(student, "hidden");

    const teacherTarget = teacher.locator("[data-card-id]").filter({ hasText: "E2E 학생 텍스트 카드" });
    await teacherTarget.getByRole("button", { name: "카드 메뉴 열기" }).click();
    await teacher.getByRole("menuitem", { name: "학생에게 숨기기" }).click();

    await new Promise((resolve) => setTimeout(resolve, 7_600));
    const whileHidden = await snapshot(student);
    expect(whileHidden.pollCounts?.student ?? 0).toBe(studentPollsBeforeHidden);
    await expect(student.locator("[data-card-id]").filter({ hasText: "E2E 학생 텍스트 카드" })).toHaveCount(1);

    const visibleStartedAt = now();
    await forceVisibility(student, "visible");
    const hideConvergenceMs = await waitForCardHidden(student, "E2E 학생 텍스트 카드", 5_000);
    const afterVisible = await snapshot(student);
    expect(afterVisible.pollCounts?.student ?? 0).toBeGreaterThan(studentPollsBeforeHidden);
    recordTransition("visibility-return-sync", visibleStartedAt, { hideConvergenceMs });

    await teacherTarget.getByRole("button", { name: "카드 메뉴 열기" }).click();
    await teacher.getByRole("menuitem", { name: "학생에게 공개하기" }).click();
    const unhideConvergenceMs = await waitForCardVisible(student, "E2E 학생 텍스트 카드");
    recordTransition("teacher-unhide-convergence", now() - unhideConvergenceMs, { unhideConvergenceMs });

    const afterVisibility = await snapshot(student);
    expect(afterVisibility.hideCount).toBe(1);
    expect(afterVisibility.unhideCount).toBe(1);
    telemetry.scenarios.C4 = "PASS";

    const preEndDraftText = "종료 직전 로컬 초안";
    const preEndComposer = await openComposer(student);
    await preEndComposer.fill(preEndDraftText);

    const beforeEnd = await snapshot(student);
    const pollsBeforeEnd = beforeEnd.pollCounts?.student ?? 0;
    await setClassState(student, "ended");

    const endStateSyncResponse = waitForStudentSyncResponse(student);
    await forceVisibility(student, "visible");
    await endStateSyncResponse;
    await expect.poll(async () => {
      const current = await snapshot(student);
      return current.pollCounts?.student ?? 0;
    }, { timeout: 5_000 }).toBeGreaterThan(pollsBeforeEnd);
    await student.waitForTimeout(100);

    const existingComposer = student.getByTestId("student-card-composer");
    const existingComposerText = student.getByTestId("student-card-composer-text");
    const existingComposerPresentAfterEnd = (await existingComposer.count()) > 0;
    let existingComposerDisabledAfterEnd = false;
    let existingComposerDraftPreserved = false;
    let existingComposerFriendlyLockVisible = false;

    if (existingComposerPresentAfterEnd) {
      existingComposerDisabledAfterEnd = await existingComposerText.isDisabled();
      existingComposerDraftPreserved = (await existingComposerText.inputValue()) === preEndDraftText;
      existingComposerFriendlyLockVisible =
        (await existingComposer.getByText(
          "오늘 수업은 종료되었어요. 다음에 다시 만나요!",
          { exact: true },
        ).count()) > 0;
    }

    await screenshot(student, "03-open-student-after-class-ended-sync");

    if (existingComposerPresentAfterEnd) {
      await existingComposer.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(existingComposer).toHaveCount(0);
    }

    await student.getByRole("button", { name: "상단바 펼치기/접기" }).click();
    const openTabEndedTopbarStatus = student.locator('[data-student-topbar-section="status"]');
    const openTabEndedStatusVisible =
      (await openTabEndedTopbarStatus.count()) === 1 &&
      (await openTabEndedTopbarStatus.textContent())?.includes(
        "오늘 수업은 종료되었어요. 다음에 다시 만나요!",
      ) === true;
    await student.getByRole("button", { name: "상단바 펼치기/접기" }).click();

    await student.keyboard.press("n");
    const postEndNewComposer = student.getByTestId("student-card-composer");
    const postEndNewComposerOpened = (await postEndNewComposer.count()) > 0;
    if (postEndNewComposerOpened) {
      await screenshot(student, "03b-post-end-new-composer-regression");
      await postEndNewComposer.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(postEndNewComposer).toHaveCount(0);
    }

    const runtimeAuthorityConverged =
      openTabEndedStatusVisible &&
      !postEndNewComposerOpened &&
      (
        !existingComposerPresentAfterEnd ||
        (
          existingComposerDisabledAfterEnd &&
          existingComposerDraftPreserved &&
          existingComposerFriendlyLockVisible
        )
      );

    const directGuardResponse = await student.request.post(
      `${base}/api/v1/share/q2b10a/walls/${wallId}/cards`,
      {
        headers: auth,
        data: {
          text: "종료 후 서버 가드 확인",
          clientId: "classroom-regression-server-guard",
        },
      },
    );
    expect(directGuardResponse.status()).toBe(403);

    const endedSnapshot = await snapshot(student);
    expect(endedSnapshot.classState).toBe("ended");
    expect(endedSnapshot.createCount).toBe(2);
    telemetry.friction.runtimeAuthorityAfterClassEnd = {
      reproduced: !runtimeAuthorityConverged,
      syncObservedAfterEnd: true,
      existingComposerPresentAfterEnd,
      existingComposerDisabledAfterEnd,
      existingComposerDraftPreserved,
      existingComposerFriendlyLockVisible,
      openTabEndedStatusVisible,
      postEndNewComposerOpened,
      openTabComposerStillEnabled:
        (existingComposerPresentAfterEnd && !existingComposerDisabledAfterEnd) ||
        postEndNewComposerOpened,
      serverGuardStatus: directGuardResponse.status(),
      serverMutationCountUnchanged: endedSnapshot.createCount === 2,
    };
    telemetry.scenarios.C5 = "PASS";

    await student.reload();
    const reenteredSmartLayer = student.getByTestId("student-smart-layer");
    await expect(reenteredSmartLayer).toBeVisible();
    await expect(reenteredSmartLayer).toHaveAttribute("data-compose-handler-ready", "true");
    await waitForCardVisible(student, "E2E 학생 첨부 카드");
    await expectStudentFileAttachment(student, "E2E 학생 첨부 카드", "classroom-note", "txt");

    await student.keyboard.press("n");
    await expect(student.getByTestId("student-card-composer-text")).toHaveCount(0);
    await student.getByRole("button", { name: "상단바 펼치기/접기" }).click();
    const endedTopbarStatus = student.locator('[data-student-topbar-section="status"]');
    await expect(endedTopbarStatus).toBeVisible();
    await expect(endedTopbarStatus).toContainText("오늘 수업은 종료되었어요. 다음에 다시 만나요!");
    await screenshot(student, "04-student-reentry-ended");

    telemetry.scenarios.C6 = "PASS";
  } finally {
    await Promise.all([studentContext.close(), teacherContext.close()]);
  }
});
