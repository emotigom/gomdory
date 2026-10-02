"use client";

import type { ReactNode } from "react";
import React from "react";

import { sendUiError } from "@/lib/ops/clientLog";

const DEFAULT_TITLE = "화면을 불러오지 못했습니다.";
const DEFAULT_DESCRIPTION = "네트워크를 확인하고 다시 접속해 주세요.";

export default class AppErrorBoundary extends React.Component<
  { children: ReactNode; title?: string; description?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    void sendUiError({
      message: error.message ?? "ui_error",
      stack: error.stack ?? null,
      route: typeof window !== "undefined" ? window.location.pathname : null,
    });
  }

  handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl">
          <p className="text-lg font-semibold text-slate-900">{this.props.title ?? DEFAULT_TITLE}</p>
          <p className="mt-2 text-sm text-slate-600">{this.props.description ?? DEFAULT_DESCRIPTION}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              새로고침
            </button>
            <a
              href={typeof window !== "undefined" ? window.location.href : "#"}
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              재접속
            </a>
          </div>
        </div>
      </div>
    );
  }
}
