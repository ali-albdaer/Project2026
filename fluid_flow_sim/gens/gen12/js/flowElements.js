/**
 * Flow Elements
 * Elementary potential flow solutions
 */

import { Vec2, toRadians } from './math.js';
import { generateElementId } from './config.js';

/**
 * Base class for all flow elements
 */
export class FlowElement {
    constructor(type, x = 0, y = 0) {
        this.id = generateElementId();
        this.type = type;
        this.x = x;
        this.y = y;
        this.enabled = true;
        this.selected = false;
    }
    
    // Get velocity at a point (to be overridden)
    getVelocity(px, py) {
        return new Vec2(0, 0);
    }
    
    // Get stream function value (to be overridden)
    getStreamFunction(px, py) {
        return 0;
    }
    
    // Get potential function value (to be overridden)
    getPotentialFunction(px, py) {
        return 0;
    }
    
    // Get display name
    getDisplayName() {
        return this.type;
    }
    
    // Get parameters for editing
    getParams() {
        return { x: this.x, y: this.y };
    }
    
    // Clone element
    clone() {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }
    
    // Check if point is near element center (for selection)
    isNear(px, py, threshold = 20) {
        const dx = px - this.x;
        const dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
    }
    
    // Serialize to JSON
    toJSON() {
        return {
            type: this.type,
            x: this.x,
            y: this.y,
            enabled: this.enabled,
            ...this.getParams()
        };
    }
}

/**
 * Uniform Flow
 * V = U * (cos(α), sin(α))
 * ψ = U * (y*cos(α) - x*sin(α))
 * φ = U * (x*cos(α) + y*sin(α))
 */
export class UniformFlow extends FlowElement {
    constructor(U = 1, alpha = 0, x = 0, y = 0) {
        super('uniform', x, y);
        this.U = U;           // Velocity magnitude
        this.alpha = alpha;   // Angle in degrees
    }
    
    getVelocity(px, py) {
        if (!this.enabled) return new Vec2(0, 0);
        const rad = toRadians(this.alpha);
        return new Vec2(
            this.U * Math.cos(rad),
            this.U * Math.sin(rad)
        );
    }
    
    getStreamFunction(px, py) {
        if (!this.enabled) return 0;
        const rad = toRadians(this.alpha);
        return this.U * (py * Math.cos(rad) - px * Math.sin(rad));
    }
    
    getPotentialFunction(px, py) {
        if (!this.enabled) return 0;
        const rad = toRadians(this.alpha);
        return this.U * (px * Math.cos(rad) + py * Math.sin(rad));
    }
    
    getDisplayName() {
        return `Uniform (U=${this.U.toFixed(2)}, α=${this.alpha.toFixed(1)}°)`;
    }
    
    getParams() {
        return { U: this.U, alpha: this.alpha };
    }
    
    // Uniform flow spawns particles from the inflow edge
    getSpawnPosition(canvasWidth, canvasHeight, viewTransform) {
        const rad = toRadians(this.alpha);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // Spawn from the edge opposite to flow direction
        let spawnX, spawnY;
        
        if (Math.abs(cos) > Math.abs(sin)) {
            // Horizontal dominant flow
            spawnX = cos > 0 ? -canvasWidth/2 : canvasWidth/2;
            spawnY = (Math.random() - 0.5) * canvasHeight;
        } else {
            // Vertical dominant flow
            spawnX = (Math.random() - 0.5) * canvasWidth;
            spawnY = sin > 0 ? -canvasHeight/2 : canvasHeight/2;
        }
        
        // Transform from view to world coordinates
        return new Vec2(
            (spawnX - viewTransform.panX) / viewTransform.zoom,
            (spawnY - viewTransform.panY) / viewTransform.zoom
        );
    }
}

/**
 * Source/Sink Flow
 * m > 0: Source (outward flow)
 * m < 0: Sink (inward flow)
 * Vr = m / (2π * r)
 * ψ = m * θ / (2π)
 * φ = m * ln(r) / (2π)
 */
export class SourceSink extends FlowElement {
    constructor(m = 10, x = 0, y = 0) {
        super(m >= 0 ? 'source' : 'sink', x, y);
        this.m = m;  // Strength (positive = source, negative = sink)
    }
    
    getVelocity(px, py) {
        if (!this.enabled) return new Vec2(0, 0);
        
        const dx = px - this.x;
        const dy = py - this.y;
        const rSq = dx * dx + dy * dy;
        
        // Avoid singularity
        if (rSq < 1) return new Vec2(0, 0);
        
        const factor = this.m / (2 * Math.PI * rSq);
        return new Vec2(factor * dx, factor * dy);
    }
    
