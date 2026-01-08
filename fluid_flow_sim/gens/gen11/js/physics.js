/**
 * Physics Module
 * Navier-Stokes solver and fluid dynamics calculations
 */

import { Vector2, MathUtils } from './utils.js';

/**
 * Fluid properties and physics parameters
 */
export class FluidProperties {
    constructor() {
        this.viscosity = 0.01;      // Kinematic viscosity (ν)
        this.density = 1.0;          // Fluid density (ρ)
        this.temperature = 300;      // Temperature in Kelvin
        this.timeScale = 1.0;        // Simulation time scale
        
        // Derived properties
        this.updateDerivedProperties();
    }

    updateDerivedProperties() {
        // Dynamic viscosity μ = ρν
        this.dynamicViscosity = this.density * this.viscosity;
        
        // Temperature affects viscosity (Sutherland's law approximation for gases)
        // For liquids, viscosity decreases with temperature
        const T0 = 300; // Reference temperature
        const tempRatio = this.temperature / T0;
        this.effectiveViscosity = this.viscosity * Math.pow(tempRatio, -0.5);
    }

    setViscosity(nu) {
        this.viscosity = nu;
        this.updateDerivedProperties();
    }

    setDensity(rho) {
        this.density = rho;
        this.updateDerivedProperties();
    }

    setTemperature(T) {
        this.temperature = T;
        this.updateDerivedProperties();
    }

    setTimeScale(scale) {
        this.timeScale = scale;
    }
}

/**
 * Navier-Stokes Physics Solver
 * 
 * Applies viscous effects to the potential flow solution.
 * The base flow from flow elements is inviscid; this adds
 * viscous corrections.
 */
export class NavierStokesSolver {
    constructor(flowManager, fluidProperties) {
        this.flowManager = flowManager;
        this.fluid = fluidProperties;
        
        // Grid for pressure and vorticity calculations
        this.gridSize = 50;
        this.vorticityField = null;
        this.pressureField = null;
        
        // Cache for performance
        this.lastUpdateTime = 0;
        this.updateInterval = 0.1; // Update fields every 100ms
    }

    setFlowManager(flowManager) {
        this.flowManager = flowManager;
    }

    /**
     * Get velocity with viscous corrections
     * For low Reynolds number flows, viscosity smooths velocity gradients
     */
    getVelocityWithViscosity(x, y, baseVelocity) {
        if (this.fluid.effectiveViscosity < 0.001) {
            return baseVelocity;
        }

        // Simple viscous damping model
        // In reality, this would require solving the full NS equations
        // For real-time performance, we use a simplified approach
        
        const dampingFactor = 1 / (1 + this.fluid.effectiveViscosity * 0.5);
        return Vector2.scale(baseVelocity, dampingFactor);
    }

    /**
     * Calculate pressure at a point using Bernoulli's equation
     * p + 0.5ρV² = constant (for inviscid, incompressible flow)
     */
    getPressure(x, y, velocity = null) {
        if (!velocity) {
            velocity = this.flowManager.getVelocityAt(x, y);
        }
        
        const V2 = velocity.lengthSquared();
        const p_stagnation = 101325; // Reference stagnation pressure (Pa)
        
        // Bernoulli: p = p_stag - 0.5 * ρ * V²
        const pressure = p_stagnation - 0.5 * this.fluid.density * V2;
        
        // Add viscous correction (simplified)
        const viscousCorrection = -this.fluid.effectiveViscosity * V2 * 0.1;
        
        return pressure + viscousCorrection;
    }

    /**
     * Calculate vorticity (curl of velocity) at a point
     * ω = ∂v/∂x - ∂u/∂y
     */
    getVorticity(x, y) {
        const h = 0.5; // Finite difference step
        
        const vRight = this.flowManager.getVelocityAt(x + h, y);
        const vLeft = this.flowManager.getVelocityAt(x - h, y);
        const vUp = this.flowManager.getVelocityAt(x, y + h);
        const vDown = this.flowManager.getVelocityAt(x, y - h);
        
        const dvdx = (vRight.y - vLeft.y) / (2 * h);
        const dudy = (vUp.x - vDown.x) / (2 * h);
        
        return dvdx - dudy;
    }

    /**
     * Get local Reynolds number
     * Re = ρVL/μ = VL/ν
     */
    getReynoldsNumber(x, y, characteristicLength = 1) {
        const velocity = this.flowManager.getVelocityAt(x, y);
        const V = velocity.length();
        return (V * characteristicLength) / this.fluid.effectiveViscosity;
    }

    /**
     * Get all flow properties at a point
     */
    getPropertiesAt(x, y) {
        const velocity = this.flowManager.getVelocityAt(x, y);
        const speed = velocity.length();
        
        return {
            position: new Vector2(x, y),
            velocity: velocity,
            speed: speed,
            pressure: this.getPressure(x, y, velocity),
            vorticity: this.getVorticity(x, y),
            streamFunction: this.flowManager.getStreamFunctionAt(x, y),
            potential: this.flowManager.getPotentialAt(x, y),
            density: this.fluid.density,
            temperature: this.fluid.temperature,
            viscosity: this.fluid.effectiveViscosity,
            reynolds: speed > 0.01 ? this.getReynoldsNumber(x, y) : 0
        };
    }

