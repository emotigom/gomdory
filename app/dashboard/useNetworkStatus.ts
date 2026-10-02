"use client";

import { useEffect, useState } from "react";

type NetworkStatus = {
  online: boolean;
  changedAt: number;
};

const getSnapshot = (): NetworkStatus => {
  if (typeof window === "undefined") {
    return { online: true, changedAt: Date.now() };
  }

  return { online: window.navigator?.onLine !== false, changedAt: Date.now() };
};

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => getSnapshot());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      setStatus(getSnapshot());
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return status;
}
