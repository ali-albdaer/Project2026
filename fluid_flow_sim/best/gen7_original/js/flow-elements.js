/**
 * Flow Elements - Elementary flow definitions
 * Uniform flow, source/sink, doublet, vortex
 */

/**
 * Base class for all flow elements
 */
class FlowElement {
    constructor(type, x = 0, y = 0) {
        this.id = FlowElement.nextId++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.enabled = true;
    }

    // Stream function at point (px, py)
    psi(px, py) { return 0; }

    // Velocity potential at point (px, py)
    phi(px, py) { return 0; }

    // Velocity components at point (px, py)
    velocity(px, py) { return { u: 0, v: 0 }; }

    // Get parameters for UI editing
    getParams() { return {}; }

    // Set parameters from UI
    setParams(params) {}

    // Clone this element
    clone() { return new FlowElement(this.type, this.x, this.y); }

    // Get display name
    getName() { return `${this.type} #${this.id}`; }
}

FlowElement.nextId = 1;

/**
 * Uniform Flow
 * ψ = U∞ * (y*cos(α) - x*sin(α))
 * φ = U∞ * (x*cos(α) + y*sin(α))
 */
class UniformFlow extends FlowElement {
    constructor(U = 1, alpha = 0) {
        super('uniform', 0, 0);
        this.U = U;          // Free stream velocity magnitude
        this.alpha = alpha;   // Angle of attack (radians)
    }

    psi(px, py) {
        return this.U * (py * Math.cos(this.alpha) - px * Math.sin(this.alpha));
    }

    phi(px, py) {
        return this.U * (px * Math.cos(this.alpha) + py * Math.sin(this.alpha));
    }

    velocity(px, py) {
        return {
            u: this.U * Math.cos(this.alpha),
            v: this.U * Math.sin(this.alpha)
        };
    }

    getParams() {
        return {
            U: { value: this.U, min: -5, max: 5, step: 0.1, label: 'Velocity (U∞)' },
            alpha: { value: this.alpha * 180 / Math.PI, min: -180, max: 180, step: 1, label: 'Angle (°)' }
        };
    }

    setParams(params) {
        if (params.U !== undefined) this.U = params.U;
        if (params.alpha !== undefined) this.alpha = params.alpha * Math.PI / 180;
    }

    clone() {
        return new UniformFlow(this.U, this.alpha);
    }

    getName() {
        return `Uniform U=${this.U.toFixed(2)}`;
    }
}

/**
 * Source/Sink Flow
 * ψ = (m / 2π) * θ
 * φ = (m / 2π) * ln(r)
 * where m > 0 for source, m < 0 for sink
 */
class SourceSink extends FlowElement {
    constructor(x = 0, y = 0, m = 1) {
        super(m >= 0 ? 'source' : 'sink', x, y);
        this.m = m;  // Strength (positive = source, negative = sink)
    }

    psi(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const theta = MathUtils.safeAtan2(dy, dx);
        return (this.m / MathUtils.TWO_PI) * theta;
    }

    phi(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        return (this.m / MathUtils.TWO_PI) * MathUtils.safeLog(r);
    }

    velocity(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < MathUtils.EPSILON) {
            return { u: 0, v: 0 };
        }
        
        const factor = this.m / (MathUtils.TWO_PI * r2);
        return {
            u: factor * dx,
            v: factor * dy
        };
    }

    getParams() {
        return {
            x: { value: this.x, min: -10, max: 10, step: 0.1, label: 'Position X' },
            y: { value: this.y, min: -10, max: 10, step: 0.1, label: 'Position Y' },
            m: { value: this.m, min: -10, max: 10, step: 0.1, label: 'Strength (m)' }
        };
    }

    setParams(params) {
        if (params.x !== undefined) this.x = params.x;
        if (params.y !== undefined) this.y = params.y;
        if (params.m !== undefined) {
            this.m = params.m;
            this.type = this.m >= 0 ? 'source' : 'sink';
        }
    }

    clone() {
        return new SourceSink(this.x, this.y, this.m);
    }

    getName() {
        return `${this.type === 'source' ? 'Source' : 'Sink'} m=${this.m.toFixed(2)}`;
    }
}

/**
 * Doublet Flow
 * ψ = -(κ / 2π) * (y / r²)
 * φ = (κ / 2π) * (x / r²)
 * Axis oriented along x by default
 */
class Doublet extends FlowElement {
    constructor(x = 0, y = 0, kappa = 1, angle = 0) {
        super('doublet', x, y);
        this.kappa = kappa;  // Strength
        this.angle = angle;   // Orientation angle (radians)
    }

    psi(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < MathUtils.EPSILON) {
            return 0;
        }
        
        // Rotate coordinates
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const xr = dx * cos + dy * sin;
        const yr = -dx * sin + dy * cos;
        
