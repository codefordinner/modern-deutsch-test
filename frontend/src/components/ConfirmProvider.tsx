import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { ConfirmContext } from '../hooks/confirmContext';
import type { ConfirmOptions } from '../hooks/confirmContext';

interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (confirmed: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => new Promise<boolean>((resolve) => {
    setRequest({ message, ...options, resolve });
  }), []);

  const finish = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(null);
  };

  return <ConfirmContext.Provider value={confirm}>
    {children}
    {request && <Modal title={request.title ?? 'Подтверждение'} size="sm" onClose={() => finish(false)} closeOnBackdrop={false}>
      <div className="modal-body"><p>{request.message}</p></div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={() => finish(false)}>Отмена</button>
        <button type="button" className={request.danger ? 'btn-primary btn-danger' : 'btn-primary'} onClick={() => finish(true)}>{request.confirmLabel ?? 'Подтвердить'}</button>
      </div>
    </Modal>}
  </ConfirmContext.Provider>;
}
