export const TEST_MANIFEST_VERSION = "2026-10-05-provider-impact-refinement-r1";

export const TEST_MANIFEST_EXPECTATION = Object.freeze({
  // Private-root runnable test cardinality; public-export source overlays run only at their exported target paths.
  tracked: 1051,
  supported: 1050,
  excluded: 1,
  source: 27,
  unclassified: 0,
  "duplicate-primary": 0,
  missing: 0,
});

export const TEST_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/i;

export const PRIMARY_SUITES = [
  { id: "QA-SUITE-001", group: "auth", description: "Node auth and permission contracts", patterns: ["auth", "permission", "ownership", "turnstile", "session", "rls"] },
  { id: "QA-SUITE-002", group: "storage", description: "Storage, files, uploads, R2, and downloads", patterns: ["storage", "file", "upload", "attachment", "asset", "blob", "r2", "download", "export"] },
  { id: "QA-SUITE-003", group: "provider", description: "WebLLM and external provider contracts", patterns: ["webllm", "openai", "provider", "drive", "stripe", "resend", "billing", "inquiry"] },
  { id: "QA-SUITE-004", group: "async", description: "Async, polling, streaming, retry, and stale-state contracts", patterns: ["async", "poll", "stream", "queue", "job", "retry", "stale", "abort", "race", "realtime"] },
  { id: "QA-SUITE-005", group: "route", description: "Route, API, public, middleware, and deploy contracts", patterns: ["route", "api", "middleware", "public", "deploy", "cloudflare", "worker", "health", "smoke"] },
  { id: "QA-SUITE-006", group: "data", description: "Node product and UI contracts", patterns: ["board", "card", "dashboard", "student", "teacher", "class", "lesson", "course", "website-studio", "ui", "theme", "menu", "panel", "modal", "overlay"] },
  { id: "QA-SUITE-007", group: "docs", description: "Documentation, SSOT, manifest, schema, and migration contracts", patterns: ["doc", "ssot", "manifest", "schema", "migration", "readiness", "compliance", "legal"] },
  { id: "QA-SUITE-008", group: "data", description: "Other Node unit and contract tests", patterns: [] },
  { id: "QA-SUITE-009", group: "ui", description: "jsdom UI tests", special: "ui-runner" },
  { id: "QA-SUITE-010", group: "source", description: "Tests colocated with app, lib, and scripts source", special: "source" },
  { id: "QA-SUITE-011", group: "smoke-contract", description: "Guard, smoke, and unsupported test assets", special: "guard-smoke-excluded" },
];

