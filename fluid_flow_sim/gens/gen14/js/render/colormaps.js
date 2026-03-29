import { clamp } from "../math.js";

const MAPS = {
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37]
  ],
  magma: [
    [0, 0, 4],
    [51, 15, 65],
    [137, 34, 106],
    [223, 93, 100],
    [252, 253, 191]
  ],
  plasma: [
    [13, 8, 135],
    [84, 3, 160],
    [182, 54, 121],
    [251, 136, 97],
    [240, 249, 33]
  ],
  inferno: [
    [0, 0, 4],
    [87, 15, 109],
    [187, 55, 84],
    [249, 142, 8],
    [252, 255, 164]
  ],
  turbo: [
    [48, 18, 59],
    [33, 99, 171],
    [40, 187, 235],
    [170, 220, 50],
    [251, 132, 33],
    [180, 4, 38]
  ],
  cividis: [
    [0, 32, 76],
    [32, 76, 117],
    [79, 120, 118],
    [140, 162, 96],
    [253, 233, 69]
  ]
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function sampleColormap(name, t) {
  const colors = MAPS[name] || MAPS.viridis;
  const n = colors.length - 1;
  const u = clamp(t, 0, 1) * n;
  const i0 = Math.floor(u);
  const i1 = Math.min(i0 + 1, n);
  const f = u - i0;

  const c0 = colors[i0];
  const c1 = colors[i1];

  return [
    lerp(c0[0], c1[0], f) | 0,
    lerp(c0[1], c1[1], f) | 0,
    lerp(c0[2], c1[2], f) | 0
  ];
}
