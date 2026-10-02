type AllowPattern = RegExp | string | ((url: string) => boolean);

type NetworkControl = {
  allowNetworkForTest: <T>(pattern: AllowPattern, callback: () => T | Promise<T>) => Promise<T>;
  addAllowRule: (pattern: AllowPattern) => () => void;
};

const NETWORK_CONTROL_SYMBOL = Symbol.for("gom.test.network.control");

function getNetworkControl(): NetworkControl {
  const control = (globalThis as typeof globalThis & { [NETWORK_CONTROL_SYMBOL]?: NetworkControl })[
    NETWORK_CONTROL_SYMBOL
  ];

  if (!control) {
    throw new Error("TEST_NETWORK_BLOCKED helper not initialized. Ensure tests/setup-node-env.cjs is preloaded.");
  }

  return control;
}

export async function withAllowedNetwork<T>(
  pattern: AllowPattern,
  callback: () => T | Promise<T>,
): Promise<T> {
  return getNetworkControl().allowNetworkForTest(pattern, callback);
}

export function allowNetworkRule(pattern: AllowPattern): () => void {
  return getNetworkControl().addAllowRule(pattern);
}
