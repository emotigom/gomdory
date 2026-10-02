export type SignalData = RTCSessionDescriptionInit | RTCIceCandidateInit;

export type SimplePeerData = ArrayBuffer | Uint8Array | string;

export interface Instance {
  connected: boolean;
  destroyed: boolean;
  _channel?: RTCDataChannel;
  on(event: "signal", handler: (data: SignalData) => void): this;
  on(event: "connect", handler: () => void): this;
  on(event: "data", handler: (data: SimplePeerData) => void): this;
  on(event: "close", handler: () => void): this;
  on(event: "error", handler: (error: unknown) => void): this;
  send(data: SimplePeerData): void;
  signal(data: SignalData): void;
  destroy(): void;
}

export interface Options {
  initiator?: boolean;
  trickle?: boolean;
  config?: RTCConfiguration;
}

export default class SimplePeer implements Instance {
  constructor(options?: Options);
  connected: boolean;
  destroyed: boolean;
  _channel?: RTCDataChannel;
  on(event: "signal", handler: (data: SignalData) => void): this;
  on(event: "connect", handler: () => void): this;
  on(event: "data", handler: (data: SimplePeerData) => void): this;
  on(event: "close", handler: () => void): this;
  on(event: "error", handler: (error: unknown) => void): this;
  send(data: SimplePeerData): void;
  signal(data: SignalData): void;
  destroy(): void;
}
