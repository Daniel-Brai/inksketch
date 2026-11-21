import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { RenderOutcome, SceneRenderOptions } from './cli.types.ts';

const CHILD = fileURLToPath(new URL('./render-child.ts', import.meta.url));
const TIMEOUT_MS = 30000;

// Bun would otherwise download an unrelated npm package when a sketch imports "inksketch" that it cannot resolve.
const RUNTIME_FLAGS = ['--no-install'];

function parseOutcome(text: string): RenderOutcome | null {
  try {
    const value: unknown = JSON.parse(text);

    if (
      typeof value !== 'object' ||
      value === null ||
      !('file' in value) ||
      typeof value.file !== 'string'
    ) {
      return null;
    }

    if ('error' in value && typeof value.error === 'string') {
      return { file: value.file, error: value.error };
    }

    if (
      'svg' in value &&
      typeof value.svg === 'string' &&
      'ms' in value &&
      typeof value.ms === 'number'
    ) {
      return { file: value.file, svg: value.svg, ms: value.ms };
    }

    return null;
  } catch {
    return null;
  }
}

export function renderFresh(file: string, options: SceneRenderOptions): Promise<RenderOutcome> {
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      [...RUNTIME_FLAGS, CHILD, file, JSON.stringify(options)],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));

    child.on('close', (code) => {
      clearTimeout(timer);

      const parsed = parseOutcome(Buffer.concat(out).toString('utf8'));

      if (parsed) {
        done(parsed);
        return;
      }

      const detail = Buffer.concat(err).toString('utf8').trim();

      done({ file, error: detail.length ? detail : `renderer exited with code ${code}` });
    });
  });
}

export function isFailure(outcome: RenderOutcome): outcome is { file: string; error: string } {
  return 'error' in outcome;
}
