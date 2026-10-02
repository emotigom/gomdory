"use client";

import { Component, type ReactNode } from "react";
import { randomHex } from "@/lib/crypto/webcrypto";

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
};

type ChatPanelErrorBoundaryProps = {
  children: ReactNode;
  onRetry?: () => void;
  onExportDiagnostics?: (requestId: string) => void | Promise<void>;
  onError?: (errorNameHash: string) => void;
  codeHash?: string | null;
};

type ChatPanelErrorBoundaryState = {
  hasError: boolean;
  requestId: string;
  errorNameHash: string | null;
};

class ChatPanelErrorBoundary extends Component<ChatPanelErrorBoundaryProps, ChatPanelErrorBoundaryState> {
  state: ChatPanelErrorBoundaryState = {
    hasError: false,
    requestId: randomHex(6),
    errorNameHash: null,
  };

  static getDerivedStateFromError(error: unknown): ChatPanelErrorBoundaryState {
    const errorName = error instanceof Error ? error.name : "Error";
    return {
      hasError: true,
      requestId: randomHex(6),
      errorNameHash: hashString(errorName),
    };
  }

  componentDidCatch(error: unknown) {
    const errorName = error instanceof Error ? error.name : "Error";
    const errorNameHash = hashString(errorName);
    this.props.onError?.(errorNameHash);
    if (process.env.NODE_ENV !== "production") {
      console.error("[edu] ChatPanel crashed", {
        requestId: this.state.requestId,
        errorNameHash,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      requestId: randomHex(6),
      errorNameHash: null,
    });
    if (this.props.onRetry) {
      this.props.onRetry();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleExport = () => {
    if (!this.props.onExportDiagnostics) return;
    void this.props.onExportDiagnostics(this.state.requestId);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[420px] w-full flex-1 items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-lg">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">문제가 발생했어요</h3>
              <p className="mt-1 text-sm text-slate-500">
                입력 내용은 저장되지 않았어요. 다시 시도하거나 안전한 진단 정보를 내보낼 수 있어요.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <p>requestId: {this.state.requestId}</p>
            <p>codeHash: {this.props.codeHash ?? "없음"}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={this.handleExport}
              disabled={!this.props.onExportDiagnostics}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              진단 내보내기
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ChatPanelErrorBoundary;
