import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.Q2_B4_BASE_URL;
const fixtureToken = process.env.Q2_BROWSER_FIXTURE_TOKEN;
const validCode = process.env.Q2_B4_VALID_CODE;
const invalidCode = process.env.Q2_B4_INVALID_CODE;
const boardTitle = process.env.Q2_B4_BOARD_TITLE;
const outputDir = process.env.Q2_BROWSER_OUTPUT_DIR;
const warmupOnly = process.env.Q2_B4_WARMUP_ONLY === '1';
const recoveryOnly = process.env.Q2_B4_RECOVERY_ONLY === '1';
const q4ErrorSemantics = process.env.Q4_STUDENT_ENTRY_ERROR_SEMANTICS === '1';

if (!baseURL || !fixtureToken || !validCode || !invalidCode || !boardTitle || !outputDir) {
  throw new Error('Q2-B4 browser environment is incomplete');
}

const fixtureFontHost = 'cdn.jsdelivr.net';
const fixtureFontPath = '/gh/sunn-us/SUIT/fonts/static/woff2/SUIT.css';
const allowedDevelopmentWarning = 'ReactDOM.useFormState has been renamed to React.useActionState. Please update %s to use React.useActionState. WallColumn';
const telemetryByTestId = new Map();
const scenarioReadinessByTestId = new Map();
const recoveryDiagnosticsByTestId = new Map();
const fixtureIngressCleanupByTestId = new Map();

function normalizeMessage(message) {
  return message.replace(/\s+/g, ' ').trim();
}

