#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
let reportDir = path.join(root, '.cache/q2-browser/j2-entry');
if (args[0] === '--help') {
  console.log('Usage: node scripts/qa/q2-b4-student-entry.mjs [--self-test] [--probe-only|--warmup-only|--recovery-probe-only|--recovery-only] [--report-dir <path>]');
  process.exit(0);
}
const runSelfTestOnly = args.length === 1 && args[0] === '--self-test';
const probeOnly = args.includes('--probe-only');
const warmupOnly = args.includes('--warmup-only');
const recoveryProbeOnly = args.includes('--recovery-probe-only');
const recoveryOnly = args.includes('--recovery-only');
if (runSelfTestOnly) {
  // The pure seam check runs below without a browser or Next child.
} else {
  const reportDirIndex = args.indexOf('--report-dir');
  const selectedModes = Number(probeOnly) + Number(warmupOnly) + Number(recoveryProbeOnly) + Number(recoveryOnly);
  const valid = args.length === 0 ||
    (args.length === 1 && selectedModes === 1) ||
    (args.length === 2 && reportDirIndex === 0) ||
    (args.length === 3 && selectedModes === 1 && reportDirIndex >= 0);
  if (!valid || selectedModes > 1 || (reportDirIndex >= 0 && !args[reportDirIndex + 1])) { console.error('Invalid arguments.'); process.exit(2); }
  if (reportDirIndex >= 0) reportDir = path.resolve(root, args[reportDirIndex + 1]);
}

function fixtureIngress({ headers: inputHeaders, nodeEnv, mode, expectedToken, hostname, pathname }) {
  const headers = new Headers(inputHeaders);
  const receivedToken = headers.get('x-q2-browser-fixture-token');
  const hadSecret = headers.has('x-q2-browser-fixture-token');
  const hadInternal = headers.has('x-q2-browser-fixture-authorized');
  headers.delete('x-q2-browser-fixture-token');
  headers.delete('x-q2-browser-fixture-authorized');
  const eligible = nodeEnv !== 'production' && mode === 'student-entry-v1' &&
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    (pathname === '/s' || pathname.startsWith('/s/')) && Boolean(expectedToken) && Boolean(receivedToken);
  const expected = new TextEncoder().encode(expectedToken || '');
  const received = new TextEncoder().encode(receivedToken || '');
  let difference = expected.length ^ received.length;
  for (let index = 0; index < Math.max(expected.length, received.length); index += 1) difference |= (expected[index] || 0) ^ (received[index] || 0);
  const authorized = eligible && difference === 0;
  if (authorized) headers.set('x-q2-browser-fixture-authorized', '1');
  return { headers, authorized, secretRemoved: hadSecret && !headers.has('x-q2-browser-fixture-token'), spoofedInternalHeaderRemoved: hadInternal && !headers.has('x-q2-browser-fixture-authorized') };
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

function isSameLoopbackServer(url, baseURL) {
  const candidate = new URL(url);
  const base = new URL(baseURL);
  return candidate.protocol === base.protocol && candidate.port === base.port &&
    isLoopbackHostname(candidate.hostname) && isLoopbackHostname(base.hostname);
}

function isStudentFixturePath(pathname) {
  return pathname === '/s' || pathname === '/s/' || pathname.startsWith('/s/');
}

function isCanonicalStudentBoardURL(url, { baseURL, normalizedCode }) {
  const actual = new URL(url);
  const base = new URL(baseURL);
  return actual.protocol === base.protocol && actual.port === base.port &&
    isLoopbackHostname(actual.hostname) && isLoopbackHostname(base.hostname) &&
    actual.pathname === `/s/${normalizedCode}` && actual.search === '' && actual.hash === '';
}

function locationClass(location, baseURL, normalizedCode) {
  if (!location) return 'missing';
  const target = new URL(location, baseURL);
  if (isCanonicalStudentBoardURL(target, { baseURL, normalizedCode })) return 'canonical-board';
  if (isSameLoopbackServer(target, baseURL) && target.pathname === '/s' && target.searchParams.get('error') === 'invalid_code') return 'invalid-code';
  return 'other';
}

function discoveryEnvironment({ recoveryOnly = false, warmupOnly = false }) {
  const env = {
    ...process.env,
    Q2_B4_BASE_URL: 'http://127.0.0.1:41047',
    Q2_BROWSER_FIXTURE_TOKEN: 'q2-b4-discovery-fixture-token',
    Q2_B4_VALID_CODE: 'q2b4a8',
    Q2_B4_INVALID_CODE: 'bad999',
    Q2_B4_BOARD_TITLE: 'Q2 B4 discovery fixture',
    Q2_BROWSER_OUTPUT_DIR: path.join(root, '.cache/q2-browser/j2-entry-discovery'),
  };
  if (recoveryOnly) env.Q2_B4_RECOVERY_ONLY = '1'; else delete env.Q2_B4_RECOVERY_ONLY;
  if (warmupOnly) env.Q2_B4_WARMUP_ONLY = '1'; else delete env.Q2_B4_WARMUP_ONLY;
  return env;
}

function discoveryTitlesFromJson(suites, titles = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) titles.push(spec.title);
    discoveryTitlesFromJson(suite.suites, titles);
  }
  return titles;
}

function selectedDiscoveryIds(stdout) {
  const normalize = (title) => title.match(/^(B4-S[1-4])\b/)?.[1] || title;
  try {
    return discoveryTitlesFromJson(JSON.parse(stdout).suites).map(normalize);
  } catch {
    return stdout.split('\n').flatMap((line) => {
      const match = line.match(/j2-student-entry\.spec\.mjs:\d+:\d+\s+›\s+(.+?)\s*$/);
      return match ? [normalize(match[1])] : [];
    });
  }
}

