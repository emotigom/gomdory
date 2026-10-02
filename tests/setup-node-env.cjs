const setDefaultEnv = (key, value) => {
  if (!process.env[key] || process.env[key].trim() === "") {
    process.env[key] = value;
  }
};

// Tests often stub Supabase clients but still import modules that validate env.
// Provide safe placeholders to avoid unrelated "Missing env" failures locally.
setDefaultEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
setDefaultEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
setDefaultEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
setDefaultEnv("SUPABASE_URL", "https://example.supabase.co");

if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === "undefined") {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
}

if (typeof globalThis.cancelAnimationFrame === "undefined") {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (typeof globalThis.requestIdleCallback === "undefined") {
  globalThis.requestIdleCallback = (cb) =>
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
}

if (typeof globalThis.cancelIdleCallback === "undefined") {
  globalThis.cancelIdleCallback = (id) => clearTimeout(id);
}

if (typeof globalThis.HTMLIFrameElement === "undefined") {
  globalThis.HTMLIFrameElement = class HTMLIFrameElement {};
}

if (typeof globalThis.document === "undefined") {
  globalThis.document = { activeElement: null };
}

const NETWORK_ALLOW_RULES_SYMBOL = Symbol.for("gom.test.network.allowRules");
const NETWORK_CONTROL_SYMBOL = Symbol.for("gom.test.network.control");
const NETWORK_GUARD_REQUIRED_IN_CI = process.env.CI === "1" || process.env.CI === "true";
const NETWORK_GUARD_ENABLED = process.env.TEST_NETWORK_GUARD !== "0";

if (NETWORK_GUARD_REQUIRED_IN_CI && !NETWORK_GUARD_ENABLED) {
  throw new Error("TEST_NETWORK_GUARD must remain enabled in CI");
}

const defaultAllowRules = [
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i,
  /^data:/i,
  /^blob:/i,
];

if (!globalThis[NETWORK_ALLOW_RULES_SYMBOL]) {
  globalThis[NETWORK_ALLOW_RULES_SYMBOL] = [...defaultAllowRules];
}

if (!globalThis[NETWORK_CONTROL_SYMBOL]) {
  globalThis[NETWORK_CONTROL_SYMBOL] = {
    allowNetworkForTest(pattern, callback) {
      const rules = globalThis[NETWORK_ALLOW_RULES_SYMBOL];
      rules.push(pattern);
      return Promise.resolve()
        .then(() => callback())
        .finally(() => {
          const index = rules.lastIndexOf(pattern);
          if (index >= 0) {
            rules.splice(index, 1);
          }
        });
    },
    addAllowRule(pattern) {
      const rules = globalThis[NETWORK_ALLOW_RULES_SYMBOL];
      rules.push(pattern);
      return () => {
        const index = rules.lastIndexOf(pattern);
        if (index >= 0) {
          rules.splice(index, 1);
        }
      };
    },
  };
}

const normalizeRequestUrl = (input) => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input && typeof input.url === "string") {
    return input.url;
  }
  return String(input);
};

const createNetworkBlockedError = (targetUrl) => {
  const error = new Error(`TEST_NETWORK_BLOCKED: ${targetUrl}`);
  error.name = "TEST_NETWORK_BLOCKED";
  error.code = "TEST_NETWORK_BLOCKED";
  error.url = targetUrl;
  return error;
};

const isAllowedRequestUrl = (url) => {
  if (typeof url !== "string") {
    return false;
  }

  if (/^\//.test(url)) {
    return true;
  }

  const rules = globalThis[NETWORK_ALLOW_RULES_SYMBOL] ?? [];
  return rules.some((rule) => {
    if (typeof rule === "function") {
      return Boolean(rule(url));
    }
    if (rule instanceof RegExp) {
      return rule.test(url);
    }
    return typeof rule === "string" ? url.startsWith(rule) : false;
  });
};

const wrapFetchWithNetworkBlocker = (fetchImpl) => {
  if (typeof fetchImpl !== "function") {
    return fetchImpl;
  }
  if (fetchImpl.__gomNetworkBlockedWrapped) {
    return fetchImpl;
  }

  const wrappedFetch = async function wrappedFetch(input, init) {
    const targetUrl = normalizeRequestUrl(input);

    if (!isAllowedRequestUrl(targetUrl)) {
      throw createNetworkBlockedError(targetUrl);
    }

    return fetchImpl.call(this, input, init);
  };

  Object.defineProperty(wrappedFetch, "__gomNetworkBlockedWrapped", {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return wrappedFetch;
};

if (NETWORK_GUARD_ENABLED && typeof globalThis.fetch === "function") {
  globalThis.fetch = wrapFetchWithNetworkBlocker(globalThis.fetch);
}

try {
  const undici = require("undici");
  if (NETWORK_GUARD_ENABLED && undici && typeof undici.fetch === "function") {
    undici.fetch = wrapFetchWithNetworkBlocker(undici.fetch);
  }
} catch {
  // undici can be unavailable depending on runtime setup
}
