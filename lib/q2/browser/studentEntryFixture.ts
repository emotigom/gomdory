import type { SharedBoardViewModel } from "@/lib/boards/toSharedViewModel";
import type { ShareBoard } from "@/lib/data/share";
import { api } from "@/lib/standards/routes";
import { normalizeShareCode } from "@/lib/student/shareCode";
import { Q2_B10_FIXTURE_MODE, Q2_B10_RESET_PATH, Q2_B10_SHARE_CODE, Q2_B10_SNAPSHOT_PATH, Q2_B10_WALL_A_ID, createQ2B10Card, q2B10StudentFixture } from "@/lib/q2/browser/multiUserPollingFixture";

export const Q2_B4_FIXTURE_MODE = "student-entry-v1";
export const Q2_B4_FIXTURE_TOKEN_HEADER = "x-q2-browser-fixture-token";
export const Q2_B4_FIXTURE_AUTHORIZATION_HEADER = "x-q2-browser-fixture-authorized";
export const Q2_B4_VALID_CODE = "q2b4a8";
export const Q2_B4_INVALID_CODE = "bad999";
export const Q2_B4_BOARD_TITLE = "Q2 B4 학생 입장 테스트 보드";
export const Q2_B4_SECTION_TITLE = "입장 확인 섹션";
export const Q2_B5_FIXTURE_MODE = "student-card-creation-v1";
export const Q2_B5_VALID_CODE = "q2b5a8";
export const Q2_B5_WALL_ID = "00000000-0000-4000-8000-0000000000b5";
export const Q2_B5_BOARD_TITLE = "Q2 B5 학생 카드 작성 테스트 보드";
export const Q2_B5_SECTION_TITLE = "카드 작성 섹션";
export const Q2_B5_RESET_PATH = "/api/q2/browser/student-card-fixture/reset";
export const Q4_STUDENT_COMPOSE_FIXTURE_MODE = "student-card-compose-semantic-feedback-v1";
export const Q2_B9_D_FIXTURE_MODE = "turnstile-integration-v1";
export const Q2_B9_D_VALID_CODE = "q2b9d8";
export const Q2_B9_D_WALL_ID = "00000000-0000-4000-8000-0000000009d4";
export const Q2_B9_D_RESET_PATH = "/api/q2/browser/turnstile-integration-fixture/reset";
export const Q2_B9_E_FIXTURE_MODE = "llm-integration-v1";
export const Q2_B9_E_RESET_PATH = "/api/q2/browser/llm-integration-fixture/reset";

export type FixtureIngressInput = {
  headers: Headers;
  nodeEnv: string | undefined;
  mode: string | undefined;
  expectedToken: string | undefined;
  hostname: string;
  pathname: string;
};

export type FixtureIngressResult = {
  headers: Headers;
  eligible: boolean;
  authorized: boolean;
  secretRemoved: boolean;
  spoofedInternalHeaderRemoved: boolean;
};

export function isQ2B4StudentFixturePath(pathname: string): boolean {
  return pathname === "/s" || pathname.startsWith("/s/");
}

export function isQ2BrowserFixturePath(pathname: string, mode: string | undefined): boolean {
  if (isQ2B4StudentFixturePath(pathname)) return true;
  if (mode === Q2_B5_FIXTURE_MODE || mode === Q4_STUDENT_COMPOSE_FIXTURE_MODE) {
    return pathname === api.share.wallCards(Q2_B5_VALID_CODE, Q2_B5_WALL_ID) ||
      pathname === api.v1("share", Q2_B5_VALID_CODE, "sync") || pathname === Q2_B5_RESET_PATH ||
      /^\/api\/v1\/share\/q2b5a8\/cards\/[^/]+\/files\/initiate$/.test(pathname) ||
      /^\/api\/v1\/share\/q2b5a8\/files\/[^/]+\/(?:finalize|delete|download)$/.test(pathname) ||
      /^\/api\/q2\/browser\/student-card-fixture\/upload\/[^/]+$/.test(pathname);
  }
  if (mode === Q2_B9_D_FIXTURE_MODE) {
    return pathname === api.share.wallCards(Q2_B9_D_VALID_CODE, Q2_B9_D_WALL_ID) ||
      pathname === Q2_B9_D_RESET_PATH;
  }
  if (mode === Q2_B9_E_FIXTURE_MODE) {
    return pathname === api.v1("tools", "student-records", "generate-guest") || pathname === Q2_B9_E_RESET_PATH;
  }
  if (mode === Q2_B10_FIXTURE_MODE) return pathname === `/s/${Q2_B10_SHARE_CODE}` || pathname === api.share.wallCards(Q2_B10_SHARE_CODE, Q2_B10_WALL_A_ID) || pathname === api.v1("share", Q2_B10_SHARE_CODE, "sync") || pathname === Q2_B10_RESET_PATH || pathname === Q2_B10_SNAPSHOT_PATH || pathname === "/dashboard/boards/00000000-0000-4000-8000-0000000000ba/board" || /^\/api\/v1\/dashboard\/cards\/[^/]+\/visibility$/.test(pathname);
  return false;
}

