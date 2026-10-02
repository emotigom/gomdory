"use client";

import { useEffect, useState } from "react";

export type DashboardToast = {
  id: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type Listener = (toasts: DashboardToast[]) => void;

const listeners = new Set<Listener>();
let queue: DashboardToast[] = [];

function emit() {
  const snapshot = [...queue];
  listeners.forEach((listener) => listener(snapshot));
}

export function pushDashboardToast(toast: Omit<DashboardToast, "id"> & { id?: string }) {
  const id = toast.id ?? crypto.randomUUID();
  queue = [...queue, { ...toast, id }];
  emit();

  window.setTimeout(() => {
    queue = queue.filter((item) => item.id !== id);
    emit();
  }, 4200);

  return id;
}

export function dismissDashboardToast(id: string) {
  queue = queue.filter((item) => item.id !== id);
  emit();
}

export function useDashboardToasts() {
  const [toasts, setToasts] = useState<DashboardToast[]>(queue);

  useEffect(() => {
    const listener: Listener = (next) => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return toasts;
}
