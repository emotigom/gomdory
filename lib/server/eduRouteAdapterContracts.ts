// [boundary role]
// This file is contract-only for student mainline route adapters.
// Keep runtime-free: type vocabulary lives here, implementation lives in
// `eduRouteAdapterUtils`, backend orchestration lives in `eduAiBackendClient`.

// [shared contract] service-step decision output for student mainline route adapters.
export type EduRouteResponseDraft = {
  payload: Record<string, unknown>;
  status: number;
  extraHeaders?: Record<string, string>;
};

// [shared contract] shared student mainline route-adapter context vocabulary.
export type EduRouteAdapterContext = {
  requestId: string;
  route: string;
};

// [shared contract] canonical route JSON emitter input contract.
export type EduRouteJsonResponseInput = {
  payload: Record<string, unknown>;
  status: number;
  requestId: string;
  extraHeaders?: Record<string, string>;
};

export type EduRouteJsonResponseEmitter = (input: EduRouteJsonResponseInput) => Response;

// [shared contract] adapter runner input contract for runDraft -> emit flow.
export type RunEduRouteAdapterInput = {
  requestId?: string;
  adapterContext?: EduRouteAdapterContext;
  runDraft: () => Promise<EduRouteResponseDraft>;
  emitResponse?: EduRouteJsonResponseEmitter;
};
