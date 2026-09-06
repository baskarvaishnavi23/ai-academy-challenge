import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

export default function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  isRetrying = false,
}: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      id="system-error-banner"
      role="alert"
      className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
        <span className="font-medium">{message}</span>
      </div>

      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            id="error-retry-action-btn"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Retry Save'}</span>
          </button>
        )}

        {onDismiss && (
          <button
            id="error-dismiss-btn"
            onClick={onDismiss}
            className="rounded-lg p-1 text-rose-500 hover:bg-rose-200/50 hover:text-rose-800"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
