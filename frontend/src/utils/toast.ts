import { getErrorMessage } from '../api/client';

export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Called by <ToastHost/>; returns an unsubscribe function. */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(message: string, kind: ToastKind = 'error'): void {
  const toast: Toast = { id: nextId++, kind, message };
  listeners.forEach((listener) => listener(toast));
}

/** Shows any error thrown by the API layer as a toast (and logs it for debugging). */
export function reportError(error: unknown, fallback?: string): void {
  console.error(error);
  showToast(getErrorMessage(error, fallback));
}
