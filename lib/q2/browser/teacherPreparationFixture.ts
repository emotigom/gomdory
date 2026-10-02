import { api } from "@/lib/standards/routes";

export const Q2_B6_FIXTURE_MODE = "teacher-preparation-v1";
export const Q4_DASHBOARD_ERROR_FIXTURE_MODE = "teacher-dashboard-error-semantics-v1";
export const Q2_B6_FIXTURE_TOKEN_HEADER = "x-q2-browser-fixture-token";
export const Q2_B6_FIXTURE_AUTHORIZATION_HEADER = "x-q2-browser-fixture-authorized";
export const Q2_B6_TEACHER_ID = "00000000-0000-4000-8000-0000000000b6";
export const Q2_B6_BOARD_ID = "00000000-0000-4000-8000-0000000000b6";
export const Q2_B6_WALL_ID = "00000000-0000-4000-8000-0000000000c6";
export const Q2_B6_BOARD_TITLE = "Q2 B6 교사 수업 준비 테스트 보드";
export const Q2_B6_SHARE_CODE = "q2b6a8";
export const Q2_B6_RESET_PATH = "/api/q2/browser/teacher-preparation-fixture/reset";

type Wall = { id: string; title: string; description: string | null };
type Card = { id: string; wall_id: string; owner_id: string; author_type: "teacher"; text: string; created_at: string; position: number };
type Store = { walls: Wall[]; cards: Card[]; sequence: number };
export const Q4_DASHBOARD_ERROR_SCENARIOS = ["loading-to-empty", "error-then-empty", "error-always", "error-twice"] as const;
export type DashboardErrorScenario = (typeof Q4_DASHBOARD_ERROR_SCENARIOS)[number];
type DashboardErrorStore = { scenario: DashboardErrorScenario; renderAttempts: number; errorThrows: number; successfulRenders: number };

function store(): Store {
  const g = globalThis as typeof globalThis & { __gomCleanQ2B6?: Store };
  if (!g.__gomCleanQ2B6) g.__gomCleanQ2B6 = { walls: [{ id: Q2_B6_WALL_ID, title: "수업 준비 섹션", description: "Q2-B6 local fixture section" }], cards: [], sequence: 0 };
  return g.__gomCleanQ2B6;
}
export function resetQ2B6FixtureStore() { const s = store(); s.walls = [{ id: Q2_B6_WALL_ID, title: "수업 준비 섹션", description: "Q2-B6 local fixture section" }]; s.cards = []; s.sequence = 0; }
export function isQ2B6FixtureAuthorized(value: string | null | undefined) { return process.env.NODE_ENV !== "production" && [Q2_B6_FIXTURE_MODE, Q4_DASHBOARD_ERROR_FIXTURE_MODE].includes(process.env.Q2_BROWSER_FIXTURE_MODE || "") && value === "1"; }
export function isQ2B6FixturePath(pathname: string, mode: string | undefined) { if (![Q2_B6_FIXTURE_MODE, Q4_DASHBOARD_ERROR_FIXTURE_MODE].includes(mode || "")) return false; return pathname === "/dashboard" || pathname === `/dashboard/boards/${Q2_B6_BOARD_ID}` || pathname === `/dashboard/boards/${Q2_B6_BOARD_ID}/board` || pathname === Q2_B6_RESET_PATH || pathname === api.v1("dashboard", "boards", Q2_B6_BOARD_ID, "walls") || pathname.startsWith(api.v1("dashboard", "walls", Q2_B6_WALL_ID)); }
export function buildQ2B6FixtureIngress(headers: Headers, hostname: string, pathname: string) {
  const next = new Headers(headers); const token = next.get(Q2_B6_FIXTURE_TOKEN_HEADER); next.delete(Q2_B6_FIXTURE_TOKEN_HEADER); next.delete(Q2_B6_FIXTURE_AUTHORIZATION_HEADER);
  const local = hostname.toLowerCase().replace(/\.$/, "") === "localhost" || hostname.toLowerCase().replace(/\.$/, "") === "127.0.0.1";
  const authorized = process.env.NODE_ENV !== "production" && local && isQ2B6FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE) && Boolean(token) && Boolean(process.env.Q2_BROWSER_FIXTURE_TOKEN) && token === process.env.Q2_BROWSER_FIXTURE_TOKEN;
  if (authorized) next.set(Q2_B6_FIXTURE_AUTHORIZATION_HEADER, "1"); return { headers: next, authorized };
}
export function q2B6Walls() { return store().walls.map((wall) => ({ wall, cards: store().cards.filter((card) => card.wall_id === wall.id).map((card) => ({ ...card, attachments: [] })) })); }
export function q2B6CreateWall(title: string) { const s=store(); s.sequence++; const wall={id:`00000000-0000-4000-8000-${String(100+s.sequence).padStart(12,"0")}`,title,description:null}; s.walls.push(wall); return wall; }
export function q2B6CreateCard(wallId: string, text: string) { const s=store(); if(!s.walls.some(x=>x.id===wallId)) return null; s.sequence++; const card={id:`00000000-0000-4000-8000-${String(200+s.sequence).padStart(12,"0")}`,wall_id:wallId,owner_id:Q2_B6_TEACHER_ID,author_type:"teacher" as const,text,created_at:"2026-07-19T00:00:00.000Z",position:s.cards.length}; s.cards.push(card); return card; }
function dashboardErrorStore(): DashboardErrorStore { const g = globalThis as typeof globalThis & { __gomCleanQ4DashboardError?: DashboardErrorStore }; if (!g.__gomCleanQ4DashboardError) g.__gomCleanQ4DashboardError = { scenario: "error-always", renderAttempts: 0, errorThrows: 0, successfulRenders: 0 }; return g.__gomCleanQ4DashboardError; }
export function resetQ4DashboardErrorFixture(scenario: DashboardErrorScenario) { const s = dashboardErrorStore(); s.scenario = scenario; s.renderAttempts = 0; s.errorThrows = 0; s.successfulRenders = 0; }
export function isQ4DashboardErrorScenario(value: unknown): value is DashboardErrorScenario { return typeof value === "string" && Q4_DASHBOARD_ERROR_SCENARIOS.includes(value as DashboardErrorScenario); }
export function consumeQ4DashboardErrorRender() { const s = dashboardErrorStore(); s.renderAttempts += 1; const shouldThrow = s.scenario === "error-always" || (s.scenario === "error-then-empty" && s.errorThrows === 0) || (s.scenario === "error-twice" && s.errorThrows < 2); if (shouldThrow) { s.errorThrows += 1; throw new Error("Q4 dashboard fixture boundary error"); } s.successfulRenders += 1; return { ...s }; }
export function q4DashboardErrorFixtureLedger() { return { ...dashboardErrorStore() }; }
