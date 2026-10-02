"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DashboardChromeState = {
  mode: "default" | "board";
  boardTitle?: string;
  boardControls?: ReactNode;
};

type DashboardChromeContextValue = {
  chrome: DashboardChromeState;
  setChrome: (next: DashboardChromeState) => void;
};

const defaultChromeState: DashboardChromeState = {
  mode: "default",
};

const DashboardChromeContext = createContext<DashboardChromeContextValue | null>(null);

export function DashboardChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<DashboardChromeState>(defaultChromeState);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome]);

  return <DashboardChromeContext.Provider value={value}>{children}</DashboardChromeContext.Provider>;
}

export function useDashboardChrome() {
  const context = useContext(DashboardChromeContext);
  if (!context) return defaultChromeState;
  return context.chrome;
}

export function useSetDashboardChrome() {
  const context = useContext(DashboardChromeContext);
  if (!context) {
    return () => {
      // noop outside provider
    };
  }
  return context.setChrome;
}
