/**
 * Flow field implementations for various fluid mechanics scenarios
 */

class FlowField {
    constructor() {
        this.parameters = {};
        this.time = 0;
        this.bounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    }

    getVelocity(x, y) {
        // Ensure we return valid numbers
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return { x: 0, y: 0 };
        }
        return { x: 0, y: 0 };
    }

    getPressure(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return 0;
        }
        return 0;
    }

    getStreamFunction(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return 0;
        }
        return 0;
    }

    getVelocityPotential(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return 0;
        }
        return 0;
    }

    update(dt) {
        this.time += dt;
    }
}

// Uniform Flow
class UniformFlow extends FlowField {
    constructor(U = 1, angle = 0) {
        super();
        this.parameters = { U, angle };
        console.log('UniformFlow created with U=', U, 'angle=', angle);
    }

    getVelocity(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return { x: 0, y: 0 };
        }
        
        const { U, angle } = this.parameters;
        const u = MathUtils.isValidNumber(U) ? U : 1;
        const a = MathUtils.isValidNumber(angle) ? angle : 0;
        
        const vel = {
            x: u * Math.cos(a),
            y: u * Math.sin(a)
        };
        
        return vel;
    }

    getStreamFunction(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return 0;
        }
        
        const { U, angle } = this.parameters;
        const u = MathUtils.isValidNumber(U) ? U : 1;
        const a = MathUtils.isValidNumber(angle) ? angle : 0;
        
        return u * (y * Math.cos(a) - x * Math.sin(a));
    }

    getVelocityPotential(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return 0;
        }
        
        const { U, angle } = this.parameters;
        const u = MathUtils.isValidNumber(U) ? U : 1;
        const a = MathUtils.isValidNumber(angle) ? angle : 0;
        
        return u * (x * Math.cos(a) + y * Math.sin(a));
    }

    getPressure(x, y) {
        if (!MathUtils.isValidNumber(x) || !MathUtils.isValidNumber(y)) {
            return 0;
        }
        
        // Bernoulli's equation: P + 0.5*ρ*V² = constant
        const vel = this.getVelocity(x, y);
        const velMag = MathUtils.magnitude(vel);
        const pressure = -0.5 * velMag * velMag; // Assuming ρ = 1, reference pressure = 0
        
        return MathUtils.isValidNumber(pressure) ? pressure : 0;
    }
}

// Source/Sink Flow
class SourceFlow extends FlowField {
    constructor(m = 1, x0 = 0, y0 = 0) {
        super();
        this.parameters = { m, x0, y0 };
    }

    getVelocity(x, y) {
        const { m, x0, y0 } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r = Math.sqrt(dx * dx + dy * dy);
        
        if (r < 1e-6) return { x: 0, y: 0 };
        
        const factor = m / (2 * Math.PI * r);
        return {
            x: factor * dx / r,
            y: factor * dy / r
        };
    }

    getStreamFunction(x, y) {
        const { m, x0, y0 } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        return (m / (2 * Math.PI)) * Math.atan2(dy, dx);
    }

    getVelocityPotential(x, y) {
        const { m, x0, y0 } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r = Math.sqrt(dx * dx + dy * dy);
        return (m / (2 * Math.PI)) * Math.log(Math.max(r, 1e-6));
    }
}

// Irrotational Vortex
class VortexFlow extends FlowField {
    constructor(gamma = 1, x0 = 0, y0 = 0) {
        super();
        this.parameters = { gamma, x0, y0 };
    }

    getVelocity(x, y) {
        const { gamma, x0, y0 } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < 1e-6) return { x: 0, y: 0 };
        
        const factor = gamma / (2 * Math.PI * r2);
        return {
            x: -factor * dy,
            y: factor * dx
        };
    }

    getStreamFunction(x, y) {
        const { gamma, x0, y0 } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r = Math.sqrt(dx * dx + dy * dy);
        return -(gamma / (2 * Math.PI)) * Math.log(Math.max(r, 1e-6));
    }

    getVelocityPotential(x, y) {
        const { gamma, x0, y0 } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        return (gamma / (2 * Math.PI)) * Math.atan2(dy, dx);
    }
}

// Doublet Flow
class DoubletFlow extends FlowField {
    constructor(kappa = 1, x0 = 0, y0 = 0, angle = 0) {
        super();
        this.parameters = { kappa, x0, y0, angle };
    }

    getVelocity(x, y) {
        const { kappa, x0, y0, angle } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r2 = dx * dx + dy * dy;
        
        if (r2 < 1e-6) return { x: 0, y: 0 };
        
        const cos_theta = Math.cos(angle);
        const sin_theta = Math.sin(angle);
        const cos_phi = dx / Math.sqrt(r2);
        const sin_phi = dy / Math.sqrt(r2);
        
        const factor = kappa / (2 * Math.PI * r2);
        const cos_diff = cos_phi * cos_theta + sin_phi * sin_theta;
        
        return {
            x: factor * (cos_theta - 2 * cos_diff * cos_phi) / Math.sqrt(r2),
            y: factor * (sin_theta - 2 * cos_diff * sin_phi) / Math.sqrt(r2)
        };
    }

