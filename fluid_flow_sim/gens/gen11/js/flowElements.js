/**
 * Flow Elements Module
 * Defines elementary flow types: uniform, source/sink, doublet, vortex
 */

import { Vector2, MathUtils, generateId } from './utils.js';

/**
 * Base class for all flow elements
 */
export class FlowElement {
    constructor(type, x = 0, y = 0) {
        this.id = generateId();
        this.type = type;
        this.position = new Vector2(x, y);
        this.enabled = true;
        this.selected = false;
    }

    /**
     * Get velocity at a point due to this element
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Vector2} Velocity vector
     */
    getVelocity(x, y) {
        return new Vector2(0, 0);
    }

    /**
     * Get stream function value at a point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Stream function value
     */
    getStreamFunction(x, y) {
        return 0;
    }

    /**
     * Get velocity potential at a point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Velocity potential value
     */
    getPotential(x, y) {
        return 0;
    }

    /**
     * Check if point is in singularity region
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    isSingularity(x, y) {
        return false;
    }

    /**
     * Get spawn rate for particles (sources create, sinks destroy)
     * @returns {number} Positive for creation, negative for destruction
     */
    getSpawnRate() {
        return 0;
    }

    /**
     * Get element display name
     */
    getDisplayName() {
        return this.type.charAt(0).toUpperCase() + this.type.slice(1);
    }

    /**
     * Get element parameters for display
     */
    getParamsString() {
        return '';
    }

    /**
     * Get element icon
     */
    getIcon() {
        return '•';
    }

    /**
     * Clone this element
     */
    clone() {
        return new FlowElement(this.type, this.position.x, this.position.y);
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.position.x,
            y: this.position.y,
            enabled: this.enabled
        };
    }
}

/**
 * Uniform Flow: V = U∞ (constant velocity at angle α)
 * ψ = U∞ * (y*cos(α) - x*sin(α))
 * φ = U∞ * (x*cos(α) + y*sin(α))
 */
export class UniformFlow extends FlowElement {
    constructor(U = 1.0, alpha = 0) {
        super('uniform', 0, 0);
        this.U = U;           // Freestream velocity magnitude
        this.alpha = alpha;   // Flow angle in radians
    }

    getVelocity(x, y) {
        return new Vector2(
            this.U * Math.cos(this.alpha),
            this.U * Math.sin(this.alpha)
        );
    }

    getStreamFunction(x, y) {
        return this.U * (y * Math.cos(this.alpha) - x * Math.sin(this.alpha));
    }

    getPotential(x, y) {
        return this.U * (x * Math.cos(this.alpha) + y * Math.sin(this.alpha));
    }

    getSpawnRate() {
        return Math.abs(this.U) * 5; // Spawn particles based on flow strength
    }

    getDisplayName() {
        return 'Uniform Flow';
    }

    getParamsString() {
        const angleDeg = (this.alpha * MathUtils.RAD_TO_DEG).toFixed(1);
        return `U=${this.U.toFixed(2)}, α=${angleDeg}°`;
    }

    getIcon() {
        return '→';
    }

    clone() {
        const c = new UniformFlow(this.U, this.alpha);
        c.enabled = this.enabled;
        return c;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            U: this.U,
            alpha: this.alpha
        };
    }

    static fromJSON(data) {
        const elem = new UniformFlow(data.U || 1, data.alpha || 0);
        elem.id = data.id;
        elem.enabled = data.enabled !== false;
        return elem;
    }
}

/**
 * Point Source/Sink: Radial flow from/to a point
 * Vr = m / (2π * r), Vθ = 0
 * ψ = (m / 2π) * θ
 * φ = (m / 2π) * ln(r)
 * m > 0: source, m < 0: sink
 */
export class SourceSink extends FlowElement {
    constructor(x = 0, y = 0, m = 1.0) {
        super(m >= 0 ? 'source' : 'sink', x, y);
        this.m = m;  // Source strength (volume flow rate per unit depth)
        this.singularityRadius = 5; // Radius within which velocity is clamped
    }

    getVelocity(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < this.singularityRadius * this.singularityRadius) {
            // Near singularity, return clamped velocity
            const r = Math.sqrt(r2);
            if (r < 0.1) return new Vector2(0, 0);
            const factor = this.m / (MathUtils.TWO_PI * this.singularityRadius * this.singularityRadius);
            return new Vector2(dx * factor, dy * factor);
        }
        
