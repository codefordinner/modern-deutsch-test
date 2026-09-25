// Global UI preferences shared across all trainers (Numbers, Words, Verbs,
// Time). Kept outside per-component localStorage so a single "Настройки"
// toggle in the Navbar affects every quiz card at once.
//
// Persisted to localStorage and broadcast via a custom DOM event so every
// mounted component picks up a change immediately, even though there's no
// shared React context provider wrapping the app.

export interface UISettings {
  /** Show the on-screen ä/ö/ü/ß insertion bar under answer inputs. */
  showUmlautBar: boolean;
  /**
   * When true, the "Дальше" (next) button grabs keyboard focus as soon as
   * an answer is checked, which blurs the answer input and closes the
   * on-screen keyboard on phones. Default is false, so the keyboard stays
   * open between questions.
   */
  collapseKeyboardAfterAnswer: boolean;
  /**
   * Accept ae/oe/ue/ss where the answer has ä/ö/ü/ß ("Tuer" for "Tür"). Off by
   * default: learners are supposed to practise the real spelling.
   */
  acceptUmlautSubstitutes: boolean;
}

const STORAGE_KEY = 'app_ui_settings';
const EVENT_NAME = 'app-ui-settings-changed';

export const DEFAULT_UI_SETTINGS: UISettings = {
  showUmlautBar: false,
  collapseKeyboardAfterAnswer: false,
  acceptUmlautSubstitutes: false,
};

export function getUISettings(): UISettings {
  if (typeof window === 'undefined') return DEFAULT_UI_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_UI_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_UI_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
}

export function setUISettings(partial: Partial<UISettings>): UISettings {
  const next = { ...getUISettings(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-blocking: the setting just won't persist across reloads.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }
  return next;
}

export function subscribeUISettings(cb: (settings: UISettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<UISettings>).detail);
  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}
