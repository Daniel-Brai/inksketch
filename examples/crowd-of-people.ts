import { sketch } from 'inksketch';

const s = sketch({ width: 820, height: 320, background: 'paper', seed: 'crowd' });

s.walker([120, 280], { look: 'ghost', height: 120, distance: 560, durationMs: 9000 });
s.walker([260, 290], { look: 'outline', height: 125, distance: 420, durationMs: 7000 });
s.person([410, 285], { look: 'solid', height: 140, pose: 'tpose' });

s.walker([560, 280], {
  look: 'outline',
  height: 118,
  distance: -380,
  durationMs: 8000,
  facing: -1,
});

s.person([660, 286], { look: 'outline', height: 120, pose: 'think', facing: -1, fill: 'wash' });
s.label([410, 30], 'the one who stops', { size: 18 });

export default s;
