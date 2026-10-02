"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_THEME, getLegacyDataTheme, getStoredTheme, setStoredTheme, type ThemeId } from "@/lib/theme/theme";

type ThemeContextValue = { theme: ThemeId; setTheme: (theme: ThemeId) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeAttributes(theme: ThemeId) {
  const root = document.documentElement;
  root.setAttribute("data-gom-theme", theme);
  root.setAttribute("data-gom-theme-active", theme);
  root.setAttribute("data-theme", getLegacyDataTheme(theme));
  root.setAttribute("data-theme-active", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = getStoredTheme();
    const nextTheme = stored ?? DEFAULT_THEME;
    hydratedRef.current = true;
    setThemeState(nextTheme);
    applyThemeAttributes(nextTheme);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    applyThemeAttributes(theme);
    setStoredTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme: setThemeState }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