function isFixtureFontRequest(request, url) {
  return url.hostname === fixtureFontHost && url.pathname === fixtureFontPath && request.resourceType() === 'stylesheet';
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

function isSameLoopbackServer(url, configuredBaseURL) {
  const candidate = new URL(url);
  const base = new URL(configuredBaseURL);
  return candidate.protocol === base.protocol && candidate.port === base.port &&
    isLoopbackHostname(candidate.hostname) && isLoopbackHostname(base.hostname);
}

function isStudentFixturePath(pathname) {
  return pathname === '/s' || pathname === '/s/' || pathname.startsWith('/s/');
}

async function expectStudentBoardURL(page, { baseURL: configuredBaseURL, normalizedCode }) {
  await expect.poll(() => {
    const actual = new URL(page.url());
    const base = new URL(configuredBaseURL);
    return {
      sameProtocol: actual.protocol === base.protocol,
      samePort: actual.port === base.port,
      loopbackHost: isLoopbackHostname(actual.hostname) && isLoopbackHostname(base.hostname),
      pathname: actual.pathname,
      search: actual.search,
      hash: actual.hash,
    };
  }).toEqual({
    sameProtocol: true,
    samePort: true,
    loopbackHost: true,
    pathname: `/s/${normalizedCode}`,
    search: '',
    hash: '',
  });
}

function postDiagnostic(request, configuredBaseURL, configuredFixtureToken, { routeHandlerInvoked = false, fixtureHeaderAttached = false } = {}) {
  const url = new URL(request.url());
  if (!isSameLoopbackServer(request.url(), configuredBaseURL) || url.pathname !== '/s/enter' || request.method() !== 'POST') return null;
  const headers = request.headers();
  const contentType = headers['content-type'] || '';
  const fields = new URLSearchParams(request.postData() || '');
  const codes = fields.getAll('code');
  const submittedCode = codes[0] || '';
  return { sequence: 0, routeHandlerInvoked, sameLoopbackServer: true, pathnameIsEnter: true, methodIsPost: true, contentTypeClass: contentType.startsWith('application/x-www-form-urlencoded') ? 'form-urlencoded' : 'other', codeFieldCount: codes.length, submittedCodeLength: submittedCode.length, submittedCodeMatchesExpectedInvalid: submittedCode === invalidCode, submittedCodeMatchesFixtureValid: submittedCode === validCode, submittedCodeClientValid: /^[a-z0-9]{4,8}$/.test(submittedCode), turnstileFieldPresent: fields.has('turnstileToken'), fixtureHeaderAttached };
}

function locationClass(location, configuredBaseURL) {
  if (!location) return 'missing';
  const target = new URL(location, configuredBaseURL);
  if (isSameLoopbackServer(target, configuredBaseURL) && target.pathname === `/s/${validCode}` && !target.search && !target.hash) return 'canonical-board';
  if (isSameLoopbackServer(target, configuredBaseURL) && target.pathname === '/s' && target.searchParams.get('error') === 'invalid_code') return 'invalid-code';
  return 'other';
}

function recordRecoveryPostResponse(recoveryDiagnostics, response, configuredBaseURL) {
  const request = response.request();
  const diagnostic = recoveryDiagnostics.posts.find((item) => item.sequence === recoveryDiagnostics.responses.length + 1 && new URL(request.url()).pathname === '/s/enter' && request.method() === 'POST');
  if (!diagnostic) return;
  const location = response.headers().location;
  recoveryDiagnostics.responses.push({ sequence: diagnostic.sequence, responseStatus: response.status(), locationPresent: Boolean(location), locationClass: locationClass(location, configuredBaseURL), locationPathMatchesCanonical: locationClass(location, configuredBaseURL) === 'canonical-board', locationHasInvalidError: locationClass(location, configuredBaseURL) === 'invalid-code' });
}

async function installStudentFixtureIngress(context, { page, baseURL: configuredBaseURL, fixtureToken: configuredFixtureToken, telemetry, recoveryDiagnostics }) {
  if (recoveryDiagnostics) {
    recoveryDiagnostics.recordPostResponse = (response) => recordRecoveryPostResponse(recoveryDiagnostics, response, configuredBaseURL);
  }
  const handler = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const sameLocalServer = isSameLoopbackServer(request.url(), configuredBaseURL);
    const isStudentRequest = sameLocalServer && isStudentFixturePath(url.pathname);

    if (isStudentRequest) {
      const diagnostic = recoveryDiagnostics && postDiagnostic(request, configuredBaseURL, configuredFixtureToken, {
        routeHandlerInvoked: true,
        fixtureHeaderAttached: true,
      });
      if (diagnostic) {
        diagnostic.sequence = recoveryDiagnostics.posts.length + 1;
        recoveryDiagnostics.posts.push(diagnostic);
      }
      await route.continue({
        headers: {
          ...request.headers(),
          'x-q2-browser-fixture-token': configuredFixtureToken,
        },
      });
      return;
    }

    if (sameLocalServer || url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
      return;
    }

    if (isFixtureFontRequest(request, url)) {
      telemetry.fulfilledFixtureFontRequests.push({ host: url.hostname, path: url.pathname, resourceType: request.resourceType() });
      await route.fulfill({ status: 200, contentType: 'text/css', body: '/* Q2 browser fixture: remote font disabled */' });
      return;
    }

    telemetry.unexpectedExternalRequests.push({ url: request.url(), resourceType: request.resourceType() });
    await route.abort('blockedbyclient');
  };
  await context.route('**/*', handler);
  return async () => {
    await context.unroute('**/*', handler);
  };
}

function installTelemetry(page) {
  const telemetry = { consoleErrors: [], allowedDevelopmentWarnings: [], pageErrors: [], failedRequests: [], unexpectedResponses: [], fulfilledFixtureFontRequests: [], unexpectedExternalRequests: [] };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = normalizeMessage(message.text());
    if (text === allowedDevelopmentWarning) telemetry.allowedDevelopmentWarnings.push(text);
    else telemetry.consoleErrors.push(text);
  });
  page.on('pageerror', (error) => telemetry.pageErrors.push(error.message));
  page.on('requestfailed', (request) => telemetry.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || null }));
  page.on('response', (response) => {
    if (response.status() >= 400) telemetry.unexpectedResponses.push({ url: response.url(), status: response.status() });
  });
  return telemetry;
}

function assertCleanTelemetry(telemetry) {
  expect(telemetry.consoleErrors).toEqual([]);
  expect(telemetry.pageErrors).toEqual([]);
  expect(telemetry.failedRequests).toEqual([]);
  expect(telemetry.unexpectedResponses).toEqual([]);
  expect(telemetry.unexpectedExternalRequests).toEqual([]);
  expect(telemetry.allowedDevelopmentWarnings.every((warning) => warning === allowedDevelopmentWarning)).toBe(true);
  expect(telemetry.fulfilledFixtureFontRequests.every((request) => request.host === fixtureFontHost && request.path === fixtureFontPath && request.resourceType === 'stylesheet')).toBe(true);
}

