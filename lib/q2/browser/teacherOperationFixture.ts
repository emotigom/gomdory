import { api } from "@/lib/standards/routes";

export const Q2_B7_FIXTURE_MODE = "teacher-operation-v1";
export const Q2_B7_FIXTURE_TOKEN_HEADER = "x-q2-browser-fixture-token";
export const Q2_B7_FIXTURE_AUTHORIZATION_HEADER = "x-q2-browser-fixture-authorized";
export const Q2_B7_FIXTURE_ROLE_HEADER = "x-q2-browser-fixture-role";
export const Q2_B7_BOARD_ID = "00000000-0000-4000-8000-0000000000b7";
export const Q2_B7_OWNER_ID = "00000000-0000-4000-8000-0000000000b7";
export const Q2_B7_VIEWER_ID = "00000000-0000-4000-8000-0000000000b8";
export const Q2_B7_WALL_A_ID = "00000000-0000-4000-8000-0000000000c7";
export const Q2_B7_WALL_B_ID = "00000000-0000-4000-8000-0000000000c8";
export const Q2_B7_TARGET_CARD_ID = "00000000-0000-4000-8000-0000000000d7";
export const Q2_B7_RESET_PATH = "/api/q2/browser/teacher-operation-fixture/reset";

export type Q2B7Role = "owner" | "viewer" | "non-member" | "student";
type Card = { id: string; wall_id: string; owner_id: string; author_type: "student" | "teacher"; author_client_id: string; text: string; is_hidden: boolean; hidden_at: string | null; is_featured: boolean; featured_at: string | null; card_color_token: null; position: number; deleted_at: null; tags: { id: string; name: string; color: string | null }[]; attachments: never[] };
type Wall = { id: string; title: string; description: string | null };
type MutationKind = "reset" | "hide" | "unhide" | "final" | "move";
export type Q2B7MutationScenario = "success" | "retryable-failure" | "terminal-failure" | "version-mismatch";
type Store = { walls: Wall[]; cards: Card[]; mutations: { hide: number; unhide: number; final: number; move: number }; storeGeneration: number; stateVersion: number; resetCount: number; mutationCount: number; lastMutationKind: MutationKind; scenario: Q2B7MutationScenario };
type StoreRegistry = { store: Store | null };
const STORE_SYMBOL = Symbol.for("gomdory.q2.b7.teacher-operation-store");