    getStreamFunction(px, py) {
        if (!this.enabled) return 0;
        const dx = px - this.x;
        const dy = py - this.y;
        return this.m * Math.atan2(dy, dx) / (2 * Math.PI);
    }
    
    getPotentialFunction(px, py) {
        if (!this.enabled) return 0;
        const dx = px - this.x;
        const dy = py - this.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 0.001) return 0;
        return this.m * Math.log(r) / (2 * Math.PI);
    }
    
    getDisplayName() {
        const type = this.m >= 0 ? 'Source' : 'Sink';
        return `${type} (m=${this.m.toFixed(2)})`;
    }
    
    getParams() {
        return { m: this.m };
    }
    
    // Source spawns particles from its center
    getSpawnPosition() {
        if (this.m > 0) {  // Only sources spawn
            const angle = Math.random() * Math.PI * 2;
            const r = 5;  // Small radius from center
            return new Vec2(
                this.x + Math.cos(angle) * r,
                this.y + Math.sin(angle) * r
            );
        }
        return null;
    }
    
    // Check if particle should be destroyed (for sinks)
    shouldDestroyParticle(px, py, threshold = 10) {
        if (this.m < 0) {  // Only sinks destroy
            const dx = px - this.x;
            const dy = py - this.y;
            return Math.sqrt(dx * dx + dy * dy) < threshold;
        }
        return false;
    }
}

/**
 * Doublet (Dipole)
 * Created by superposition of source and sink at same location
 * κ = strength
 * Vr = -κ * cos(θ) / (2π * r²)
 * Vθ = -κ * sin(θ) / (2π * r²)
 * ψ = -κ * sin(θ) / (2π * r) = -κ * y / (2π * r²)
 * φ = κ * cos(θ) / (2π * r) = κ * x / (2π * r²)
 */
export class Doublet extends FlowElement {
    constructor(kappa = 100, x = 0, y = 0, angle = 0) {
        super('doublet', x, y);
        this.kappa = kappa;  // Doublet strength
        this.angle = angle;  // Orientation angle in degrees
    }
    
    getVelocity(px, py) {
        if (!this.enabled) return new Vec2(0, 0);
        
        const rad = toRadians(this.angle);
        const cos_a = Math.cos(rad);
        const sin_a = Math.sin(rad);
        
        // Rotate point to doublet's local coordinate system
        const dx = px - this.x;
        const dy = py - this.y;
        const localX = dx * cos_a + dy * sin_a;
        const localY = -dx * sin_a + dy * cos_a;
        
        const rSq = localX * localX + localY * localY;
        
        // Avoid singularity
        if (rSq < 1) return new Vec2(0, 0);
        
        const r4 = rSq * rSq;
        const factor = this.kappa / (2 * Math.PI * r4);
        
        // Velocity in local coordinates
        const vxLocal = factor * (localY * localY - localX * localX);
        const vyLocal = -2 * factor * localX * localY;
        
        // Rotate back to global coordinates
        return new Vec2(
            vxLocal * cos_a - vyLocal * sin_a,
            vxLocal * sin_a + vyLocal * cos_a
        );
    }
    
    getStreamFunction(px, py) {
        if (!this.enabled) return 0;
        
        const rad = toRadians(this.angle);
        const dx = px - this.x;
        const dy = py - this.y;
        
        // Rotate to local coordinates
        const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
        
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.001) return 0;
        
        return -this.kappa * localY / (2 * Math.PI * rSq);
    }
    
    getPotentialFunction(px, py) {
        if (!this.enabled) return 0;
        
        const rad = toRadians(this.angle);
        const dx = px - this.x;
        const dy = py - this.y;
        
        // Rotate to local coordinates
        const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
        
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.001) return 0;
        
        return this.kappa * localX / (2 * Math.PI * rSq);
    }
    
    getDisplayName() {
        return `Doublet (κ=${this.kappa.toFixed(1)}, θ=${this.angle.toFixed(1)}°)`;
    }
    
    getParams() {
        return { kappa: this.kappa, angle: this.angle };
    }
}

/**
 * Irrotational Vortex (Free Vortex)
 * Γ > 0: Counter-clockwise
 * Γ < 0: Clockwise
 * Vθ = Γ / (2π * r)
 * ψ = -Γ * ln(r) / (2π)
 * φ = Γ * θ / (2π)
 */