async function assertBoard(page) {
  await expect(page.getByTestId('student-board-root')).toBeVisible();
  await expect(page.getByText(boardTitle, { exact: true })).toBeVisible();
  await expect(page.getByTestId('student-board-section')).toHaveCount(1);
  await expect(page.getByTestId('teacher-only-control')).toHaveCount(0);
}

async function waitForStudentEntryReady(page) {
  await expect(page.getByTestId('student-entry-fixture-authorized')).toBeVisible();

  const fixtureForm = page.locator('form[data-q2-fixture-bypass="true"]');
  await expect(fixtureForm).toHaveCount(1);
  await expect(fixtureForm).toHaveAttribute('data-q2-client-hydrated', 'true');
  await expect(fixtureForm).toHaveAttribute('data-q2-fixture-bypass', 'true');

  const input = page.getByTestId('student-code-input');
  const submit = page.getByTestId('student-code-submit');
  await expect(input).toBeVisible();
  await expect(submit).toBeVisible();

  return { fixtureForm, input, submit };
}

async function enterValidStudentCode({ fixtureForm, input, submit, validCode }) {
  await input.focus();
  await input.fill(validCode);
  await expect(input).toHaveValue(validCode);
  await expect(fixtureForm).toHaveAttribute('data-q2-share-code-valid', 'true');
  await expect(fixtureForm).toHaveAttribute('data-q2-is-submitting', 'false');
  await expect(fixtureForm).toHaveAttribute('data-q2-challenge-pending', 'false');
  await expect(fixtureForm).toHaveAttribute('data-q2-can-attempt-submit', 'true');
  await expect(submit).toBeEnabled();
}

async function enterClientValidStudentCode({ fixtureForm, input, submit, code }) {
  await input.focus();
  await input.fill(code);
  await expect(input).toHaveValue(code);
  await expect(fixtureForm).toHaveAttribute('data-q2-share-code-valid', 'true');
  await expect(fixtureForm).toHaveAttribute('data-q2-is-submitting', 'false');
  await expect(fixtureForm).toHaveAttribute('data-q2-challenge-pending', 'false');
  await expect(fixtureForm).toHaveAttribute('data-q2-can-attempt-submit', 'true');
  await expect(submit).toBeEnabled();
}

async function studentEntryReadiness(entry) {
  return {
    authorizationMarker: true,
    clientHydrated: (await entry.fixtureForm.getAttribute('data-q2-client-hydrated')) === 'true',
    fixtureBypass: (await entry.fixtureForm.getAttribute('data-q2-fixture-bypass')) === 'true',
  };
}

const browserWarmup = {
  started: false,
  passed: false,
  authorizationMarker: false,
  fixtureBypass: false,
  clientHydrated: false,
  rawInputLength: 0,
  shareCodeValid: false,
  isSubmitting: false,
  challengePending: false,
  turnstileEnabled: false,
  canAttemptSubmit: false,
  buttonDisabled: true,
  inputRetained: false,
  submitEnabled: false,
  unexpectedConsoleErrors: [],
  unexpectedPageErrors: [],
  unexpectedRequests: [],
};

