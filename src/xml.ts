import { isSpace } from './chars.ts';

export interface Tag {
  name: string;
  attrs: Record<string, string>;
  closing: boolean;
  selfClosing: boolean;
}

const SKIPPED: ReadonlyArray<readonly [string, string]> = [
  ['<!--', '-->'],
  ['<![CDATA[', ']]>'],
  ['<?', '?>'],
  ['<!', '>'],
];

const isNameEnd = (c: string | undefined): boolean =>
  c === undefined || isSpace(c) || c === '/' || c === '>' || c === '=';

function decode(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function readName(xml: string, start: number): { name: string; end: number } {
  let i = start;

  while (!isNameEnd(xml[i])) i++;

  return { name: xml.slice(start, i), end: i };
}

function readValue(xml: string, start: number): { value: string; end: number } {
  const quote = xml[start];

  if (quote === '"' || quote === "'") {
    const close = xml.indexOf(quote, start + 1);
    const end = close < 0 ? xml.length : close;

    return { value: decode(xml.slice(start + 1, end)), end: end + 1 };
  }

  let i = start;

  while (i < xml.length && !isSpace(xml[i]) && xml[i] !== '>') i++;

  return { value: decode(xml.slice(start, i)), end: i };
}

function afterNext(xml: string, char: string, from: number): number {
  const at = xml.indexOf(char, from);

  return at < 0 ? xml.length : at + 1;
}

function readTag(xml: string, open: number): { tag: Tag; end: number } {
  const closing = xml[open + 1] === '/';
  const { name, end: afterName } = readName(xml, open + (closing ? 2 : 1));
  const attrs: Record<string, string> = {};
  let i = afterName;

  while (i < xml.length) {
    while (isSpace(xml[i])) i++;

    if (xml[i] === '>') return { tag: { name, attrs, closing, selfClosing: false }, end: i + 1 };

    if (xml[i] === '/') {
      return { tag: { name, attrs, closing, selfClosing: true }, end: afterNext(xml, '>', i) };
    }

    const attr = readName(xml, i);

    i = attr.end;

    while (isSpace(xml[i])) i++;

    if (xml[i] !== '=') {
      if (attr.name) attrs[attr.name] = attr.name;
      continue;
    }

    i++;

    while (isSpace(xml[i])) i++;

    const value = readValue(xml, i);

    attrs[attr.name] = value.value;
    i = value.end;
  }

  return { tag: { name, attrs, closing, selfClosing: false }, end: xml.length };
}

function skipSpecial(xml: string, at: number): number | null {
  for (const [open, close] of SKIPPED) {
    if (!xml.startsWith(open, at)) continue;

    const end = xml.indexOf(close, at + open.length);

    return end < 0 ? xml.length : end + close.length;
  }

  return null;
}

export function scanTags(xml: string): Tag[] {
  const tags: Tag[] = [];
  let i = xml.indexOf('<');

  while (i >= 0 && i < xml.length) {
    const skipped = skipSpecial(xml, i);

    if (skipped !== null) {
      i = xml.indexOf('<', skipped);
      continue;
    }

    const { tag, end } = readTag(xml, i);

    tags.push(tag);
    i = xml.indexOf('<', end);
  }

  return tags;
}
