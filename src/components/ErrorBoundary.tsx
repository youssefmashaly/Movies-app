import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { reportError } from "../lib/analytics";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Global crash guard: catches render/lifecycle errors anywhere in the tree
// below it and shows a themed fallback instead of a blank white screen.
// Does not catch errors in event handlers, async code, or SSR — those are
// already handled individually via try/catch + SupabaseResult in the service
// layer, so this is specifically the last line of defense for render crashes.
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled render error caught by ErrorBoundary:", error, info.componentStack);
    // No-op unless VITE_ANALYTICS_ENABLED + VITE_ANALYTICS_ENDPOINT are set.
    reportError(error, { componentStack: info.componentStack });
  }

  handleReturnHome = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased flex items-center justify-center px-6 py-12">
        <div className="pointer-events-none fixed top-0 left-0 right-0 h-[600px] bg-[radial-gradient(circle_at_top,_rgba(220,38,38,0.08)_0%,_transparent_60%)] z-0" />

        <div className="relative z-10 w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden="true" />
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed mb-8">
            An unexpected error interrupted this page. Your account, watchlist, and reviews are safe —
            try refreshing, or head back to the homepage.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={this.handleReturnHome}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-red-650 hover:bg-red-600 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-xl shadow-red-950/30 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Return to Homepage
            </button>
            <button
              onClick={this.handleRefresh}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-neutral-800 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}