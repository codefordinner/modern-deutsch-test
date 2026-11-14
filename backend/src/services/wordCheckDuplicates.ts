import { duplicateKey } from './wordImport';
import type { WordCheckIssue, WordCheckResult } from './aiSettings';

export interface ExistingGermanWord {
  id: string;
  de: string;
}

const addIssue = (issues: WordCheckIssue[], issue: WordCheckIssue): void => {
  if (!issues.some((current) => current.field === issue.field && current.message === issue.message)) issues.push(issue);
};

/** Keeps conflicting German corrections from aborting an entire bulk check. */
export function resolveWordCheckDuplicates(
  results: WordCheckResult[],
  existingWords: ExistingGermanWord[],
): WordCheckResult[] {
  const wordsById = new Map(existingWords.map((word) => [word.id, word]));
  const currentKeyById = new Map(existingWords.map((word) => [word.id, duplicateKey(word.de)]));
  const correctionById = new Map<string, { key: string; value: string }>();

  for (const result of results) {
    const correction = result.corrections.find((item) => item.field === 'de' && typeof item.value === 'string');
    if (!correction || typeof correction.value !== 'string') continue;
    const key = duplicateKey(correction.value);
    if (currentKeyById.get(result.id) === key) {
      result.corrections = result.corrections.filter((item) => item !== correction);
    } else {
      correctionById.set(result.id, { key, value: correction.value });
    }
  }

  const blockedIds = new Set<string>();
  const ownersByFinalKey = new Map<string, string[]>();
  const rebuildFinalKeys = () => {
    ownersByFinalKey.clear();
    for (const word of existingWords) {
      const correction = correctionById.get(word.id);
      const key = correction && !blockedIds.has(word.id) ? correction.key : currentKeyById.get(word.id)!;
      const owners = ownersByFinalKey.get(key) ?? [];
      owners.push(word.id);
      ownersByFinalKey.set(key, owners);
    }
  };

  // Blocking is iterative: reverting one correction can expose another conflict.
  while (true) {
    rebuildFinalKeys();
    const newlyBlocked = [...ownersByFinalKey.values()]
      .filter((owners) => owners.length > 1)
      .flatMap((owners) => owners.filter((id) => correctionById.has(id) && !blockedIds.has(id)));
    if (!newlyBlocked.length) break;
    newlyBlocked.forEach((id) => blockedIds.add(id));
  }
  rebuildFinalKeys();

  const resultById = new Map(results.map((result) => [result.id, result]));
  for (const id of blockedIds) {
    const result = resultById.get(id);
    const correction = correctionById.get(id);
    if (!result || !correction) continue;
    const existingConflict = existingWords.find((word) => word.id !== id && currentKeyById.get(word.id) === correction.key);
    addIssue(result.issues, {
      field: 'de',
      severity: 'error',
      message: `Исправление на «${correction.value}» создаёт дубликат${existingConflict ? ` формы «${existingConflict.de}»` : ' среди выбранных слов'}; оно не применено.`,
    });
    result.corrections = result.corrections.filter((item) => item.field !== 'de');
  }

  for (const [key, owners] of ownersByFinalKey) {
    if (owners.length < 2) continue;
    const forms = owners.map((id) => wordsById.get(id)?.de).filter((de): de is string => Boolean(de));
    for (const id of owners) {
      const result = resultById.get(id);
      if (!result || blockedIds.has(id)) continue;
      const correction = correctionById.get(id);
      const message = correction
        ? `После остальных исправлений форма «${correction.value}» совпадёт с другой записью; исправление не применено.`
        : `В словаре уже есть дубликат немецкой формы${forms.length ? ` «${forms.join('» / «')}»` : ` «${key}»`}; объедините записи во вкладке «Дубликаты».`;
      addIssue(result.issues, { field: 'de', severity: 'error', message });
      if (correction) result.corrections = result.corrections.filter((item) => item.field !== 'de');
    }
  }

  return results;
}
