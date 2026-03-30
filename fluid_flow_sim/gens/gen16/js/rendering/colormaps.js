// colormaps.js — Scientific colormap LUTs and GPU texture creation
// Each colormap is 256 RGBA entries. Data sampled from matplotlib reference implementations.

function lerp3(a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

function buildLUT(stops) {
    // stops: [[pos, r, g, b], ...]  pos in [0,1], rgb in [0,255]
    const data = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let si = 0;
        while (si < stops.length - 2 && stops[si + 1][0] < t) si++;
        const s0 = stops[si], s1 = stops[si + 1];
        const lt = (t - s0[0]) / (s1[0] - s0[0] + 1e-10);
        const c = lerp3([s0[1], s0[2], s0[3]], [s1[1], s1[2], s1[3]], Math.max(0, Math.min(1, lt)));
        data[i * 4]     = Math.round(c[0]);
        data[i * 4 + 1] = Math.round(c[1]);
        data[i * 4 + 2] = Math.round(c[2]);
        data[i * 4 + 3] = 255;
    }
    return data;
}

export const COLORMAPS = {
    viridis: buildLUT([
        [0.0,  68,  1, 84], [0.1,  72, 36,117], [0.2,  65, 68,135],
        [0.3,  53, 95,141], [0.4,  42,120,142], [0.5,  33,145,140],
        [0.6,  34,168,132], [0.7,  68,191,112], [0.8, 122,209, 81],
        [0.9, 189,223, 38], [1.0, 253,231, 37]
    ]),
    magma: buildLUT([
        [0.0,   0,  0,  4], [0.1,  18,  9, 54], [0.2,  51, 16,104],
        [0.3,  89, 17,123], [0.4, 128, 24,117], [0.5, 167, 42, 99],
        [0.6, 204, 71, 75], [0.7, 232,112, 56], [0.8, 249,163, 52],
        [0.9, 254,215,110], [1.0, 252,253,191]
    ]),
    plasma: buildLUT([
        [0.0,  13,  8,135], [0.1,  75,  3,161], [0.2, 125,  3,168],
        [0.3, 168, 18,150], [0.4, 203, 44,122], [0.5, 229, 80, 91],
        [0.6, 248,118, 65], [0.7, 253,159, 41], [0.8, 246,201, 28],
        [0.9, 224,239, 31], [1.0, 240,249, 33]
    ]),
    inferno: buildLUT([
        [0.0,   0,  0,  4], [0.1,  22,  9, 52], [0.2,  58, 12,101],
        [0.3,  96, 19,110], [0.4, 135, 33, 98], [0.5, 174, 52, 72],
        [0.6, 207, 84, 42], [0.7, 231,126, 16], [0.8, 242,174, 11],
        [0.9, 237,224, 75], [1.0, 252,255,164]
    ]),
    jet: buildLUT([
        [0.0,   0,  0,128], [0.1,   0,  0,255], [0.2,   0, 85,255],
        [0.35,  0,198,255], [0.5,  25,255,230], [0.65,170,255, 85],
        [0.8, 255,198,  0], [0.9, 255, 85,  0], [1.0, 128,  0,  0]
    ]),
    coolwarm: buildLUT([
        [0.0,  59, 76,192], [0.15, 98,130,234], [0.3, 141,176,254],
        [0.45,184,208,249], [0.5, 221,221,221], [0.55,245,196,173],
        [0.7, 244,150,111], [0.85,222, 96, 62], [1.0, 180,  4, 38]
    ]),
    turbo: buildLUT([
        [0.0,  48, 18, 59], [0.07, 69, 55,175], [0.13, 66,106,228],
        [0.2,  33,155,241], [0.27,  9,195,217], [0.33, 18,225,170],
        [0.4,  65,243,119], [0.47,125,250, 78], [0.53,183,246, 46],
        [0.6, 228,232, 32], [0.67,255,209, 37], [0.73,255,174, 30],
        [0.8, 250,131, 20], [0.87,232, 87, 12], [0.93,203, 47,  7],
        [1.0, 122,  4,  3]
    ]),
    grayscale: buildLUT([
        [0.0, 0, 0, 0], [1.0, 255, 255, 255]
    ])
};

export const COLORMAP_NAMES = Object.keys(COLORMAPS);

/**
 * Create GPU textures for all colormaps.
 * @param {import('../core/gpu.js').GPU} gpu
 * @returns {Object<string, WebGLTexture>}
 */
export function createColormapTextures(gpu) {
    const textures = {};
    for (const name in COLORMAPS) {
        textures[name] = gpu.createColormapTexture(COLORMAPS[name]);
    }
    return textures;
}

/**
 * Get CSS gradient string for a colormap (for UI preview strips).
 */
export function getColormapCSS(name) {
    const data = COLORMAPS[name];
    if (!data) return 'linear-gradient(to right, #000, #fff)';
    const stops = [];
    for (let i = 0; i < 256; i += 32) {
        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
        stops.push(`rgb(${r},${g},${b}) ${(i/255*100).toFixed(0)}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
}
