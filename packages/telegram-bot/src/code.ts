export const extractLoginCode = (text: string): string | null =>
  text.trim().match(/^(?:(?:\/start(?:@\w+)?)\s+)?(\d{6})$/)?.[1] ?? null;
