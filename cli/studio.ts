import { relative } from 'node:path';
import {
  BoxRenderable,
  createCliRenderer,
  SelectRenderable,
  TextRenderable,
  type SelectOption,
} from '@opentui/core';

import type { SceneRenderOptions } from './cli.types.ts';
import { renderCommand } from './commands.ts';
import { startPreview } from './preview-server.ts';
import { findScenes, sceneName } from './scenes.ts';

const THEMES: ReadonlyArray<SceneRenderOptions['theme']> = ['auto', 'light', 'dark', 'inherit'];
const KEYS = 'enter render · a all · t theme · s static · p preview · q quit';
const INK = '#f2f1ec';
const ACCENT = '#d85a30';
const MUTED = '#8a8781';

const COMMANDS = [
  'inksketch render <file|dir>   render to SVG',
  'inksketch watch <file|dir>    render on every change',
  'inksketch preview [dir]       live gallery in the browser',
  'inksketch --help              every option',
].join('\n');

interface StudioState {
  scenes: string[];
  options: SceneRenderOptions;
  preview: { url: string; close: () => void } | null;
  log: string[];
}

function nextTheme(theme: SceneRenderOptions['theme']): SceneRenderOptions['theme'] {
  const index = THEMES.indexOf(theme);
  return THEMES[(index + 1) % THEMES.length] ?? 'auto';
}

export async function startStudio(o: { root: string; options: SceneRenderOptions }): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });

  const state: StudioState = {
    scenes: await findScenes([o.root]).catch(() => []),
    options: o.options,
    preview: null,
    log: [],
  };

  const frame = new BoxRenderable(renderer, {
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  });

  const header = new BoxRenderable(renderer, { flexDirection: 'row', gap: 1, paddingLeft: 1 });
  const brand = new TextRenderable(renderer, { content: '▣ inksketch', fg: ACCENT });
  const where = new TextRenderable(renderer, { content: o.root, fg: MUTED });
  const body = new BoxRenderable(renderer, { flexDirection: 'row', flexGrow: 1 });

  const listBox = new BoxRenderable(renderer, {
    border: true,
    title: 'sketches',
    width: '40%',
    height: '100%',
  });

  const list = new SelectRenderable(renderer, {
    width: '100%',
    height: '100%',
    showDescription: true,
  });

  const side = new BoxRenderable(renderer, { flexDirection: 'column', flexGrow: 1 });
  const detailsBox = new BoxRenderable(renderer, {
    border: true,
    title: 'settings',
    height: 6,
    paddingLeft: 1,
  });
  const details = new TextRenderable(renderer, { content: '', fg: INK });
  const helpBox = new BoxRenderable(renderer, {
    border: true,
    title: 'commands',
    height: 6,
    paddingLeft: 1,
  });
  const help = new TextRenderable(renderer, { content: COMMANDS, fg: MUTED });
  const logBox = new BoxRenderable(renderer, {
    border: true,
    title: 'log',
    flexGrow: 1,
    paddingLeft: 1,
  });

  const logText = new TextRenderable(renderer, {
    content: 'Pick a sketch and press enter to render it.',
  });

  const footer = new TextRenderable(renderer, { content: KEYS, fg: MUTED, paddingLeft: 1 });

  header.add(brand);
  header.add(where);
  listBox.add(list);
  detailsBox.add(details);
  helpBox.add(help);
  logBox.add(logText);
  side.add(detailsBox);
  side.add(helpBox);
  side.add(logBox);
  body.add(listBox);
  body.add(side);
  frame.add(header);
  frame.add(body);
  frame.add(footer);
  renderer.root.add(frame);

  const options = (): SelectOption[] =>
    state.scenes.map((file) => ({
      name: sceneName(file),
      description: relative(o.root, file),
      value: file,
    }));

  const showSettings = (): void => {
    const preview = state.preview ? state.preview.url : 'off';

    details.content = [
      `theme    ${state.options.theme}`,
      `static   ${state.options.static ? 'yes' : 'no'}`,
      `preview  ${preview}`,
      `sketches ${state.scenes.length}`,
    ].join('\n');
  };

  const log = (line: string): void => {
    state.log = [...state.log.slice(-40), line];
    logText.content = state.log.join('\n');
  };

  const capture = async (targets: string[]): Promise<void> => {
    const original = console.log;

    console.log = (...parts: unknown[]) => log(parts.map(String).join(' '));

    try {
      await renderCommand({ targets, outDir: null, png: false, scale: 1, options: state.options });
    } finally {
      console.log = original;
    }
  };

  const togglePreview = (): void => {
    if (state.preview) {
      state.preview.close();
      state.preview = null;
      log('preview stopped');

      return;
    }

    state.preview = startPreview([o.root], 4747);
    log(`preview at ${state.preview.url}`);
  };

  list.options = options();

  list.on('itemSelected', (_index: number, option: SelectOption | null) => {
    if (typeof option?.value === 'string') void capture([option.value]);
  });

  list.focus();
  showSettings();

  renderer.keyInput.on('keypress', (key) => {
    if (key.name === 'q') {
      state.preview?.close();
      renderer.destroy();

      return;
    }

    if (key.name === 'a') void capture(state.scenes);

    if (key.name === 't') {
      state.options = { ...state.options, theme: nextTheme(state.options.theme) };
    }

    if (key.name === 's') state.options = { ...state.options, static: !state.options.static };

    if (key.name === 'p') togglePreview();

    showSettings();
  });
}