export function isQ2B4LoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host === "127.0.0.1";
}

function constantTimeTokenMatch(expectedToken: string, receivedToken: string): boolean {
  const expected = new TextEncoder().encode(expectedToken);
  const received = new TextEncoder().encode(receivedToken);
  const maxLength = Math.max(expected.length, received.length);
  let difference = expected.length ^ received.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (expected[index] ?? 0) ^ (received[index] ?? 0);
  }

  return difference === 0;
}

export async function buildStudentEntryFixtureIngress({
  headers: inputHeaders,
  nodeEnv,
  mode,
  expectedToken,
  hostname,
  pathname,
}: FixtureIngressInput): Promise<FixtureIngressResult> {
  const headers = new Headers(inputHeaders);
  const receivedToken = headers.get(Q2_B4_FIXTURE_TOKEN_HEADER);
  const hadSecret = headers.has(Q2_B4_FIXTURE_TOKEN_HEADER);
  const hadInternalAuthorization = headers.has(Q2_B4_FIXTURE_AUTHORIZATION_HEADER);
  headers.delete(Q2_B4_FIXTURE_TOKEN_HEADER);
  headers.delete(Q2_B4_FIXTURE_AUTHORIZATION_HEADER);

  const eligible =
    nodeEnv !== "production" &&
    (mode === Q2_B4_FIXTURE_MODE || mode === Q2_B5_FIXTURE_MODE || mode === Q4_STUDENT_COMPOSE_FIXTURE_MODE || mode === Q2_B9_D_FIXTURE_MODE || mode === Q2_B9_E_FIXTURE_MODE || mode === Q2_B10_FIXTURE_MODE) &&
    isQ2B4LoopbackHost(hostname) &&
    isQ2BrowserFixturePath(pathname, mode) &&
    Boolean(expectedToken) &&
    Boolean(receivedToken);
  const authorized = Boolean(
    eligible && expectedToken && receivedToken && constantTimeTokenMatch(expectedToken, receivedToken),
  );

  if (authorized) headers.set(Q2_B4_FIXTURE_AUTHORIZATION_HEADER, "1");

  return {
    headers,
    eligible,
    authorized,
    secretRemoved: hadSecret && !headers.has(Q2_B4_FIXTURE_TOKEN_HEADER),
    spoofedInternalHeaderRemoved:
      hadInternalAuthorization && !headers.has(Q2_B4_FIXTURE_AUTHORIZATION_HEADER),
  };
}

export function isQ2B5StudentCardFixtureEnabled(authorization: string | null | undefined): boolean {
  return process.env.NODE_ENV !== "production" &&
    [Q2_B5_FIXTURE_MODE, Q4_STUDENT_COMPOSE_FIXTURE_MODE].includes(process.env.Q2_BROWSER_FIXTURE_MODE || "") && authorization === "1";
}
export function isQ2B5StudentCardFixtureTarget(code: string, wallId: string): boolean {
  return normalizeShareCode(code) === Q2_B5_VALID_CODE && wallId === Q2_B5_WALL_ID;
}
export function isQ2B10FixtureEnabled(authorization: string | null | undefined): boolean { return process.env.NODE_ENV !== "production" && process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B10_FIXTURE_MODE && authorization === "1"; }
export function isQ2B10FixtureTarget(code: string, wallId: string): boolean {
  return normalizeShareCode(code) === Q2_B10_SHARE_CODE && wallId === Q2_B10_WALL_A_ID;
}
export { Q2_B10_FIXTURE_MODE, Q2_B10_SHARE_CODE, Q2_B10_WALL_A_ID, q2B10StudentFixture, createQ2B10Card };

