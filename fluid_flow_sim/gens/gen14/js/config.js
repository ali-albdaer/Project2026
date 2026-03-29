export const DEFAULTS = {
  sim: {
    resolution: 256,
    domainWidth: 1,
    domainHeight: 1,
    cfl: 0.45,
    maxDt: 0.008,
    pressureIters: 80,
    sorOmega: 1.88,
    viscosity: 2e-5,
    density: 1.225,
    temperature: 300,
    prandtl: 0.71,
    gravity: 9.81,
    strictIncompressible: true,
    boussinesq: false,
    inviscidCore: false,
    noSlipWalls: true,
    primarySolver: "projection",
    pressureSolver: "sor",
    frictionModel: "blasius"
  },
  flow: {
    uxExpr: "1.0",
    uyExpr: "0.0"
  },
  visual: {
    displayField: "speed",
    colormap: "viridis",
    showProbe: true,
    showVectors: false,
    showDelta: true,
    showDeltaStar: true,
    showTheta: true
  },
  bodySpawn: {
    type: "sphere",
    sizeA: 0.08,
    sizeB: 0.04,
    angleDeg: 0,
    mass: 5
  }
};

export const KEYBINDS = {
  togglePause: "Space",
  togglePanel: "KeyH",
  toggleProbe: "KeyP",
  reset: "KeyR",
  toggleLayers: "KeyB",
  spawnArmed: "KeyN"
};

export const METRIC_KEYS = [
  "drag",
  "lift",
  "cf",
  "tauW",
  "re",
  "pr",
  "st",
  "fr",
  "mach",
  "courant"
];
