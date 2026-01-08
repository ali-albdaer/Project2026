/**
 * Presets Module
 * Predefined flow scenarios and configurations
 */

import { UniformFlow, SourceSink, Doublet, Vortex } from './flowElements.js';

/**
 * Preset configurations for common flow patterns
 */
export const PRESETS = {
    /**
     * Simple uniform flow
     */
    uniform: {
        name: 'Uniform Flow',
        description: 'Constant velocity flow in one direction',
        elements: [
            { type: 'uniform', params: { U: 2, alpha: 0 } }
        ]
    },

    /**
     * Point source
     */
    source: {
        name: 'Point Source',
        description: 'Radial outward flow from a point',
        elements: [
            { type: 'source', params: { x: 0, y: 0, m: 100 } }
        ]
    },

    /**
     * Point sink
     */
    sink: {
        name: 'Point Sink',
        description: 'Radial inward flow to a point',
        elements: [
            { type: 'sink', params: { x: 0, y: 0, m: -100 } }
        ]
    },

    /**
     * Doublet
     */
    doublet: {
        name: 'Doublet',
        description: 'Flow pattern from coincident source and sink',
        elements: [
            { type: 'doublet', params: { x: 0, y: 0, kappa: 500, orientation: 0 } }
        ]
    },

    /**
     * Irrotational vortex
     */
    vortex: {
        name: 'Irrotational Vortex',
        description: 'Circular flow around a point',
        elements: [
            { type: 'vortex', params: { x: 0, y: 0, gamma: 200 } }
        ]
    },

    /**
     * Rankine Half-Body
     * Uniform flow + Source
     * Creates a semi-infinite body with stagnation point
     */
    'half-body': {
        name: 'Rankine Half-Body',
        description: 'Uniform flow past a source creates a half-body shape',
        elements: [
            { type: 'uniform', params: { U: 1.5, alpha: 0 } },
            { type: 'source', params: { x: 0, y: 0, m: 80 } }
        ],
        notes: 'The stagnation point is at x = -m/(2πU)'
    },

    /**
     * Rankine Oval
     * Uniform flow + Source + Sink
     * Creates a closed oval body
     */
    'rankine-oval': {
        name: 'Rankine Oval',
        description: 'Uniform flow past a source-sink pair creates an oval body',
        elements: [
            { type: 'uniform', params: { U: 1.5, alpha: 0 } },
            { type: 'source', params: { x: -100, y: 0, m: 80 } },
            { type: 'sink', params: { x: 100, y: 0, m: -80 } }
        ],
        notes: 'The body length depends on source-sink separation and strength'
    },

    /**
     * Flow over Cylinder (Non-rotating)
     * Uniform flow + Doublet
     * Creates flow around a circular cylinder
     */
    cylinder: {
        name: 'Flow Over Cylinder',
        description: 'Potential flow around a circular cylinder',
        elements: [
            { type: 'uniform', params: { U: 1.5, alpha: 0 } },
            { type: 'doublet', params: { x: 0, y: 0, kappa: 2000, orientation: 0 } }
        ],
        notes: 'Cylinder radius R = sqrt(κ/(2πU))'
    },

    /**
     * Rotating Cylinder (Magnus Effect)
     * Uniform flow + Doublet + Vortex
     * Demonstrates lift generation
     */
    'rotating-cylinder': {
        name: 'Rotating Cylinder',
        description: 'Flow around a rotating cylinder showing Magnus effect',
        elements: [
            { type: 'uniform', params: { U: 1.5, alpha: 0 } },
            { type: 'doublet', params: { x: 0, y: 0, kappa: 2000, orientation: 0 } },
            { type: 'vortex', params: { x: 0, y: 0, gamma: 150 } }
        ],
        notes: 'Circulation creates lift: L = ρ U Γ (Kutta-Joukowski theorem)'
    },

    /**
     * Source-Sink Pair
     * Dipole flow pattern
     */
    'source-sink-pair': {
        name: 'Source-Sink Pair',
        description: 'Flow from source to sink',
        elements: [
            { type: 'source', params: { x: -80, y: 0, m: 100 } },
            { type: 'sink', params: { x: 80, y: 0, m: -100 } }
        ]
    },

    /**
     * Multiple Vortices
     * Vortex street pattern
     */
    'vortex-pair': {
        name: 'Vortex Pair',
        description: 'Counter-rotating vortex pair',
        elements: [
            { type: 'vortex', params: { x: -60, y: 0, gamma: 150 } },
            { type: 'vortex', params: { x: 60, y: 0, gamma: -150 } }
        ]
    },

    /**
     * Corner Flow
     * Flow in a 90-degree corner
     */
    'corner-flow': {
        name: 'Corner Flow',
        description: 'Flow around a 90-degree corner (potential flow)',
        elements: [
            { type: 'uniform', params: { U: 2, alpha: 0 } },
            { type: 'uniform', params: { U: 2, alpha: Math.PI / 2 } }
        ]
    },

    /**
     * Stagnation Point Flow
     * Flow impinging on a surface
     */
    'stagnation-flow': {
        name: 'Stagnation Point Flow',
        description: 'Flow towards a stagnation point',
        elements: [
            { type: 'source', params: { x: 0, y: -200, m: 150 } },
            { type: 'source', params: { x: 0, y: 200, m: 150 } },
            { type: 'sink', params: { x: -200, y: 0, m: -150 } },
            { type: 'sink', params: { x: 200, y: 0, m: -150 } }
        ]
    },

    /**
     * Kelvin Oval
     * Uniform flow + Two sources + Two sinks
     */
    'kelvin-oval': {
        name: 'Kelvin Oval',
        description: 'Symmetric oval formed by multiple sources and sinks',
        elements: [
            { type: 'uniform', params: { U: 1.2, alpha: 0 } },
            { type: 'source', params: { x: -80, y: 30, m: 60 } },
            { type: 'source', params: { x: -80, y: -30, m: 60 } },
            { type: 'sink', params: { x: 80, y: 30, m: -60 } },
            { type: 'sink', params: { x: 80, y: -30, m: -60 } }
        ]
    },

    /**
     * Vortex Street
     * Multiple alternating vortices
     */
    'vortex-street': {
        name: 'Von Kármán Vortex Street',
        description: 'Alternating vortices behind a bluff body',
        elements: [
            { type: 'uniform', params: { U: 1, alpha: 0 } },
            { type: 'vortex', params: { x: 0, y: 40, gamma: 100 } },
            { type: 'vortex', params: { x: 60, y: -40, gamma: -100 } },
            { type: 'vortex', params: { x: 120, y: 40, gamma: 100 } },
            { type: 'vortex', params: { x: 180, y: -40, gamma: -100 } }
        ]
    },

    /**
     * Lifting Airfoil (simplified)
     * Uniform + Doublet + Vortex at angle
     */
    'lifting-airfoil': {
        name: 'Lifting Airfoil (Simplified)',
        description: 'Cylinder with circulation at angle of attack',
        elements: [
            { type: 'uniform', params: { U: 1.5, alpha: 0.1 } },
            { type: 'doublet', params: { x: 0, y: 0, kappa: 1500, orientation: 0 } },
            { type: 'vortex', params: { x: 0, y: 0, gamma: 200 } }
        ]
    }
};

