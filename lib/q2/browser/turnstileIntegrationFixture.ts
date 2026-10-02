import { randomUUID } from "node:crypto";

export const Q2_B9_D_EXPECTED_ACTION = "share_card_create";
export const Q2_B9_D_EXPECTED_CDATA = "q2-b9-d-card-create";
const TOKEN_TTL_MS = 60_000;

type Challenge = { token: string; hostname: string; action: string; cdata: string; issuedAt: number; usedAt: number | null };
type Store = { challenges: Map<string, Challenge>; mutations: number; verificationAttempts: number };

function store(): Store {
  const target = globalThis as typeof globalThis & { __gomCleanQ2B9DTurnstileFixture?: Store };
  if (!target.__gomCleanQ2B9DTurnstileFixture) target.__gomCleanQ2B9DTurnstileFixture = { challenges: new Map(), mutations: 0, verificationAttempts: 0 };
  return target.__gomCleanQ2B9DTurnstileFixture;
}

export function resetQ2B9DTurnstileFixture() { const value = store(); value.challenges.clear(); value.mutations = 0; value.verificationAttempts = 0; }
export function issueQ2B9DTurnstileChallenge(input: { hostname: string; action?: string; cdata?: string }) {
  const token = `q2b9d-${randomUUID()}-${randomUUID()}`;
  store().challenges.set(token, { token, hostname: input.hostname, action: input.action ?? Q2_B9_D_EXPECTED_ACTION, cdata: input.cdata ?? Q2_B9_D_EXPECTED_CDATA, issuedAt: Date.now(), usedAt: null });
  return token;
}
export function verifyQ2B9DTurnstileToken(token: string, input: { hostname: string; action: string; cdata: string }) {
  const value = store(); value.verificationAttempts += 1;
  const challenge = value.challenges.get(token);
  if (!challenge || challenge.usedAt || Date.now() - challenge.issuedAt > TOKEN_TTL_MS) return { ok: false, reason: "invalid-or-replayed" as const };
  if (challenge.hostname !== input.hostname) return { ok: false, reason: "hostname" as const };
  if (challenge.action !== input.action) return { ok: false, reason: "action" as const };
  if (challenge.cdata !== input.cdata) return { ok: false, reason: "cdata" as const };
  challenge.usedAt = Date.now(); return { ok: true as const };
}
export function recordQ2B9DBusinessMutation() { store().mutations += 1; return `q2-b9-d-card-${store().mutations}`; }
export function q2B9DTurnstileFixtureSnapshot() { const value = store(); return { verificationAttempts: value.verificationAttempts, businessMutationCount: value.mutations, issuedChallengeCount: value.challenges.size, usedChallengeCount: [...value.challenges.values()].filter((item) => item.usedAt).length }; }
