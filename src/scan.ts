import { isDigit, isSpace } from './chars.ts';

export interface Cursor {
  text: string;
  i: number;
}

const isSeparator = (c: string | undefined): boolean => c === ',' || isSpace(c);

export function skipSeparators(c: Cursor): void {
  while (isSeparator(c.text[c.i])) c.i++;
}

export function atEnd(c: Cursor): boolean {
  skipSeparators(c);

  return c.i >= c.text.length;
}

export function peekNumber(c: Cursor): boolean {
  skipSeparators(c);

  const ch = c.text[c.i];

  return isDigit(ch) || ch === '-' || ch === '+' || ch === '.';
}

function skipDigits(c: Cursor): number {
  const start = c.i;

  while (isDigit(c.text[c.i])) c.i++;

  return c.i - start;
}

export function readNumber(c: Cursor): number | null {
  skipSeparators(c);

  const start = c.i;

  if (c.text[c.i] === '-' || c.text[c.i] === '+') c.i++;

  let digits = skipDigits(c);

  if (c.text[c.i] === '.') {
    c.i++;
    digits += skipDigits(c);
  }

  if (digits === 0) {
    c.i = start;
    return null;
  }

  if (c.text[c.i] === 'e' || c.text[c.i] === 'E') {
    const mark = c.i;

    c.i++;

    if (c.text[c.i] === '-' || c.text[c.i] === '+') c.i++;

    if (skipDigits(c) === 0) c.i = mark;
  }

  return Number(c.text.slice(start, c.i));
}

export function readFlag(c: Cursor): number | null {
  skipSeparators(c);

  const ch = c.text[c.i];

  if (ch !== '0' && ch !== '1') return null;

  c.i++;

  return ch === '1' ? 1 : 0;
}

export function readNumbers(text: string | undefined): number[] {
  if (!text) return [];

  const c: Cursor = { text, i: 0 };
  const out: number[] = [];

  while (!atEnd(c)) {
    const n = readNumber(c);

    if (n === null) {
      c.i++;
    } else {
      out.push(n);
    }
  }

  return out;
}
