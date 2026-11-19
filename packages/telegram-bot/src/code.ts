export const extractLoginCode = (text: string): string | null =>
  text.trim().match(/^(?:\/start\s+)?(\d{6})$/)?.[1] ?? null;
