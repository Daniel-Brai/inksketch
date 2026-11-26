import { polylineLength } from './geometry.ts';
import type { GroupNode, SceneNode } from './model.ts';
import type { DrawConfig } from './options.ts';
import type { Timeline } from './render.types.ts';

const DEFAULT_MAX_DRAW_MS = 7000;

interface Scheduler {
  times: Map<number, [number, number]>;
  ends: Map<number, number>;
  order: number[];
  speed: number;
}

function place(state: Scheduler, id: number, slot: [number, number]): void {
  state.times.set(id, slot);
  state.order.push(id);
}

function leafDuration(node: SceneNode, speed: number): number | null {
  switch (node.kind) {
    case 'stroke': {
      if (!node.draw) return null;

      const drawMs = (polylineLength(node.points, node.closed) / speed) * 1000;

      return Math.max(60, Math.min(2600, drawMs));
    }
    case 'fill':
      return node.draw ? 200 : null;
    case 'dots':
      return node.draw ? Math.max(150, Math.min(1400, node.points.length * 3)) : null;
    case 'text':
      return node.draw ? 400 : null;
    case 'image':
      return node.draw ? 600 : null;
    default:
      return null;
  }
}

function stretch(state: Scheduler, from: { mark: number; start: number }, ratio: number): void {
  for (const id of state.order.slice(from.mark)) {
    const slot = state.times.get(id);
    if (slot) state.times.set(id, [from.start + (slot[0] - from.start) * ratio, slot[1] * ratio]);
  }
}

function visitGroup(state: Scheduler, node: GroupNode, cursor: number): number {
  if (node.draw.instant) {
    state.ends.set(node.id, cursor);
    return cursor;
  }

  const start = (node.draw.at ?? cursor) + (node.draw.delay ?? 0);
  const gap = node.draw.gap;
  const mark = state.order.length;
  let end = start;

  for (const child of node.children) {
    const childEnd = visit(state, child, node.draw.mode === 'together' ? start : end, gap);
    end = Math.max(end, childEnd);
  }

  if (node.draw.duration !== undefined && end > start) {
    stretch(state, { mark, start }, node.draw.duration / (end - start));
    end = start + node.draw.duration;
  }

  state.ends.set(node.id, end);

  return node.draw.at === undefined ? end : Math.max(cursor, end);
}

function visit(state: Scheduler, node: SceneNode, cursor: number, gap = 50): number {
  if (node.kind === 'group') return visitGroup(state, node, cursor);

  const duration = leafDuration(node, state.speed);

  if (duration === null) return cursor;

  place(state, node.id, [cursor, duration]);

  if (node.kind === 'fill') return cursor + 30;

  return cursor + duration + gap;
}

export function schedule(root: GroupNode, config: DrawConfig): Timeline {
  const state: Scheduler = {
    times: new Map(),
    ends: new Map(),
    order: [],
    speed: config.speed ?? 900,
  };

  const total = visit(state, root, config.delayMs ?? 250, config.gapMs ?? 50);
  const limit = config.maxDurationMs ?? DEFAULT_MAX_DRAW_MS;

  if (!limit || total <= limit) return { times: state.times, ends: state.ends, total };

  const k = limit / total;

  for (const [id, slot] of state.times) state.times.set(id, [slot[0] * k, slot[1] * k]);

  for (const [id, end] of state.ends) state.ends.set(id, end * k);

  return { times: state.times, ends: state.ends, total: limit };
}
