import { sketch } from 'inksketch';

const s = sketch({
  width: 900,
  height: 600,
  background: 'paper',
  texture: true,
  draw: true,
  seed: 3,
});

const figurePoses = ['wave', 'think', 'run', 'sit', 'cheer', 'shrug'] as const;

s.rect([40, 40], [140, 90], { fill: 'hatch' });
s.circle([270, 85], 45, { fill: 'stipple' });
s.cylinder([420, 95], { rx: 55, label: 'sqlite', shade: 'hatch' });
s.cube([540, 50], 80, { label: 'box' });
s.stone([760, 100], 55);

for (const [index, pose] of figurePoses.entries()) {
  s.stickFigure([80 + index * 80, 300], { pose });
}

s.document([540, 200], [80, 100], { title: 'Spec' });
s.cloud([720, 240], [150, 80], { label: 'cloud' });
s.lightbulb([840, 230], 26);

s.text([40, 350], 'the ratio between roots and shoots → (ok)?', { size: 22 });
s.arrow([60, 460], [300, 510], { bend: 0.2 });
s.brace([340, 450], [340, 540], { depth: 14 });

s.plant([450, 540], 140);
s.gear([600, 490], 40).spin();
s.waves([660, 470], 200, { rows: 3, color: { light: '#1d4ed8', dark: '#93c5fd' } });
s.server([820, 420], [60, 90], { label: 'api' });
s.path('M20 560 q 40 -40 80 0 t 80 0 a20 20 0 012 2', { color: 'accent' });

export default s;
