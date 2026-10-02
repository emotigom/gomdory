class SimplePeer {
  constructor(options = {}) {
    this.initiator = Boolean(options.initiator);
    this.trickle = options.trickle !== false;
    this.connected = false;
    this.destroyed = false;
    this._events = new Map();
    this._channel = null;
    this._pc = new RTCPeerConnection(options.config ?? {});

    this._pc.onicecandidate = (event) => {
      if (!event.candidate || !this.trickle) return;
      this._emit("signal", event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
    };

    this._pc.onconnectionstatechange = () => {
      if (this._pc.connectionState === "failed") {
        this._emit("error", new Error("connection_failed"));
        this.destroy();
      }
    };

    this._pc.ondatachannel = (event) => {
      this._setupChannel(event.channel);
    };

    if (this.initiator) {
      this._setupChannel(this._pc.createDataChannel("data"));
      this._pc
        .createOffer()
        .then((offer) => this._pc.setLocalDescription(offer))
        .then(() => {
          if (this._pc.localDescription) {
            this._emit("signal", this._pc.localDescription.toJSON());
          }
        })
        .catch((error) => {
          this._emit("error", error);
        });
    }
  }

  on(event, handler) {
    const handlers = this._events.get(event) ?? new Set();
    handlers.add(handler);
    this._events.set(event, handlers);
    return this;
  }

  send(data) {
    if (!this._channel || this._channel.readyState !== "open") return;
    this._channel.send(data);
  }

  signal(data) {
    if (this.destroyed) return;
    if (data && data.candidate) {
      this._pc
        .addIceCandidate(data)
        .catch((error) => this._emit("error", error));
      return;
    }
    if (data && data.type) {
      const description = data;
      this._pc
        .setRemoteDescription(description)
        .then(() => {
          if (description.type === "offer") {
            return this._pc.createAnswer().then((answer) => {
              return this._pc.setLocalDescription(answer).then(() => {
                if (this._pc.localDescription) {
                  this._emit("signal", this._pc.localDescription.toJSON());
                }
              });
            });
          }
          return null;
        })
        .catch((error) => this._emit("error", error));
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      if (this._channel) this._channel.close();
      this._pc.close();
    } catch {
      // ignore close errors
    }
    this._emit("close");
  }

  _setupChannel(channel) {
    this._channel = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      this.connected = true;
      this._emit("connect");
    };
    channel.onmessage = (event) => {
      this._emit("data", event.data);
    };
    channel.onerror = (event) => {
      this._emit("error", event);
    };
    channel.onclose = () => {
      this.connected = false;
      this._emit("close");
    };
  }

  _emit(event, ...args) {
    const handlers = this._events.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch {
        // ignore handler errors
      }
    }
  }
}

module.exports = SimplePeer;
