import React from "react";
import debugLog from "../utils/debugLog.js";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] caught:", error, info?.componentStack);
    debugLog.error("render", error, {
      source: "ErrorBoundary",
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-lg w-full bg-surface-light dark:bg-surface-dark rounded-2xl shadow-soft p-8 text-center">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-4xl">error</span>
          </div>
          <h1 className="text-2xl font-bold text-text-light dark:text-text-dark mb-2">
            حدث خطأ غير متوقع
          </h1>
          <p className="text-sm text-text-light/70 dark:text-text-dark/70 mb-6">
            تم اعتراض الخطأ حتى لا تنهار الواجهة بالكامل. يمكنك إعادة تحميل الصفحة أو العودة للوحة الرئيسية.
          </p>
          <pre className="text-xs text-left bg-background-light dark:bg-background-dark/50 p-3 rounded-lg text-red-600 dark:text-red-400 overflow-auto max-h-40 mb-6 whitespace-pre-wrap break-words">
            {message}
          </pre>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 transition">
              إعادة التحميل
            </button>
            <button
              onClick={this.handleHome}
              className="px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary/10 transition">
              الصفحة الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
