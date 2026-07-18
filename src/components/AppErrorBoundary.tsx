import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/error-reporting";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error, "react_boundary", {
      componentStack: info.componentStack?.slice(0, 8_000) || null,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-xl border border-border bg-card p-7 text-center shadow-lg">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CloseSync</p>
          <h1 className="text-xl font-semibold mt-3">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The problem has been recorded. Your saved work is still in your account.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              onClick={() => window.location.assign("/dashboard")}
            >
              Go to dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }
}
