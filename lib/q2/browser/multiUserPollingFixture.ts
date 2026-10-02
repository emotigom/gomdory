import type { SharedBoardViewModel } from "@/lib/boards/toSharedViewModel";
import type { ShareBoard } from "@/lib/data/share";

export const Q2_B10_FIXTURE_MODE = "multi-user-polling-v1";
export const Q2_B10_BOARD_ID = "00000000-0000-4000-8000-0000000000ba";
export const Q2_B10_OWNER_ID = "00000000-0000-4000-8000-0000000000bb";
export const Q2_B10_SHARE_CODE = "q2b10a";
export const Q2_B10_WALL_A_ID = "00000000-0000-4000-8000-0000000000bc";
export const Q2_B10_WALL_B_ID = "00000000-0000-4000-8000-0000000000bd";
export const Q2_B10_RESET_PATH = "/api/q2/browser/multi-user-polling-fixture/reset";
export const Q2_B10_SNAPSHOT_PATH = "/api/q2/browser/multi-user-polling-fixture/snapshot";

type Card = { id: string; wallId: string; position: number; authorClientId: string; text: string; createdAt: string; isHidden: boolean; hiddenAt: string | null };
type Store = { cards: Card[]; stateVersion: number; storeGeneration: number; resetCount: number; mutationCount: number; creates: number; hides: number; unhides: number; polls: Record<string, number> };
const STORE = Symbol.for("gomdory.q2.b10.multi-user-polling-store");
function registry() { const scope = globalThis as typeof globalThis & { [STORE]?: Store }; return scope; }
function create(previous?: Store): Store { return { cards: [], stateVersion: (previous?.stateVersion ?? 0) + 1, storeGeneration: (previous?.storeGeneration ?? 0) + 1, resetCount: (previous?.resetCount ?? 0) + 1, mutationCount: 0, creates: 0, hides: 0, unhides: 0, polls: {} }; }
export function resetQ2B10Fixture() { const next = create(registry()[STORE]); registry()[STORE] = next; return next; }
export function q2B10Store() { return registry()[STORE] ?? resetQ2B10Fixture(); }
function view(store = q2B10Store()): SharedBoardViewModel {
  return { columns: [
    { id: Q2_B10_WALL_A_ID, title: "동시 작성", description: "Q2-B10 fixture wall A", uiColorToken: null, studentWriteEnabled: true, cards: store.cards.filter((card) => card.wallId === Q2_B10_WALL_A_ID && !card.isHidden).sort((a,b) => a.position-b.position).map((card) => ({ id: card.id, wallId: card.wallId, position: card.position, text: card.text, authorType: "student" as const, authorName: "학생", authorClientId: card.authorClientId, createdAt: card.createdAt, isPinned: false, isFeatured: false, cardColorToken: null, attachments: [] })), featuredCards: [], pinnedCards: [], totalCount: store.cards.filter((card) => card.wallId === Q2_B10_WALL_A_ID && !card.isHidden).length },
    { id: Q2_B10_WALL_B_ID, title: "교사 확인", description: "Q2-B10 fixture wall B", uiColorToken: null, studentWriteEnabled: true, cards: [], featuredCards: [], pinnedCards: [], totalCount: 0 },
  ] };
}
export function q2B10StudentFixture(clientLabel?: string) { const store = q2B10Store(); if (clientLabel) store.polls[clientLabel] = (store.polls[clientLabel] ?? 0) + 1; const board: ShareBoard = { id: Q2_B10_BOARD_ID, owner_id: Q2_B10_OWNER_ID, title: "Q2 B10 다중 사용자 테스트 보드", description: null, board_view_type: "wall", wall_v2_enabled: false, share_code: Q2_B10_SHARE_CODE, share_enabled: true, share_updated_at: "2026-07-21T00:00:00.000Z", share_write_enabled: true, share_write_updated_at: "2026-07-21T00:00:00.000Z", class_state: "live", class_notice: null, class_updated_at: "2026-07-21T00:00:00.000Z", rules_text: null, rules_updated_at: "2026-07-21T00:00:00.000Z", tools_enabled: [], tools_updated_at: "2026-07-21T00:00:00.000Z", ui_minimap_mode: "hover" }; return { board, viewModel: view(store), stateVersion: store.stateVersion }; }
export function createQ2B10Card(input: { text: string; authorClientId: string }) { const store = q2B10Store(); const text = input.text.trim(); if (!text) return null; const existing = store.cards.find((card) => card.authorClientId === input.authorClientId && card.text === text); if (existing) return existing; const card = { id: `00000000-0000-4000-8000-${String(store.cards.length + 100).padStart(12, "0")}`, wallId: Q2_B10_WALL_A_ID, position: store.cards.filter((item) => item.wallId === Q2_B10_WALL_A_ID).length, authorClientId: input.authorClientId, text, createdAt: new Date().toISOString(), isHidden: false, hiddenAt: null }; store.cards.push(card); store.creates += 1; store.mutationCount += 1; store.stateVersion += 1; return card; }
export function setQ2B10Visibility(cardId: string, hidden: boolean) { const store = q2B10Store(); const card = store.cards.find((item) => item.id === cardId); if (!card) return null; card.isHidden = hidden; card.hiddenAt = hidden ? new Date().toISOString() : null; store[hidden ? "hides" : "unhides"] += 1; store.mutationCount += 1; store.stateVersion += 1; return { card, stateVersion: store.stateVersion }; }
export function q2B10TeacherWalls() { const store = q2B10Store(); return [{ wall: { id: Q2_B10_WALL_A_ID, title: "동시 작성", description: "Q2-B10 fixture wall A" }, cards: store.cards.filter((card) => card.wallId === Q2_B10_WALL_A_ID).map((card) => ({ id: card.id, wall_id: card.wallId, owner_id: Q2_B10_OWNER_ID, author_type: "student" as const, author_client_id: card.authorClientId, text: card.text, is_hidden: card.isHidden, hidden_at: card.hiddenAt, is_featured: false, featured_at: null, card_color_token: null, position: card.position, deleted_at: null, tags: [], attachments: [] })) }, { wall: { id: Q2_B10_WALL_B_ID, title: "교사 확인", description: "Q2-B10 fixture wall B" }, cards: [] }]; }
export function q2B10Snapshot() { const store = q2B10Store(); return { cardCount: store.cards.length, visibleCardCount: store.cards.filter((card) => !card.isHidden).length, hiddenCardCount: store.cards.filter((card) => card.isHidden).length, stateVersion: store.stateVersion, mutationCount: store.mutationCount, createCount: store.creates, hideCount: store.hides, unhideCount: store.unhides, pollCounts: store.polls }; }
export function isQ2B10Authorized(value: string | null) { return process.env.NODE_ENV !== "production" && process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B10_FIXTURE_MODE && value === "1"; }
