import { clamp, lerp } from '../util.js';

// Lightweight colormaps. Input t in [0,1]. Output [r,g,b] 0-255.

function rgb(r, g, b) {
  return [r | 0, g | 0, b | 0];
}

// Turbo approximation via keypoints (small table for speed).
const TURBO = [
  [0.18995,0.07176,0.23217], [0.25107,0.25237,0.63374], [0.27628,0.42118,0.89123],
  [0.25862,0.57264,0.96495], [0.21029,0.71251,0.93708], [0.14659,0.82336,0.83331],
  [0.15297,0.90790,0.68138], [0.37767,0.95173,0.43569], [0.64362,0.96411,0.25237],
  [0.87930,0.91228,0.15167], [0.98431,0.77252,0.18995], [0.98512,0.53259,0.28141],
  [0.85859,0.28047,0.34577], [0.64362,0.09523,0.30401]
];

const VIRIDIS = [
  [0.267,0.005,0.329],[0.283,0.141,0.458],[0.254,0.265,0.530],[0.207,0.372,0.553],
  [0.164,0.471,0.558],[0.128,0.567,0.551],[0.135,0.659,0.518],[0.267,0.749,0.441],
  [0.478,0.821,0.318],[0.741,0.873,0.150],[0.993,0.906,0.144]
];

const MAGMA = [
  [0.001,0.000,0.014],[0.078,0.046,0.204],[0.217,0.062,0.413],[0.377,0.090,0.508],
  [0.534,0.144,0.505],[0.680,0.230,0.458],[0.808,0.333,0.404],[0.901,0.450,0.360],
  [0.964,0.584,0.402],[0.992,0.733,0.517],[0.987,0.892,0.749]
];

const ICEFIRE = [
  [0.019,0.071,0.232],[0.090,0.262,0.560],[0.200,0.510,0.720],[0.465,0.753,0.760],
  [0.810,0.920,0.830],[0.980,0.980,0.980],[0.990,0.865,0.780],[0.965,0.627,0.525],
  [0.902,0.376,0.306],[0.720,0.160,0.220],[0.420,0.040,0.120]
];

function sampleTable(table, t) {
  t = clamp(t, 0, 1);
  const n = table.length;
  const f = t * (n - 1);
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const u = f - i;
  const a = table[i];
  const b = table[j];
  return rgb(
    Math.round(lerp(a[0], b[0], u) * 255),
    Math.round(lerp(a[1], b[1], u) * 255),
    Math.round(lerp(a[2], b[2], u) * 255)
  );
}

export function sampleColormap(name, t) {
  switch (name) {
    case 'viridis': return sampleTable(VIRIDIS, t);
    case 'magma': return sampleTable(MAGMA, t);
    case 'icefire': return sampleTable(ICEFIRE, t);
    case 'turbo':
    default: return sampleTable(TURBO, t);
  }
}