    getStreamFunction(x, y) {
        const { kappa, x0, y0, angle } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r = Math.sqrt(dx * dx + dy * dy);
        
        if (r < 1e-6) return 0;
        
        const cos_theta = Math.cos(angle);
        const sin_theta = Math.sin(angle);
        return -(kappa / (2 * Math.PI)) * (cos_theta * dy - sin_theta * dx) / r;
    }

    getVelocityPotential(x, y) {
        const { kappa, x0, y0, angle } = this.parameters;
        const dx = x - x0;
        const dy = y - y0;
        const r = Math.sqrt(dx * dx + dy * dy);
        
        if (r < 1e-6) return 0;
        
        const cos_theta = Math.cos(angle);
        const sin_theta = Math.sin(angle);
        return (kappa / (2 * Math.PI)) * (cos_theta * dx + sin_theta * dy) / r;
    }
}

// Superposition Flow: Half-Body (Uniform + Source)
class HalfBodyFlow extends FlowField {
    constructor(U = 1, m = 1, x0 = -1, y0 = 0) {
        super();
        this.parameters = { U, m, x0, y0 };
        this.uniform = new UniformFlow(U, 0);
        this.source = new SourceFlow(m, x0, y0);
    }

    getVelocity(x, y) {
        const vel1 = this.uniform.getVelocity(x, y);
        const vel2 = this.source.getVelocity(x, y);
        return MathUtils.add(vel1, vel2);
    }

    getStreamFunction(x, y) {
        return this.uniform.getStreamFunction(x, y) + this.source.getStreamFunction(x, y);
    }

    getVelocityPotential(x, y) {
        return this.uniform.getVelocityPotential(x, y) + this.source.getVelocityPotential(x, y);
    }
}

// Flow Around Cylinder (Uniform + Doublet)
class CylinderFlow extends FlowField {
    constructor(U = 1, R = 1, x0 = 0, y0 = 0) {
        super();
        this.parameters = { U, R, x0, y0 };
        this.uniform = new UniformFlow(U, 0);
        this.doublet = new DoubletFlow(U * R * R, x0, y0, Math.PI);
    }

    getVelocity(x, y) {
        const vel1 = this.uniform.getVelocity(x, y);
        const vel2 = this.doublet.getVelocity(x, y);
        return MathUtils.add(vel1, vel2);
    }

    getStreamFunction(x, y) {
        return this.uniform.getStreamFunction(x, y) + this.doublet.getStreamFunction(x, y);
    }

    getVelocityPotential(x, y) {
        return this.uniform.getVelocityPotential(x, y) + this.doublet.getVelocityPotential(x, y);
    }

    getPressure(x, y) {
        const vel = this.getVelocity(x, y);
        const velMag = MathUtils.magnitude(vel);
        return -0.5 * velMag * velMag;
    }
}

// Cylinder with Circulation (Uniform + Doublet + Vortex)
class CylinderCirculationFlow extends FlowField {
    constructor(U = 1, R = 1, gamma = 2, x0 = 0, y0 = 0) {
        super();
        this.parameters = { U, R, gamma, x0, y0 };
        this.uniform = new UniformFlow(U, 0);
        this.doublet = new DoubletFlow(U * R * R, x0, y0, Math.PI);
        this.vortex = new VortexFlow(gamma, x0, y0);
    }

    getVelocity(x, y) {
        const vel1 = this.uniform.getVelocity(x, y);
        const vel2 = this.doublet.getVelocity(x, y);
        const vel3 = this.vortex.getVelocity(x, y);
        return MathUtils.add(MathUtils.add(vel1, vel2), vel3);
    }

    getStreamFunction(x, y) {
        return this.uniform.getStreamFunction(x, y) + 
               this.doublet.getStreamFunction(x, y) + 
               this.vortex.getStreamFunction(x, y);
    }

    getLift() {
        // Kutta-Joukowski theorem: L = ρ * U * Γ (per unit depth)
        const { U, gamma } = this.parameters;
        return U * gamma; // Assuming ρ = 1
    }
}

// Poiseuille Flow (Viscous Channel Flow)
class PoiseuilleFlow extends FlowField {
    constructor(dpdk = -1, mu = 0.001, h = 1) {
        super();
        this.parameters = { dpdk: dpdk, mu, h }; // dpdk = pressure gradient
    }

    getVelocity(x, y) {
        const { dpdk, mu, h } = this.parameters;
        // Parabolic velocity profile: u(y) = -(1/2μ)(dp/dx)(y² - h²)
        const u = -(1 / (2 * mu)) * dpdk * (y * y - h * h);
        return { x: Math.max(0, u), y: 0 };
    }