        const factor = this.m / (MathUtils.TWO_PI * r2);
        return new Vector2(dx * factor, dy * factor);
    }

    getStreamFunction(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const theta = Math.atan2(dy, dx);
        return (this.m / MathUtils.TWO_PI) * theta;
    }

    getPotential(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 0.1) return 0;
        return (this.m / MathUtils.TWO_PI) * Math.log(r);
    }

    isSingularity(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        return (dx * dx + dy * dy) < this.singularityRadius * this.singularityRadius;
    }

    getSpawnRate() {
        return this.m; // Positive = create particles, negative = destroy
    }

    getDisplayName() {
        return this.m >= 0 ? 'Source' : 'Sink';
    }

    getParamsString() {
        return `m=${this.m.toFixed(2)}`;
    }

    getIcon() {
        return this.m >= 0 ? '⊕' : '⊖';
    }

    clone() {
        const c = new SourceSink(this.position.x, this.position.y, this.m);
        c.enabled = this.enabled;
        return c;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            m: this.m
        };
    }

    static fromJSON(data) {
        const elem = new SourceSink(data.x || 0, data.y || 0, data.m || 1);
        elem.id = data.id;
        elem.enabled = data.enabled !== false;
        elem.type = elem.m >= 0 ? 'source' : 'sink';
        return elem;
    }
}

/**
 * Doublet: Limit of source-sink pair
 * Vr = -κ * cos(θ) / (2π * r²)
 * Vθ = -κ * sin(θ) / (2π * r²)
 * ψ = -κ * sin(θ) / (2π * r)
 * φ = κ * cos(θ) / (2π * r)
 */
export class Doublet extends FlowElement {
    constructor(x = 0, y = 0, kappa = 100, orientation = 0) {
        super('doublet', x, y);
        this.kappa = kappa;         // Doublet strength
        this.orientation = orientation; // Orientation angle
        this.singularityRadius = 10;
    }

    getVelocity(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < this.singularityRadius * this.singularityRadius) {
            return new Vector2(0, 0);
        }
        
        const r4 = r2 * r2;
        const cos_o = Math.cos(this.orientation);
        const sin_o = Math.sin(this.orientation);
        
        // Rotate coordinates
        const x_rot = dx * cos_o + dy * sin_o;
        const y_rot = -dx * sin_o + dy * cos_o;
        
        // Velocity in rotated frame
        const factor = this.kappa / (MathUtils.TWO_PI * r4);
        const u_rot = factor * (y_rot * y_rot - x_rot * x_rot);
        const v_rot = -2 * factor * x_rot * y_rot;
        
        // Rotate back
        return new Vector2(
            u_rot * cos_o - v_rot * sin_o,
            u_rot * sin_o + v_rot * cos_o
        );
    }

    getStreamFunction(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < 0.1) return 0;
        
        const cos_o = Math.cos(this.orientation);
        const sin_o = Math.sin(this.orientation);
        const y_rot = -dx * sin_o + dy * cos_o;
        
        return -(this.kappa / MathUtils.TWO_PI) * (y_rot / r2);
    }

    getPotential(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < 0.1) return 0;
        
        const cos_o = Math.cos(this.orientation);
        const sin_o = Math.sin(this.orientation);
        const x_rot = dx * cos_o + dy * sin_o;
        
        return (this.kappa / MathUtils.TWO_PI) * (x_rot / r2);
    }

    isSingularity(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        return (dx * dx + dy * dy) < this.singularityRadius * this.singularityRadius;
    }

    getDisplayName() {
        return 'Doublet';
    }

    getParamsString() {
        const angleDeg = (this.orientation * MathUtils.RAD_TO_DEG).toFixed(1);
        return `κ=${this.kappa.toFixed(1)}, θ=${angleDeg}°`;
    }

    getIcon() {
        return '◐';
    }

    clone() {
        const c = new Doublet(this.position.x, this.position.y, this.kappa, this.orientation);
        c.enabled = this.enabled;
        return c;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            kappa: this.kappa,
            orientation: this.orientation
        };
    }

    static fromJSON(data) {
        const elem = new Doublet(data.x || 0, data.y || 0, data.kappa || 100, data.orientation || 0);
        elem.id = data.id;
        elem.enabled = data.enabled !== false;
        return elem;
    }
}

/**
 * Irrotational Vortex: Circular flow around a point
 * Vr = 0, Vθ = Γ / (2π * r)
 * ψ = -(Γ / 2π) * ln(r)
 * φ = (Γ / 2π) * θ
 * Γ > 0: counter-clockwise, Γ < 0: clockwise
 */
export class Vortex extends FlowElement {
    constructor(x = 0, y = 0, gamma = 100) {
        super('vortex', x, y);
        this.gamma = gamma;  // Circulation (positive = CCW)
        this.singularityRadius = 5;
    }

    getVelocity(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < this.singularityRadius * this.singularityRadius) {
            // Rankine vortex core: solid body rotation
            const factor = this.gamma / (MathUtils.TWO_PI * this.singularityRadius * this.singularityRadius);
            return new Vector2(-dy * factor, dx * factor);
        }
        
