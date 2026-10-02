"use client";

import { useEffect, useState } from "react";

export type DashboardChromePrefs = {
  showHelpText: boolean;
  showSecondaryLinks: boolean;
  showDockCompose: boolean;
  showAdvancedActions: boolean;
};

const STORAGE_KEYS = {
  showHelpText: "gomdory.ui.showHelpText.v1",
  showSecondaryLinks: "gomdory.ui.showSecondaryLinks.v1",
  showDockCompose: "gomdory.ui.showDockCompose.v1",
  showAdvancedActions: "gomdory.ui.showAdvancedActions.v1",
} as const;

const DEFAULT_PREFS: DashboardChromePrefs = {
  showHelpText: false,
  showSecondaryLinks: false,
  showDockCompose: false,
  showAdvancedActions: false,
};

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return typeof window.localStorage === "undefined" ? null : window.localStorage;
}

function readBoolean(key: string, fallback: boolean) {
  const storage = getLocalStorage();
  if (!storage) return fallback;
  const raw = storage.getItem(key);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}

export function readDashboardChromePrefs(): DashboardChromePrefs {
  if (!getLocalStorage()) return DEFAULT_PREFS;
  return {
    showHelpText: readBoolean(STORAGE_KEYS.showHelpText, DEFAULT_PREFS.showHelpText),
    showSecondaryLinks: readBoolean(STORAGE_KEYS.showSecondaryLinks, DEFAULT_PREFS.showSecondaryLinks),
    showDockCompose: readBoolean(STORAGE_KEYS.showDockCompose, DEFAULT_PREFS.showDockCompose),
    showAdvancedActions: readBoolean(STORAGE_KEYS.showAdvancedActions, DEFAULT_PREFS.showAdvancedActions),
  };
}

export function writeDashboardChromePref(key: keyof DashboardChromePrefs, value: boolean) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEYS[key], value ? "1" : "0");
  window.dispatchEvent(new CustomEvent("gomdory:dashboard-chrome-pref-change"));
}

export function useDashboardChromePrefs() {
  const [prefs, setPrefs] = useState<DashboardChromePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const sync = () => setPrefs(readDashboardChromePrefs());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("gomdory:dashboard-chrome-pref-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("gomdory:dashboard-chrome-pref-change", sync);
    };
  }, []);

  return prefs;
}
