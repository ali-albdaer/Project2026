/**
 * Simulation Engine
 * Core physics and Navier-Stokes integration
 */

import { Vec2, numericalGradient, numericalLaplacian, clamp } from './math.js';
import { Config, State } from './config.js';
import { getSuperposedVelocity, getSuperposedStreamFunction, getSuperposedPotentialFunction } from './flowElements.js';
import { ParticleSystem, generateStreamlines, generateStreaklines } from './particles.js';

/**
 * Simulation class manages the physics simulation
 */
export class Simulation {
    constructor() {
        this.particleSystem = new ParticleSystem();
        this.time = 0;
        this.streamlinesCache = [];
        this.streamlinesCacheTime = -1;
        this.staticVectorsCache = [];
        this.staticVectorsCacheTime = -1;
    }
    
    /**
     * Reset simulation
     */
    reset() {
        this.particleSystem.clear();
        this.time = 0;
        this.streamlinesCache = [];
        this.streamlinesCacheTime = -1;
        this.staticVectorsCache = [];
        this.staticVectorsCacheTime = -1;
        State.time = 0;
    }
    
    /**
     * Main update loop
     */
    update(dt) {
        if (!State.isPlaying) return;
        
        // Cap delta time for stability
        dt = Math.min(dt, Config.simulation.maxTimeStep);
        
        // Get bounds
        const bounds = this.getBounds();
        
        // Get fluid properties
        const fluidProps = {
            viscosity: Config.fluid.viscosity,
            temperature: Config.fluid.temperature,
            density: Config.fluid.density
        };
        
        // Substep physics for stability
        const substeps = Config.simulation.substeps;
        const subDt = dt / substeps;
        
        for (let i = 0; i < substeps; i++) {
            this.particleSystem.update(subDt, State.flowElements, bounds, fluidProps);
        }
        
        // Update time
        this.time += dt;
        State.time = this.time;
        
        // Update streamlines cache periodically
        if (Config.visualization.showStreamlines) {
            this.updateStreamlinesCache(bounds);
        }
        
        // Update static vectors cache
        if (Config.visualization.showStaticVectors) {
            this.updateStaticVectorsCache(bounds);
        }
    }
    
    /**
     * Step simulation by one frame
     */
    step() {
        const wasPlaying = State.isPlaying;
        State.isPlaying = true;
        this.update(Config.simulation.timeStep);
        State.isPlaying = wasPlaying;
    }
    
    /**
     * Get simulation bounds
     */
    getBounds() {
        if (Config.boundaries.dynamic) {
            // Use canvas/view bounds
            const canvas = document.getElementById('flowCanvas');
            const halfWidth = (canvas.width / 2) / Config.view.zoom;
            const halfHeight = (canvas.height / 2) / Config.view.zoom;
            
            return {
                minX: -Config.view.panX / Config.view.zoom - halfWidth,
                maxX: -Config.view.panX / Config.view.zoom + halfWidth,
                minY: -Config.view.panY / Config.view.zoom - halfHeight,
                maxY: -Config.view.panY / Config.view.zoom + halfHeight
            };
        } else {
            // Use fixed bounds
            const halfWidth = Config.boundaries.mapWidth / 2;
            const halfHeight = Config.boundaries.mapHeight / 2;
            
            return {
                minX: -halfWidth,
                maxX: halfWidth,
                minY: -halfHeight,
                maxY: halfHeight
            };
        }
    }
    
    /**
     * Update streamlines cache
     */
    updateStreamlinesCache(bounds) {
        // Only regenerate if elements changed or periodically
        const now = performance.now();
        if (now - this.streamlinesCacheTime > 1000) {  // Regenerate every second
            this.streamlinesCache = generateStreamlines(
                State.flowElements,
                bounds,
                Config.visualization.streamlineDensity
            );
            this.streamlinesCacheTime = now;
        }
    }
    
