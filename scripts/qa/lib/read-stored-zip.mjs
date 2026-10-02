const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

function crc32(data) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function fail(message) { throw new Error(`invalid stored ZIP: ${message}`); }
function safeName(name) { return name && !name.startsWith("/") && !name.includes("\\") && !name.split("/").includes("..") && !name.includes("\0"); }

/** Reads the deliberately small, stored-method ZIPs produced by lib/board/zipWriter. */
export function readStoredZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 22) fail("too short");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) if (view.getUint32(offset, true) === END) { end = offset; break; }
  if (end < 0) fail("missing end record");
  const count = view.getUint16(end + 10, true); const centralSize = view.getUint32(end + 12, true); const centralOffset = view.getUint32(end + 16, true);
  if (centralOffset + centralSize > end) fail("central directory bounds");
  const decoder = new TextDecoder("utf-8", { fatal: true }); const entries = new Map(); let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > centralOffset + centralSize || view.getUint32(cursor, true) !== CENTRAL) fail("central header");
    const method = view.getUint16(cursor + 10, true); const crc = view.getUint32(cursor + 16, true); const size = view.getUint32(cursor + 24, true); const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength; if (next > centralOffset + centralSize) fail("central entry bounds");
    if (method !== 0) fail("unsupported compression method"); const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)); if (!safeName(name) || entries.has(name)) fail("unsafe or duplicate entry name");
    if (localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== LOCAL) fail("local header"); const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true); const start = localOffset + 30 + localNameLength + localExtraLength; const finish = start + size; if (finish > centralOffset) fail("local entry bounds"); const data = bytes.slice(start, finish); if (crc32(data) !== crc) fail("CRC32"); entries.set(name, data); cursor = next;
  }
  if (cursor !== centralOffset + centralSize) fail("central directory size"); return entries;
}
