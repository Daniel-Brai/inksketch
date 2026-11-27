import { watch } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { RenderOutcome, SceneRenderOptions } from './cli.types.ts';
import { writePng } from './png.ts';
import { isFailure, renderFresh } from './runner.ts';
import { findScenes, outputPath, sceneRoot } from './scenes.ts';

interface RenderCommand {
  targets: string[];
  outDir: string | null;
  png: boolean;
  scale: number;
  options: SceneRenderOptions;
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

async function save(outcome: RenderOutcome, command: RenderCommand): Promise<string> {
  if (isFailure(outcome)) return `✗ ${outcome.file}\n  ${outcome.error}`;

  const root = sceneRoot(outcome.file, command.targets);
  const svgPath = outputPath(outcome.file, command.outDir, 'svg', root);

  await mkdir(dirname(svgPath), { recursive: true });
  await writeFile(svgPath, outcome.svg);

  if (command.png) {
    await writePng(outcome.svg, {
      file: outputPath(outcome.file, command.outDir, 'png', root),
      scale: command.scale,
    });
  }

  return `✓ ${svgPath}  ${kb(outcome.svg.length)}  ${outcome.ms} ms`;
}

export async function renderCommand(command: RenderCommand): Promise<boolean> {
  const scenes = await findScenes(command.targets);
  const outcomes = await Promise.all(scenes.map((file) => renderFresh(file, command.options)));

  for (const outcome of outcomes) console.log(await save(outcome, command));

  return outcomes.every((o) => !isFailure(o));
}

export async function watchCommand(command: RenderCommand): Promise<void> {
  await renderCommand(command);
  console.log('watching for changes…');

  for (const target of command.targets) {
    watch(target, { recursive: true }, async (_event, name) => {
      if (name === null || !name.endsWith('.ts')) return;

      await renderCommand(command);
    });
  }
}
