import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';
import type { Toast, ToastKind } from '../utils/toast';

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

const kindIcon: Record<ToastKind, React.ReactNode> = {
  error: <AlertCircle size={18} />,
  success: <CheckCircle size={18} />,
  info: <Info size={18} />,
};

/** Renders the notifications raised via `showToast` / `reportError`. Mount once, near the app root. */
export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      subscribeToasts((toast) => {
        setToasts((prev) => [...prev, toast].slice(-MAX_VISIBLE));
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), AUTO_DISMISS_MS);
      }),
    []
  );

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon">{kindIcon[t.kind]}</span>
          <span className="toast-message">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Закрыть"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