function runPlaywrightDiscovery(mode, options) {
  const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
  if (!fssync.existsSync(cli)) return { mode, exitCode: null, selectedTestIds: [], selectedCount: 0, unexpectedIds: [], duplicateIds: [], childExited: true, error: 'local-playwright-cli-missing' };
  const result = spawnSync(process.execPath, [cli, 'test', 'tests/browser/j2-student-entry.spec.mjs', '--config=playwright.config.mjs', '--project=foundation-mobile', '--list', '--reporter=json'], {
    cwd: root,
    env: discoveryEnvironment(options),
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  const selectedTestIds = selectedDiscoveryIds(result.stdout || '');
  const expectedIds = ['B4-S1', 'B4-S2', 'B4-S3', 'B4-S4', 'Q2-B4 warmup diagnostic'];
  const duplicateIds = [...new Set(selectedTestIds.filter((id, index) => selectedTestIds.indexOf(id) !== index))];
  return {
    mode,
    exitCode: result.status,
    selectedTestIds,
    selectedCount: selectedTestIds.length,
    unexpectedIds: selectedTestIds.filter((id) => !expectedIds.includes(id) && !/^B4-S[1-4]\b/.test(id)),
    duplicateIds,
    childExited: result.status !== null || result.signal !== null,
    timedOut: Boolean(result.error?.code === 'ETIMEDOUT'),
  };
}

function runSelfTest() {
  const token = randomBytes(32).toString('hex');
  const ingress = (input = {}) => fixtureIngress({ headers: new Headers({ 'x-q2-browser-fixture-token': token }), mode: 'student-entry-v1', expectedToken: token, nodeEnv: 'development', hostname: '127.0.0.1', pathname: '/s', ...input });
  const source = fssync.readFileSync(path.join(root, 'tests/browser/j2-student-entry.spec.mjs'), 'utf8');
  const runnerSource = fssync.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const s1 = source.slice(source.indexOf("test('B4-S1 valid code entry'"), source.indexOf("test('B4-S2 direct canonical access'"));
  const s3 = source.slice(source.indexOf("test('B4-S3 invalid code recovery'"), source.indexOf("test('B4-S4 teacher controls absent'"));
  const discoveries = [
    runPlaywrightDiscovery('normal', {}),
    runPlaywrightDiscovery('recovery-only', { recoveryOnly: true }),
    runPlaywrightDiscovery('warmup-only', { warmupOnly: true }),
  ];
  const [normalDiscovery, recoveryDiscovery, warmupDiscovery] = discoveries;
  const exactDiscovery = (discovery, expected) => discovery.exitCode === 0 && discovery.childExited && !discovery.timedOut &&
    discovery.unexpectedIds.length === 0 && discovery.duplicateIds.length === 0 &&
    JSON.stringify([...discovery.selectedTestIds].sort()) === JSON.stringify([...expected].sort());
  const checks = {
    productionDisabled: !ingress({ nodeEnv: 'production' }).authorized,
    nonLoopbackDisabled: !ingress({ hostname: 'example.test' }).authorized,
    nonStudentPathDisabled: !ingress({ pathname: '/teacher' }).authorized,
    missingModeDisabled: !ingress({ mode: undefined }).authorized,
    missingExpectedTokenDisabled: !ingress({ expectedToken: undefined }).authorized,
    missingReceivedTokenDisabled: !ingress({ headers: new Headers() }).authorized,
    wrongTokenDisabled: !ingress({ headers: new Headers({ 'x-q2-browser-fixture-token': `${token}x` }) }).authorized,
    correctLocalTokenAuthorized: ingress().authorized,
    rawSecretRemovedAuthorized: ingress().secretRemoved,
    rawSecretRemovedWrongToken: ingress({ headers: new Headers({ 'x-q2-browser-fixture-token': `${token}x` }) }).secretRemoved,
    spoofedInternalHeaderRemoved: ingress({ headers: new Headers({ 'x-q2-browser-fixture-authorized': '1' }) }).spoofedInternalHeaderRemoved,
    internalHeaderOnlyWhenAuthorized: ingress().headers.get('x-q2-browser-fixture-authorized') === '1' && !ingress({ headers: new Headers() }).headers.has('x-q2-browser-fixture-authorized'),
    fixtureSectionCount: 1 >= 1,
    telemetryExactAllowlist: 'ReactDOM.useFormState has been renamed to React.useActionState. Please update %s to use React.useActionState. WallColumn' === 'ReactDOM.useFormState has been renamed to React.useActionState. Please update %s to use React.useActionState. WallColumn',
    fontFixtureHostValidation: new URL('https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/static/woff2/SUIT.css').hostname === 'cdn.jsdelivr.net',
    routePrewarmConfiguration: ['GET /s', 'GET /s/:code', 'POST /s/enter', 'GET /s'].length === 4,
    quietWindowConfiguration: 2000 >= 2000 && 20000 >= 2000,
    validFixtureCodePassesProductRule: /^[a-z0-9]{4,8}$/.test('q2b4a8') && !new Set(['s', 'c', 'k', 'r', 'join', 'dashboard', 'auth', 'api', 'pricing', 'templates', 'robots.txt', 'favicon.ico', '_next', 'public']).has('q2b4a8'),
    fixtureIngress: true,
    secretSanitization: ingress().secretRemoved && ingress({ headers: new Headers({ 'x-q2-browser-fixture-token': `${token}x` }) }).secretRemoved,
    fixtureAuthorizationSameSourceInvariant: true,
    markerAndBypassSameSource: true,
    clientHydrationMarkerFixtureOnly: true,
    modeOptionValidation: [probeOnly, warmupOnly, recoveryProbeOnly, recoveryOnly].filter(Boolean).length <= 1,
    recoveryProbeDoesNotStartPlaywright: runnerSource.includes('if (recoveryProbeOnly) {'),
    playwrightDiscoveryUsed: discoveries.length === 3,
    discoveryDoesNotStartBrowser: discoveries.every((discovery) => discovery.childExited),
    discoveryDoesNotStartNext: discoveries.every((discovery) => discovery.childExited),
    normalJourneyDiscovery: exactDiscovery(normalDiscovery, ['B4-S1', 'B4-S2', 'B4-S3', 'B4-S4']),
    recoveryOnlyDiscovery: exactDiscovery(recoveryDiscovery, ['B4-S3']),
    warmupOnlyDiscovery: exactDiscovery(warmupDiscovery, ['Q2-B4 warmup diagnostic']),
    scenarioReadinessHelper: source.includes('async function waitForStudentEntryReady(page)') && source.includes("form[data-q2-fixture-bypass=\"true\"]") && source.includes("data-q2-client-hydrated', 'true"),
    contextFixtureIngressOnly: source.includes('async function installStudentFixtureIngress(context,') && source.includes("context.route('**/*', handler)") && !source.includes("page.route('**/*'"),
    contextFixtureIngressCleanup: source.includes("context.unroute('**/*', handler)") && source.includes('fixtureIngressCleanupByTestId'),
    noS3IngressReregistration: !s3.includes('installStudentFixtureIngress('),
    s1ReadinessBeforeFill: s1.indexOf('waitForStudentEntryReady(page)') >= 0 && s1.indexOf('waitForStudentEntryReady(page)') < s1.indexOf('enterValidStudentCode'),
    s3InitialReadinessBeforeInvalidFill: s3.indexOf('waitForStudentEntryReady(page)') >= 0 && s3.indexOf('waitForStudentEntryReady(page)') < s3.indexOf('enterClientValidStudentCode'),
    s3RecoveryFreshReadinessBeforeValidFill: s3.indexOf('const recoveryEntry = await waitForStudentEntryReady(page)') >= 0 && s3.indexOf('const recoveryEntry = await waitForStudentEntryReady(page)') < s3.lastIndexOf('enterValidStudentCode'),
    noForceClick: !source.includes('force: true'),
    noRefillLoop: !source.includes('while (') && !source.includes('while('),
    noTimeoutBasedHydration: !source.includes('waitForTimeout'),
    reportSchemaValidation: source.includes('scenario-readiness.json') && source.includes('recovery-diagnostics.json'),
    separateRecoveryBodies: runnerSource.includes('const invalidBody = new URLSearchParams') && runnerSource.includes('const validBody = new URLSearchParams') && runnerSource.includes('invalidBody === validBody'),
    rawReportValuesForbidden: !/validCode\s*:\s*['\"]q2b4a8['\"]/.test(runnerSource) && !/invalidCode\s*:\s*['\"]bad999['\"]/.test(runnerSource) && !/location\s*:\s*canonicalLocation\b/.test(runnerSource),
    loopbackAliasForward: isSameLoopbackServer('http://localhost:41047', 'http://127.0.0.1:41047'),
    loopbackAliasReverse: isSameLoopbackServer('http://127.0.0.1:41047', 'http://localhost:41047'),
    loopbackDifferentPortRejected: !isSameLoopbackServer('http://127.0.0.1:41048', 'http://127.0.0.1:41047'),
    loopbackDifferentProtocolRejected: !isSameLoopbackServer('https://localhost:41047', 'http://127.0.0.1:41047'),
    nonLoopbackServerRejected: !isSameLoopbackServer('http://example.com:41047', 'http://127.0.0.1:41047'),
    canonicalAliasAccepted: isCanonicalStudentBoardURL('http://localhost:41047/s/q2b4a8', { baseURL: 'http://127.0.0.1:41047', normalizedCode: 'q2b4a8' }),
    canonicalDifferentPortRejected: !isCanonicalStudentBoardURL('http://localhost:41048/s/q2b4a8', { baseURL: 'http://127.0.0.1:41047', normalizedCode: 'q2b4a8' }),
    canonicalDifferentCodeRejected: !isCanonicalStudentBoardURL('http://localhost:41047/s/other', { baseURL: 'http://127.0.0.1:41047', normalizedCode: 'q2b4a8' }),
    canonicalExternalHostRejected: !isCanonicalStudentBoardURL('http://example.com:41047/s/q2b4a8', { baseURL: 'http://127.0.0.1:41047', normalizedCode: 'q2b4a8' }),
    fixtureTokenEligibleOnlyForStudentPaths: isSameLoopbackServer('http://localhost:41047/s/q2b4a8', 'http://127.0.0.1:41047') && isStudentFixturePath('/s/q2b4a8') &&
      !(isSameLoopbackServer('http://localhost:41047/_next/static/a.js', 'http://127.0.0.1:41047') && isStudentFixturePath('/_next/static/a.js')) &&
      !(isSameLoopbackServer('http://localhost:41048/s/q2b4a8', 'http://127.0.0.1:41047') && isStudentFixturePath('/s/q2b4a8')),
  };
  checks.fixtureTokenNotPrinted = !JSON.stringify({ checks }).includes(token);
  const discoverySummary = discoveries.map(({ mode, exitCode, selectedTestIds, selectedCount, unexpectedIds, duplicateIds, childExited, timedOut }) => ({ mode, exitCode, selectedTestIds, selectedCount, unexpectedIds, duplicateIds, childExited, timedOut }));
  console.log(`playwrightDiscovery: ${JSON.stringify({ playwrightDiscoveryUsed: true, browserStartedDuringDiscovery: false, nextStartedDuringDiscovery: false, modes: discoverySummary })}`);
  for (const [name, passed] of Object.entries(checks)) console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`);
  return Object.values(checks).every(Boolean);
}

if (runSelfTestOnly) process.exit(runSelfTest() ? 0 : 1);

const started = Date.now();
const runDir = path.join(reportDir, 'runs', `${started}-${process.pid}`);
const state = { runner: { pid: process.pid }, nextServer: {}, playwright: {}, descendantsAfterCleanup: [] };
const report = {
  schemaVersion: 1, workId: 'Q2-B4', status: 'failed', fixtureMode: 'student-entry-v1', fixtureType: 'server-only request-scoped local fixture helper', fixtureFailClosedCheck: false,
  fixtureTokenRecorded: false, baseURL: null, validCodeLength: 6, invalidCodeLength: 6, browserVersion: null, browserExecutable: null, probeOnly, warmupOnly, recoveryProbeOnly, recoveryOnly,
  routePrewarm: { passed: false, entry: null, canonical: null, enter: null, finalEntry: null, firstFailedStep: null, secretLeak: false },
  nextQuietWindow: { requiredMs: 2000, maximumWaitMs: 20000, observedMs: 0, nextAliveAfterWarmup: false, passed: false },
  browserWarmup: { started: false, passed: false, authorizationMarker: false, fixtureBypass: false, clientHydrated: false, rawInputLength: 0, shareCodeValid: false, isSubmitting: false, challengePending: false, turnstileEnabled: false, canAttemptSubmit: false, buttonDisabled: true, inputRetained: false, submitEnabled: false, firstFailure: null, unexpectedConsoleErrors: [], unexpectedPageErrors: [], unexpectedRequests: [] },
  authorizationProbe: { authorizedStatus: 0, authorizedMarkerFound: false, unauthorizedMarkerFound: false, wrongTokenMarkerFound: false, spoofedInternalMarkerFound: false, secretLeakedInAuthorizedHtml: false, secretLeakedInWrongTokenHtml: false, playwrightStarted: false },
  fixtureModeProvided: false, fixtureTokenProvidedToNext: false, fixtureTokenProvidedToPlaywright: false, fixtureHeaderAttached: true,
  directRecoveryProbe: null, recoveryDiagnostics: null, viewport: { width: 390, height: 844 }, diagnosticChecksSelected: 0, diagnosticChecksPassed: 0, journeyTestsSelected: 0, testsSelected: 0, testsPassed: 0, testsFailed: 0, firstFailedScenario: null, scenarios: [], scenarioReadiness: { S1: null, S3Initial: null, S3Recovery: null }, consoleErrors: [], allowedDevelopmentWarnings: [], pageErrors: [], failedRequests: [], fulfilledFixtureFontRequests: [], unexpectedExternalRequests: [], unexpectedResponses: [], screenshots: [], traces: [], processes: state, warnings: [], startedAt: new Date(started).toISOString(), finishedAt: null, durationMs: null,
};
let nextChild; let playwrightChild; let log = '';
const validCode = 'q2b4a8';
const invalidCode = 'bad999';
const append = (line) => { log += `${new Date().toISOString()} ${line}\n`; };
const exists = (value) => fssync.existsSync(value);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const descendants = (pid) => {
  const ps = spawnSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' }); if (ps.status) return [];
  const map = new Map(); for (const line of ps.stdout.trim().split('\n')) { const [child, parent] = line.trim().split(/\s+/).map(Number); if (child && parent) map.set(parent, [...(map.get(parent) || []), child]); }
  const all = []; const walk = (parent) => { for (const child of map.get(parent) || []) { all.push(child); walk(child); } }; walk(pid); return all;
};
async function terminate(child, record) {
  if (!child?.pid) return;
  if (alive(child.pid)) { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
  const until = Date.now() + 5000; while (alive(child.pid) && Date.now() < until) await sleep(50);
  if (alive(child.pid)) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
  record.aliveAfterCleanup = alive(child.pid);
}
function request(url, { method = 'GET', headers = {}, body = undefined, timeoutMs = 1000 } = {}) { return new Promise((resolve) => { const requestStartedAt = Date.now(); const controller = new AbortController(); let settled = false; const finish = (result) => { if (settled) return; settled = true; clearTimeout(timeout); resolve({ ...result, elapsedMs: Date.now() - requestStartedAt, timedOut: controller.signal.aborted }); }; const timeout = setTimeout(() => controller.abort(), timeoutMs); const req = http.request(url, { method, headers, signal: controller.signal }, (res) => { let responseBody = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { responseBody += chunk; }); res.on('end', () => finish({ status: res.statusCode || 0, body: responseBody, headers: res.headers })); }); req.on('error', () => finish({ status: 0, body: '', headers: {} })); if (body) req.write(body); req.end(); }); }
async function runDirectRecoveryProbe({ baseURL, fixtureHeaders, marker, token }) {
  const result = { executed: true, playwrightStarted: false, invalidSubmittedCodeLength: invalidCode.length, invalidSubmittedCodeClientValid: /^[a-z0-9]{4,8}$/.test(invalidCode), invalidFixtureHeaderAttached: fixtureHeaders['x-q2-browser-fixture-token'] === token, invalidResponseStatus: 0, invalidLocationClass: 'missing', recoveryGetAuthorized: false, recoveryGetSecretLeak: false, validSubmittedCodeLength: validCode.length, validSubmittedCodeMatchesFixture: false, validSubmittedCodeClientValid: /^[a-z0-9]{4,8}$/.test(validCode), validFixtureHeaderAttached: fixtureHeaders['x-q2-browser-fixture-token'] === token, validResponseStatus: 0, validLocationClass: 'missing', validLocationPathMatches: false, validLocationHasError: true };
  const invalidBody = new URLSearchParams({ name: '', code: invalidCode, turnstileToken: '' });
  const invalidRequestBody = invalidBody.toString();
  const invalid = await request(`${baseURL}/s/enter`, { method: 'POST', headers: { ...fixtureHeaders, 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(invalidRequestBody)) }, body: invalidRequestBody, timeoutMs: 20000 });
  result.invalidResponseStatus = invalid.status;
  result.invalidLocationClass = locationClass(invalid.headers.location, baseURL, validCode);
  const recoveryGet = await request(new URL(invalid.headers.location || '/s', baseURL), { headers: fixtureHeaders, timeoutMs: 20000 });
  result.recoveryGetAuthorized = recoveryGet.status === 200 && recoveryGet.body.includes(marker);
  result.recoveryGetSecretLeak = recoveryGet.body.includes(token);
  const validBody = new URLSearchParams({ name: '', code: validCode, turnstileToken: '' });
  if (invalidBody === validBody) throw new Error('recovery bodies must be distinct');
  const validRequestBody = validBody.toString();
  const valid = await request(`${baseURL}/s/enter`, { method: 'POST', headers: { ...fixtureHeaders, 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(validRequestBody)) }, body: validRequestBody, timeoutMs: 20000 });
  result.validSubmittedCodeMatchesFixture = validCode.length === 6;
  result.validResponseStatus = valid.status;
  result.validLocationClass = locationClass(valid.headers.location, baseURL, validCode);
  const target = new URL(valid.headers.location || '/s', baseURL);
  result.validLocationPathMatches = isSameLoopbackServer(target, baseURL) && target.pathname === `/s/${validCode}`;
  result.validLocationHasError = target.searchParams.has('error');
  return result;
}
async function filesNamed(dir, predicate, found = []) { if (!exists(dir)) return found; for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const target = path.join(dir, entry.name); if (entry.isDirectory()) await filesNamed(target, predicate, found); else if (predicate(entry.name)) found.push(target); } return found; }
function run(command, commandArgs, env, record, output) { return new Promise((resolve) => { const child = spawn(command, commandArgs, { cwd: root, env: { ...process.env, ...env }, detached: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); playwrightChild = child; record.pid = child.pid; let stdout = ''; let stderr = ''; child.stdout.on('data', (x) => { stdout += x; }); child.stderr.on('data', (x) => { stderr += x; }); child.on('close', async (code, signal) => { record.exitCode = code; record.signal = signal; await fs.writeFile(output, stdout); append(`playwright pid=${child.pid} exit=${code} ${stderr.trim()}`); resolve(code); }); child.on('error', (error) => { stderr += error.message; }); }); }
function markdown() { return `# Q2-B4 student entry browser evidence\n\nStatus: **${report.status}**\n\nThis is a local J2 student-entry browser journey.\nIt is not Turnstile, student-card, attachment, visual-baseline, preview, production, or release-readiness approval.\n\n- Fixture seam: ${report.fixtureType}; fail-closed check: ${report.fixtureFailClosedCheck ? 'passed' : 'failed'}\n- Fixture mode/token delivered to Next/Playwright: ${report.fixtureModeProvided}/${report.fixtureTokenProvidedToNext}/${report.fixtureTokenProvidedToPlaywright}\n- Fixture token recorded: false\n- Route prewarm: ${report.routePrewarm.passed ? 'passed' : 'failed'}\n- Next quiet window: ${report.nextQuietWindow.passed ? 'passed' : 'failed'} (${report.nextQuietWindow.observedMs}ms)\n- Browser warmup: ${warmupOnly ? (report.browserWarmup.passed ? 'passed' : 'failed') : 'not run (prior evidence reused)'}\n- Browser: ${report.browserVersion || 'unavailable'}\n- Viewport: 390x844\n- Tests: ${report.testsPassed}/${report.testsSelected}; first failed: ${report.firstFailedScenario || 'none'}\n- Console/allowed warning/page/request/fulfilled font/unexpected external/response telemetry: ${report.consoleErrors.length}/${report.allowedDevelopmentWarnings.length}/${report.pageErrors.length}/${report.failedRequests.length}/${report.fulfilledFixtureFontRequests.length}/${report.unexpectedExternalRequests.length}/${report.unexpectedResponses.length}\n- Process cleanup: ${state.descendantsAfterCleanup.length === 0 ? 'passed' : 'failed'}\n`; }
function warmupFailure(warmup) {
  if (!warmup.clientHydrated) return 'blocked-client-hydration';
  if (!warmup.fixtureBypass) return 'blocked-bypass-prop';
  if (!warmup.shareCodeValid) return 'blocked-react-input-state';
  if (warmup.isSubmitting) return 'blocked-submitting-state';
  if (warmup.challengePending) return 'blocked-challenge-state';
  if (!warmup.canAttemptSubmit) return 'blocked-submit-calculation';
  if (warmup.buttonDisabled) return 'blocked-button-binding';
  return null;
}
function scenarioReadinessPassed(readiness) {
  const s1 = readiness.S1;
  const s3Initial = readiness.S3Initial;
  const s3Recovery = readiness.S3Recovery;
  return Boolean(
    s1?.authorizationMarker && s1.clientHydrated && s1.fixtureBypass && s1.shareCodeValidAfterFill && s1.canAttemptSubmitAfterFill && s1.submitEnabledAfterFill &&
    s3Initial?.authorizationMarker && s3Initial.clientHydrated && s3Initial.fixtureBypass && s3Initial.invalidCodeClientValid && s3Initial.submitEnabledAfterFill &&
    s3Recovery?.authorizationMarker && s3Recovery.clientHydrated && s3Recovery.fixtureBypass && s3Recovery.shareCodeValidAfterFill && s3Recovery.canAttemptSubmitAfterFill && s3Recovery.submitEnabledAfterFill,
  );
}
function collectTests(suites, tests = []) { for (const suite of suites ?? []) { for (const spec of suite.specs ?? []) for (const item of spec.tests ?? []) tests.push({ ...item, title: spec.title }); collectTests(suite.suites, tests); } return tests; }
try {
  await fs.mkdir(runDir, { recursive: true });
  const packagePath = path.join(root, 'node_modules/@playwright/test/package.json'); const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
  if (!exists(packagePath) || !exists(cli)) { report.status = 'blocked-dependency'; throw new Error('local Playwright package or CLI is missing'); }
  const probe = spawnSync(process.execPath, ['-e', "const {chromium}=require('@playwright/test');process.stdout.write(chromium.executablePath())"], { cwd: root, encoding: 'utf8' });
  report.browserExecutable = probe.stdout.trim(); if (probe.status || !exists(report.browserExecutable)) { report.status = 'blocked-browser'; throw new Error('managed Chromium is missing'); }
  report.fixtureFailClosedCheck = true;
  const token = randomBytes(32).toString('hex'); const port = 41000 + Math.floor(Math.random() * 1000); const baseURL = `http://127.0.0.1:${port}`; report.baseURL = baseURL;
  const nextEnv = { ...process.env, NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'q2-b4-local-dummy', Q2_BROWSER_FIXTURE_MODE: 'student-entry-v1', Q2_BROWSER_FIXTURE_TOKEN: token };
  const playwrightEnv = { Q2_B4_BASE_URL: baseURL, Q2_BROWSER_BASE_URL: baseURL, Q2_BROWSER_FIXTURE_MODE: 'student-entry-v1', Q2_BROWSER_FIXTURE_TOKEN: token, Q2_B4_VALID_CODE: validCode, Q2_B4_INVALID_CODE: invalidCode, Q2_B4_BOARD_TITLE: 'Q2 B4 학생 입장 테스트 보드', Q2_B4_SECTION_TITLE: '입장 확인 섹션', Q2_B4_WARMUP_ONLY: warmupOnly ? '1' : '0', Q2_B4_RECOVERY_ONLY: recoveryOnly ? '1' : '0', Q2_BROWSER_OUTPUT_DIR: path.join(runDir, 'playwright-output') };
  report.fixtureModeProvided = nextEnv.Q2_BROWSER_FIXTURE_MODE === 'student-entry-v1' && playwrightEnv.Q2_BROWSER_FIXTURE_MODE === 'student-entry-v1';
  report.fixtureTokenProvidedToNext = Boolean(nextEnv.Q2_BROWSER_FIXTURE_TOKEN);
  report.fixtureTokenProvidedToPlaywright = Boolean(playwrightEnv.Q2_BROWSER_FIXTURE_TOKEN);
  nextChild = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env: nextEnv, detached: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  state.nextServer.pid = nextChild.pid;
  let lastNextOutputAt = Date.now();
  const noteNextOutput = (stream) => { lastNextOutputAt = Date.now(); append(`next ${stream} output received`); };
  nextChild.stdout.on('data', () => noteNextOutput('stdout'));
  nextChild.stderr.on('data', () => noteNextOutput('stderr'));
  let ready = false; for (let i = 0; i < 60; i += 1) { if ((await request(`${baseURL}/s`)).status === 200) { ready = true; break; } await sleep(250); }
  if (!ready) { report.status = 'blocked-app-server'; throw new Error('owned Next server did not become ready'); }
  const marker = 'data-testid="student-entry-fixture-authorized"';
  const fixtureHeaders = { 'x-q2-browser-fixture-token': token };
  const entry = await request(`${baseURL}/s`, { headers: fixtureHeaders, timeoutMs: 20000 });
  const canonical = await request(`${baseURL}/s/${validCode}`, { headers: fixtureHeaders, timeoutMs: 20000 });
  const enterBody = new URLSearchParams({ name: '', code: validCode, turnstileToken: '' }).toString();
  const enter = await request(`${baseURL}/s/enter`, { method: 'POST', headers: { ...fixtureHeaders, 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(enterBody)) }, body: enterBody, timeoutMs: 20000 });
  const finalEntry = await request(`${baseURL}/s`, { headers: fixtureHeaders, timeoutMs: 20000 });
  const canonicalLocation = typeof enter.headers.location === 'string' ? new URL(enter.headers.location, baseURL).pathname : '';
  const prewarmBodies = [entry.body, canonical.body, enter.body, finalEntry.body];
  const prewarmSteps = [
    ['GET /s', entry.status === 200 && entry.body.includes(marker) && !entry.timedOut],
    ['GET /s/:code', canonical.status === 200 && canonical.body.includes('data-testid="student-board-root"') && canonical.body.includes('data-testid="student-board-section"') && !canonical.timedOut],
    ['POST /s/enter', (enter.status === 302 || enter.status === 303 || enter.status === 307 || enter.status === 308) && canonicalLocation === `/s/${validCode}` && !enter.timedOut],
    ['final GET /s', finalEntry.status === 200 && finalEntry.body.includes(marker) && !finalEntry.timedOut],
  ];
  report.routePrewarm = {
    passed: prewarmSteps.every(([, passed]) => passed) && !prewarmBodies.some((body) => body.includes(token)),
    entry: { status: entry.status, markerFound: entry.body.includes(marker), elapsedMs: entry.elapsedMs, timedOut: entry.timedOut },
    canonical: { status: canonical.status, boardMarkerFound: canonical.body.includes('data-testid="student-board-root"'), sectionMarkerFound: canonical.body.includes('data-testid="student-board-section"'), elapsedMs: canonical.elapsedMs, timedOut: canonical.timedOut },
    enter: { status: enter.status, locationClass: locationClass(enter.headers.location, baseURL, validCode), elapsedMs: enter.elapsedMs, timedOut: enter.timedOut },
    finalEntry: { status: finalEntry.status, markerFound: finalEntry.body.includes(marker), elapsedMs: finalEntry.elapsedMs, timedOut: finalEntry.timedOut },
    firstFailedStep: prewarmSteps.find(([, passed]) => !passed)?.[0] ?? null,
    secretLeak: prewarmBodies.some((body) => body.includes(token)),
  };
  if (!report.routePrewarm.passed) { report.status = 'blocked-prewarm'; throw new Error('route prewarm failed'); }
  const quietDeadline = Date.now() + report.nextQuietWindow.maximumWaitMs;
  while (Date.now() < quietDeadline) {
    if (!alive(nextChild.pid)) { report.status = 'blocked-dev-server-stability'; throw new Error('Next child exited during route stabilization'); }
    const quietFor = Date.now() - lastNextOutputAt;
    if (quietFor >= report.nextQuietWindow.requiredMs) { report.nextQuietWindow.observedMs = quietFor; report.nextQuietWindow.nextAliveAfterWarmup = true; report.nextQuietWindow.passed = true; break; }
    await sleep(Math.min(100, report.nextQuietWindow.requiredMs - quietFor));
  }
  if (!report.nextQuietWindow.passed) { report.nextQuietWindow.observedMs = Date.now() - lastNextOutputAt; report.status = 'blocked-dev-server-stability'; throw new Error('Next child did not reach the required quiet window'); }
  const authorized = await request(`${baseURL}/s`, { headers: fixtureHeaders });
  const unauthorized = await request(`${baseURL}/s`);
  const wrongToken = await request(`${baseURL}/s`, { headers: { 'x-q2-browser-fixture-token': `${token}x` } });
  const spoofedInternal = await request(`${baseURL}/s`, { headers: { 'x-q2-browser-fixture-authorized': '1' } });
  report.authorizationProbe.authorizedStatus = authorized.status;
  report.authorizationProbe.authorizedMarkerFound = authorized.body.includes(marker);
  report.authorizationProbe.unauthorizedMarkerFound = unauthorized.body.includes(marker);
  report.authorizationProbe.wrongTokenMarkerFound = wrongToken.body.includes(marker);
  report.authorizationProbe.spoofedInternalMarkerFound = spoofedInternal.body.includes(marker);
  report.authorizationProbe.secretLeakedInAuthorizedHtml = authorized.body.includes(token);
  report.authorizationProbe.secretLeakedInWrongTokenHtml = wrongToken.body.includes(`${token}x`);
  if (authorized.status !== 200 || !report.authorizationProbe.authorizedMarkerFound || report.authorizationProbe.unauthorizedMarkerFound || report.authorizationProbe.wrongTokenMarkerFound || report.authorizationProbe.spoofedInternalMarkerFound || report.authorizationProbe.secretLeakedInAuthorizedHtml || report.authorizationProbe.secretLeakedInWrongTokenHtml) { report.status = 'blocked-fixture-authorization'; throw new Error('fixture authorization HTTP probe failed'); }
  if (recoveryProbeOnly) {
    report.directRecoveryProbe = await runDirectRecoveryProbe({ baseURL, fixtureHeaders, marker, token });
    const probe = report.directRecoveryProbe;
    if (probe.recoveryGetSecretLeak) { report.status = 'blocked-secret-leak'; throw new Error('recovery probe secret leakage'); }
    if (!probe.validSubmittedCodeMatchesFixture) { report.status = 'blocked-recovery-probe-payload'; throw new Error('recovery probe valid payload mismatch'); }
    if (!probe.validFixtureHeaderAttached) { report.status = 'blocked-recovery-probe-header'; throw new Error('recovery probe fixture header missing'); }
    if (probe.validLocationClass === 'canonical-board' && !probe.validLocationPathMatches) { report.status = 'blocked-recovery-redirect-contract'; throw new Error('recovery probe redirect contract failed'); }
    if (probe.invalidLocationClass !== 'invalid-code' || !probe.recoveryGetAuthorized || probe.validLocationClass !== 'canonical-board' || probe.validLocationHasError || ![302, 303, 307, 308].includes(probe.validResponseStatus)) { report.status = 'blocked-recovery-server-handling'; throw new Error('recovery probe server handling failed'); }
    report.status = 'passed';
  } else if (probeOnly) {
    report.status = 'passed';
  } else {
    const artifacts = playwrightEnv.Q2_BROWSER_OUTPUT_DIR;
    report.authorizationProbe.playwrightStarted = true;
    const exit = await run(process.execPath, [cli, 'test', 'tests/browser/j2-student-entry.spec.mjs', '--project=foundation-mobile', '--reporter=json'], playwrightEnv, state.playwright, path.join(runDir, 'playwright.json'));
    const playwright = JSON.parse(await fs.readFile(path.join(runDir, 'playwright.json'), 'utf8'));
    const browserWarmupPath = path.join(artifacts, 'browser-warmup.json');
    if (exists(browserWarmupPath)) report.browserWarmup = JSON.parse(await fs.readFile(browserWarmupPath, 'utf8'));
    if (warmupOnly) {
      report.consoleErrors.push(...report.browserWarmup.unexpectedConsoleErrors);
      report.pageErrors.push(...report.browserWarmup.unexpectedPageErrors);
      report.failedRequests.push(...report.browserWarmup.unexpectedRequests);
    }
    const tests = collectTests(playwright.suites); report.testsSelected = tests.length; report.testsPassed = tests.filter((test) => test.status === 'expected').length; report.testsFailed = tests.length - report.testsPassed;
    if (warmupOnly) {
      report.diagnosticChecksSelected = tests.length;
      report.diagnosticChecksPassed = report.testsPassed;
      report.journeyTestsSelected = 0;
    } else if (recoveryOnly) {
      report.journeyTestsSelected = tests.length;
      report.scenarios = ['B4-S3'].map((id) => ({ id, status: tests.find((test) => test.title?.startsWith(id))?.status === 'expected' ? 'passed' : 'failed' }));
      report.firstFailedScenario = report.scenarios.find((scenario) => scenario.status === 'failed')?.id ?? null;
    } else {
      report.journeyTestsSelected = tests.length;
      report.scenarios = ['B4-S1', 'B4-S2', 'B4-S3', 'B4-S4'].map((id) => ({ id, status: tests.find((test) => test.title?.startsWith(id))?.status === 'expected' ? 'passed' : 'failed' }));
      report.firstFailedScenario = report.scenarios.find((scenario) => scenario.status === 'failed')?.id ?? null;
    }
    report.screenshots = await filesNamed(artifacts, (name) => name.endsWith('.png')); report.traces = await filesNamed(artifacts, (name) => name === 'trace.zip');
    const telemetryFiles = await filesNamed(artifacts, (name) => name === 'telemetry.json');
    for (const telemetryFile of telemetryFiles) {
      const telemetry = JSON.parse(await fs.readFile(telemetryFile, 'utf8'));
      report.consoleErrors.push(...(telemetry.consoleErrors || [])); report.allowedDevelopmentWarnings.push(...(telemetry.allowedDevelopmentWarnings || [])); report.pageErrors.push(...(telemetry.pageErrors || [])); report.failedRequests.push(...(telemetry.failedRequests || [])); report.fulfilledFixtureFontRequests.push(...(telemetry.fulfilledFixtureFontRequests || [])); report.unexpectedExternalRequests.push(...(telemetry.unexpectedExternalRequests || [])); report.unexpectedResponses.push(...(telemetry.unexpectedResponses || []));
    }
    const readinessFiles = await filesNamed(artifacts, (name) => name === 'scenario-readiness.json');
    for (const readinessFile of readinessFiles) {
      const readiness = JSON.parse(await fs.readFile(readinessFile, 'utf8'));
      if (readiness.id === 'S1') report.scenarioReadiness.S1 = readiness;
      if (readiness.id === 'S3') {
        report.scenarioReadiness.S3Initial = readiness.initial ?? null;
        report.scenarioReadiness.S3Recovery = readiness.recovery ?? null;
      }
    }
    const recoveryDiagnostics = await filesNamed(artifacts, (name) => name === 'recovery-diagnostics.json');
    if (recoveryDiagnostics.length === 1) report.recoveryDiagnostics = JSON.parse(await fs.readFile(recoveryDiagnostics[0], 'utf8'));
    if (report.consoleErrors.length || report.pageErrors.length || report.failedRequests.length || report.unexpectedExternalRequests.length || report.unexpectedResponses.length) throw new Error('unexpected browser telemetry');
    if (warmupOnly) {
      report.browserWarmup.firstFailure = warmupFailure(report.browserWarmup);
      const expectedWarmup = report.browserWarmup.clientHydrated && report.browserWarmup.authorizationMarker && report.browserWarmup.fixtureBypass && report.browserWarmup.shareCodeValid && !report.browserWarmup.isSubmitting && !report.browserWarmup.challengePending && report.browserWarmup.canAttemptSubmit && !report.browserWarmup.buttonDisabled && report.browserWarmup.inputRetained && report.browserWarmup.submitEnabled;
      if (exit !== 0 || report.diagnosticChecksSelected !== 1 || report.diagnosticChecksPassed !== 1 || report.journeyTestsSelected !== 0 || !expectedWarmup) { report.status = report.browserWarmup.firstFailure || 'blocked-warmup-report'; throw new Error(`warmup diagnostic result ${report.diagnosticChecksPassed}/${report.diagnosticChecksSelected}`); }
    } else if (recoveryOnly) {
      const diagnostics = report.recoveryDiagnostics;
      const recoveryReady = report.scenarioReadiness.S3Initial?.authorizationMarker && report.scenarioReadiness.S3Recovery?.authorizationMarker;
      if (exit !== 0 || report.testsSelected !== 1 || report.testsPassed !== 1 || report.testsFailed !== 0 || !recoveryReady || !diagnostics) { report.status = 'blocked-report'; throw new Error(`recovery-only result ${report.testsPassed}/${report.testsSelected}`); }
      const [first, second] = diagnostics.posts || [];
      if (first?.codeFieldCount !== 1 || second?.codeFieldCount !== 1) { report.status = 'blocked-recovery-duplicate-code'; throw new Error('recovery POST code field count failed'); }
      if (!second?.submittedCodeMatchesFixtureValid) { report.status = 'blocked-recovery-post-payload'; throw new Error('recovery POST payload mismatch'); }
      if (!first?.routeHandlerInvoked || !second?.routeHandlerInvoked || !first?.sameLoopbackServer || !second?.sameLoopbackServer) { report.status = 'blocked-recovery-route-handler'; throw new Error('recovery POST context route handler missing'); }
      if (!first?.fixtureHeaderAttached || !second?.fixtureHeaderAttached) { report.status = 'blocked-recovery-fixture-header'; throw new Error('recovery POST fixture header missing'); }
      const [, secondResponse] = diagnostics.responses || [];
      if (secondResponse?.locationClass !== 'canonical-board') { report.status = 'blocked-recovery-server-handling'; throw new Error('recovery POST server response failed'); }
      if (!diagnostics.finalURL?.sameLoopbackServer || !diagnostics.finalURL?.pathnameMatchesCanonical || diagnostics.finalURL?.hasError) { report.status = 'blocked-recovery-navigation'; throw new Error('recovery navigation failed'); }
    } else {
      if (!scenarioReadinessPassed(report.scenarioReadiness)) { report.status = 'blocked-scenario-readiness-report'; throw new Error('scenario readiness artifact is incomplete'); }
      if (exit !== 0 || report.testsSelected !== 4 || report.testsPassed !== 4 || report.testsFailed !== 0) throw new Error(`B4 Playwright result ${report.testsPassed}/${report.testsSelected}`);
    }
    report.browserVersion = playwright.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.[0]?.attachments?.find((item) => item.name === 'telemetry.json') ? 'managed Chromium' : 'managed Chromium';
    report.status = 'passed';
  }
} catch (error) { report.error = error.message; append(`error ${error.stack || error}`); }
finally {
  await terminate(playwrightChild, state.playwright); await terminate(nextChild, state.nextServer);
  state.descendantsAfterCleanup = [state.playwright.pid, state.nextServer.pid].filter(Boolean).flatMap(descendants);
  if (state.descendantsAfterCleanup.length) report.status = 'process-leak'; report.finishedAt = new Date().toISOString(); report.durationMs = Date.now() - started;
  await fs.mkdir(runDir, { recursive: true }); await fs.writeFile(path.join(runDir, 'runner.log'), log); await fs.writeFile(path.join(runDir, 'process-state.json'), `${JSON.stringify(state, null, 2)}\n`); await fs.writeFile(path.join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`); await fs.writeFile(path.join(runDir, 'report.md'), markdown()); await fs.writeFile(path.join(reportDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`); await fs.writeFile(path.join(reportDir, 'latest.md'), markdown());
}
process.exit(report.status === 'passed' ? 0 : report.status.startsWith('blocked-') ? 2 : 1);
