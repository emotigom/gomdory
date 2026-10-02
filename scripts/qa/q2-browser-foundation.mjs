#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaults = path.join(root, '.cache/q2-browser/foundation');
const args = process.argv.slice(2);
let reportDir = defaults;
if (args[0] === '--help') {
  console.log('Usage: node scripts/qa/q2-browser-foundation.mjs [--report-dir <path>]');
  process.exit(0);
}
if (args.length === 2 && args[0] === '--report-dir') reportDir = path.resolve(root, args[1]);
else if (args.length) {
  console.error('Invalid arguments. Only --report-dir <path> is supported.');
  process.exit(2);
}

const startedAt = new Date().toISOString();
const started = Date.now();
const runId = `${started}-${process.pid}`;
const runDir = path.join(reportDir, 'runs', runId);
const state = { runner: { pid: process.pid, aliveAfterCleanup: null }, fixtureServer: {}, passingPlaywright: {}, failurePlaywright: {}, descendantsAfterCleanup: [] };
const report = {
  schemaVersion: 1, workId: 'Q2-B3', status: 'failed', packageVersion: null,
  browserProfile: 'Playwright managed Chromium', browserVersion: null, browserExecutable: null,
  fixtureMode: 'owned loopback HTTP fixture', baseURL: null,
  viewports: { mobile: { width: 390, height: 844 }, laptop: { width: 1280, height: 800 } },
  passingTestsSelected: 0, passingTestsPassed: 0, intentionalFailureObserved: false,
  consoleErrors: [], pageErrors: [], failedRequests: [], screenshots: [], traces: [],
  processes: state, warnings: [], startedAt, finishedAt: null, durationMs: null,
};
let serverChild;
let passingChild;
let failureChild;
let timedOut = false;
let log = '';

const appendLog = (line) => { log += `${new Date().toISOString()} ${line}\n`; };
const writeJson = async (target, value) => fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
const exists = (target) => fssync.existsSync(target);
const isAlive = (pid) => Boolean(pid) && (() => { try { process.kill(pid, 0); return true; } catch { return false; } })();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function filesNamed(dir, name, found = []) {
  if (!exists(dir)) return found;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) await filesNamed(target, name, found);
    else if (entry.name === name || (name === '.png' && entry.name.endsWith('.png'))) found.push(target);
  }
  return found;
}

function descendants(pid) {
  if (!pid) return [];
  const result = spawnSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  const byParent = new Map();
  for (const line of result.stdout.trim().split('\n')) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (Number.isInteger(child) && Number.isInteger(parent)) byParent.set(parent, [...(byParent.get(parent) || []), child]);
  }
  const found = [];
  const visit = (parent) => forEachChild(parent);
  const forEachChild = (parent) => { for (const child of byParent.get(parent) || []) { found.push(child); visit(child); } };
  visit(pid);
  return found;
}

async function terminate(child, record) {
  if (!child?.pid) return;
  if (isAlive(child.pid)) child.kill('SIGTERM');
  const limit = Date.now() + 5_000;
  while (isAlive(child.pid) && Date.now() < limit) await sleep(50);
  if (isAlive(child.pid)) child.kill('SIGKILL');
  record.aliveAfterCleanup = isAlive(child.pid);
}

function runChild(label, command, commandArgs, env, record, outputFile) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd: root, env: { ...process.env, ...env }, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    if (label === 'passing') passingChild = child;
    else failureChild = child;
    record.pid = child.pid;
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 90_000);
    child.on('error', (error) => { stderr += `${error.stack || error}\n`; });
    child.on('close', async (code, signal) => {
      clearTimeout(timeout);
      record.exitCode = code;
      record.signal = signal;
      record.aliveAfterExit = isAlive(child.pid);
      await fs.writeFile(outputFile, stdout);
      appendLog(`${label} child pid=${child.pid} exit=${code} signal=${signal || 'none'} stderr=${stderr.trim()}`);
      resolve({ code, stdout, stderr });
    });
  });
}

