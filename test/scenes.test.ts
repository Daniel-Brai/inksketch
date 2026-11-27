import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { findScenes, outputPath, sceneRoot } from '#cli/scenes.ts';

let root: string;

const touch = async (path: string): Promise<void> => {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), 'export default null;\n');
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'inksketch-scenes-'));

  await touch('top.sketch.ts');
  await touch('banners/one.sketch.ts');
  await touch('banners/scene.ts');
  await touch('logos/mark.ts');
  await touch('logos/deep/two.sketch.ts');
  await touch('plain/three.ts');
  await touch('.hidden/four.sketch.ts');
  await touch('node_modules/pkg/five.sketch.ts');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('findScenes', () => {
  test('finds sketches in nested folders and keeps the suffix rule per folder', async () => {
    const found = (await findScenes([root])).map((f) => relative(root, f));

    expect(found).toEqual([
      'top.sketch.ts',
      'banners/one.sketch.ts',
      'logos/mark.ts',
      'logos/deep/two.sketch.ts',
      'plain/three.ts',
    ]);
  });

  test('skips dot folders and node_modules', async () => {
    const found = await findScenes([root]);

    expect(found.some((f) => f.includes('.hidden') || f.includes('node_modules'))).toBe(false);
  });
});

describe('outputPath', () => {
  test('mirrors the nested folder under the out dir so names never collide', () => {
    const file = join(root, 'logos/deep/two.sketch.ts');

    expect(outputPath(file, '/out', 'svg', sceneRoot(file, [root]))).toBe(
      '/out/logos/deep/two.svg',
    );
  });

  test('writes next to the sketch when there is no out dir', () => {
    const file = join(root, 'banners/one.sketch.ts');

    expect(outputPath(file, null, 'svg', root)).toBe(join(root, 'banners/one.svg'));
  });
});
