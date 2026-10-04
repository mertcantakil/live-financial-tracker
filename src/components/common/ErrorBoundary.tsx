import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Panel name shown in the fallback, e.g. "Grafik". */
  label: string
  /** Changing this value resets the boundary (e.g. selected asset id). */
  resetKey?: unknown
  className?: string
}

interface State {
  error: Error | null
  resetKey: unknown
}

/** Isolates render crashes to a single panel instead of blanking the whole terminal. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label}]`, error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-3 p-6 text-center ${this.props.className ?? ''}`}>
        <TriangleAlert className="size-8 text-down" />
        <div>
          <p className="text-sm font-medium text-fg">{this.props.label} yüklenemedi</p>
          <p className="mt-1 max-w-xs text-xs text-muted">{this.state.error.message}</p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-xs text-fg transition hover:border-accent hover:text-accent"
        >
          <RefreshCw className="size-3.5" /> Tekrar dene
        </button>
      </div>
    )
  }
}