    /**
     * Calculate pressure coefficient
     * Cp = (p - p∞) / (0.5 * ρ * V∞²)
     */
    getPressureCoefficient(x, y, freestreamVelocity) {
        const V_inf = freestreamVelocity;
        if (V_inf < 0.01) return 0;
        
        const velocity = this.flowManager.getVelocityAt(x, y);
        const V = velocity.length();
        
        // Cp = 1 - (V/V∞)²
        return 1 - (V * V) / (V_inf * V_inf);
    }

    /**
     * Apply viscous diffusion to particle velocity
     * This simulates momentum diffusion due to viscosity
     */
    applyViscousDiffusion(particle, dt, neighbors = []) {
        if (this.fluid.effectiveViscosity < 0.001) return;
        
        // Simple SPH-like viscous diffusion
        // In a full implementation, this would interact with neighboring particles
        const dampingRate = this.fluid.effectiveViscosity * 10;
        const damping = Math.exp(-dampingRate * dt);
        particle.velocity.scale(damping);
    }

    /**
     * Update field caches (for visualization)
     */
    updateFields(bounds, time) {
        if (time - this.lastUpdateTime < this.updateInterval) return;
        this.lastUpdateTime = time;
        
        // Update vorticity and pressure fields for visualization
        // This is optional and used for field rendering
    }
}

/**
 * Streamline generator
 * Computes streamlines through numerical integration
 */
export class StreamlineGenerator {
    constructor(flowManager) {
        this.flowManager = flowManager;
        this.maxSteps = 500;
        this.stepSize = 2;
        this.minVelocity = 0.01;
    }

    setFlowManager(flowManager) {
        this.flowManager = flowManager;
    }

    /**
     * Generate a streamline starting from a point
     * Uses RK4 integration
     */
    generateStreamline(startX, startY, direction = 1, bounds = null) {
        const points = [new Vector2(startX, startY)];
        let x = startX;
        let y = startY;
        
        for (let i = 0; i < this.maxSteps; i++) {
            // RK4 integration
            const k1 = this.getVelocityNormalized(x, y);
            if (!k1 || k1.isZero(this.minVelocity)) break;
            
            const k2 = this.getVelocityNormalized(
                x + 0.5 * this.stepSize * k1.x * direction,
                y + 0.5 * this.stepSize * k1.y * direction
            );
            if (!k2) break;
            
            const k3 = this.getVelocityNormalized(
                x + 0.5 * this.stepSize * k2.x * direction,
                y + 0.5 * this.stepSize * k2.y * direction
            );
            if (!k3) break;
            
            const k4 = this.getVelocityNormalized(
                x + this.stepSize * k3.x * direction,
                y + this.stepSize * k3.y * direction
            );
            if (!k4) break;
            
            // Combine
            const dx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
            const dy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
            
            x += dx * this.stepSize * direction;
            y += dy * this.stepSize * direction;
            
            // Check bounds
            if (bounds) {
                if (x < bounds.left || x > bounds.right || 
                    y < bounds.top || y > bounds.bottom) {
                    break;
                }
            }
            
            // Check for singularity
            if (this.flowManager.isNearSingularity(x, y)) {
                break;
            }
            
            points.push(new Vector2(x, y));
        }
        
        return points;
    }

    /**
     * Get normalized velocity at a point
     */
    getVelocityNormalized(x, y) {
        const v = this.flowManager.getVelocityAt(x, y);
        const len = v.length();
        if (len < this.minVelocity) return null;
        return v.scale(1 / len);
    }

    /**
     * Generate multiple streamlines evenly distributed
     */
    generateStreamlines(bounds, count = 20) {
        const streamlines = [];
        
        // Generate streamlines from left edge
        const spacing = (bounds.bottom - bounds.top) / (count + 1);
        
        for (let i = 1; i <= count; i++) {
            const y = bounds.top + spacing * i;
            
            // Forward streamline
            const forward = this.generateStreamline(bounds.left, y, 1, bounds);
            if (forward.length > 2) {
                streamlines.push(forward);
            }
        }
        
        // Also generate from top edge for better coverage
        const spacingX = (bounds.right - bounds.left) / (count + 1);
        for (let i = 1; i <= count; i++) {
            const x = bounds.left + spacingX * i;
            
            const forward = this.generateStreamline(x, bounds.top, 1, bounds);
            if (forward.length > 2) {
                streamlines.push(forward);
            }
        }
        
        return streamlines;
    }
}

/**
 * Static velocity field generator
 * For displaying velocity arrows across the domain
 */
export class VelocityFieldGenerator {
    constructor(flowManager) {
        this.flowManager = flowManager;
    }

    setFlowManager(flowManager) {
        this.flowManager = flowManager;
    }

    /**
     * Generate velocity field grid
     */
    generateField(bounds, spacing = 40) {
        const field = [];
        
        for (let x = bounds.left; x <= bounds.right; x += spacing) {
            for (let y = bounds.top; y <= bounds.bottom; y += spacing) {
                // Skip singularities
                if (this.flowManager.isNearSingularity(x, y)) continue;
                
                const velocity = this.flowManager.getVelocityAt(x, y);
                const speed = velocity.length();
                
                if (speed > 0.01) {
                    field.push({
                        x: x,
                        y: y,
                        vx: velocity.x,
                        vy: velocity.y,
                        speed: speed
                    });
                }
            }
        }
        
        return field;
    }
}
