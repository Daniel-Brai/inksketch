import { sketch, tones, type Point } from 'inksketch';

const s = sketch({ width: 1200, height: 800, background: 'paper', seed: 'detail' });

const field: Point[] = [
  [20, 140],
  [380, 140],
  [380, 380],
  [20, 380],
];

const gradient = tones.contrast(tones.linear([0, 150], [0, 380]), 1.2);

s.toneStipple(field, gradient, { density: 14, size: 1.3 });

s.grass([20, 382], [380, 382], { height: 14, density: 3 });
s.text([20, 410], 'denmark: a gradient of dots', { size: 15 });

s.pebbles({ x: 420, y: 140, w: 360, h: 240 });
s.text([420, 410], 'stones: packed and stippled', { size: 15 });

s.cracks({ x: 820, y: 140, w: 360, h: 240 });
s.text([820, 410], 'earth: split plates', { size: 15 });

const slab: Point[] = [
  [60, 470],
  [180, 470],
  [180, 600],
  [300, 600],
  [300, 680],
  [60, 680],
];

s.polygon(slab, { width: 1.6 });

const lichen = tones.max(
  tones.noise({ seed: 'lichen', scale: 40, contrast: 2.4 }),
  tones.side({ x: 60, y: 470, w: 240, h: 210 }, 'right'),
);

s.toneStipple(slab, lichen, { density: 10, size: 1.2 });

s.text([60, 720], 'stone with lichen noise', { size: 15 });

const ball: Point[] = Array.from({ length: 64 }, (_, i): Point => {
  const angle = (i / 64) * Math.PI * 2;

  return [480 + Math.cos(angle) * 90, 590 + Math.sin(angle) * 90];
});

const shading = tones.contrast(tones.radial([440, 550], 190), -1.3);

s.curve(ball, { closed: true });
s.toneHatch(ball, shading, { layers: 4, gap: 4 });
s.text([400, 720], 'chiaroscuro by hatching', { size: 15 });

s.tree([780, 700], 230, { depth: 8, leaves: 'blossoms', spreadDeg: 24 });
s.grass([660, 702], [900, 702], { height: 12, density: 2.5, leanDeg: 20 });
s.text([700, 740], 'cherry tree', { size: 15 });

for (const [index, radius] of [34, 28, 24, 20].entries()) {
  const column = index % 2;
  const row = Math.floor(index / 2);

  s.logEnd([960 + column * 70, 520 + row * 70], radius);
}

s.text([940, 720], 'log ends with rings', { size: 15 });

export default s;