/**
 * Create flow elements from a preset
 * @param {string} presetName - Name of the preset
 * @returns {Array} Array of flow element instances
 */
export function createPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) {
        console.warn(`Unknown preset: ${presetName}`);
        return [];
    }

    const elements = [];

    for (const config of preset.elements) {
        let element;
        const p = config.params;

        switch (config.type) {
            case 'uniform':
                element = new UniformFlow(p.U, p.alpha);
                break;
            case 'source':
                element = new SourceSink(p.x, p.y, Math.abs(p.m));
                break;
            case 'sink':
                element = new SourceSink(p.x, p.y, -Math.abs(p.m));
                break;
            case 'doublet':
                element = new Doublet(p.x, p.y, p.kappa, p.orientation || 0);
                break;
            case 'vortex':
                element = new Vortex(p.x, p.y, p.gamma);
                break;
            default:
                console.warn(`Unknown element type: ${config.type}`);
                continue;
        }

        elements.push(element);
    }

    return elements;
}

/**
 * Get preset metadata
 */
export function getPresetInfo(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return null;
    
    return {
        name: preset.name,
        description: preset.description,
        notes: preset.notes || '',
        elementCount: preset.elements.length
    };
}

/**
 * Get all preset names
 */
export function getPresetNames() {
    return Object.keys(PRESETS);
}

/**
 * Get presets grouped by category
 */
export function getPresetsByCategory() {
    return {
        'Basic Elements': ['uniform', 'source', 'sink', 'doublet', 'vortex'],
        'Bodies': ['half-body', 'rankine-oval', 'cylinder', 'rotating-cylinder', 'kelvin-oval'],
        'Multi-Element': ['source-sink-pair', 'vortex-pair', 'stagnation-flow'],
        'Advanced': ['corner-flow', 'vortex-street', 'lifting-airfoil']
    };
}
