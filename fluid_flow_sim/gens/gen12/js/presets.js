/**
 * Preset Scenarios
 * Predefined flow configurations for common aerodynamic cases
 */

import { UniformFlow, SourceSink, Doublet, Vortex } from './flowElements.js';

/**
 * Preset definitions
 */
export const presets = {
    /**
     * Simple uniform flow
     */
    uniform: {
        name: 'Uniform Flow',
        description: 'Constant velocity flow in one direction',
        elements: [
            { type: UniformFlow, params: [2, 0, 0, 0] }  // U=2, alpha=0
        ]
    },
    
    /**
     * Single source
     */
    source: {
        name: 'Source',
        description: 'Radial outward flow from a point',
        elements: [
            { type: SourceSink, params: [30, 0, 0] }  // m=30, center
        ]
    },
    
    /**
     * Single sink
     */
    sink: {
        name: 'Sink',
        description: 'Radial inward flow to a point',
        elements: [
            { type: SourceSink, params: [-30, 0, 0] }  // m=-30, center
        ]
    },
    
    /**
     * Doublet
     */
    doublet: {
        name: 'Doublet',
        description: 'Source-sink pair at same location',
        elements: [
            { type: Doublet, params: [200, 0, 0, 0] }  // kappa=200, center
        ]
    },
    
    /**
     * Irrotational vortex
     */
    vortex: {
        name: 'Vortex',
        description: 'Rotating flow around a point',
        elements: [
            { type: Vortex, params: [100, 0, 0] }  // Gamma=100, center
        ]
    },
    
    /**
     * Half-body (Rankine half-body)
     * Uniform flow + Source
     * Creates a semi-infinite body shape
     */
    halfBody: {
        name: 'Half-Body',
        description: 'Uniform flow + source creates semi-infinite body',
        elements: [
            { type: UniformFlow, params: [1.5, 0, 0, 0] },  // U=1.5
            { type: SourceSink, params: [20, 0, 0] }        // Source at origin
        ]
    },
    
    /**
     * Rankine Oval
     * Uniform flow + Source + Sink (separated)
     * Creates a closed oval shape
     */
    rankineOval: {
        name: 'Rankine Oval',
        description: 'Uniform flow + source + sink creates closed oval body',
        elements: [
            { type: UniformFlow, params: [1.5, 0, 0, 0] },  // U=1.5
            { type: SourceSink, params: [25, -80, 0] },     // Source on left
            { type: SourceSink, params: [-25, 80, 0] }      // Sink on right
        ]
    },
    
    /**
     * Flow over a cylinder (non-rotating)
     * Uniform flow + Doublet
     * The doublet strength determines cylinder radius: R = sqrt(κ/(2πU))
     */
    cylinder: {
        name: 'Flow over Cylinder',
        description: 'Uniform flow + doublet models non-rotating cylinder',
        elements: [
            { type: UniformFlow, params: [1.5, 0, 0, 0] },  // U=1.5
            { type: Doublet, params: [150, 0, 0, 0] }       // Doublet at origin
        ]
    },
    
    /**
     * Rotating cylinder with circulation (Magnus effect)
     * Uniform flow + Doublet + Vortex
     * Creates lift force due to circulation
     */
    rotatingCylinder: {
        name: 'Rotating Cylinder',
        description: 'Adds circulation for Magnus effect / lift',
        elements: [
            { type: UniformFlow, params: [1.5, 0, 0, 0] },  // U=1.5
            { type: Doublet, params: [150, 0, 0, 0] },      // Doublet
            { type: Vortex, params: [80, 0, 0] }            // Circulation
        ]
    },
    
    /**
     * Source-Sink pair
     */
    sourceSinkPair: {
        name: 'Source-Sink Pair',
        description: 'Flow from source to sink',
        elements: [
            { type: SourceSink, params: [30, -100, 0] },   // Source on left
            { type: SourceSink, params: [-30, 100, 0] }    // Sink on right
        ]
    },
    
    /**
     * Vortex pair (counter-rotating)
     */
    vortexPair: {
        name: 'Vortex Pair',
        description: 'Two counter-rotating vortices',
        elements: [
            { type: Vortex, params: [80, -50, 0] },   // CCW on left
            { type: Vortex, params: [-80, 50, 0] }    // CW on right
        ]
    },
    
    /**
     * Symmetric airfoil approximation
     * Multiple source-sink pairs
     */
    airfoil: {
        name: 'Symmetric Airfoil',
        description: 'Approximation using multiple elements',
        elements: [
            { type: UniformFlow, params: [2, 0, 0, 0] },
            { type: SourceSink, params: [15, -100, 0] },
            { type: SourceSink, params: [10, -50, 0] },
            { type: SourceSink, params: [-10, 50, 0] },
            { type: SourceSink, params: [-15, 100, 0] }
        ]
    },
    
    /**
     * Complex flow field
     */
    complexField: {
        name: 'Complex Field',
        description: 'Multiple interacting elements',
        elements: [
            { type: UniformFlow, params: [1, 0, 0, 0] },
            { type: Vortex, params: [60, -100, -50] },
            { type: Vortex, params: [-60, 100, -50] },
            { type: SourceSink, params: [20, 0, 100] },
            { type: SourceSink, params: [-20, 0, -150] }
        ]
    }
};

/**
 * Load a preset configuration
 * @param {string} presetName - Name of the preset to load
 * @returns {Array} Array of instantiated flow elements
 */
export function loadPreset(presetName) {
    const preset = presets[presetName];
    if (!preset) {
        console.warn(`Unknown preset: ${presetName}`);
        return [];
    }
    
    const elements = [];
    
    for (const elementDef of preset.elements) {
        const ElementClass = elementDef.type;
        const params = elementDef.params;
        
        // Create instance with spread parameters
        const element = new ElementClass(...params);
        elements.push(element);
    }
    
    return elements;
}

/**
 * Get preset names for UI
 */
export function getPresetNames() {
    return Object.keys(presets).map(key => ({
        key,
        name: presets[key].name,
        description: presets[key].description
    }));
}

/**
 * Get preset info
 */
export function getPresetInfo(presetName) {
    return presets[presetName] || null;
}
