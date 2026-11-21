import { lerpPose } from '#/figures/poses.ts';
import { ease } from '#/sampling.ts';

import type { Keyframe, PropValue, Track } from './document.types.ts';
import { resolvePose } from './props.ts';

const DEFAULT_EASING = 'ease-in-out';

function isPair(v: PropValue): v is readonly [number, number] {
  return Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number';
}

export function blend(a: PropValue, b: PropValue, u: number): PropValue {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;

  if (isPair(a) && isPair(b)) return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

  const poseA = resolvePose(a);
  const poseB = resolvePose(b);

  if (poseA && poseB) return lerpPose(poseA, poseB, u);

  return u < 1 ? a : b;
}

export function sampleTrack<T extends PropValue>(track: Track<T>, time: number): PropValue {
  const first = track[0];
  const last = track.at(-1);

  if (!first || !last) return null;

  if (time <= first.atMs) return first.value;

  if (time >= last.atMs) return last.value;

  const next = track.findIndex((k) => k.atMs > time);
  const a: Keyframe<T> = track[next - 1] ?? first;
  const b: Keyframe<T> = track[next] ?? last;
  const u = ease(a.easing ?? DEFAULT_EASING, (time - a.atMs) / (b.atMs - a.atMs || 1));

  return blend(a.value, b.value, u);
}

export function trackSpan(
  tracks: Array<Track<PropValue>>,
): { startMs: number; endMs: number } | null {
  const times = tracks.flatMap((t) => t.map((k) => k.atMs));

  if (times.length < 2) return null;

  return { startMs: Math.min(...times), endMs: Math.max(...times) };
}

export function sorted<T>(track: Track<T>): Track<T> {
  return track.toSorted((a, b) => a.atMs - b.atMs);
}

export { resolvePose } from './props.ts';
