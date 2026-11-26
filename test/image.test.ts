import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { sketch } from 'inksketch';

import { inlineImages } from '#cli/images.ts';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

test('an image fades in on the drawing timeline', () => {
  const s = sketch({ width: 200, height: 200, draw: true });

  s.image('disk.png', [20, 30], [120, 90], { fit: 'cover' });

  const svg = s.toSVG({ theme: 'light' });

  expect(svg).toContain('<image href="disk.png" x="20" y="30" width="120" height="90"');
  expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  expect(svg).toMatch(/<image [^>]*--t:600ms/);
});

test('the CLI inlines local images and leaves urls alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ik-image-'));

  writeFileSync(join(dir, 'disk.png'), PNG);

  const resolve = inlineImages(join(dir, 'art.ts'));

  expect(resolve('disk.png')).toBe(`data:image/png;base64,${PNG.toString('base64')}`);
  expect(resolve('https://example.com/a.png')).toBe('https://example.com/a.png');
  expect(() => resolve('notes.txt')).toThrow('unsupported type');
});
