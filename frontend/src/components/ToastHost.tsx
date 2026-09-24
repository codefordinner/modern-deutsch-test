import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';
import type { Toast, ToastKind } from '../utils/toast';

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

const kindStyle: Record<ToastKind, { color: string; icon: React.ReactNode }> = {
  error: { color: 'var(--error)', icon: <AlertCircle size={18} /> },
  success: { color: 'var(--success)', icon: <CheckCircle size={18} /> },
  info: { color: 'var(--accent-primary)', icon: <Info size={18} /> },
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
    <div
      aria-live="polite"
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: 'min(380px, calc(100vw - 32px))',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', fontSize: 14,
            background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
            borderLeft: `4px solid ${kindStyle[t.kind].color}`, borderRadius: 8, boxShadow: 'var(--shadow-md)',
          }}
        >
          <span style={{ color: kindStyle[t.kind].color, display: 'flex', marginTop: 1 }}>{kindStyle[t.kind].icon}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
