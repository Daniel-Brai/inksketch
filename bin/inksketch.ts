#!/usr/bin/env bun
import { parseArgs } from 'node:util';

import type { SceneRenderOptions } from '#cli/cli.types.ts';
import { renderCommand, watchCommand } from '#cli/commands.ts';
import { startPreview } from '#cli/preview-server.ts';

const HELP = `inksketch: hand-drawn illustrations and animations

  inksketch                         open the studio
  inksketch render <file|dir...>    render sketches to SVG
  inksketch watch <file|dir...>     render again on every change
  inksketch preview [dir]           live gallery in the browser

options
  --out <dir>        where files go (default: next to each sketch)
  --theme <t>        auto | light | dark | inherit (default: auto)
  --trigger <t>      load | visible | hover | click (default: load)
  --static           no animation, the finished drawing
  --png              also write a PNG (needs sharp in the project)
  --scale <n>        PNG pixel scale (default: 1)
  --port <n>         preview port (default: 4747)`;

const THEMES: ReadonlyArray<SceneRenderOptions['theme']> = ['auto', 'light', 'dark', 'inherit'];

const TRIGGERS: ReadonlyArray<SceneRenderOptions['trigger']> = [
  'load',
  'visible',
  'hover',
  'click',
];

function pick<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  if (value === undefined) return fallback;

  const match = allowed.find((a) => a === value);

  if (!match) throw new Error(`"${value}" is not one of ${allowed.join(', ')}`);

  return match;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    theme: { type: 'string' },
    trigger: { type: 'string' },
    static: { type: 'boolean', default: false },
    png: { type: 'boolean', default: false },
    scale: { type: 'string', default: '1' },
    port: { type: 'string', default: '4747' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const [command, ...targets] = positionals;

const options: SceneRenderOptions = {
  theme: pick(THEMES, values.theme, 'auto'),
  trigger: pick(TRIGGERS, values.trigger, 'load'),
  static: values.static,
};

const render = {
  targets,
  outDir: values.out ?? null,
  png: values.png,
  scale: Number(values.scale),
  options,
};

if (values.help) {
  console.log(HELP);
} else if (command === 'render' && targets.length) {
  process.exitCode = (await renderCommand(render)) ? 0 : 1;
} else if (command === 'watch' && targets.length) {
  await watchCommand(render);
} else if (command === 'preview') {
  const preview = startPreview(targets.length ? targets : ['.'], Number(values.port));
  console.log(`preview at ${preview.url}`);
} else if (command === undefined) {
  const { startStudio } = await import('#cli/studio.ts');

  await startStudio({ root: process.cwd(), options });
} else {
  console.log(HELP);
  process.exitCode = 1;
}
