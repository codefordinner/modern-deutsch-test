/** Splits listed translations while keeping separators inside parentheses. */
export function splitTranslations(value: string): string[] {
  const translations: string[] = [];
  let start = 0;
  let parenthesisDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '(') {
      parenthesisDepth += 1;
      continue;
    }
    if (character === ')') {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      continue;
    }
    if (parenthesisDepth === 0 && /[,;/]/u.test(character)) {
      const translation = value.slice(start, index).trim();
      if (translation) translations.push(translation);
      start = index + 1;
    }
  }

  const last = value.slice(start).trim();
  if (last) translations.push(last);
  return translations;
}