export function isQ2B9DTurnstileFixtureEnabled(authorization: string | null | undefined): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B9_D_FIXTURE_MODE && authorization === "1";
}
export function isQ2B9DTurnstileFixtureTarget(code: string, wallId: string): boolean {
  return normalizeShareCode(code) === Q2_B9_D_VALID_CODE && wallId === Q2_B9_D_WALL_ID;
}

export function isQ2B9ELlmFixtureEnabled(authorization: string | null | undefined): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B9_E_FIXTURE_MODE && authorization === "1";
}

export function isQ2B4StudentEntryFixtureAuthorized({
  nodeEnv,
  mode,
  authorization,
}: {
  nodeEnv: string | undefined;
  mode: string | undefined;
  authorization: string | null | undefined;
}): boolean {
  return nodeEnv !== "production" && mode === Q2_B4_FIXTURE_MODE && authorization === "1";
}

export function isQ2B4StudentEntryFixtureEnabled(authorization: string | null | undefined): boolean {
  return isQ2B4StudentEntryFixtureAuthorized({
    nodeEnv: process.env.NODE_ENV,
    mode: process.env.Q2_BROWSER_FIXTURE_MODE,
    authorization,
  });
}

export type Q2B4StudentEntryFixtureResolution =
  | { mode: "inactive" }
  | { mode: "active-invalid" }
  | { mode: "active-valid"; fixture: Q2B4StudentEntryFixture };

export type Q2B4StudentEntryFixture = {
  board: ShareBoard;
  viewModel: SharedBoardViewModel;
};

const fixtureBoard: ShareBoard = {
  id: "q2-b4-fixture-board", owner_id: "q2-b4-fixture-owner", title: Q2_B4_BOARD_TITLE, description: null,
  board_view_type: "wall", wall_v2_enabled: false, share_code: Q2_B4_VALID_CODE, share_enabled: true,
  share_updated_at: "2026-07-19T00:00:00.000Z", share_write_enabled: false, share_write_updated_at: "2026-07-19T00:00:00.000Z",
  class_state: "live", class_notice: null, class_updated_at: "2026-07-19T00:00:00.000Z", rules_text: null,
  rules_updated_at: "2026-07-19T00:00:00.000Z", tools_enabled: [], tools_updated_at: "2026-07-19T00:00:00.000Z", ui_minimap_mode: "hover",
};

const fixtureViewModel: SharedBoardViewModel = {
  columns: [{ id: "q2-b4-fixture-section", title: Q2_B4_SECTION_TITLE, description: "Q2-B4 local fixture section", uiColorToken: null,
    studentWriteEnabled: false, cards: [{ id: "q2-b4-fixture-card", wallId: "q2-b4-fixture-section", position: 0,
      text: "학생 입장 확인용 카드", authorType: "teacher", authorName: "선생님", createdAt: "2026-07-19T00:00:00.000Z",
      isPinned: false, isFeatured: false, cardColorToken: null, attachments: [] }], featuredCards: [], pinnedCards: [], totalCount: 0 }],
};

export function resolveQ2B4StudentEntryFixture({
  authorized,
  code,
}: {
  authorized: boolean;
  code: string;
}): Q2B4StudentEntryFixtureResolution {
  if (!authorized) return { mode: "inactive" };
  if (normalizeShareCode(code) !== Q2_B4_VALID_CODE) return { mode: "active-invalid" };
  return { mode: "active-valid", fixture: { board: fixtureBoard, viewModel: fixtureViewModel } };
}

export function getQ2B4StudentEntryFixture(code: string, authorized: boolean) {
  const resolution = resolveQ2B4StudentEntryFixture({ authorized, code });
  return resolution.mode === "active-valid" ? resolution.fixture : null;
}

