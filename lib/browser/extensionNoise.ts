export const EXTENSION_MESSAGE_CHANNEL_CLOSED_MESSAGE =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

const getMessage = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    return String((reason as { message?: unknown }).message ?? "");
  }
  return "";
};

export const isKnownExtensionMessageChannelRejection = (reason: unknown): boolean => {
  const message = getMessage(reason);
  return message === EXTENSION_MESSAGE_CHANNEL_CLOSED_MESSAGE;
};
