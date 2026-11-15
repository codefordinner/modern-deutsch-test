import { createContext } from 'react';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const ConfirmContext = createContext<((message: string, options?: ConfirmOptions) => Promise<boolean>) | null>(null);