async function runWarmupDiagnostic(browser) {
  browserWarmup.started = true;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const telemetry = installTelemetry(page);
  let cleanupFixtureIngress;

  try {
    cleanupFixtureIngress = await installStudentFixtureIngress(context, { page, baseURL, fixtureToken, telemetry });
    await page.goto(new URL('/s', baseURL).toString(), { waitUntil: 'domcontentloaded' });
    const entry = await waitForStudentEntryReady(page);
    const readiness = await studentEntryReadiness(entry);
    await enterValidStudentCode({ ...entry, validCode });

    browserWarmup.authorizationMarker = readiness.authorizationMarker;
    browserWarmup.clientHydrated = readiness.clientHydrated;
    browserWarmup.fixtureBypass = readiness.fixtureBypass;
    browserWarmup.rawInputLength = (await entry.input.inputValue()).length;
    browserWarmup.shareCodeValid = (await entry.fixtureForm.getAttribute('data-q2-share-code-valid')) === 'true';
    browserWarmup.isSubmitting = (await entry.fixtureForm.getAttribute('data-q2-is-submitting')) === 'true';
    browserWarmup.challengePending = (await entry.fixtureForm.getAttribute('data-q2-challenge-pending')) === 'true';
    browserWarmup.turnstileEnabled = (await entry.fixtureForm.getAttribute('data-q2-turnstile-enabled')) === 'true';
    browserWarmup.canAttemptSubmit = (await entry.fixtureForm.getAttribute('data-q2-can-attempt-submit')) === 'true';
    browserWarmup.buttonDisabled = await entry.submit.isDisabled();
    browserWarmup.inputRetained = (await entry.input.inputValue()) === validCode;
    browserWarmup.submitEnabled = await entry.submit.isEnabled();
    assertCleanTelemetry(telemetry);
    browserWarmup.passed = browserWarmup.authorizationMarker && browserWarmup.fixtureBypass && browserWarmup.clientHydrated && browserWarmup.rawInputLength === validCode.length && browserWarmup.shareCodeValid && !browserWarmup.isSubmitting && !browserWarmup.challengePending && !browserWarmup.turnstileEnabled && browserWarmup.canAttemptSubmit && !browserWarmup.buttonDisabled && browserWarmup.inputRetained && browserWarmup.submitEnabled;
  } finally {
    browserWarmup.unexpectedConsoleErrors = telemetry.consoleErrors;
    browserWarmup.unexpectedPageErrors = telemetry.pageErrors;
    browserWarmup.unexpectedRequests = [...telemetry.failedRequests, ...telemetry.unexpectedResponses, ...telemetry.unexpectedExternalRequests];
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(`${outputDir}/browser-warmup.json`, JSON.stringify(browserWarmup));
    await cleanupFixtureIngress?.();
    await context.close();
  }

}

if (warmupOnly) {
  test('Q2-B4 warmup diagnostic', async ({ browser }) => {
    await runWarmupDiagnostic(browser);
    expect(browserWarmup.passed).toBe(true);
  });
}

if (!warmupOnly) test.beforeEach(async ({ context, page }, testInfo) => {
  const telemetry = installTelemetry(page);
  telemetryByTestId.set(testInfo.testId, telemetry);
  const recoveryDiagnostics = recoveryOnly || q4ErrorSemantics ? { posts: [], responses: [], finalURL: null } : null;
  if (recoveryDiagnostics) recoveryDiagnosticsByTestId.set(testInfo.testId, recoveryDiagnostics);
  fixtureIngressCleanupByTestId.set(testInfo.testId, await installStudentFixtureIngress(context, { page, baseURL, fixtureToken, telemetry, recoveryDiagnostics }));
});

if (!warmupOnly) test.afterEach(async ({}, testInfo) => {
  const cleanupFixtureIngress = fixtureIngressCleanupByTestId.get(testInfo.testId);
  fixtureIngressCleanupByTestId.delete(testInfo.testId);
  await cleanupFixtureIngress?.();
  const telemetry = telemetryByTestId.get(testInfo.testId);
  telemetryByTestId.delete(testInfo.testId);
  const body = JSON.stringify(telemetry);
  await testInfo.attach('telemetry.json', { body, contentType: 'application/json' });
  await fs.writeFile(testInfo.outputPath('telemetry.json'), body);
  const readiness = scenarioReadinessByTestId.get(testInfo.testId);
  scenarioReadinessByTestId.delete(testInfo.testId);
  if (readiness) {
    const readinessBody = JSON.stringify(readiness);
    await testInfo.attach('scenario-readiness.json', { body: readinessBody, contentType: 'application/json' });
    await fs.writeFile(testInfo.outputPath('scenario-readiness.json'), readinessBody);
  }
  const diagnostics = recoveryDiagnosticsByTestId.get(testInfo.testId);
  recoveryDiagnosticsByTestId.delete(testInfo.testId);
  if (diagnostics) {
    const body = JSON.stringify(diagnostics);
    await testInfo.attach('recovery-diagnostics.json', { body, contentType: 'application/json' });
    await fs.writeFile(testInfo.outputPath('recovery-diagnostics.json'), body);
  }
});