export const TEST_GROUPS = [
  { id: "all", description: "All supported tracked tests", executable: true, minimumExpectedFiles: 895, allowEmpty: false, selectorEnabled: true },
  { id: "node", description: "Node tests that do not require jsdom and are not guard/smoke tests", executable: true, minimumExpectedFiles: 771, allowEmpty: false, selectorEnabled: true, setup: "tests/setup-node-env.cjs" },
  { id: "ui", description: "Tests requiring the jsdom UI setup", executable: true, minimumExpectedFiles: 25, allowEmpty: false, selectorEnabled: true, setup: "tests/setup-ui-env.cjs" },
  { id: "guards", description: "All tracked guard test files", executable: true, minimumExpectedFiles: 103, allowEmpty: false, selectorEnabled: true, setup: "tests/setup-node-env.cjs" },
  { id: "webllm", description: "WebLLM unit and contract tests; no browser model download", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true, setup: "tests/setup-node-env.cjs" },
  { id: "source", description: "Supported tests colocated under app, lib, and scripts", executable: true, minimumExpectedFiles: 24, allowEmpty: false, selectorEnabled: true, setup: "tests/setup-node-env.cjs" },
  { id: "docs", description: "Documentation and SSOT test contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "auth", description: "Authentication and permission contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "data", description: "Data and general unit contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "storage", description: "Storage and file contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "provider", description: "External provider unit and contract tests", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "async", description: "Async and state-transition contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "route", description: "Route and API contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "deploy", description: "Deploy and runtime configuration contracts", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
  { id: "smoke-contract", description: "Local smoke contract tests without external browser/provider execution", executable: true, minimumExpectedFiles: 1, allowEmpty: false, selectorEnabled: true },
];

export const EXCLUDED_TESTS = [
  {
    path: "tests/inferSlotFromText.test.ts",
    status: "EXCLUDED-UNSUPPORTED",
    reason: "Uses node:test mock.module before importing the subject. The canonical esbuild bundle inlines that dependency, so the module mock cannot intercept it; widening transpilation or loader behavior is outside the supported runner boundary.",
    primarySuite: "QA-SUITE-011",
    currentlyCalled: false,
    evidence: "tests/README.md",
  },
];

export const TEST_RUNNER_OVERRIDES = [
  {
    path: "tests/e2e-smoke-supabase-api-key-headers.test.mjs",
    runner: "direct-node",
    reason: "This test uses createRequire(import.meta.url) to load the source-relative CommonJS Supabase API-key header helper. Esbuild relocation moves import.meta.url into .test-dist and breaks that runtime relative require. Direct Node preserves the original module location without changing assertions or helper behavior.",
  },
  {
    path: "scripts/architecture/pr-fast-checks.test.mjs",
    runner: "direct-node",
    reason: "This test imports CLI modules whose import.meta.url main guards are collapsed into the test bundle by esbuild, causing select-seam-checks.mjs and pr-fast-checks.mjs to execute as CLIs before assertions run. Direct Node preserves distinct module URLs and the intended CLI boundary without changing assertions or coverage.",
  },
  {
    path: "scripts/architecture/dependency-impact.test.mjs",
    runner: "direct-node",
    reason: "This test imports source-dependencies.mjs, which imports the TypeScript runtime. Esbuild ESM bundling inlines TypeScript CommonJS __filename assumptions and fails before assertions execute. Direct Node preserves the package runtime boundary without changing assertions or coverage.",
  },
  {
    path: "scripts/architecture/source-dependencies.test.mjs",
    runner: "direct-node",
    reason: "This test imports the TypeScript runtime through source-dependencies.mjs. Esbuild ESM bundling inlines TypeScript CommonJS __filename assumptions and fails before assertions execute. Direct Node preserves the package runtime boundary without changing assertions or coverage.",
  },
  {
    path: "tests/architecture-seam-selector.guard.test.mjs",
    runner: "direct-node",
    reason: "Imported architecture CLIs use import.meta.url for repository paths and main guards. Esbuild collapses those module identities into the test bundle, causing incorrect Git scope and CLI execution. Direct Node preserves the source locations and runs every existing assertion.",
  },
  {
    path: "scripts/selfcheck/scan.test.mjs",
    runner: "direct-node",
    reason: "scan.mjs derives repository paths from import.meta.url; esbuild bundling relocates that URL, so this test must run from its original source location.",
  },
  {
    path: "scripts/ssot/env.contract.test.mjs",
    runner: "direct-node",
    reason: "env-inventory.mjs resolves env.inventory.json relative to import.meta.url; esbuild bundling relocates that source-relative path, so this test must run from its original repository location.",
  },
  {
    path: "tests/decorate-one-click-playwright.test.mjs",
    runner: "direct-node",
    reason: "This optional browser E2E test imports Playwright only at runtime; esbuild bundling follows Playwright's internal packages and native fsevents.node, while direct Node preserves the existing skip and E2E behavior.",
  },
  {
    path: "tests/lesson-list-jt-entry.playwright.test.mjs",
    runner: "direct-node",
    reason: "This optional browser E2E test imports Playwright through its runtime helper; esbuild bundling follows Playwright's internal packages and native fsevents.node, while direct Node preserves its configured skip and E2E behavior.",
  },
  {
    path: "tests/q2-b10-multi-user-polling-contract.test.mjs",
    runner: "direct-node",
    reason: "This contract test reads tracked Q2-B10 sources relative to import.meta.url; esbuild relocates the test into .test-dist and breaks those source paths, so direct Node preserves the existing contract inspection.",
  },
  {
    path: "tests/q2-b11-design-accessibility-contract.test.mjs",
    runner: "direct-node",
    reason: "This contract test reads tracked Q2-B11 sources relative to import.meta.url; esbuild relocates the test into .test-dist and breaks those source paths, so direct Node preserves the existing contract inspection.",
  },
  {
    path: "tests/q5-readiness-manifest-and-static-preflight.test.mjs",
    runner: "direct-node",
    reason: "The imported Q5 preflight module resolves repository assets relative to its source import.meta.url; esbuild relocation changes that base to .test-dist, while direct Node preserves source-relative config/docs validation. This is not a test exclusion or assertion relaxation.",
  },
  {
    path: "tests/q5-supabase-migration-chain-checker-contract.test.mjs",
    runner: "direct-node",
    reason: "This contract test imports analyzeDirectory() from the Q5 migration-chain checker; the checker derives the repository root from import.meta.url, so esbuild relocation makes it inspect .test-dist/supabase instead of the source-relative migration inventory. Direct Node preserves the existing repository inventory contract without excluding the test or weakening assertions.",
  },
  {
    path: "tests/supabase-migration-filename-version.guard.test.mjs",
    runner: "direct-node",
    reason: "This focused migration guard imports the checker module and spawns its CLI; direct Node keeps the import-time CLI boundary and repository-relative migration inventory intact instead of bundling the checker into .test-dist.",
  },
  {
    path: "tests/q5-supabase-migration-chain-checker.test.mjs",
    runner: "direct-node",
    reason: "This test runs analyzeDirectory() from the imported checker module; the checker resolves supabase/migrations from its source import.meta.url, so esbuild relocation incorrectly moves the lookup to .test-dist/supabase. Direct Node preserves validation of the actual repository migration inventory without excluding the test or weakening assertions.",
  },
  {
    path: "tests/q5-supabase-offline-dependency-resolution-plan-scope-contract.test.mjs",
    runner: "direct-node",
    reason: "This test directly imports and calls analyzeDirectory() from q5-supabase-migration-chain-checker.mjs; the checker reads supabase/migrations relative to its source import.meta.url, while esbuild relocation redirects that lookup to .test-dist/supabase. Direct Node preserves actual migration inventory analysis without excluding the test or weakening assertions.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-entry-gate.test.mjs",
    runner: "direct-node",
    reason: "This test directly imports and executes the R3 entry-gate exported functions from scripts/qa/q5-supabase-offline-disposable-local-replay-r3-entry-gate.mjs. That SHA-bound source retains a legacy import.meta.url CLI guard; esbuild makes the test bundle URL and argv coincide, incorrectly running main(). Direct Node preserves the source/module URL and prevents the CLI false positive while keeping raw source bytes for the tracked SHA contract. This is not a test exclusion or assertion relaxation.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-failure-semantics.test.mjs",
    runner: "direct-node",
    reason: "This test directly imports and executes exported functions from scripts/qa/q5-supabase-offline-disposable-local-replay-r3-failure-semantics.mjs. The SHA-bound source retains a legacy import.meta.url CLI guard; esbuild makes the test bundle URL and argv coincide, incorrectly running main(). Direct Node preserves the source/module URL and prevents the CLI false positive while keeping raw source bytes required by the tracked SHA contract. This is not a test exclusion or assertion relaxation, and the test exercises failure semantics rather than only spawning a CLI.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-service-command-authority.test.mjs",
    runner: "direct-node",
    reason: "This test directly imports and executes exported functions from scripts/qa/q5-supabase-offline-disposable-local-replay-r3-service-command-authority.mjs. The SHA-bound source retains a legacy import.meta.url CLI guard; esbuild makes the test bundle URL and argv coincide, incorrectly running main(). Direct Node preserves the source/module URL and prevents the CLI false positive while keeping raw source bytes required by the tracked SHA contract. This is not a test exclusion or assertion relaxation, and the test exercises service-command authority rather than only spawning a CLI.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-lifecycle-enforcement.test.mjs",
    runner: "direct-node",
    reason: "This test directly imports and executes exported functions from scripts/qa/q5-supabase-offline-disposable-local-replay-r3-lifecycle-enforcement.mjs. The SHA-bound source retains a legacy import.meta.url CLI guard; esbuild makes the test bundle URL and argv coincide, incorrectly running main(). Direct Node preserves the source/module URL and prevents the CLI false positive while keeping raw source bytes required by the tracked SHA contract. This is not a test exclusion or assertion relaxation, and the test exercises lifecycle enforcement rather than only spawning a CLI.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-official-source-acquisition-coordinator.test.mjs",
    runner: "direct-node",
    reason: "The coordinator test imports the SHA-bound coordinator source, whose import graph includes the SHA-bound execution-control source. Esbuild bundling collapses their module URLs into the test bundle, causing legacy CLI guards to execute execution-control main without an allowed mode. Direct-node preserves distinct source module URLs without changing source bytes, SHA bindings, assertions, or CLI behavior.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-official-source-acquisition-execution-terminal-semantics.test.mjs",
    runner: "direct-node",
    reason: "The terminal-semantics test imports the SHA-bound terminal-semantics source, which imports the SHA-bound execution-control source. Esbuild bundling collapses the module URLs and incorrectly activates execution-control's legacy CLI guard. Direct-node preserves the original module identities without changing tracked source bytes or digest contracts.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-official-source-acquisition-adapters.test.mjs",
    runner: "direct-node",
    reason: "The adapters test directly imports the SHA-bound acquisition scope and adapters sources. Both sources retain legacy CLI guards that are incorrectly activated when esbuild combines their module URLs into the test bundle, setting exit 2 because no CLI mode is present. Direct-node preserves distinct source module identities without changing source bytes, SHA bindings, assertions, or CLI behavior.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-official-source-acquisition-execution-control.test.mjs",
    runner: "direct-node",
    reason: "The execution-control test directly imports the SHA-bound execution-control source. Esbuild bundling collapses the source module URL into the test bundle and incorrectly activates its legacy CLI guard, running main without an allowed mode and producing the 0 !== 1 assertion. Direct-node preserves the original source module identity without changing source bytes, SHA bindings, test assertions, or CLI behavior.",
  },
  {
    path: "tests/q5-supabase-offline-disposable-local-replay-r3-official-source-acquisition-scope.test.mjs",
    runner: "direct-node",
    reason: "The scope test directly imports the SHA-bound official-source acquisition scope source. Esbuild bundling collapses the source module URL into the test bundle and incorrectly activates the source's legacy CLI guard, producing unsupported mode and exit 2 because no CLI mode is present. Direct-node preserves the original source module identity without changing source bytes, SHA bindings, test assertions, or CLI behavior.",
  },
];

export const TEST_MANIFEST = {
  schemaVersion: 1,
  manifestVersion: TEST_MANIFEST_VERSION,
  trackedRoots: ["tests", "app", "lib", "scripts"],
  testFilePattern: TEST_FILE_PATTERN.source,
  groups: TEST_GROUPS,
  primarySuites: PRIMARY_SUITES,
  excludedTests: EXCLUDED_TESTS,
  testRunnerOverrides: TEST_RUNNER_OVERRIDES,
};
