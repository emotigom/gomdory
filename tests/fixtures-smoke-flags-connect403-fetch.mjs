globalThis.fetch = async function mockedFetch() {
  const cause = new Error("Proxy CONNECT tunnel failed 403");
  throw new TypeError("fetch failed", { cause });
};
