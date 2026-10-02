const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-Z0-9]{6,8}$/;
export function normalizeJoinCode(input: string) { return input.trim().toUpperCase().replace(/\s+/g, ""); }
export function parseJoinCode(input: string) { const code = normalizeJoinCode(input); return CODE_RE.test(code) ? code : null; }
export function generateJoinCode(length = 7) { let out = ""; for (let i = 0; i < length; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; return out; }
