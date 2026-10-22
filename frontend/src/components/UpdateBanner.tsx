import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useServiceWorkerUpdates } from '../hooks/useServiceWorkerUpdates';

/** "Доступна новая версия" — the page only switches to the new service worker when the learner agrees. */
export const UpdateBanner: React.FC = () => {
  const { updateReady, applyUpdate } = useServiceWorkerUpdates();
  const [dismissed, setDismissed] = useState(false);

  if (!updateReady || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <span className="update-banner-text">Доступна новая версия приложения.</span>
      <button type="button" className="btn-primary btn-xs" onClick={applyUpdate}>Обновить</button>
      <button type="button" className="btn-secondary btn-xs" onClick={() => setDismissed(true)}>Позже</button>
    </div>
  );
};
