require("./setup-node-env.cjs");

if (process.env.TEST_MODE === "ui") {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
  });

  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.navigator = window.navigator;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.Document = window.Document;
  globalThis.HTMLIFrameElement = window.HTMLIFrameElement;

  const UI_REACT_MESSAGE_CHANNEL_STATE = Symbol.for(
    "gom.test.ui.reactMessageChannelState",
  );
  const UI_MESSAGE_CHANNEL_AFTER_REGISTERED = Symbol.for(
    "gom.test.ui.messageChannelAfterRegistered",
  );

  if (
    !globalThis[UI_REACT_MESSAGE_CHANNEL_STATE] &&
    typeof globalThis.MessageChannel === "function"
  ) {
    const NativeMessageChannel = globalThis.MessageChannel;
    const schedulerChannels = new Set();
    const actChannels = new Set();

    function isReactSchedulerHandler(handler) {
      if (typeof handler !== "function") {
        return false;
      }

      const source = Function.prototype.toString.call(handler);

      return (
        handler.name === "performWorkUntilDeadline" &&
        source.includes("isMessageLoopRunning") &&
        source.includes("schedulePerformWorkUntilDeadline")
      );
    }

    function isReactActHandler(handler) {
      if (typeof handler !== "function") {
        return false;
      }

      const source = Function.prototype.toString.call(handler);

      return (
        source.includes("recursivelyFlushAsyncActWork") &&
        source.includes("return recursivelyFlushAsyncActWork(")
      );
    }

    function classifyReactMessageChannelHandler(handler) {
      if (isReactSchedulerHandler(handler)) {
        return "scheduler";
      }

      if (isReactActHandler(handler)) {
        return "act";
      }

      return null;
    }

    function TestMessageChannel(...args) {
      const channel = new NativeMessageChannel(...args);

      queueMicrotask(() => {
        const handler = channel.port1?.onmessage;

        const kind = classifyReactMessageChannelHandler(handler);

        if (kind === "scheduler") {
          schedulerChannels.add(channel);
        } else if (kind === "act") {
          actChannels.add(channel);
        }
      });

      return channel;
    }

    Object.setPrototypeOf(TestMessageChannel, NativeMessageChannel);
    TestMessageChannel.prototype = NativeMessageChannel.prototype;

    Object.defineProperty(TestMessageChannel, "name", {
      value: "MessageChannel",
      configurable: true,
    });

    globalThis.MessageChannel = TestMessageChannel;
    window.MessageChannel = TestMessageChannel;
    globalThis[UI_REACT_MESSAGE_CHANNEL_STATE] = {
      NativeMessageChannel,
      schedulerChannels,
      actChannels,
      classifyReactMessageChannelHandler,
    };
  }

  if (!globalThis[UI_MESSAGE_CHANNEL_AFTER_REGISTERED]) {
    const { after } = require("node:test");

    after(() => {
      const state = globalThis[UI_REACT_MESSAGE_CHANNEL_STATE];

      if (!state) {
        return;
      }

      for (const channel of state.schedulerChannels) {
        channel.port1?.unref?.();
        channel.port2?.unref?.();
      }

      for (const channel of state.actChannels) {
        channel.port1?.unref?.();
        channel.port2?.unref?.();
      }

      state.schedulerChannels.clear();
      state.actChannels.clear();
    });

    globalThis[UI_MESSAGE_CHANNEL_AFTER_REGISTERED] = true;
  }

  if (!globalThis.document.body) {
    const body = globalThis.document.createElement("body");
    globalThis.document.documentElement.appendChild(body);
  }

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  if (typeof globalThis.requestAnimationFrame === "undefined") {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  }

  if (typeof globalThis.cancelAnimationFrame === "undefined") {
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  if (typeof globalThis.matchMedia === "undefined") {
    globalThis.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  }
}