        const factor = this.gamma / (MathUtils.TWO_PI * r2);
        return new Vector2(-dy * factor, dx * factor);
    }

    getStreamFunction(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 0.1) return 0;
        return -(this.gamma / MathUtils.TWO_PI) * Math.log(r);
    }

    getPotential(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const theta = Math.atan2(dy, dx);
        return (this.gamma / MathUtils.TWO_PI) * theta;
    }

    isSingularity(x, y) {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        return (dx * dx + dy * dy) < this.singularityRadius * this.singularityRadius;
    }

    getSpawnRate() {
        // Vortices rotate particles, higher gamma = more rotation influence
        return 0;
    }

    getDisplayName() {
        return 'Vortex';
    }

    getParamsString() {
        const dir = this.gamma >= 0 ? 'CCW' : 'CW';
        return `Γ=${Math.abs(this.gamma).toFixed(1)} ${dir}`;
    }

    getIcon() {
        return this.gamma >= 0 ? '↺' : '↻';
    }

    clone() {
        const c = new Vortex(this.position.x, this.position.y, this.gamma);
        c.enabled = this.enabled;
        return c;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            gamma: this.gamma
        };
    }

    static fromJSON(data) {
        const elem = new Vortex(data.x || 0, data.y || 0, data.gamma || 100);
        elem.id = data.id;
        elem.enabled = data.enabled !== false;
        return elem;
    }
}

/**
 * Flow Elements Manager
 * Manages all active flow elements and computes superposition
 */
export class FlowElementsManager {
    constructor() {
        this.elements = [];
    }

    add(element) {
        this.elements.push(element);
        return element;
    }

    remove(elementOrId) {
        const id = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
        const index = this.elements.findIndex(e => e.id === id);
        if (index !== -1) {
            return this.elements.splice(index, 1)[0];
        }
        return null;
    }

    get(id) {
        return this.elements.find(e => e.id === id);
    }

    clear() {
        this.elements = [];
    }

    getEnabled() {
        return this.elements.filter(e => e.enabled);
    }

    /**
     * Get total velocity at a point (superposition)
     */
    getVelocityAt(x, y) {
        const velocity = new Vector2(0, 0);
        for (const element of this.elements) {
            if (element.enabled) {
                const v = element.getVelocity(x, y);
                velocity.add(v);
            }
        }
        return velocity;
    }

    /**
     * Get total stream function at a point
     */
    getStreamFunctionAt(x, y) {
        let psi = 0;
        for (const element of this.elements) {
            if (element.enabled) {
                psi += element.getStreamFunction(x, y);
            }
        }
        return psi;
    }

    /**
     * Get total velocity potential at a point
     */
    getPotentialAt(x, y) {
        let phi = 0;
        for (const element of this.elements) {
            if (element.enabled) {
                phi += element.getPotential(x, y);
            }
        }
        return phi;
    }

    /**
     * Check if point is near any singularity
     */
    isNearSingularity(x, y) {
        for (const element of this.elements) {
            if (element.enabled && element.isSingularity(x, y)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get sources and sinks for particle spawning
     */
    getSources() {
        return this.elements.filter(e => e.enabled && e.type === 'source');
    }

    getSinks() {
        return this.elements.filter(e => e.enabled && e.type === 'sink');
    }

    getUniformFlows() {
        return this.elements.filter(e => e.enabled && e.type === 'uniform');
    }

    /**
     * Find element at position
     */
    getElementAt(x, y, radius = 20) {
        for (const element of this.elements) {
            if (element.type === 'uniform') continue; // Uniform flow has no position
            const dx = x - element.position.x;
            const dy = y - element.position.y;
            if (dx * dx + dy * dy < radius * radius) {
                return element;
            }
        }
        return null;
    }

    /**
     * Serialize all elements
     */
    toJSON() {
        return this.elements.map(e => e.toJSON());
    }

    /**
     * Deserialize elements
     */
    fromJSON(data) {
        this.clear();
        for (const item of data) {
            let element;
            switch (item.type) {
                case 'uniform':
                    element = UniformFlow.fromJSON(item);
                    break;
                case 'source':
                case 'sink':
                    element = SourceSink.fromJSON(item);
                    break;
                case 'doublet':
                    element = Doublet.fromJSON(item);
                    break;
                case 'vortex':
                    element = Vortex.fromJSON(item);
                    break;
                default:
                    continue;
            }
            this.elements.push(element);
        }
    }

    get count() {
        return this.elements.length;
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]();
    }
}

// Export factory function
export function createFlowElement(type, options = {}) {
    switch (type) {
        case 'uniform':
            return new UniformFlow(options.U || 1, options.alpha || 0);
        case 'source':
            return new SourceSink(options.x || 0, options.y || 0, Math.abs(options.m || 50));
        case 'sink':
            return new SourceSink(options.x || 0, options.y || 0, -Math.abs(options.m || 50));
        case 'doublet':
            return new Doublet(options.x || 0, options.y || 0, options.kappa || 100, options.orientation || 0);
        case 'vortex':
            return new Vortex(options.x || 0, options.y || 0, options.gamma || 100);
        default:
            throw new Error(`Unknown flow element type: ${type}`);
    }
}
