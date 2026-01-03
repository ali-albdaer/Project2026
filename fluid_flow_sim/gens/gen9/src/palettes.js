import { clamp, lerp } from './util.js';

function ramp(stops, t) {
  t = clamp(t, 0, 1);
  const n = stops.length;
  const x = t * (n - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[Math.max(0, Math.min(n - 1, i))];
  const b = stops[Math.max(0, Math.min(n - 1, i + 1))];
  return [
    Math.round(lerp(a[0], b[0], f)),
    Math.round(lerp(a[1], b[1], f)),
    Math.round(lerp(a[2], b[2], f)),
  ];
}

// Compact, hand-picked stops (no external assets). 
const viridis = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

const plasma = [
  [13, 8, 135],
  [126, 3, 168],
  [203, 71, 119],
  [248, 149, 64],
  [240, 249, 33],
];

const magma = [
  [0, 0, 4],
  [78, 18, 123],
  [182, 54, 121],
  [251, 140, 60],
  [252, 253, 191],
];

// Turbo-ish approximation (few stops).
const turbo = [
  [48, 18, 59],
  [0, 79, 255],
  [0, 229, 171],
  [255, 231, 0],
  [255, 44, 0],
];

const gray = [
  [0, 0, 0],
  [255, 255, 255],
];

export const Palettes = {
  get(name) {
    const key = String(name || 'viridis').toLowerCase();
    const stops =
      key === 'plasma' ? plasma :
      key === 'magma' ? magma :
      key === 'turbo' ? turbo :
      key === 'gray' ? gray :
      viridis;

    return {
      sample(t) {
        const [r, g, b] = ramp(stops, t);
        return { r, g, b };
      },
    };
  },
};
