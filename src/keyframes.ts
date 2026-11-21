export class KeyframeRegistry {
  private readonly names = new Map<string, string>();
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  nameFor(body: string): string {
    const existing = this.names.get(body);

    if (existing) return existing;

    const name = `${this.prefix}-k${this.names.size + 1}`;

    this.names.set(body, name);

    return name;
  }

  toCss(): string {
    let out = '';

    for (const [body, name] of this.names) out += `@keyframes ${name}{${body}}`;

    return out;
  }
}