function cloneCard(card: Card): Card { return { ...card, tags: card.tags.map((tag) => ({ ...tag })), attachments: [] }; }
function cloneWalls(store: Store) { return store.walls.map((wall) => ({ wall: { ...wall }, cards: store.cards.filter((card) => card.wall_id === wall.id).map(cloneCard) })); }
function registry(): StoreRegistry {
  const scope = globalThis as typeof globalThis & { [STORE_SYMBOL]?: StoreRegistry };
  scope[STORE_SYMBOL] ??= { store: null };
  return scope[STORE_SYMBOL];
}
function createStore(previous: Store | null, scenario: Q2B7MutationScenario = "success"): Store {
  const stateVersion = (previous?.stateVersion ?? 0) + 1;
  return {
    walls: [{ id: Q2_B7_WALL_A_ID, title: "학생 제출", description: "Q2-B7 fixture wall A" }, { id: Q2_B7_WALL_B_ID, title: "발표 작품", description: "Q2-B7 fixture wall B" }],
    cards: [
      { id: Q2_B7_TARGET_CARD_ID, wall_id: Q2_B7_WALL_A_ID, owner_id: "00000000-0000-4000-8000-0000000000d8", author_type: "student", author_client_id: "q2-b7-target", text: "B7 fixture student submission", is_hidden: false, hidden_at: null, is_featured: false, featured_at: null, card_color_token: null, position: 0, deleted_at: null, tags: [], attachments: [] },
      { id: "00000000-0000-4000-8000-0000000000d9", wall_id: Q2_B7_WALL_A_ID, owner_id: "00000000-0000-4000-8000-0000000000da", author_type: "student", author_client_id: "q2-b7-second", text: "B7 second fixture submission", is_hidden: false, hidden_at: null, is_featured: false, featured_at: null, card_color_token: null, position: 1, deleted_at: null, tags: [], attachments: [] },
      { id: "00000000-0000-4000-8000-0000000000db", wall_id: Q2_B7_WALL_A_ID, owner_id: Q2_B7_OWNER_ID, author_type: "teacher", author_client_id: "q2-b7-teacher", text: "B7 teacher fixture card", is_hidden: false, hidden_at: null, is_featured: false, featured_at: null, card_color_token: null, position: 2, deleted_at: null, tags: [], attachments: [] },
    ],
    mutations: { hide: 0, unhide: 0, final: 0, move: 0 }, storeGeneration: (previous?.storeGeneration ?? 0) + 1, stateVersion, resetCount: (previous?.resetCount ?? 0) + 1, mutationCount: 0, lastMutationKind: "reset", scenario,
  };
}
export function getTeacherOperationStore(): Store { const current = registry().store; if (!current) return resetTeacherOperationScenario(); return current; }
export function resetTeacherOperationScenario(scenario: Q2B7MutationScenario = "success"): Store { const next = createStore(registry().store, scenario); registry().store = next; return next; }
export const resetQ2B7FixtureStore = resetTeacherOperationScenario;
export function readTeacherOperationSnapshot() { const store = getTeacherOperationStore(); return { walls: cloneWalls(store), storeGeneration: store.storeGeneration, stateVersion: store.stateVersion, resetCount: store.resetCount, mutationCount: store.mutationCount, lastMutationKind: store.lastMutationKind }; }
function mutate(cardId: string, kind: Exclude<MutationKind, "reset">, apply: (card: Card, store: Store) => boolean) { const store = getTeacherOperationStore(); const card = store.cards.find((entry) => entry.id === cardId); if (!card || !apply(card, store)) return null; store.stateVersion += 1; store.mutationCount += 1; store.lastMutationKind = kind; store.mutations[kind] += 1; return { card: cloneCard(card), stateVersion: store.stateVersion }; }
export function setTeacherOperationVisibility(cardId: string, hidden: boolean) { return mutate(cardId, hidden ? "hide" : "unhide", (card) => { card.is_hidden = hidden; card.hidden_at = hidden ? "2026-07-19T00:00:00.000Z" : null; return true; }); }
export function setTeacherOperationFinalArtwork(cardId: string, final: boolean) { return mutate(cardId, "final", (card) => { if (card.author_type !== "student") return false; card.tags = final ? [{ id: "00000000-0000-4000-8000-0000000000e7", name: "최종 작품", color: null }] : []; return true; }); }
export function moveTeacherOperationCard(cardId: string, wallId: string) { return mutate(cardId, "move", (card, store) => { if (!store.walls.some((wall) => wall.id === wallId)) return false; card.wall_id = wallId; card.position = store.cards.filter((entry) => entry.wall_id === wallId && entry.id !== cardId).length; return true; }); }
export const q2B7UpdateVisibility = setTeacherOperationVisibility;
export function q2B7VisibilityScenario() { return getTeacherOperationStore().scenario; }
export const q2B7SetFinalArtwork = setTeacherOperationFinalArtwork;
export const q2B7MoveCard = moveTeacherOperationCard;
export function q2B7Walls() { return readTeacherOperationSnapshot().walls; }
export function q2B7Snapshot() { const store = getTeacherOperationStore(); const card = store.cards.find((entry) => entry.id === Q2_B7_TARGET_CARD_ID)!; return { isHidden: card.is_hidden, final: card.tags.some((tag) => tag.name === "최종 작품"), wallId: card.wall_id, mutations: { ...store.mutations }, stateVersion: store.stateVersion }; }

export function isQ2B7FixtureAuthorized(value: string | null | undefined) { return process.env.NODE_ENV !== "production" && process.env.Q2_BROWSER_FIXTURE_MODE === Q2_B7_FIXTURE_MODE && value === "1"; }
export function q2B7Role(headers: Headers) { const role = headers.get(Q2_B7_FIXTURE_ROLE_HEADER); return role === "owner" || role === "viewer" || role === "non-member" || role === "student" ? role : null; }
export function q2B7CanOperate(headers: Headers) { return q2B7Role(headers) === "owner"; }
export function isQ2B7FixturePath(pathname: string, mode: string | undefined) { const dashboardCardsPrefix = `${api.v1("dashboard", "cards")}/`; const dashboardWallsPrefix = `${api.v1("dashboard", "walls")}/`; return mode === Q2_B7_FIXTURE_MODE && (pathname === "/dashboard" || pathname === `/dashboard/boards/${Q2_B7_BOARD_ID}/board` || pathname === Q2_B7_RESET_PATH || pathname.startsWith(dashboardCardsPrefix) || pathname.startsWith(dashboardWallsPrefix)); }
export function buildQ2B7FixtureIngress(headers: Headers, hostname: string, pathname: string) {
  const next = new Headers(headers); const raw = next.get(Q2_B7_FIXTURE_TOKEN_HEADER); next.delete(Q2_B7_FIXTURE_TOKEN_HEADER); next.delete(Q2_B7_FIXTURE_AUTHORIZATION_HEADER); next.delete(Q2_B7_FIXTURE_ROLE_HEADER);
  const match = raw?.match(/^(.*):(owner|viewer|non-member|student)$/); const local = ["localhost", "127.0.0.1"].includes(hostname.toLowerCase().replace(/\.$/, ""));
  const authorized = process.env.NODE_ENV !== "production" && local && isQ2B7FixturePath(pathname, process.env.Q2_BROWSER_FIXTURE_MODE) && Boolean(match?.[1]) && match?.[1] === process.env.Q2_BROWSER_FIXTURE_TOKEN;
  if (authorized) { next.set(Q2_B7_FIXTURE_AUTHORIZATION_HEADER, "1"); next.set(Q2_B7_FIXTURE_ROLE_HEADER, match![2]); }
  return { headers: next, authorized };
}
