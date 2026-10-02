import assert from "node:assert/strict";
import test from "node:test";

import {
  getConfiguredNetworkSaverMode,
  isNetworkSaverPilotEnabled,
  setNetworkSaverUserFlags,
  getP2PTier,
  getP2PMaxBytes,
} from "@/lib/edu/netsaver/config";

test("netsaver remains off unless per-user netsaverEnabled is true", () => {
  setNetworkSaverUserFlags(null);
  assert.equal(isNetworkSaverPilotEnabled(), false);
  assert.equal(getConfiguredNetworkSaverMode(), "off");

  setNetworkSaverUserFlags({
    enabled: false,
    mode: "auto",
    tier: "wasm",
    maxBytes: 123,
  });
  assert.equal(isNetworkSaverPilotEnabled(), false);
  assert.equal(getConfiguredNetworkSaverMode(), "off");

  setNetworkSaverUserFlags({
    enabled: true,
    mode: null,
    tier: null,
    maxBytes: null,
  });
  assert.equal(isNetworkSaverPilotEnabled(), true);
  assert.equal(getConfiguredNetworkSaverMode(), "lease_only");
  assert.equal(getP2PTier(), "meta");
  assert.equal(getP2PMaxBytes(), 10 * 1024 * 1024);

  setNetworkSaverUserFlags(null);
});
