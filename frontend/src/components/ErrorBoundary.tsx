import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Prevents render errors and failed lazy imports from blanking the whole app. */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Ошибка интерфейса:', error);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main className="centered-message" role="alert">
          <h1>Не удалось показать страницу</h1>
          <p>Попробуйте загрузить её ещё раз. Если проблема повторяется, проверьте соединение.</p>
          <button className="btn-primary" type="button" onClick={this.reload}>Повторить загрузку</button>
        </main>
      );
    }
    return this.props.children;
  }
}