    getStreamFunction(x, y) {
        const vel = this.getVelocity(0, y);
        return vel.x * y;
    }

    getPressure(x, y) {
        const { dpdk } = this.parameters;
        return dpdk * x; // Linear pressure drop
    }
}

// Couette Flow (Viscous Shear Flow)
class CouetteFlow extends FlowField {
    constructor(U = 1, dpdk = 0, mu = 0.001, h = 1) {
        super();
        this.parameters = { U, dpdk, mu, h };
    }

    getVelocity(x, y) {
        const { U, dpdk, mu, h } = this.parameters;
        // Linear velocity profile with pressure gradient
        const u = U * (y + h) / (2 * h) + (1 / (2 * mu)) * dpdk * (y * y - h * h);
        return { x: u, y: 0 };
    }

    getStreamFunction(x, y) {
        const vel = this.getVelocity(0, y);
        return vel.x * y;
    }

    getPressure(x, y) {
        const { dpdk } = this.parameters;
        return dpdk * x;
    }
}

// Custom Flow Field (User-defined equations)
class CustomFlow extends FlowField {
    constructor() {
        super();
        this.userEquations = {
            u: '1',
            v: '0'
        };
        this.compiledU = null;
        this.compiledV = null;
    }

    setEquations(uEquation, vEquation) {
        this.userEquations.u = uEquation;
        this.userEquations.v = vEquation;
        
        // Simple equation parser/evaluator
        try {
            this.compiledU = this.compileEquation(uEquation);
            this.compiledV = this.compileEquation(vEquation);
        } catch (e) {
            console.warn('Error compiling equations:', e);
            this.compiledU = () => 0;
            this.compiledV = () => 0;
        }
    }

    compileEquation(equation) {
        // Replace common mathematical notation
        let code = equation
            .replace(/\bx\b/g, 'args.x')
            .replace(/\by\b/g, 'args.y')
            .replace(/\bt\b/g, 'args.t')
            .replace(/sin/g, 'Math.sin')
            .replace(/cos/g, 'Math.cos')
            .replace(/tan/g, 'Math.tan')
            .replace(/exp/g, 'Math.exp')
            .replace(/log/g, 'Math.log')
            .replace(/sqrt/g, 'Math.sqrt')
            .replace(/pi/g, 'Math.PI')
            .replace(/\^/g, '**');

        return new Function('args', `return ${code}`);
    }

    getVelocity(x, y) {
        if (!this.compiledU || !this.compiledV) {
            return { x: 0, y: 0 };
        }

        try {
            const args = { x, y, t: this.time };
            return {
                x: this.compiledU(args),
                y: this.compiledV(args)
            };
        } catch (e) {
            return { x: 0, y: 0 };
        }
    }
}

// Flow factory for creating different flow types
class FlowFactory {
    static createFlow(type, parameters = {}) {
        switch (type) {
            case 'uniform':
                return new UniformFlow(parameters.U, parameters.angle);
            case 'source':
                return new SourceFlow(parameters.m, parameters.x0, parameters.y0);
            case 'vortex':
                return new VortexFlow(parameters.gamma, parameters.x0, parameters.y0);
            case 'doublet':
                return new DoubletFlow(parameters.kappa, parameters.x0, parameters.y0, parameters.angle);
            case 'halfbody':
                return new HalfBodyFlow(parameters.U, parameters.m, parameters.x0, parameters.y0);
            case 'cylinder':
                return new CylinderFlow(parameters.U, parameters.R, parameters.x0, parameters.y0);
            case 'cylinderCirc':
                return new CylinderCirculationFlow(parameters.U, parameters.R, parameters.gamma, parameters.x0, parameters.y0);
            case 'poiseuille':
                return new PoiseuilleFlow(parameters.dpdk, parameters.mu, parameters.h);
            case 'couette':
                return new CouetteFlow(parameters.U, parameters.dpdk, parameters.mu, parameters.h);
            case 'custom':
                return new CustomFlow();
            default:
                return new UniformFlow();
        }
    }

    static getDefaultParameters(type) {
        const defaults = {
            uniform: { U: 1, angle: 0 },
            source: { m: 2, x0: 0, y0: 0 },
            vortex: { gamma: 2, x0: 0, y0: 0 },
            doublet: { kappa: 2, x0: 0, y0: 0, angle: 0 },
            halfbody: { U: 1, m: 2, x0: -1, y0: 0 },
            cylinder: { U: 1, R: 1, x0: 0, y0: 0 },
            cylinderCirc: { U: 1, R: 1, gamma: 4, x0: 0, y0: 0 },
            poiseuille: { dpdk: -1, mu: 0.001, h: 1 },
            couette: { U: 1, dpdk: 0, mu: 0.001, h: 1 },
            custom: {}
        };
        return defaults[type] || {};
    }
}

// Export classes
window.FlowField = FlowField;
window.FlowFactory = FlowFactory;
window.CustomFlow = CustomFlow;