import type { StrokeFeel } from './stroke.ts';

export type LetteringMode = 'hand' | 'font';
export type FontRole = 'hand' | 'sans' | 'mono' | 'serif';
export type ColorName = 'ink' | 'paper' | 'muted' | 'accent';

export interface ThemedColor {
  light: string;
  dark: string;
}

export type Color = ColorName | ThemedColor | (string & {});

export interface Palettes {
  light: Palette;
  dark: Palette;
}

export interface Palette {
  ink: string;
  paper: string;
  muted: string;
  accent: string;
}

export interface Preset extends StrokeFeel {
  name: string;
  strokeWidth: number;
  overlapCorners: boolean;
  passes: number;
  passOpacity: number;
  hatchGap: number;
  hatchAngle: number;
  lettering: LetteringMode;
  font: FontRole;
  light: Palette;
  dark: Palette;
}

export const FONT_STACKS: Record<FontRole, string> = {
  hand: "var(--ik-font-hand, 'Caveat', 'Patrick Hand', 'Segoe Print', 'Bradley Hand', 'Comic Neue', cursive)",
  sans: 'var(--ik-font-sans, Geist, ui-sans-serif, system-ui, sans-serif)',
  mono: "var(--ik-font-mono, 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace)",
  serif: "var(--ik-font-serif, 'Crimson Pro', Georgia, 'Times New Roman', serif)",
};

const PAPER: Palette = { ink: '#1c1b19', paper: '#f6f4ef', muted: '#8a8781', accent: '#c2410c' };
const NIGHT: Palette = { ink: '#f2f1ec', paper: '#0b0b0b', muted: '#7b7a76', accent: '#fb923c' };

const MONO_LIGHT: Palette = {
  ink: '#111111',
  paper: '#ffffff',
  muted: '#8a8a8a',
  accent: '#111111',
};

const MONO_DARK: Palette = {
  ink: '#ffffff',
  paper: '#000000',
  muted: '#777777',
  accent: '#ffffff',
};

const HAND: Pick<Preset, 'lettering' | 'font' | 'overlapCorners'> = {
  lettering: 'hand',
  font: 'hand',
  overlapCorners: true,
};

export const presets = {
  ink: {
    ...HAND,
    name: 'ink',
    roughness: 1,
    bowing: 1,
    overshoot: 4,
    strokeWidth: 2,
    passes: 0,
    passOpacity: 0.35,
    hatchGap: 6,
    hatchAngle: -45,
    light: PAPER,
    dark: NIGHT,
  },
  sketch: {
    ...HAND,
    name: 'sketch',
    roughness: 2,
    bowing: 2,
    overshoot: 8,
    strokeWidth: 1.6,
    passes: 1,
    passOpacity: 0.4,
    hatchGap: 7,
    hatchAngle: -50,
    light: PAPER,
    dark: NIGHT,
  },
  pencil: {
    ...HAND,
    name: 'pencil',
    roughness: 1.3,
    bowing: 1.5,
    overshoot: 6,
    strokeWidth: 1.2,
    passes: 1,
    passOpacity: 0.5,
    hatchGap: 4,
    hatchAngle: -40,
    light: { ...PAPER, ink: '#3b3a37' },
    dark: { ...NIGHT, ink: '#d6d4cf' },
  },
  geometric: {
    name: 'geometric',
    lettering: 'font',
    font: 'mono',
    overlapCorners: false,
    roughness: 0,
    bowing: 0,
    overshoot: 0,
    strokeWidth: 2,
    passes: 0,
    passOpacity: 0,
    hatchGap: 8,
    hatchAngle: -45,
    light: MONO_LIGHT,
    dark: MONO_DARK,
  },
  chalk: {
    ...HAND,
    name: 'chalk',
    roughness: 1.2,
    bowing: 1,
    overshoot: 5,
    strokeWidth: 2.4,
    passes: 1,
    passOpacity: 0.3,
    hatchGap: 7,
    hatchAngle: -45,
    light: NIGHT,
    dark: NIGHT,
  },
} satisfies Record<string, Preset>;

export type PresetName = keyof typeof presets;

function findPreset(name: string): Preset | null {
  const entry = Object.entries(presets).find(([key]) => key === name);
  return entry ? entry[1] : null;
}

export function resolvePreset(style: PresetName | Partial<Preset> | undefined): Preset {
  if (!style) return presets.ink;

  if (typeof style === 'string') return presets[style];

  const base = findPreset(style.name ?? 'ink') ?? presets.ink;

  return { ...base, ...style };
}

export function fontStack(role: FontRole | (string & {})): string {
  const entry = Object.entries(FONT_STACKS).find(([key]) => key === role);
  return entry ? entry[1] : role;
}

export function isColorName(value: string): value is ColorName {
  return value === 'ink' || value === 'paper' || value === 'muted' || value === 'accent';
}

export function resolvePalettes(
  preset: Preset,
  overrides: { light?: Partial<Palette>; dark?: Partial<Palette> } | undefined,
): Palettes {
  return {
    light: { ...preset.light, ...overrides?.light },
    dark: { ...preset.dark, ...overrides?.dark },
  };
}
