export const isSpace = (c: string | undefined): boolean =>
  c === ' ' || c === '\n' || c === '\t' || c === '\r';

export const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
