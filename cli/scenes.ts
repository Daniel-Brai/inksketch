import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { RenderOptions } from '#/render.types.ts';
import type { Sketch } from '#/sketch.ts';

const SKETCH_SUFFIX = '.sketch.ts';

function isSketch(value: unknown): value is Sketch {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toSVG' in value &&
    typeof value.toSVG === 'function'
  );
}

function isRenderOptions(value: unknown): value is RenderOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const ts = entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'))
    .map((e) => join(dir, e.name));

  const marked = ts.filter((f) => f.endsWith(SKETCH_SUFFIX));

  return (marked.length ? marked : ts).sort();
}

export async function findScenes(targets: string[]): Promise<string[]> {
  const found: string[] = [];

  for (const target of targets) {
    const path = resolve(target);
    const info = await stat(path);

    found.push(...(info.isDirectory() ? await filesIn(path) : [path]));
  }

  return found;
}

export function sceneName(file: string): string {
  const name = basename(file);

  if (name.endsWith(SKETCH_SUFFIX)) return name.slice(0, -SKETCH_SUFFIX.length);

  return name.slice(0, -extname(name).length);
}

export function outputPath(file: string, outDir: string | null, ext: 'svg' | 'png'): string {
  return join(outDir ?? dirname(file), `${sceneName(file)}.${ext}`);
}

export async function loadScene(file: string): Promise<{ sketch: Sketch; options: RenderOptions }> {
  const mod: Record<string, unknown> = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const exported = mod.default;
  const value = typeof exported === 'function' ? await exported() : exported;

  if (!isSketch(value)) {
    throw new Error(`${basename(file)} must default-export a sketch or a function returning one`);
  }

  return { sketch: value, options: isRenderOptions(mod.options) ? mod.options : {} };
}