if (!warmupOnly && !recoveryOnly) test('B4-S1 valid code entry', async ({ page }, testInfo) => {
  const entryURL = new URL('/s', baseURL).toString();
  await page.goto(entryURL, { waitUntil: 'domcontentloaded' });
  const entry = await waitForStudentEntryReady(page);
  const readiness = await studentEntryReadiness(entry);
  await enterValidStudentCode({ ...entry, validCode });
  scenarioReadinessByTestId.set(testInfo.testId, {
    id: 'S1',
    ...readiness,
    shareCodeValidAfterFill: true,
    canAttemptSubmitAfterFill: true,
    submitEnabledAfterFill: true,
  });
  await entry.submit.click();
  await expectStudentBoardURL(page, { baseURL, normalizedCode: validCode });
  await assertBoard(page);
  assertCleanTelemetry(telemetryByTestId.get(test.info().testId));
});

if (!warmupOnly && !recoveryOnly) test('B4-S2 direct canonical access', async ({ page }) => {
  await page.goto(new URL(`/s/${validCode}`, baseURL).toString(), { waitUntil: 'domcontentloaded' });
  await expectStudentBoardURL(page, { baseURL, normalizedCode: validCode });
  await assertBoard(page);
  assertCleanTelemetry(telemetryByTestId.get(test.info().testId));
});

if (!warmupOnly) test('B4-S3 invalid code recovery', async ({ page }, testInfo) => {
  const entryURL = new URL('/s', baseURL).toString();
  await page.goto(entryURL, { waitUntil: 'domcontentloaded' });
  const initialEntry = await waitForStudentEntryReady(page);
  const initialReadiness = await studentEntryReadiness(initialEntry);
  await enterClientValidStudentCode({ ...initialEntry, code: invalidCode });
  scenarioReadinessByTestId.set(testInfo.testId, {
    id: 'S3',
    initial: {
      ...initialReadiness,
      invalidCodeClientValid: true,
      submitEnabledAfterFill: true,
    },
  });
  if (recoveryOnly) {
    const initialResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/s/enter');
    await initialEntry.submit.click();
    recoveryDiagnosticsByTestId.get(testInfo.testId)?.recordPostResponse(await initialResponse);
  } else {
    await initialEntry.submit.click();
  }
  await expect(page.getByTestId('student-code-error')).toBeVisible();
  await expect(page.getByTestId('student-board-root')).toHaveCount(0);
  const recoveryEntry = await waitForStudentEntryReady(page);
  const recoveryReadiness = await studentEntryReadiness(recoveryEntry);
  await enterValidStudentCode({ ...recoveryEntry, validCode });
  scenarioReadinessByTestId.set(testInfo.testId, {
    id: 'S3',
    initial: {
      ...initialReadiness,
      invalidCodeClientValid: true,
      submitEnabledAfterFill: true,
    },
    recovery: {
      ...recoveryReadiness,
      shareCodeValidAfterFill: true,
      canAttemptSubmitAfterFill: true,
      submitEnabledAfterFill: true,
    },
  });
  if (recoveryOnly) {
    const recoveryResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/s/enter');
    await recoveryEntry.submit.click();
    recoveryDiagnosticsByTestId.get(testInfo.testId)?.recordPostResponse(await recoveryResponse);
  } else {
    await recoveryEntry.submit.click();
  }
  await expectStudentBoardURL(page, { baseURL, normalizedCode: validCode });
  const diagnostics = recoveryDiagnosticsByTestId.get(testInfo.testId);
  if (diagnostics) {
    const final = new URL(page.url());
    diagnostics.finalURL = { sameLoopbackServer: isSameLoopbackServer(page.url(), baseURL), pathnameMatchesCanonical: final.pathname === `/s/${validCode}`, hasError: final.searchParams.has('error') };
  }
  await assertBoard(page);
  assertCleanTelemetry(telemetryByTestId.get(test.info().testId));
});

