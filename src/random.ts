export interface Rng {
  readonly seed: number;
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  sign(): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  gauss(): number;
  fork(salt: number | string): Rng;
}

export function hashSeed(value: number | string): number {
  const text = String(value);
  let h = 2166136261 >>> 0;

  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

function pickItem<T>(items: readonly T[], roll: number): T {
  const item = items[Math.floor(roll * items.length)];

  if (item === undefined) throw new Error('inksketch: cannot pick from an empty list');

  return item;
}

export function createRng(seed: number | string = 1): Rng {
  const base = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  let state = base || 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed: base,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    sign: () => (next() < 0.5 ? -1 : 1),
    chance: (p) => next() < p,
    pick: (items) => pickItem(items, next()),
    gauss: () => {
      const u = Math.max(next(), 1e-9);
      const v = next();

      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork: (salt) => createRng(hashSeed(`${base}:${salt}`)),
  };
}

export function lineNoise(rng: Rng, scale = 1): (t: number) => number {
  const lattice: number[] = [];

  const at = (i: number): number => {
    const k = i < 0 ? -i * 2 + 1 : i * 2;

    while (lattice.length <= k) lattice.push(rng.range(-1, 1));

    return lattice[k] ?? 0;
  };

  return (t: number) => {
    const x = t / scale;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);

    return at(i) * (1 - s) + at(i + 1) * s;
  };
}

function latticeValue(seed: number, ix: number, iy: number): number {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);

  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;

  return ((h >>> 0) / 4294967296) * 2 - 1;
}

export function planeNoise(seed: number, scale = 1): (x: number, y: number) => number {
  return (x, y) => {
    const fx = x / scale;
    const fy = y / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const top = latticeValue(seed, ix, iy) * (1 - sx) + latticeValue(seed, ix + 1, iy) * sx;

    const bottom =
      latticeValue(seed, ix, iy + 1) * (1 - sx) + latticeValue(seed, ix + 1, iy + 1) * sx;

    return top * (1 - sy) + bottom * sy;
  };
}
