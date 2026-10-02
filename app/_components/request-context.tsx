"use client";

import { createContext, ReactNode, useContext } from "react";

type RequestContextValue = {
  requestId: string;
  path: string;
};

const RequestContext = createContext<RequestContextValue | null>(null);

export function RequestContextProvider({
  children,
  requestId,
  path,
}: RequestContextValue & { children: ReactNode }) {
  return <RequestContext.Provider value={{ requestId, path }}>{children}</RequestContext.Provider>;
}

export function useRequestContext(): RequestContextValue {
  const value = useContext(RequestContext);

  if (value) return value;

  return {
    requestId: "unknown",
    path: typeof window !== "undefined" ? window.location.pathname : "unknown",
  };
}
