/* Browser-only Python Studio Lite worker. No server-side execution. */
let pyodidePromise = null;
let configuredBaseUrl = null;

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

function getErrorMessage(error, fallback) {
  if (error && typeof error.message === "string") return error.message;
  return String(error ?? fallback);
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim())
    return "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const trimmed = baseUrl.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

async function loadRuntime(baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (pyodidePromise && configuredBaseUrl === normalizedBaseUrl)
    return pyodidePromise;
  configuredBaseUrl = normalizedBaseUrl;
  pyodidePromise = (async () => {
    if (typeof self.loadPyodide !== "function") {
      importScripts(`${normalizedBaseUrl}pyodide.js`);
    }
    if (typeof self.loadPyodide !== "function") {
      throw new Error(
        "파이썬 실행 환경을 불러오지 못했어요. 코드는 저장할 수 있어요.",
      );
    }
    return self.loadPyodide({ indexURL: normalizedBaseUrl });
  })();
  return pyodidePromise;
}

function createRawTextSink() {
  const chunks = [];
  const decoder = new TextDecoder();
  return {
    raw(charCode) {
      if (typeof charCode !== "number") return;
      chunks.push(decoder.decode(new Uint8Array([charCode]), { stream: true }));
    },
    write(text) {
      chunks.push(String(text ?? ""));
    },
    text() {
      const remaining = decoder.decode();
      if (remaining) chunks.push(remaining);
      return chunks.join("");
    },
  };
}

function createInputReader(stdin, stdoutSink) {
  const inputLines = String(stdin ?? "").split(/\r\n|\r|\n/);
  let inputIndex = 0;
  return () => {
    if (
      inputIndex >= inputLines.length ||
      (inputLines.length === 1 && inputLines[0] === "")
    ) {
      throw new Error(
        "input()에 넣을 입력값이 부족해요. 입력값 칸에 줄마다 하나씩 적어 주세요.",
      );
    }
    const value = inputLines[inputIndex++];
    stdoutSink.write(`${value}\n`);
    return value;
  };
}

async function runPython(message) {
  const stdoutSink = createRawTextSink();
  const stderrSink = createRawTextSink();
  const pyodide = await loadRuntime(message.baseUrl);
  const code =
    typeof message.code === "string"
      ? message.code
      : String(message.code ?? "");
  const readInput = createInputReader(message.stdin, stdoutSink);
  pyodide.setStdin?.({ stdin: readInput });
  pyodide.setStdout?.({ raw: stdoutSink.raw });
  pyodide.setStderr?.({ raw: stderrSink.raw });
  try {
    await pyodide.runPythonAsync(code);
    post("run:success", {
      id: message.id,
      stdout: stdoutSink.text(),
      stderr: stderrSink.text(),
    });
  } catch (error) {
    const messageText = getErrorMessage(
      error,
      "파이썬 코드를 실행하지 못했어요.",
    );
    const stderrText = [stderrSink.text(), messageText]
      .filter(Boolean)
      .join("\n");
    post("run:error", {
      id: message.id,
      stdout: stdoutSink.text(),
      stderr: stderrText,
    });
  }
}

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "init") {
    loadRuntime(message.baseUrl)
      .then(() => post("ready", { id: message.id }))
      .catch((error) =>
        post("init:error", {
          id: message.id,
          error: getErrorMessage(
            error,
            "파이썬 실행 환경을 불러오지 못했어요.",
          ),
        }),
      );
    return;
  }
  if (message.type === "run") {
    runPython(message).catch((error) => {
      post("run:error", {
        id: message.id,
        stdout: "",
        stderr: getErrorMessage(error, "파이썬 코드를 실행하지 못했어요."),
      });
    });
  }
});
