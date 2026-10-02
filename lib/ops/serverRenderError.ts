type ServerRenderErrorMeta = {
  scope: string;
  path: string;
  requestId: string;
  digest?: string;
  host?: string;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: (error as Error & { digest?: string }).digest,
    };
  }

  if (typeof error === "object" && error !== null) {
    return {
      message: "non_error_throwable",
      value: error,
      digest: (error as { digest?: string }).digest,
    };
  }

  return { message: "non_error_throwable", value: error };
}

export function logServerRenderError(meta: ServerRenderErrorMeta, err: unknown): void {
  const error = serializeError(err);
  const payload = {
    level: "error",
    stage: "server_render_failed",
    scope: meta.scope,
    path: meta.path,
    requestId: meta.requestId,
    digest: meta.digest ?? error.digest,
    host: meta.host ?? undefined,
    error,
  };

  console.error(JSON.stringify(payload, (_key, value) => (value === undefined ? undefined : value)));
}
