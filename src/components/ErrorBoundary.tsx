import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last line of defence: the app never white-screens; the player can recover their save or reset. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MARKET//30] UI crash', error, info.componentStack);
  }

  private reload = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  private hardReset = () => {
    try {
      window.localStorage.removeItem('market30:save:v1');
    } catch {
      /* ignore */
    }
    this.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="panel max-w-md p-6 text-center">
          <div className="font-mono text-lg font-bold text-[var(--color-down)]">SYSTEM HALT</div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">예상치 못한 오류가 발생했습니다. 다시 불러오거나, 계속 문제가 있으면 현재 게임만 초기화하세요.</p>
          <pre className="mt-3 max-h-24 overflow-auto rounded bg-[var(--color-panel-2)] p-2 text-left text-[10px] text-[var(--color-dim)]">{this.state.error.message}</pre>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={this.reload} className="h-10 rounded-lg bg-[var(--color-ink)] px-4 font-mono text-xs font-bold text-[var(--color-bg)]">
              RELOAD
            </button>
            <button type="button" onClick={this.hardReset} className="h-10 rounded-lg border border-[var(--color-down)] px-4 font-mono text-xs font-bold text-[var(--color-down)]">
              RESET CURRENT GAME
            </button>
          </div>
        </div>
      </div>
    );
  }
}
