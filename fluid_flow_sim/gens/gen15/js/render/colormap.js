// ────────────────────────────────────────────
// colormap.js — Perceptually uniform colormaps
// ────────────────────────────────────────────
// Each colormap is defined by control points and interpolated to 256 RGBA entries.
// Data derived from matplotlib's reference implementations.

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
    return [
        lerp(c1[0], c2[0], t),
        lerp(c1[1], c2[1], t),
        lerp(c1[2], c2[2], t),
    ];
}

function buildLUT(stops) {
    const lut = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let segIdx = 0;
        for (let s = 0; s < stops.length - 1; s++) {
            if (t >= stops[s][0] && t <= stops[s + 1][0]) {
                segIdx = s;
                break;
            }
        }
        const s0 = stops[segIdx];
        const s1 = stops[segIdx + 1];
        const lt = (t - s0[0]) / (s1[0] - s0[0]);
        const c = lerpColor(s0[1], s1[1], lt);
        lut[i * 4 + 0] = Math.round(c[0] * 255);
        lut[i * 4 + 1] = Math.round(c[1] * 255);
        lut[i * 4 + 2] = Math.round(c[2] * 255);
        lut[i * 4 + 3] = 255;
    }
    return lut;
}

// Viridis: dark indigo → teal → yellow-green
const VIRIDIS_STOPS = [
    [0.00, [0.267, 0.004, 0.329]],
    [0.13, [0.282, 0.140, 0.458]],
    [0.25, [0.253, 0.265, 0.530]],
    [0.38, [0.191, 0.407, 0.556]],
    [0.50, [0.128, 0.567, 0.551]],
    [0.63, [0.153, 0.688, 0.498]],
    [0.75, [0.360, 0.789, 0.387]],
    [0.88, [0.667, 0.863, 0.189]],
    [1.00, [0.993, 0.906, 0.144]],
];

// Magma: black → dark purple → hot pink → light yellow
const MAGMA_STOPS = [
    [0.00, [0.001, 0.000, 0.014]],
    [0.13, [0.082, 0.047, 0.220]],
    [0.25, [0.233, 0.059, 0.437]],
    [0.38, [0.417, 0.056, 0.495]],
    [0.50, [0.616, 0.090, 0.437]],
    [0.63, [0.809, 0.181, 0.332]],
    [0.75, [0.945, 0.378, 0.246]],
    [0.88, [0.995, 0.647, 0.296]],
    [1.00, [0.987, 0.991, 0.750]],
];

// Inferno: black → indigo → red-orange → yellow
const INFERNO_STOPS = [
    [0.00, [0.001, 0.000, 0.014]],
    [0.13, [0.106, 0.032, 0.318]],
    [0.25, [0.289, 0.028, 0.498]],
    [0.38, [0.478, 0.075, 0.435]],
    [0.50, [0.647, 0.139, 0.319]],
    [0.63, [0.808, 0.235, 0.170]],
    [0.75, [0.929, 0.411, 0.055]],
    [0.88, [0.985, 0.652, 0.039]],
    [1.00, [0.988, 0.998, 0.645]],
];

// Plasma: dark purple → magenta → orange → yellow
const PLASMA_STOPS = [
    [0.00, [0.050, 0.030, 0.528]],
    [0.13, [0.225, 0.036, 0.620]],
    [0.25, [0.381, 0.002, 0.652]],
    [0.38, [0.538, 0.024, 0.618]],
    [0.50, [0.686, 0.097, 0.523]],
    [0.63, [0.816, 0.200, 0.392]],
    [0.75, [0.916, 0.339, 0.241]],
    [0.88, [0.976, 0.534, 0.098]],
    [1.00, [0.940, 0.975, 0.131]],
];

// Jet: blue → cyan → green → yellow → red
const JET_STOPS = [
    [0.00, [0.000, 0.000, 0.500]],
    [0.11, [0.000, 0.000, 1.000]],
    [0.25, [0.000, 0.500, 1.000]],
    [0.36, [0.000, 1.000, 1.000]],
    [0.50, [0.500, 1.000, 0.500]],
    [0.64, [1.000, 1.000, 0.000]],
    [0.75, [1.000, 0.500, 0.000]],
    [0.89, [1.000, 0.000, 0.000]],
    [1.00, [0.500, 0.000, 0.000]],
];

// Coolwarm: blue → white → red (diverging)
const COOLWARM_STOPS = [
    [0.00, [0.230, 0.299, 0.754]],
    [0.25, [0.520, 0.600, 0.910]],
    [0.50, [0.865, 0.865, 0.865]],
    [0.75, [0.910, 0.520, 0.430]],
    [1.00, [0.706, 0.016, 0.150]],
];

// Grayscale
const GRAYSCALE_STOPS = [
    [0.00, [0.000, 0.000, 0.000]],
    [1.00, [1.000, 1.000, 1.000]],
];

// Pre-build all LUTs
const _cache = {};

const COLORMAP_DATA = {
    viridis: VIRIDIS_STOPS,
    magma: MAGMA_STOPS,
    inferno: INFERNO_STOPS,
    plasma: PLASMA_STOPS,
    jet: JET_STOPS,
    coolwarm: COOLWARM_STOPS,
    grayscale: GRAYSCALE_STOPS,
};

/**
 * Get a 256×1 RGBA Uint8Array for the named colormap.
 * @param {string} name
 * @returns {Uint8Array} 256*4 bytes
 */
export function getColormapLUT(name) {
    if (!_cache[name]) {
        const stops = COLORMAP_DATA[name];
        if (!stops) throw new Error(`Unknown colormap: ${name}`);
        _cache[name] = buildLUT(stops);
    }
    return _cache[name];
}

/**
 * List available colormap names.
 * @returns {string[]}
 */
export function getColormapNames() {
    return Object.keys(COLORMAP_DATA);
}

/**
 * Sample a colormap at value t ∈ [0,1], returns [r,g,b] in 0–255.
 */
export function sampleColormap(name, t) {
    const lut = getColormapLUT(name);
    const i = Math.max(0, Math.min(255, Math.round(t * 255)));
    return [lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2]];
}