function health(baseURL) {
  return new Promise((resolve) => {
    const request = http.get(`${baseURL}/health`, (response) => { response.resume(); resolve(response.statusCode === 200); });
    request.on('error', () => resolve(false));
    request.setTimeout(1_000, () => { request.destroy(); resolve(false); });
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverChild = spawn(process.execPath, ['tests/browser/fixtures/foundation-server.mjs'], { cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    state.fixtureServer.pid = serverChild.pid;
    let stderr = '';
    serverChild.stderr.on('data', (chunk) => { stderr += chunk; });
    serverChild.stdout.once('data', (chunk) => {
      try { resolve(JSON.parse(chunk.toString().trim())); } catch (error) { reject(error); }
    });
    serverChild.once('error', reject);
    serverChild.once('exit', (code) => reject(new Error(`fixture server exited early (${code}): ${stderr}`)));
  });
}

function markdown() {
  return `# Q2-B3 browser foundation evidence\n\nStatus: **${report.status}**\n\nThis is isolated browser-foundation evidence.\nIt is not a product journey, visual-baseline, preview, production, or release-readiness approval.\n\n- Package: ${report.packageVersion || 'unavailable'}\n- Browser: ${report.browserVersion || 'unavailable'}\n- Executable: ${report.browserExecutable || 'unavailable'}\n- Viewports: mobile 390x844; laptop 1280x800\n- Passing tests: ${report.passingTestsPassed}/${report.passingTestsSelected}\n- Intentional failure observed: ${report.intentionalFailureObserved}\n- Console errors: ${report.consoleErrors.length}\n- Page errors: ${report.pageErrors.length}\n- Failed requests: ${report.failedRequests.length}\n- Screenshots: ${report.screenshots.length}\n- Traces: ${report.traces.length}\n- Process cleanup: ${state.descendantsAfterCleanup.length === 0 ? 'passed' : 'failed'}\n`;
}

try {
  await fs.mkdir(runDir, { recursive: true });
  const packagePath = path.join(root, 'node_modules/@playwright/test/package.json');
  const cliPath = path.join(root, 'node_modules/@playwright/test/cli.js');
  if (!exists(packagePath) || !exists(cliPath)) { report.status = 'blocked-dependency'; throw new Error('local @playwright/test package or CLI is missing'); }
  report.packageVersion = JSON.parse(await fs.readFile(packagePath, 'utf8')).version;
  const executableProbe = spawnSync(process.execPath, ['-e', "const {chromium}=require('@playwright/test');process.stdout.write(chromium.executablePath())"], { cwd: root, encoding: 'utf8' });
  report.browserExecutable = executableProbe.stdout.trim();
  if (executableProbe.status !== 0 || !exists(report.browserExecutable)) { report.status = 'blocked-browser'; throw new Error('Playwright managed Chromium executable is missing'); }

  const fixture = await startServer();
  state.fixtureServer = { ...state.fixtureServer, ...fixture };
  report.baseURL = fixture.baseURL;
  for (let attempt = 0; attempt < 20 && !(await health(fixture.baseURL)); attempt += 1) await sleep(100);
  if (!(await health(fixture.baseURL))) { report.status = 'blocked-environment'; throw new Error('owned fixture server did not pass health check'); }

  const passingArtifacts = path.join(runDir, 'passing-artifacts');
  const failureArtifacts = path.join(runDir, 'failure-artifacts');
  const commonEnv = { Q2_FOUNDATION_BASE_URL: fixture.baseURL };
  const passing = await runChild('passing', process.execPath, [cliPath, 'test', 'tests/browser/foundation.spec.mjs', '--reporter=json'], { ...commonEnv, Q2_BROWSER_OUTPUT_DIR: passingArtifacts }, state.passingPlaywright, path.join(runDir, 'passing-playwright.json'));
  if (timedOut) { report.status = 'timed-out'; throw new Error('passing child timed out'); }
  if (passing.code !== 0) throw new Error(`passing foundation tests failed (${passing.code})`);
  const telemetryPaths = await filesNamed(passingArtifacts, 'telemetry.json');
  const telemetry = await Promise.all(telemetryPaths.map(async (target) => JSON.parse(await fs.readFile(target, 'utf8'))));
  report.passingTestsSelected = telemetry.length;
  report.passingTestsPassed = telemetry.length;
  if (telemetry.length !== 2) throw new Error(`expected exactly two passing telemetry files, found ${telemetry.length}`);
  for (const item of telemetry) {
    report.browserVersion ||= item.browserVersion;
    report.browserExecutable = item.browserExecutable;
    report.consoleErrors.push(...item.consoleErrors);
    report.pageErrors.push(...item.pageErrors);
    report.failedRequests.push(...item.failedRequests);
  }
  if (!report.consoleErrors.filter((value) => value.includes('q2-foundation-console-error')).length || !report.pageErrors.filter((value) => value.includes('q2-foundation-page-error')).length || !report.failedRequests.filter((value) => value.url.includes('/abort')).length) throw new Error('required telemetry markers were not collected');

  const failure = await runChild('failure', process.execPath, [cliPath, 'test', 'tests/browser/foundation-failure.spec.mjs', '--project=foundation-mobile', '--reporter=json'], { ...commonEnv, Q2_BROWSER_OUTPUT_DIR: failureArtifacts }, state.failurePlaywright, path.join(runDir, 'failure-playwright.json'));
  if (timedOut) { report.status = 'timed-out'; throw new Error('failure child timed out'); }
  if (failure.code === 0) throw new Error('intentional failure child unexpectedly passed');
  const failureJson = JSON.parse(await fs.readFile(path.join(runDir, 'failure-playwright.json'), 'utf8'));
  const failed = JSON.stringify(failureJson).match(/q2-foundation-intentional-failure/g) || [];
  if (failed.length < 1) throw new Error('intentional failure marker missing from Playwright JSON');
  report.intentionalFailureObserved = true;
  report.screenshots = await filesNamed(failureArtifacts, '.png');
  report.traces = await filesNamed(failureArtifacts, 'trace.zip');
  if (!report.screenshots.length || !report.traces.length) throw new Error('intentional failure screenshot or trace is missing');
  report.status = 'passed';
} catch (error) {
  appendLog(`error ${error.stack || error}`);
  if (report.status === 'failed' && timedOut) report.status = 'timed-out';
  report.error = error.message;
} finally {
  await terminate(passingChild, state.passingPlaywright);
  await terminate(failureChild, state.failurePlaywright);
  await terminate(serverChild, state.fixtureServer);
  const owned = [state.fixtureServer.pid, state.passingPlaywright.pid, state.failurePlaywright.pid].filter(Boolean);
  state.descendantsAfterCleanup = owned.flatMap((pid) => descendants(pid));
  state.runner.aliveAfterCleanup = true;
  if (state.descendantsAfterCleanup.length) report.status = 'process-leak';
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - started;
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, 'runner.log'), log);
  await writeJson(path.join(runDir, 'process-state.json'), state);
  await writeJson(path.join(runDir, 'report.json'), report);
  await fs.writeFile(path.join(runDir, 'report.md'), markdown());
  await writeJson(path.join(reportDir, 'latest.json'), report);
  await fs.writeFile(path.join(reportDir, 'latest.md'), markdown());
}

process.exit(report.status === 'passed' ? 0 : ['blocked-dependency', 'blocked-browser', 'blocked-environment'].includes(report.status) ? 2 : 1);
