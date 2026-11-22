import { poses, type Pose } from '#/figures/poses.ts';
import type { Point } from '#/geometry.ts';
import type { Color } from '#/style.ts';

import type { PropValue } from './document.types.ts';

export function resolvePose(value: PropValue | undefined): Pose | null {
  if (typeof value === 'object' && value !== null && 'armBack' in value) return value;

  if (typeof value !== 'string') return null;

  return Object.entries(poses).find(([name]) => name === value)?.[1] ?? null;
}

export class Props {
  private readonly values: Record<string, PropValue>;

  constructor(values: Record<string, PropValue>) {
    this.values = values;
  }

  number(key: string, fallback: number): number {
    const v = this.values[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }

  text(key: string, fallback: string): string {
    const v = this.values[key];
    return typeof v === 'string' ? v : fallback;
  }

  point(key: string, fallback: Point): Point {
    const v = this.values[key];

    if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number') {
      return [v[0], v[1]];
    }

    return fallback;
  }

  color(key: string): Color | undefined {
    const v = this.values[key];

    if (typeof v === 'string') return v;

    if (typeof v === 'object' && v !== null && 'light' in v && 'dark' in v) return v;

    return undefined;
  }

  choice<T extends string>(key: string, options: readonly T[], fallback: T): T {
    const v = this.values[key];
    return options.find((o) => o === v) ?? fallback;
  }

  pose(key: string): Pose {
    return resolvePose(this.values[key]) ?? poses.stand;
  }
}
