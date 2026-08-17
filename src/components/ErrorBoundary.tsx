import { Component, ReactNode } from 'react';

// React 19 has no hook-based error boundary — this MUST be a class component.
// Contains any render-time throw inside its subtree and shows a fixed Vietnamese
// fallback (never the raw error/stack — see threat T-00-10) instead of blanking
// the whole app. The caught error is logged via console.error only.
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // `react` ships no bundled types and `@types/react` is not installed, so the
  // `Component` base resolves to `any` and does not surface `props`. Declare it
  // explicitly (declaration-only — React still populates it at runtime) so the
  // compiler sees `this.props` without changing behavior.
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error('Render error:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <p className="font-semibold">Không hiển thị được kết quả</p>
          <p>Đã có lỗi khi hiển thị nội dung. Vui lòng thử tạo lại.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
