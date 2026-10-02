type PeerRole = "teacher" | "student";

export type PeerInfo = {
  peerId: string;
  role: PeerRole;
};

type SignalMessage =
  | { type: "peers"; peers: PeerInfo[] }
  | { type: "peer-joined"; peerId: string; role: PeerRole }
  | { type: "peer-left"; peerId: string }
  | { type: "signal"; to: string; from: string; data: unknown };

type SignalClientOptions = {
  roomKey: string;
  peerId: string;
  role: PeerRole;
};

type SignalHandlers = {
  onPeers: (peers: PeerInfo[]) => void;
  onPeerJoined: (peer: PeerInfo) => void;
  onPeerLeft: (peerId: string) => void;
  onSignal: (payload: { from: string; data: unknown }) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class SignalClient {
  private readonly options: SignalClientOptions;
  private readonly handlers: SignalHandlers;
  private socket: WebSocket | null = null;

  constructor(options: SignalClientOptions, handlers: SignalHandlers) {
    this.options = options;
    this.handlers = handlers;
  }

  connect() {
    if (this.socket) return;
    const url = new URL("/__edu_p2p/ws", window.location.origin);
    url.protocol = url.protocol.replace("http", "ws");
    url.searchParams.set("code", this.options.roomKey);
    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          type: "join",
          roomKey: this.options.roomKey,
          peerId: this.options.peerId,
          role: this.options.role,
        }),
      );
      this.handlers.onOpen?.();
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as SignalMessage;
        switch (message.type) {
          case "peers":
            this.handlers.onPeers(message.peers ?? []);
            break;
          case "peer-joined":
            this.handlers.onPeerJoined({ peerId: message.peerId, role: message.role });
            break;
          case "peer-left":
            this.handlers.onPeerLeft(message.peerId);
            break;
          case "signal":
            this.handlers.onSignal({ from: message.from, data: message.data });
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed
      }
    });

    socket.addEventListener("close", () => {
      this.socket = null;
      this.handlers.onClose?.();
    });
    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  sendSignal(to: string, data: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        type: "signal",
        to,
        from: this.options.peerId,
        data,
      }),
    );
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}
