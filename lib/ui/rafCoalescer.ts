export type RequestFrame = (callback: FrameRequestCallback) => number;
export type CancelFrame = (handle: number) => void;

export function createRafCoalescer(callback: () => void, requestFrame: RequestFrame) {
  let frame: number | null = null;

  return {
    schedule(): boolean {
      if (frame !== null) {
        return false;
      }
      frame = requestFrame(() => {
        frame = null;
        callback();
      });
      return true;
    },
    hasPending(): boolean {
      return frame !== null;
    },
    cancel(cancelFrame: CancelFrame) {
      if (frame === null) {
        return;
      }
      cancelFrame(frame);
      frame = null;
    },
  };
}