type Q2B5FixtureCard = { id: string; text: string; authorClientId: string; createdAt: string };
type Q2B5FixtureStore = { cards: Map<string, Q2B5FixtureCard>; sequence: number; scenario: "success" | "create-failure" | "partial-upload"; uploadSequence: number; initiatedFiles: Map<string, string> };

// Next dev compiles route handlers into separate bundles.  Keep this local-process
// test store on globalThis so create/read/reset routes observe one run-local state.
function getQ2B5FixtureStore(): Q2B5FixtureStore {
  const globalStore = globalThis as typeof globalThis & { __gomCleanQ2B5FixtureStore?: Q2B5FixtureStore };
  if (!globalStore.__gomCleanQ2B5FixtureStore) {
    globalStore.__gomCleanQ2B5FixtureStore = { cards: new Map(), sequence: 0, scenario: "success", uploadSequence: 0, initiatedFiles: new Map() };
  }
  return globalStore.__gomCleanQ2B5FixtureStore;
}

export function resetQ2B5StudentCardFixtureStore() {
  const store = getQ2B5FixtureStore();
  store.cards.clear();
  store.sequence = 0;
  store.scenario = "success";
  store.uploadSequence = 0;
  store.initiatedFiles.clear();
}

export function setQ4StudentComposeFixtureScenario(value: unknown) {
  if (value !== "success" && value !== "create-failure" && value !== "partial-upload") return false;
  const store = getQ2B5FixtureStore();
  store.scenario = value;
  return true;
}

export function q4StudentComposeFixtureLedger() {
  const store = getQ2B5FixtureStore();
  return { scenario: store.scenario, cards: store.cards.size, initiatedFiles: store.initiatedFiles.size, uploadSequence: store.uploadSequence };
}

export function getQ2B5StudentCardFixture(code: string, authorized: boolean): Q2B4StudentEntryFixture | null {
  if (!authorized || normalizeShareCode(code) !== Q2_B5_VALID_CODE) return null;
  const cards = [...getQ2B5FixtureStore().cards.values()].map((card, index) => ({
    id: card.id, wallId: Q2_B5_WALL_ID, position: index, text: card.text, authorType: "student" as const,
    authorName: "학생", authorClientId: card.authorClientId, createdAt: card.createdAt,
    isPinned: false, isFeatured: false, cardColorToken: null, attachments: [],
  }));
  return {
    board: { ...fixtureBoard, id: "q2-b5-fixture-board", title: Q2_B5_BOARD_TITLE, share_code: Q2_B5_VALID_CODE, share_write_enabled: true },
    viewModel: { columns: [{ id: Q2_B5_WALL_ID, title: Q2_B5_SECTION_TITLE, description: "Q2-B5 local fixture section", uiColorToken: null,
      studentWriteEnabled: true, cards, featuredCards: [], pinnedCards: [], totalCount: cards.length }] },
  };
}

export function createQ2B5StudentFixtureCard(input: { text: string; authorClientId: string }) {
  const text = input.text.trim();
  if (!text) return null;
  const store = getQ2B5FixtureStore();
  if (store.scenario === "create-failure") return null;
  store.sequence += 1;
  const card = { id: `00000000-0000-4000-8000-${String(store.sequence).padStart(12, "0")}`, text,
    authorClientId: input.authorClientId || "q2-b5-guest", createdAt: "2026-07-19T00:00:00.000Z" };
  store.cards.set(card.id, card);
  return card;
}

export function createQ4StudentComposeUpload(cardId: string) {
  const store = getQ2B5FixtureStore();
  if (!store.cards.has(cardId)) return null;
  store.uploadSequence += 1;
  const fileId = `q4-fixture-file-${store.uploadSequence}`;
  store.initiatedFiles.set(fileId, cardId);
  return { fileId, uploadUrl: `/api/q2/browser/student-card-fixture/upload/${fileId}`, deduped: false };
}

export function finalizeQ4StudentComposeUpload(fileId: string) {
  const store = getQ2B5FixtureStore();
  if (!store.initiatedFiles.has(fileId)) return false;
  return !(store.scenario === "partial-upload" && fileId.endsWith("-2"));
}

export function deleteQ4StudentComposeUpload(fileId: string) { return getQ2B5FixtureStore().initiatedFiles.delete(fileId); }
