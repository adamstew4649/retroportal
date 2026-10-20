import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Widget "${this.props.name}" failed`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="widget-error" role="alert">
          <p>This widget ran into a problem.</p>
          <button
            type="button"
            className="mini-button"
            onClick={() => this.setState({ hasError: false })}
          >
            <RotateCw size={12} aria-hidden="true" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
