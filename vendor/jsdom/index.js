class Event {
  constructor(type, options = {}) {
    this.type = String(type);
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

class KeyboardEvent extends Event {
  constructor(type, options = {}) {
    super(type, options);
    this.key = options.key ?? "";
  }
}

class MouseEvent extends Event {}

class EventTarget {
  constructor() {
    this.__listeners = new Map();
  }

  addEventListener(type, handler) {
    if (typeof handler !== "function") return;
    const listeners = this.__listeners.get(type) ?? [];
    listeners.push(handler);
    this.__listeners.set(type, listeners);
  }

  removeEventListener(type, handler) {
    const listeners = this.__listeners.get(type);
    if (!listeners) return;
    this.__listeners.set(
      type,
      listeners.filter((candidate) => candidate !== handler),
    );
  }

  dispatchEvent(event) {
    if (!event || typeof event.type !== "string") {
      throw new TypeError("dispatchEvent expects an Event");
    }

    if (!event.target) {
      event.target = this;
    }

    event.currentTarget = this;

    const listeners = this.__listeners.get(event.type) ?? [];
    for (const listener of [...listeners]) {
      listener.call(this, event);
    }

    if (event.bubbles && this.parentNode && this.parentNode !== this) {
      this.parentNode.dispatchEvent(event);
    }

    return !event.defaultPrevented;
  }
}

class Node extends EventTarget {
  constructor(ownerDocument, nodeType, nodeName) {
    super();
    this.ownerDocument = ownerDocument;
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.parentNode = null;
    this.childNodes = [];
    this.textContent = "";
  }

  appendChild(node) {
    node.parentNode = this;
    if (!node.ownerDocument) {
      node.ownerDocument = this.ownerDocument;
    }
    this.childNodes.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }

  insertBefore(node, before) {
    if (!before) {
      return this.appendChild(node);
    }

    const index = this.childNodes.indexOf(before);
    if (index < 0) {
      return this.appendChild(node);
    }

    node.parentNode = this;
    if (!node.ownerDocument) {
      node.ownerDocument = this.ownerDocument;
    }
    this.childNodes.splice(index, 0, node);
    return node;
  }

  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    return this.childNodes.some((child) => child.contains(node));
  }
}

class Element extends Node {
  constructor(ownerDocument, tagName) {
    super(ownerDocument, 1, String(tagName).toUpperCase());
    this.tagName = this.nodeName;
    this.style = {};
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON() {
        return this;
      },
    };
  }
}

class HTMLIFrameElement extends Element {}

class TextNode extends Node {
  constructor(ownerDocument, text) {
    super(ownerDocument, 3, "#text");
    this.textContent = text;
  }
}

class CommentNode extends Node {
  constructor(ownerDocument, text) {
    super(ownerDocument, 8, "#comment");
    this.textContent = text;
  }
}

class Document extends Node {
  constructor() {
    super(null, 9, "#document");
    this.ownerDocument = this;
    this.documentElement = new Element(this, "html");
    this.head = new Element(this, "head");
    this.body = new Element(this, "body");
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
    this.activeElement = this.body;
    this.defaultView = null;
  }

  createElement(tagName) {
    const element = String(tagName).toLowerCase() === "iframe"
      ? new HTMLIFrameElement(this, "iframe")
      : new Element(this, tagName);
    return element;
  }

  createElementNS(_namespace, tagName) {
    return this.createElement(tagName);
  }

  createTextNode(text) {
    return new TextNode(this, String(text));
  }

  createComment(text) {
    return new CommentNode(this, String(text));
  }
}

class Window extends EventTarget {
  constructor() {
    super();
    this.document = new Document();
    this.document.defaultView = this;
    this.navigator = { userAgent: "local-jsdom" };
    this.innerWidth = 1024;
    this.innerHeight = 768;
    this.Event = Event;
    this.KeyboardEvent = KeyboardEvent;
    this.MouseEvent = MouseEvent;
    this.Node = Node;
    this.Element = Element;
    this.HTMLElement = Element;
    this.HTMLIFrameElement = HTMLIFrameElement;
    this.Document = Document;
    this.setTimeout = setTimeout;
    this.clearTimeout = clearTimeout;
    this.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    this.cancelAnimationFrame = (id) => clearTimeout(id);
    this.matchMedia = (query) => ({
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

class JSDOM {
  constructor(_html = "", _options = {}) {
    this.window = new Window();
  }
}

module.exports = {
  JSDOM,
};
