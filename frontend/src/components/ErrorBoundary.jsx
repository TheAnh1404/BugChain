import { Component } from 'react';
import { captureFrontendException } from '../monitoring/sentry';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    captureFrontendException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6">
          <div className="glass max-w-md rounded-2xl p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-[#ffb4ab]">
              error
            </span>
            <h1 className="mt-4 text-2xl font-bold text-[#e8dfee]">
              BugChain hit an unexpected error
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#ccc3d8]">
              Refresh the page and retry the last action. The error is captured when monitoring is configured.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff]"
              type="button"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
