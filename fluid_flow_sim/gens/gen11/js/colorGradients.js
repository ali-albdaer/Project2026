/**
 * Color Gradients Module
 * Color palettes for flow visualization
 */

import { MathUtils } from './utils.js';

/**
 * Color utility functions
 */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : null;
}

export function rgbToCss(r, g, b, a = 1) {
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

export function lerpColor(color1, color2, t) {
    return {
        r: color1.r + (color2.r - color1.r) * t,
        g: color1.g + (color2.g - color1.g) * t,
        b: color1.b + (color2.b - color1.b) * t
    };
}

/**
 * Color palette definitions
 * Each palette is an array of {position, color} stops
 */
export const PALETTES = {
    viridis: [
        { pos: 0.0, r: 0.267, g: 0.004, b: 0.329 },
        { pos: 0.25, r: 0.282, g: 0.140, b: 0.458 },
        { pos: 0.5, r: 0.127, g: 0.566, b: 0.551 },
        { pos: 0.75, r: 0.369, g: 0.788, b: 0.382 },
        { pos: 1.0, r: 0.993, g: 0.906, b: 0.144 }
    ],
    
    jet: [
        { pos: 0.0, r: 0.0, g: 0.0, b: 0.5 },
        { pos: 0.125, r: 0.0, g: 0.0, b: 1.0 },
        { pos: 0.375, r: 0.0, g: 1.0, b: 1.0 },
        { pos: 0.5, r: 0.0, g: 1.0, b: 0.0 },
        { pos: 0.625, r: 1.0, g: 1.0, b: 0.0 },
        { pos: 0.875, r: 1.0, g: 0.0, b: 0.0 },
        { pos: 1.0, r: 0.5, g: 0.0, b: 0.0 }
    ],
    
    magma: [
        { pos: 0.0, r: 0.001, g: 0.0, b: 0.014 },
        { pos: 0.25, r: 0.329, g: 0.071, b: 0.433 },
        { pos: 0.5, r: 0.716, g: 0.215, b: 0.475 },
        { pos: 0.75, r: 0.987, g: 0.535, b: 0.380 },
        { pos: 1.0, r: 0.988, g: 0.991, b: 0.749 }
    ],
    
    plasma: [
        { pos: 0.0, r: 0.050, g: 0.030, b: 0.528 },
        { pos: 0.25, r: 0.494, g: 0.012, b: 0.658 },
        { pos: 0.5, r: 0.798, g: 0.280, b: 0.470 },
        { pos: 0.75, r: 0.973, g: 0.580, b: 0.254 },
        { pos: 1.0, r: 0.940, g: 0.975, b: 0.131 }
    ],
    
    inferno: [
        { pos: 0.0, r: 0.001, g: 0.0, b: 0.014 },
        { pos: 0.25, r: 0.341, g: 0.062, b: 0.429 },
        { pos: 0.5, r: 0.735, g: 0.216, b: 0.330 },
        { pos: 0.75, r: 0.988, g: 0.553, b: 0.180 },
        { pos: 1.0, r: 0.988, g: 1.0, b: 0.644 }
    ],
    
    coolwarm: [
        { pos: 0.0, r: 0.230, g: 0.299, b: 0.754 },
        { pos: 0.25, r: 0.552, g: 0.691, b: 0.996 },
        { pos: 0.5, r: 0.866, g: 0.866, b: 0.866 },
        { pos: 0.75, r: 0.956, g: 0.604, b: 0.485 },
        { pos: 1.0, r: 0.706, g: 0.016, b: 0.150 }
    ],
    
    grayscale: [
        { pos: 0.0, r: 0.0, g: 0.0, b: 0.0 },
        { pos: 1.0, r: 1.0, g: 1.0, b: 1.0 }
    ],
    
    rainbow: [
        { pos: 0.0, r: 1.0, g: 0.0, b: 0.0 },
        { pos: 0.17, r: 1.0, g: 0.5, b: 0.0 },
        { pos: 0.33, r: 1.0, g: 1.0, b: 0.0 },
        { pos: 0.5, r: 0.0, g: 1.0, b: 0.0 },
        { pos: 0.67, r: 0.0, g: 0.5, b: 1.0 },
        { pos: 0.83, r: 0.5, g: 0.0, b: 1.0 },
        { pos: 1.0, r: 1.0, g: 0.0, b: 0.5 }
    ],
    
    blues: [
        { pos: 0.0, r: 0.031, g: 0.188, b: 0.420 },
        { pos: 0.5, r: 0.259, g: 0.573, b: 0.776 },
        { pos: 1.0, r: 0.878, g: 0.925, b: 0.957 }
    ],
    
    reds: [
        { pos: 0.0, r: 0.404, g: 0.0, b: 0.051 },
        { pos: 0.5, r: 0.839, g: 0.376, b: 0.302 },
        { pos: 1.0, r: 0.996, g: 0.878, b: 0.824 }
    ]
};

/**
 * Color Gradient class
 */
export class ColorGradient {
    constructor(paletteName = 'viridis') {
        this.setPalette(paletteName);
        this.minValue = 0;
        this.maxValue = 1;
        this.autoScale = true;
        this.samples = [];
        this.sampleCount = 0;
        this.maxSamples = 1000;
    }

    setPalette(name) {
        this.paletteName = name;
        this.palette = PALETTES[name] || PALETTES.viridis;
        this.precomputeLUT();
    }

    /**
     * Precompute lookup table for fast color mapping
     */
    precomputeLUT() {
        this.lut = [];
        const lutSize = 256;
        
        for (let i = 0; i < lutSize; i++) {
            const t = i / (lutSize - 1);
            const color = this.samplePalette(t);
            this.lut.push(color);
        }
    }

    /**
     * Sample the palette at position t (0-1)
     */
    samplePalette(t) {
        t = MathUtils.clamp(t, 0, 1);
        
        // Find the two stops to interpolate between
        let lower = this.palette[0];
        let upper = this.palette[this.palette.length - 1];
        
        for (let i = 0; i < this.palette.length - 1; i++) {
            if (this.palette[i].pos <= t && this.palette[i + 1].pos >= t) {
                lower = this.palette[i];
                upper = this.palette[i + 1];
                break;
            }
        }
        
        // Interpolate
        const range = upper.pos - lower.pos;
        const localT = range > 0 ? (t - lower.pos) / range : 0;
        
        return {
            r: lower.r + (upper.r - lower.r) * localT,
            g: lower.g + (upper.g - lower.g) * localT,
            b: lower.b + (upper.b - lower.b) * localT
        };
    }

    /**
     * Get color for a value
     */
    getColor(value, alpha = 1) {
        // Add sample for auto-scaling
        if (this.autoScale) {
            this.addSample(value);
        }
        
        // Normalize value to 0-1 range
        const range = this.maxValue - this.minValue;
        const t = range > 0 ? (value - this.minValue) / range : 0.5;
        
        // Use LUT for fast lookup
        const lutIndex = Math.floor(MathUtils.clamp(t, 0, 1) * 255);
        const color = this.lut[lutIndex];
        
        return rgbToCss(color.r, color.g, color.b, alpha);
    }

    /**
     * Get color as RGB object
     */
    getColorRGB(value) {
        const range = this.maxValue - this.minValue;
        const t = range > 0 ? (value - this.minValue) / range : 0.5;
        const lutIndex = Math.floor(MathUtils.clamp(t, 0, 1) * 255);
        return this.lut[lutIndex];
    }

    /**
     * Add sample for auto-scaling
     */
    addSample(value) {
        if (!isFinite(value)) return;
        
        this.samples.push(value);
        this.sampleCount++;
        
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
        
        // Update range periodically
        if (this.sampleCount % 100 === 0) {
            this.updateRange();
        }
    }

    /**
     * Update min/max from samples
     */
    updateRange() {
        if (this.samples.length === 0) return;
        
        let min = Infinity;
        let max = -Infinity;
        
        for (const v of this.samples) {
            if (v < min) min = v;
            if (v > max) max = v;
        }
        
        // Smooth transition to new range
        const alpha = 0.1;
        this.minValue = this.minValue * (1 - alpha) + min * alpha;
        this.maxValue = this.maxValue * (1 - alpha) + max * alpha;
        
        // Ensure minimum range
        if (this.maxValue - this.minValue < 0.01) {
            this.maxValue = this.minValue + 1;
        }
    }

    /**
     * Set fixed range (disables auto-scaling)
     */
    setRange(min, max) {
        this.minValue = min;
        this.maxValue = max;
        this.autoScale = false;
    }

    /**
     * Enable auto-scaling
     */
    enableAutoScale() {
        this.autoScale = true;
        this.samples = [];
        this.sampleCount = 0;
    }

    /**
     * Reset range
     */
    reset() {
        this.minValue = 0;
        this.maxValue = 1;
        this.samples = [];
        this.sampleCount = 0;
    }

    /**
     * Get palette names
     */
    static getPaletteNames() {
        return Object.keys(PALETTES);
    }
}

/**
 * Color mapping quantities
 */
export const QUANTITY_CONFIG = {
    none: {
        name: 'None',
        getValue: () => 0,
        unit: ''
    },
    velocity: {
        name: 'Velocity Magnitude',
        getValue: (props) => props.speed,
        unit: 'm/s'
    },
    pressure: {
        name: 'Pressure',
        getValue: (props) => props.pressure,
        unit: 'Pa'
    },
    density: {
        name: 'Density',
        getValue: (props) => props.density,
        unit: 'kg/m³'
    },
    temperature: {
        name: 'Temperature',
        getValue: (props) => props.temperature,
        unit: 'K'
    },
    vorticity: {
        name: 'Vorticity',
        getValue: (props) => props.vorticity,
        unit: '1/s'
    },
    'stream-function': {
        name: 'Stream Function',
        getValue: (props) => props.streamFunction,
        unit: 'm²/s'
    },
    potential: {
        name: 'Velocity Potential',
        getValue: (props) => props.potential,
        unit: 'm²/s'
    }
};
