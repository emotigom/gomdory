import { api } from "@/lib/standards/routes";
import type { CardColorToken } from "@/lib/types/cards";

export const Q2_B8_FIXTURE_MODE = "result-download-v1";
export const Q2_B9_FIXTURE_MODE = "google-drive-live-v1";
export const Q2_B8_FIXTURE_TOKEN_HEADER = "x-q2-browser-fixture-token";
export const Q2_B8_BOARD_ID = "00000000-0000-4000-8000-0000000000b8";
export const Q2_B8_OWNER_ID = "00000000-0000-4000-8000-0000000000e8";
export const Q2_B8_RESET_PATH = "/api/q2/browser/result-download-fixture/reset";
export const Q2_B9_BOARD_ID = "00000000-0000-4000-8000-0000000000b9";
export const Q2_B9_OWNER_ID = "00000000-0000-4000-8000-0000000000e9";
export const Q2_B9_RESET_PATH = "/api/q2/browser/google-drive-fixture/reset";
const AUTH = "x-q2-browser-fixture-authorized";

type Attachment = { id: string; kind: "image"; label: string; url: string; contentType: string; size: number };
type Card = { id: string; wall_id: string; owner_id: string; author_type: "teacher" | "student"; author_name: string; text: string; created_at: string; position: number; is_hidden: boolean; hidden_at: string | null; card_color_token: CardColorToken | null; tags: { id: string; name: string; color: string | null }[]; attachments: Attachment[] };
type Store = { stateVersion: number; walls: { id: string; title: string; description: string | null }[]; cards: Card[] };
const STORE = Symbol.for("gomdory.q2.b8.result-download-store");
function registry() { const global = globalThis as typeof globalThis & { [STORE]?: Store }; return global; }
function fresh(previous?: Store): Store { return { stateVersion: (previous?.stateVersion ?? 0) + 1, walls: [{ id: "00000000-0000-4000-8000-0000000000f1", title: "첫 번째 결과", description: "B8 fixture section A" }, { id: "00000000-0000-4000-8000-0000000000f2", title: "공유 전 확인", description: "B8 fixture section B" }], cards: [ { id: "00000000-0000-4000-8000-000000000101", wall_id: "00000000-0000-4000-8000-0000000000f1", owner_id: Q2_B8_OWNER_ID, author_type: "teacher", author_name: "테스트 교사", text: "B8 fixture teacher note", created_at: "2026-07-20T00:00:00.000Z", position: 0, is_hidden: false, hidden_at: null, card_color_token: null, tags: [], attachments: [] }, { id: "00000000-0000-4000-8000-000000000102", wall_id: "00000000-0000-4000-8000-0000000000f1", owner_id: "00000000-0000-4000-8000-000000000201", author_type: "student", author_name: "테스트 학생 1", text: "B8 fixture visible response", created_at: "2026-07-20T00:01:00.000Z", position: 1, is_hidden: false, hidden_at: null, card_color_token: "yellow", tags: [], attachments: [{ id: "00000000-0000-4000-8000-000000000301", kind: "image", label: "fixture-image.png", url: "/q2-fixture/attachment.png", contentType: "image/png", size: 128 }] }, { id: "00000000-0000-4000-8000-000000000103", wall_id: "00000000-0000-4000-8000-0000000000f2", owner_id: "00000000-0000-4000-8000-000000000202", author_type: "student", author_name: "테스트 학생 2", text: "B8 fixture hidden response", created_at: "2026-07-20T00:02:00.000Z", position: 0, is_hidden: true, hidden_at: "2026-07-20T00:03:00.000Z", card_color_token: "green", tags: [], attachments: [] }] }; }
export function resetResultDownloadScenario() { const global = registry(); global[STORE] = fresh(global[STORE]); return global[STORE]!; }
export function readResultDownloadSnapshot() { const store = registry()[STORE] ?? resetResultDownloadScenario(); return { stateVersion: store.stateVersion, walls: store.walls.map((wall) => ({ wall: { ...wall }, cards: store.cards.filter((card) => card.wall_id === wall.id).map((card) => ({ ...card, tags: card.tags.map((tag) => ({ ...tag })), attachments: card.attachments.map((attachment) => ({ ...attachment })) })) })) }; }
export function isQ2B8FixtureAuthorized(value: string | null | undefined) { return process.env.NODE_ENV !== "production" && process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B8_FIXTURE_MODE && value === "1"; }
export function isQ2B9FixtureAuthorized(value: string | null | undefined) { return process.env.NODE_ENV !== "production" && process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B9_FIXTURE_MODE && value === "1"; }
export function isQ2B8FixturePath(pathname: string, mode: string | undefined) { return mode === Q2_B8_FIXTURE_MODE && (pathname === "/dashboard" || pathname === `/dashboard/boards/${Q2_B8_BOARD_ID}/board` || pathname === Q2_B8_RESET_PATH); }
export function isQ2B9FixturePath(pathname: string, mode: string | undefined) { return mode === Q2_B9_FIXTURE_MODE && (pathname === "/dashboard" || pathname === `/dashboard/boards/${Q2_B9_BOARD_ID}/board` || pathname === Q2_B9_RESET_PATH || pathname === api.v1("google-drive", "preferences")); }
export function buildQ2B8FixtureIngress(headers: Headers, hostname: string, pathname: string) { const next = new Headers(headers); const raw = next.get(Q2_B8_FIXTURE_TOKEN_HEADER); next.delete(Q2_B8_FIXTURE_TOKEN_HEADER); next.delete(AUTH); const local = ["localhost", "127.0.0.1"].includes(hostname.toLowerCase().replace(/\.$/, "")); const authorized = process.env.NODE_ENV !== "production" && local && (isQ2B8FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE) || isQ2B9FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE)) && Boolean(raw) && raw === process.env.Q2_BROWSER_FIXTURE_TOKEN; if (authorized) next.set(AUTH, "1"); return { headers: next, authorized }; }
