// Export / import of everything the app keeps in localStorage (SRS boxes, scores,
// settings), so progress can move between devices. When you add a new
// localStorage key that belongs to the learner, add it to BACKUP_KEYS.

export const BACKUP_KEYS = [
  'app_scores',
  'app_ui_settings',
  'app_study_prefs',
  'theme',
  'words_use_srs',
  'words_srs_state',
  'verbs_use_srs',
  'verbs_srs_state',
  'articles_use_srs',
  'articles_srs_state',
  'app_srs_reset_at', // SRS sync: when each trainer was last reset
  'verbs_praesens_submode',
  // Trainer settings (usePersistentState)
  'words_settings',
  'numbers_direction',
  'numbers_range',
  'time_display_mode',
  'time_step_mode',
  'verbs_mode',
  'articles_category',
] as const;

// The daily counter (app_daily_progress) is deliberately not exported: it's meaningless on another day/device.

const BACKUP_APP = 'deutsch-trainer';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export interface ProgressBackup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

export function buildBackup(): ProgressBackup {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    } catch {
      // storage unavailable: export what we could read
    }
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deutsch-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Parses and validates the text of a backup file; throws an Error with a user-presentable message. */
export function parseBackup(text: string): ProgressBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Файл слишком большой');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Файл не похож на JSON');
  }

  const backup = parsed as Partial<ProgressBackup> | null;
  if (!backup || backup.app !== BACKUP_APP || typeof backup.data !== 'object' || backup.data === null) {
    throw new Error('Это не файл прогресса Deutsch Trainer');
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('Файл создан более новой версией приложения');
  }

  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = (backup.data as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new Error(`Некорректное значение «${key}»`);
    if (key !== 'theme') {
      let inner: unknown;
      try {
        inner = JSON.parse(value);
      } catch {
        throw new Error(`Повреждены данные «${key}»`);
      }
      // Valid JSON of the wrong shape would later break the trainers, so check the shape too.
      const isPlainObject = typeof inner === 'object' && inner !== null && !Array.isArray(inner);
      if (key.endsWith('_srs_state') && !isPlainObject) throw new Error(`Повреждены данные «${key}»`);
      if (key.endsWith('_use_srs') && typeof inner !== 'boolean') throw new Error(`Повреждены данные «${key}»`);
    }
    data[key] = value;
  }
  if (Object.keys(data).length === 0) throw new Error('В файле нет данных прогресса');

  return { app: BACKUP_APP, version: backup.version, exportedAt: String(backup.exportedAt ?? ''), data };
}

/** Replaces the app's stored progress with the backup (keys absent from the file are cleared). The page must be reloaded afterwards. */
export function applyBackup(backup: ProgressBackup): void {
  for (const key of BACKUP_KEYS) {
    const value = backup.data[key];
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
}
