const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

export const hashRoomCodeShort = async (code: string, length = 6) => {
  if (typeof window === "undefined" || !window.crypto?.subtle) return "-";
  const data = new TextEncoder().encode(code);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  const hex = toHex(new Uint8Array(digest));
  return hex.slice(0, length);
};
