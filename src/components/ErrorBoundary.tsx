import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Without this, any exception thrown during render unmounts the whole tree and
 * leaves the user staring at a blank white page with no way back.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcf9f8] px-6 text-[#1b1c1c]">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ffdad6] text-[#93000a]">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="mt-4 font-serif text-xl font-bold">Terjadi Kesalahan</h1>
          <p className="mt-2 text-sm text-[#5d5f5b]">
            Aplikasi mengalami gangguan tak terduga. Muat ulang halaman untuk melanjutkan.
          </p>
          <button
            onClick={this.handleReload}
            className="tap-44 mx-auto mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34562e] px-6 text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>
    );
  }
}
