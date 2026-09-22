import { useEffect, useState } from 'react';
import { getUISettings, subscribeUISettings, setUISettings } from '../utils/uiSettings';
import type { UISettings } from '../utils/uiSettings';

/**
 * Reads the global UI settings (umlaut bar visibility, keep-keyboard-open
 * behaviour) and stays in sync with changes made from anywhere else in the
 * app (e.g. the Navbar's "Настройки" modal).
 */
export function useUISettings(): [UISettings, (partial: Partial<UISettings>) => void] {
  const [settings, setSettings] = useState<UISettings>(() => getUISettings());

  useEffect(() => subscribeUISettings(setSettings), []);

  const update = (partial: Partial<UISettings>) => {
    setUISettings(partial);
  };

  return [settings, update];
}