export class Vortex extends FlowElement {
    constructor(gamma = 50, x = 0, y = 0) {
        super('vortex', x, y);
        this.gamma = gamma;  // Circulation (positive = CCW)
    }
    
    getVelocity(px, py) {
        if (!this.enabled) return new Vec2(0, 0);
        
        const dx = px - this.x;
        const dy = py - this.y;
        const rSq = dx * dx + dy * dy;
        
        // Avoid singularity
        if (rSq < 1) return new Vec2(0, 0);
        
        const factor = this.gamma / (2 * Math.PI * rSq);
        // Tangential velocity (perpendicular to radial direction)
        return new Vec2(-factor * dy, factor * dx);
    }
    
    getStreamFunction(px, py) {
        if (!this.enabled) return 0;
        const dx = px - this.x;
        const dy = py - this.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 0.001) return 0;
        return -this.gamma * Math.log(r) / (2 * Math.PI);
    }
    
    getPotentialFunction(px, py) {
        if (!this.enabled) return 0;
        const dx = px - this.x;
        const dy = py - this.y;
        return this.gamma * Math.atan2(dy, dx) / (2 * Math.PI);
    }
    
    getDisplayName() {
        const dir = this.gamma >= 0 ? 'CCW' : 'CW';
        return `Vortex ${dir} (Γ=${this.gamma.toFixed(1)})`;
    }
    
    getParams() {
        return { gamma: this.gamma };
    }
}

/**
 * Create element from type string
 */
export function createElement(type, params = {}) {
    switch (type) {
        case 'uniform':
            return new UniformFlow(
                params.U ?? 1,
                params.alpha ?? 0,
                params.x ?? 0,
                params.y ?? 0
            );
        case 'source':
            return new SourceSink(
                Math.abs(params.m ?? 10),
                params.x ?? 0,
                params.y ?? 0
            );
        case 'sink':
            return new SourceSink(
                -Math.abs(params.m ?? 10),
                params.x ?? 0,
                params.y ?? 0
            );
        case 'doublet':
            return new Doublet(
                params.kappa ?? 100,
                params.x ?? 0,
                params.y ?? 0,
                params.angle ?? 0
            );
        case 'vortex':
            return new Vortex(
                params.gamma ?? 50,
                params.x ?? 0,
                params.y ?? 0
            );
        default:
            console.warn(`Unknown element type: ${type}`);
            return null;
    }
}

/**
 * Get superposed velocity at a point from multiple elements
 */
export function getSuperposedVelocity(elements, px, py) {
    let vx = 0;
    let vy = 0;
    
    for (const element of elements) {
        if (!element.enabled) continue;
        const v = element.getVelocity(px, py);
        vx += v.x;
        vy += v.y;
    }
    
    return new Vec2(vx, vy);
}

/**
 * Get superposed stream function at a point
 */
export function getSuperposedStreamFunction(elements, px, py) {
    let psi = 0;
    
    for (const element of elements) {
        if (!element.enabled) continue;
        psi += element.getStreamFunction(px, py);
    }
    
    return psi;
}

/**
 * Get superposed potential function at a point
 */
export function getSuperposedPotentialFunction(elements, px, py) {
    let phi = 0;
    
    for (const element of elements) {
        if (!element.enabled) continue;
        phi += element.getPotentialFunction(px, py);
    }
    
    return phi;
}

/**
 * Element parameter definitions for UI
 */
export const elementParamDefs = {
    uniform: [
        { key: 'U', label: 'Velocity (U)', min: -10, max: 10, step: 0.1, default: 1 },
        { key: 'alpha', label: 'Angle (α°)', min: -180, max: 180, step: 1, default: 0 }
    ],
    source: [
        { key: 'm', label: 'Strength (m)', min: 0.1, max: 100, step: 0.5, default: 10 }
    ],
    sink: [
        { key: 'm', label: 'Strength (|m|)', min: 0.1, max: 100, step: 0.5, default: 10, negate: true }
    ],
    doublet: [
        { key: 'kappa', label: 'Strength (κ)', min: 1, max: 500, step: 5, default: 100 },
        { key: 'angle', label: 'Angle (θ°)', min: -180, max: 180, step: 1, default: 0 }
    ],
    vortex: [
        { key: 'gamma', label: 'Circulation (Γ)', min: -200, max: 200, step: 1, default: 50 }
    ]
};
