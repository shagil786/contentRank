"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("OUTRANK UI boundary caught an error", { error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="px-5 py-16 text-center rule-b">
          <p className="font-display text-2xl tracking-tightest">THIS SECTION HIT A SNAG.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-5 bg-signal text-white px-5 py-2.5 font-mono text-xs tracking-widest hover:bg-signal-dim"
          >
            TRY AGAIN
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