        return -(this.kappa / MathUtils.TWO_PI) * yr / r2;
    }

    phi(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < MathUtils.EPSILON) {
            return 0;
        }
        
        // Rotate coordinates
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const xr = dx * cos + dy * sin;
        
        return (this.kappa / MathUtils.TWO_PI) * xr / r2;
    }

    velocity(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < MathUtils.EPSILON) {
            return { u: 0, v: 0 };
        }
        
        const r4 = r2 * r2;
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        
        // Velocity in rotated frame
        const factor = this.kappa / MathUtils.TWO_PI;
        const ur = factor * (dy * dy - dx * dx) / r4;
        const vr = factor * (-2 * dx * dy) / r4;
        
        // Rotate back
        return {
            u: ur * cos - vr * sin,
            v: ur * sin + vr * cos
        };
    }

    getParams() {
        return {
            x: { value: this.x, min: -10, max: 10, step: 0.1, label: 'Position X' },
            y: { value: this.y, min: -10, max: 10, step: 0.1, label: 'Position Y' },
            kappa: { value: this.kappa, min: 0.1, max: 20, step: 0.1, label: 'Strength (κ)' },
            angle: { value: this.angle * 180 / Math.PI, min: -180, max: 180, step: 1, label: 'Angle (°)' }
        };
    }

    setParams(params) {
        if (params.x !== undefined) this.x = params.x;
        if (params.y !== undefined) this.y = params.y;
        if (params.kappa !== undefined) this.kappa = params.kappa;
        if (params.angle !== undefined) this.angle = params.angle * Math.PI / 180;
    }

    clone() {
        return new Doublet(this.x, this.y, this.kappa, this.angle);
    }

    getName() {
        return `Doublet κ=${this.kappa.toFixed(2)}`;
    }
}

/**
 * Irrotational Vortex
 * ψ = (Γ / 2π) * ln(r)
 * φ = (Γ / 2π) * θ
 * Γ > 0 for counterclockwise rotation
 */
class Vortex extends FlowElement {
    constructor(x = 0, y = 0, gamma = 1) {
        super('vortex', x, y);
        this.gamma = gamma;  // Circulation strength
    }

    psi(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        return (this.gamma / MathUtils.TWO_PI) * MathUtils.safeLog(r);
    }

    phi(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const theta = MathUtils.safeAtan2(dy, dx);
        return (this.gamma / MathUtils.TWO_PI) * theta;
    }

    velocity(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < MathUtils.EPSILON) {
            return { u: 0, v: 0 };
        }
        
        const factor = this.gamma / (MathUtils.TWO_PI * r2);
        return {
            u: -factor * dy,
            v: factor * dx
        };
    }

    getParams() {
        return {
            x: { value: this.x, min: -10, max: 10, step: 0.1, label: 'Position X' },
            y: { value: this.y, min: -10, max: 10, step: 0.1, label: 'Position Y' },
            gamma: { value: this.gamma, min: -10, max: 10, step: 0.1, label: 'Circulation (Γ)' }
        };
    }

    setParams(params) {
        if (params.x !== undefined) this.x = params.x;
        if (params.y !== undefined) this.y = params.y;
        if (params.gamma !== undefined) this.gamma = params.gamma;
    }

    clone() {
        return new Vortex(this.x, this.y, this.gamma);
    }

    getName() {
        return `Vortex Γ=${this.gamma.toFixed(2)}`;
    }
}

/**
 * Flow Element Factory
 */
const FlowElementFactory = {
    create(type, params = {}) {
        switch (type) {
            case 'uniform':
                return new UniformFlow(params.U || 1, params.alpha || 0);
            case 'source':
                return new SourceSink(params.x || 0, params.y || 0, Math.abs(params.m || 1));
            case 'sink':
                return new SourceSink(params.x || 0, params.y || 0, -Math.abs(params.m || 1));
            case 'doublet':
                return new Doublet(params.x || 0, params.y || 0, params.kappa || 1, params.angle || 0);
            case 'vortex':
                return new Vortex(params.x || 0, params.y || 0, params.gamma || 1);
            default:
                console.warn(`Unknown flow element type: ${type}`);
                return null;
        }
    },

    getTypes() {
        return ['uniform', 'source', 'sink', 'doublet', 'vortex'];
    },

    getTypeInfo(type) {
        const info = {
            uniform: { name: 'Uniform Flow', icon: '→', description: 'Constant velocity field' },
            source: { name: 'Source', icon: '⊕', description: 'Radial outward flow' },
            sink: { name: 'Sink', icon: '⊖', description: 'Radial inward flow' },
            doublet: { name: 'Doublet', icon: '⊛', description: 'Source-sink pair at same point' },
            vortex: { name: 'Vortex', icon: '🌀', description: 'Irrotational circular flow' }
        };
        return info[type] || { name: type, icon: '?', description: '' };
    }
};

// Export classes and factory
window.FlowElement = FlowElement;
window.UniformFlow = UniformFlow;
window.SourceSink = SourceSink;
window.Doublet = Doublet;
window.Vortex = Vortex;
window.FlowElementFactory = FlowElementFactory;
