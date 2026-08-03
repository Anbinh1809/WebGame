import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface GameErrorBoundaryProps {
  children: ReactNode
}

interface GameErrorBoundaryState {
  error: Error | null
}

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  public state: GameErrorBoundaryState = { error: null }

  public static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { error }
  }

  public componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Rendering errors are contained here; the visible fallback gives players a recovery path.
  }

  private readonly retry = (): void => this.setState({ error: null })

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="webgl-fallback" role="alert">
          <span className="eyebrow">Khôi phục phiên chơi</span>
          <strong>Giao diện thế giới cần tải lại</strong>
          <p>{this.state.error.message}</p>
          <button type="button" className="secondary-button" onClick={this.retry}>Thử lại</button>
        </div>
      )
    }
    return this.props.children
  }
}
