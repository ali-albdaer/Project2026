/**
 * Color Maps
 * Scientific color palettes for visualization
 */

// Predefined color palettes
const palettes = {
    viridis: [
        [0.267, 0.004, 0.329],
        [0.282, 0.140, 0.458],
        [0.253, 0.265, 0.530],
        [0.206, 0.372, 0.553],
        [0.163, 0.471, 0.558],
        [0.128, 0.567, 0.551],
        [0.134, 0.658, 0.517],
        [0.267, 0.749, 0.441],
        [0.478, 0.821, 0.318],
        [0.741, 0.873, 0.150],
        [0.993, 0.906, 0.144]
    ],
    
    plasma: [
        [0.050, 0.030, 0.528],
        [0.254, 0.014, 0.615],
        [0.417, 0.001, 0.658],
        [0.564, 0.052, 0.641],
        [0.692, 0.165, 0.564],
        [0.798, 0.280, 0.470],
        [0.881, 0.393, 0.383],
        [0.949, 0.517, 0.295],
        [0.988, 0.653, 0.198],
        [0.988, 0.809, 0.145],
        [0.940, 0.975, 0.131]
    ],
    
    magma: [
        [0.001, 0.000, 0.014],
        [0.078, 0.042, 0.206],
        [0.232, 0.059, 0.437],
        [0.390, 0.100, 0.501],
        [0.550, 0.161, 0.506],
        [0.716, 0.215, 0.475],
        [0.868, 0.287, 0.409],
        [0.967, 0.439, 0.360],
        [0.994, 0.624, 0.427],
        [0.996, 0.803, 0.579],
        [0.987, 0.991, 0.750]
    ],
    
    inferno: [
        [0.001, 0.000, 0.014],
        [0.046, 0.030, 0.186],
        [0.159, 0.044, 0.387],
        [0.311, 0.072, 0.483],
        [0.470, 0.108, 0.488],
        [0.621, 0.162, 0.432],
        [0.762, 0.233, 0.335],
        [0.876, 0.340, 0.216],
        [0.957, 0.494, 0.078],
        [0.984, 0.696, 0.094],
        [0.988, 0.998, 0.645]
    ],
    
    jet: [
        [0.000, 0.000, 0.500],
        [0.000, 0.000, 1.000],
        [0.000, 0.500, 1.000],
        [0.000, 1.000, 1.000],
        [0.500, 1.000, 0.500],
        [1.000, 1.000, 0.000],
        [1.000, 0.500, 0.000],
        [1.000, 0.000, 0.000],
        [0.500, 0.000, 0.000]
    ],
    
    coolwarm: [
        [0.230, 0.299, 0.754],
        [0.390, 0.475, 0.860],
        [0.550, 0.630, 0.930],
        [0.718, 0.776, 0.965],
        [0.866, 0.866, 0.866],
        [0.958, 0.742, 0.697],
        [0.918, 0.577, 0.505],
        [0.839, 0.383, 0.324],
        [0.706, 0.016, 0.150]
    ],
    
    turbo: [
        [0.190, 0.072, 0.232],
        [0.254, 0.266, 0.844],
        [0.148, 0.476, 0.988],
        [0.063, 0.660, 0.836],
        [0.198, 0.808, 0.595],
        [0.478, 0.906, 0.339],
        [0.750, 0.946, 0.219],
        [0.947, 0.859, 0.191],
        [0.992, 0.655, 0.167],
        [0.947, 0.420, 0.116],
        [0.800, 0.181, 0.063],
        [0.547, 0.034, 0.069]
    ]
};

/**
 * Interpolate between colors in a palette
 * @param {number} t - Value between 0 and 1
 * @param {string} paletteName - Name of the palette
 * @returns {string} CSS color string
 */
export function getColor(t, paletteName = 'viridis') {
    const palette = palettes[paletteName] || palettes.viridis;
    
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));
    
    // Find the two colors to interpolate between
    const numColors = palette.length;
    const scaledT = t * (numColors - 1);
    const index = Math.floor(scaledT);
    const frac = scaledT - index;
    
    // Handle edge case
    if (index >= numColors - 1) {
        const c = palette[numColors - 1];
        return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
    }
    
    // Interpolate
    const c1 = palette[index];
    const c2 = palette[index + 1];
    
    const r = Math.round((c1[0] + (c2[0] - c1[0]) * frac) * 255);
    const g = Math.round((c1[1] + (c2[1] - c1[1]) * frac) * 255);
    const b = Math.round((c1[2] + (c2[2] - c1[2]) * frac) * 255);
    
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get color as RGB array [0-255]
 */
export function getColorRGB(t, paletteName = 'viridis') {
    const palette = palettes[paletteName] || palettes.viridis;
    
    t = Math.max(0, Math.min(1, t));
    
    const numColors = palette.length;
    const scaledT = t * (numColors - 1);
    const index = Math.floor(scaledT);
    const frac = scaledT - index;
    
    if (index >= numColors - 1) {
        const c = palette[numColors - 1];
        return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
    }
    
    const c1 = palette[index];
    const c2 = palette[index + 1];
    
    return [
        Math.round((c1[0] + (c2[0] - c1[0]) * frac) * 255),
        Math.round((c1[1] + (c2[1] - c1[1]) * frac) * 255),
        Math.round((c1[2] + (c2[2] - c1[2]) * frac) * 255)
    ];
}

/**
 * Get color with alpha
 */
export function getColorWithAlpha(t, alpha, paletteName = 'viridis') {
    const rgb = getColorRGB(t, paletteName);
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Get list of available palette names
 */
export function getPaletteNames() {
    return Object.keys(palettes);
}

/**
 * Create a color scale for a legend
 */
export function createColorScale(paletteName, steps = 10) {
    const colors = [];
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        colors.push({
            t: t,
            color: getColor(t, paletteName)
        });
    }
    return colors;
}

/**
 * Element type colors
 */
export const elementColors = {
    uniform: '#4a90d9',
    source: '#22c55e',
    sink: '#ef4444',
    doublet: '#f59e0b',
    vortex: '#a855f7'
};

/**
 * Get element color by type
 */
export function getElementColor(type) {
    return elementColors[type] || '#ffffff';
}

/**
 * Default particle color
 */
export const defaultParticleColor = '#ffffff';

/**
 * Grid/background colors
 */
export const gridColors = {
    major: 'rgba(60, 60, 80, 0.3)',
    minor: 'rgba(40, 40, 60, 0.2)',
    axis: 'rgba(100, 100, 120, 0.4)'
};
