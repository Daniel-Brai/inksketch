import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

const PASS_THROUGH = ['data:', 'http://', 'https://', '//'];

export function inlineImages(sketchFile: string): (src: string) => string {
  const base = dirname(sketchFile);
  const cache = new Map<string, string>();

  return (src) => {
    if (PASS_THROUGH.some((prefix) => src.startsWith(prefix))) return src;

    const cached = cache.get(src);

    if (cached !== undefined) return cached;

    const path = resolve(base, src);
    const mime = MIME[extname(path).toLowerCase()];

    if (mime === undefined)
      throw new Error(`image ${src}: unsupported type, use ${Object.keys(MIME).join(' ')}`);

    const uri = `data:${mime};base64,${readFileSync(path).toString('base64')}`;

    cache.set(src, uri);

    return uri;
  };
}
