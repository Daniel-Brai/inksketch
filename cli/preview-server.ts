import { watch } from 'node:fs';
import { join } from 'node:path';

import type { SceneRenderOptions } from './cli.types.ts';
import { renderFresh } from './runner.ts';
import { findScenes } from './scenes.ts';

const ASSETS = join(import.meta.dir, 'preview');
const THEMES = new Set<SceneRenderOptions['theme']>(['auto', 'light', 'dark', 'inherit']);
const ASSET_NAMES = new Set(['index.html', 'app.js', 'app.css']);
const LOGO = join(import.meta.dir, '..', 'assets', 'logo.svg');
const NO_STORE = { 'cache-control': 'no-store' };
const encoder = new TextEncoder();

function themeOf(value: string | null): SceneRenderOptions['theme'] {
  const match = [...THEMES].find((t) => t === value);

  return match ?? 'auto';
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

async function renderRoute(url: URL, targets: string[]): Promise<Response> {
  const scenes = await findScenes(targets);
  const file = url.searchParams.get('file');

  if (file === null || !scenes.includes(file)) {
    return json(404, { error: 'That scene is not in the watched folders.' });
  }

  const outcome = await renderFresh(file, {
    theme: themeOf(url.searchParams.get('theme')),
    trigger: 'load',
    static: false,
  });

  return json(200, outcome);
}

function assetRoute(pathname: string): Response {
  if (pathname === '/logo.svg') return new Response(Bun.file(LOGO));

  const asset = pathname === '/' ? 'index.html' : pathname.slice(1);

  if (!ASSET_NAMES.has(asset)) return new Response(null, { status: 404 });

  return new Response(Bun.file(join(ASSETS, asset)));
}

export function startPreview(targets: string[], port: number): { url: string; close: () => void } {
  const listeners = new Set<ReadableStreamDefaultController<Uint8Array>>();

  function events(): Response {
    let own: ReadableStreamDefaultController<Uint8Array> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        own = controller;
        controller.enqueue(encoder.encode('retry: 1000\n\n'));
        listeners.add(controller);
      },
      cancel() {
        if (own) listeners.delete(own);
      },
    });

    return new Response(stream, {
      headers: { ...NO_STORE, 'content-type': 'text/event-stream', connection: 'keep-alive' },
    });
  }

  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    idleTimeout: 0,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/events') return events();

      if (url.pathname === '/scenes') return json(200, await findScenes(targets));

      if (url.pathname === '/render') return renderRoute(url, targets);

      return assetRoute(url.pathname);
    },
  });

  const watchers = targets.map((target) =>
    watch(target, { recursive: true }, (_event, name) => {
      if (name === null || !name.endsWith('.ts')) return;

      const message = encoder.encode(`event: change\ndata: ${name}\n\n`);

      for (const listener of listeners) listener.enqueue(message);
    }),
  );

  return {
    url: `http://127.0.0.1:${server.port}`,
    close: () => {
      for (const w of watchers) w.close();

      server.stop(true);
    },
  };
}
