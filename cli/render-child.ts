import { loadScene } from './scenes.ts';

const [file, raw] = process.argv.slice(2);

if (file === undefined || raw === undefined) {
  process.stderr.write('usage: render-child <file> <options-json>\n');
  process.exit(2);
}

try {
  const started = performance.now();
  const { sketch, options } = await loadScene(file);
  const svg = sketch.toSVG({ ...options, ...JSON.parse(raw) });

  process.stdout.write(JSON.stringify({ file, svg, ms: Math.round(performance.now() - started) }));
} catch (error) {
  process.stdout.write(
    JSON.stringify({ file, error: error instanceof Error ? error.message : String(error) }),
  );
}
