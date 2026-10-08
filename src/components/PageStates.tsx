import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Shown while a page's code loads: same card shapes as the app, so the layout doesn't jump. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="space-y-4">
      <div className="sk h-9 w-48 rounded-xl" />
      <div className="sk h-4 w-64 max-w-full rounded-lg" />
      <div className="sk mt-6 h-44 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sk h-32 rounded-2xl" />
        <div className="sk h-32 rounded-2xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** A clear, recoverable error screen (a page failing to load or crashing no longer blanks the whole app). */
export class PageBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('Page failed', e, info.componentStack) }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="glass mx-auto mt-10 max-w-md rounded-3xl p-7 text-center">
        <p className="font-display text-xl font-semibold">That page didn&rsquo;t load</p>
        <p className="mt-2 text-sm text-muted">Your data is safe. Check your connection and try again.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => this.setState({ failed: false })} className="tap rounded-xl bg-teal px-5 text-sm font-medium text-bg">Try again</button>
          <button type="button" onClick={() => window.location.reload()} className="tap rounded-xl border border-white/15 px-5 text-sm">Reload app</button>
        </div>
      </div>
    )
  }
}