    /**
     * Update static vectors cache
     */
    updateStaticVectorsCache(bounds) {
        const now = performance.now();
        if (now - this.staticVectorsCacheTime > 500) {
            this.staticVectorsCache = this.generateStaticVectors(bounds);
            this.staticVectorsCacheTime = now;
        }
    }
    
    /**
     * Generate grid of static velocity vectors
     */
    generateStaticVectors(bounds) {
        const vectors = [];
        const gridSize = Config.visualization.staticVectorGridSize;
        const { minX, minY, maxX, maxY } = bounds;
        
        const spacingX = (maxX - minX) / gridSize;
        const spacingY = (maxY - minY) / gridSize;
        
        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                const x = minX + i * spacingX;
                const y = minY + j * spacingY;
                const velocity = getSuperposedVelocity(State.flowElements, x, y);
                
                vectors.push({
                    x, y,
                    vx: velocity.x,
                    vy: velocity.y,
                    magnitude: velocity.length()
                });
            }
        }
        
        return vectors;
    }
    
    /**
     * Get flow data at a specific point (for probe)
     */
    getFlowDataAtPoint(x, y) {
        const velocity = getSuperposedVelocity(State.flowElements, x, y);
        const streamFunction = getSuperposedStreamFunction(State.flowElements, x, y);
        const potentialFunction = getSuperposedPotentialFunction(State.flowElements, x, y);
        
        // Calculate derived quantities
        const speed = velocity.length();
        
        // Pressure using Bernoulli (simplified, incompressible)
        // P + 0.5 * ρ * V² = P_0 + 0.5 * ρ * V_0²
        // Assuming reference P_0 at V_0 = 0
        const density = Config.fluid.density;
        const pressure = Config.physics.referencePressure - 0.5 * density * speed * speed;
        
        // Temperature (simplified - could be more complex with compressible flow)
        const temperature = Config.fluid.temperature;
        
        // Vorticity (numerical approximation)
        const h = 0.1;
        const vRight = getSuperposedVelocity(State.flowElements, x + h, y);
        const vLeft = getSuperposedVelocity(State.flowElements, x - h, y);
        const vUp = getSuperposedVelocity(State.flowElements, x, y + h);
        const vDown = getSuperposedVelocity(State.flowElements, x, y - h);
        const vorticity = (vRight.y - vLeft.y) / (2 * h) - (vUp.x - vDown.x) / (2 * h);
        
        return {
            velocity,
            speed,
            pressure,
            density,
            temperature,
            streamFunction,
            potentialFunction,
            vorticity
        };
    }
    
    /**
     * Get particles
     */
    get particles() {
        return this.particleSystem.particles;
    }
    
    /**
     * Get streamlines
     */
    get streamlines() {
        return this.streamlinesCache;
    }
    
    /**
     * Get streaklines
     */
    get streaklines() {
        return generateStreaklines(this.particleSystem.particles);
    }
    
    /**
     * Get static vectors
     */
    get staticVectors() {
        return this.staticVectorsCache;
    }
}

/**
 * Calculate minimum/maximum values for normalization
 */
export function calculateFieldRange(elements, bounds, quantity = 'velocity') {
    let min = Infinity;
    let max = -Infinity;
    
    const samples = 20;
    const { minX, minY, maxX, maxY } = bounds;
    const dx = (maxX - minX) / samples;
    const dy = (maxY - minY) / samples;
    
    for (let i = 0; i <= samples; i++) {
        for (let j = 0; j <= samples; j++) {
            const x = minX + i * dx;
            const y = minY + j * dy;
            
            let value;
            switch (quantity) {
                case 'velocity':
                    value = getSuperposedVelocity(elements, x, y).length();
                    break;
                case 'streamFunction':
                    value = getSuperposedStreamFunction(elements, x, y);
                    break;
                case 'potentialFunction':
                    value = getSuperposedPotentialFunction(elements, x, y);
                    break;
                default:
                    value = 0;
            }
            
            if (isFinite(value)) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }
    }
    
    return { min, max };
}
