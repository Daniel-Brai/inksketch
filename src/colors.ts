import { isColorName, type Color, type ColorName } from './style.ts';

export interface ThemedVariable {
  name: string;
  light: string;
  dark: string;
}

export class ColorRegistry {
  private readonly themed = new Map<string, ThemedVariable>();

  resolve(color: Color | undefined, fallback: ColorName = 'ink'): string {
    const value = color ?? fallback;

    if (typeof value !== 'string') return `var(${this.variableFor(value.light, value.dark)})`;

    if (isColorName(value)) return `var(--ik-${value})`;

    return value;
  }

  variables(): ThemedVariable[] {
    return [...this.themed.values()];
  }

  private variableFor(light: string, dark: string): string {
    const key = `${light}|${dark}`;
    const existing = this.themed.get(key);

    if (existing) return existing.name;

    const name = `--ik-t${this.themed.size + 1}`;

    this.themed.set(key, { name, light, dark });

    return name;
  }
}