if (!warmupOnly && !recoveryOnly) test('B4-S4 teacher controls absent', async ({ page }) => {
  await page.goto(new URL(`/s/${validCode}`, baseURL).toString(), { waitUntil: 'domcontentloaded' });
  await assertBoard(page);
  await expect(page.getByRole('button', { name: '보드 설정' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '섹션 추가' })).toHaveCount(0);
  assertCleanTelemetry(telemetryByTestId.get(test.info().testId));
});

if (q4ErrorSemantics) test('Q4-UX-BUNDLE-01 student entry error semantics', async ({ page, browser }, testInfo) => {
  const evidence = { ariaInvalidBefore: null, ariaInvalidOnError: null, ariaInvalidAfterEdit: null, describedByBefore: null, describedByOnError: null, describedByAfterEdit: null, invalidFocus: null, duplicateRequestCount: 0 };

  await page.goto(new URL('/s', baseURL).toString(), { waitUntil: 'domcontentloaded' });
  let entry = await waitForStudentEntryReady(page);
  evidence.ariaInvalidBefore = await entry.input.getAttribute('aria-invalid');
  evidence.describedByBefore = await entry.input.getAttribute('aria-describedby');
  await enterClientValidStudentCode({ ...entry, code: invalidCode });
  await entry.input.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/s\\?code=${invalidCode}&error=invalid_code$`));
  entry = await waitForStudentEntryReady(page);
  await expect(entry.input).toHaveValue(invalidCode);
  await expect(page.getByTestId('student-code-error')).toHaveCount(1);
  evidence.ariaInvalidOnError = await entry.input.getAttribute('aria-invalid');
  evidence.describedByOnError = await entry.input.getAttribute('aria-describedby');
  evidence.invalidFocus = await page.evaluate(() => document.activeElement?.id ?? null);
  await entry.input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await entry.input.type(validCode);
  await expect(entry.input).toHaveAttribute('aria-describedby', 'student-code-help');
  await expect(entry.input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('student-code-error')).toHaveCount(0);
  evidence.ariaInvalidAfterEdit = await entry.input.getAttribute('aria-invalid');
  evidence.describedByAfterEdit = await entry.input.getAttribute('aria-describedby');
  await entry.input.press('Enter');
  await expectStudentBoardURL(page, { baseURL, normalizedCode: validCode });
  await assertBoard(page);

  const duplicateContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const duplicatePage = await duplicateContext.newPage();
  const duplicateTelemetry = installTelemetry(duplicatePage);
  const duplicateDiagnostics = { posts: [], responses: [], finalURL: null };
  const cleanupDuplicateIngress = await installStudentFixtureIngress(duplicateContext, { page: duplicatePage, baseURL, fixtureToken, telemetry: duplicateTelemetry, recoveryDiagnostics: duplicateDiagnostics });
  try {
    await duplicatePage.goto(new URL('/s', baseURL).toString(), { waitUntil: 'domcontentloaded' });
    const duplicateEntry = await waitForStudentEntryReady(duplicatePage);
    await duplicateEntry.input.fill(validCode);
    await Promise.all([duplicateEntry.input.press('Enter'), duplicateEntry.input.press('Enter')]);
    await expectStudentBoardURL(duplicatePage, { baseURL, normalizedCode: validCode });
    evidence.duplicateRequestCount = duplicateDiagnostics.posts.length;
    assertCleanTelemetry(duplicateTelemetry);
  } finally {
    await cleanupDuplicateIngress();
    await duplicateContext.close();
  }
  expect(evidence.duplicateRequestCount).toBe(1);
  expect(evidence.ariaInvalidBefore).toBeNull();
  expect(evidence.describedByBefore).toBe('student-code-help');
  expect(evidence.ariaInvalidOnError).toBe('true');
  expect(evidence.describedByOnError).toContain('student-code-error');
  expect(evidence.invalidFocus).toBe('student-code');
  expect(evidence.ariaInvalidAfterEdit).toBeNull();
  assertCleanTelemetry(telemetryByTestId.get(testInfo.testId));
  await fs.writeFile(testInfo.outputPath('q4-error-semantics.json'), JSON.stringify(evidence));
});
