/**
 * Particle System
 * Manages fluid particles for visualization
 */

import { Vec2, randomRange } from './math.js';
import { Config, State } from './config.js';
import { getSuperposedVelocity } from './flowElements.js';

/**
 * Particle class representing a fluid element
 */
export class Particle {
    constructor(x, y) {
        this.position = new Vec2(x, y);
        this.velocity = new Vec2(0, 0);
        this.age = 0;
        this.lifespan = Config.particles.lifespan;
        this.trail = [];  // Position history for streaklines
        this.alive = true;
        this.spawnedBy = null;  // Reference to spawning element
    }
    
    update(dt, elements, fluidProps) {
        if (!this.alive) return;
        
        // Get velocity from flow field
        this.velocity = getSuperposedVelocity(elements, this.position.x, this.position.y);
        
        // Apply viscous effects (simplified)
        const viscosityFactor = 1 - fluidProps.viscosity * dt;
        this.velocity = this.velocity.mul(Math.max(0.1, viscosityFactor));
        
        // Temperature affects velocity (thermal expansion approximation)
        const tempFactor = Math.sqrt(fluidProps.temperature / Config.physics.referenceTemp);
        this.velocity = this.velocity.mul(tempFactor);
        
        // Update position
        this.position = this.position.add(this.velocity.mul(dt));
        
        // Store trail for streaklines
        this.trail.push(this.position.clone());
        if (this.trail.length > Config.particles.trailLength) {
            this.trail.shift();
        }
        
        // Age particle
        this.age += dt;
        
        // Check lifespan
        if (!Config.boundaries.conserveParticles && this.age >= this.lifespan) {
            this.alive = false;
        }
    }
    
    // Check if particle is within bounds
    checkBounds(bounds) {
        const { minX, minY, maxX, maxY } = bounds;
        
        if (Config.boundaries.periodic) {
            // Wrap around
            if (this.position.x < minX) this.position.x = maxX;
            if (this.position.x > maxX) this.position.x = minX;
            if (this.position.y < minY) this.position.y = maxY;
            if (this.position.y > maxY) this.position.y = minY;
        } else {
            // Kill if out of bounds
            if (this.position.x < minX || this.position.x > maxX ||
                this.position.y < minY || this.position.y > maxY) {
                this.alive = false;
            }
        }
    }
    
    // Check if particle should be destroyed by a sink
    checkSinks(elements) {
        for (const element of elements) {
            if (element.type === 'sink' && element.enabled) {
                const dx = this.position.x - element.x;
                const dy = this.position.y - element.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 15) {  // Destruction radius
                    this.alive = false;
                    return true;
                }
            }
        }
        return false;
    }
}

/**
 * Particle System Manager
 */
export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.spawnAccumulator = 0;
    }
    
    /**
     * Update all particles
     */
    update(dt, elements, bounds, fluidProps) {
        // Update existing particles
        for (const particle of this.particles) {
            particle.update(dt, elements, fluidProps);
            particle.checkBounds(bounds);
            particle.checkSinks(elements);
        }
        
        // Remove dead particles
        this.particles = this.particles.filter(p => p.alive);
        
        // Spawn new particles
        this.spawnParticles(dt, elements, bounds);
    }
    
    /**
     * Spawn new particles from sources and uniform flows
     */
    spawnParticles(dt, elements, bounds) {
        const spawnRate = Config.particles.spawnRate;
        const maxParticles = Config.particles.maxCount;
        
        // Accumulate spawn time
        this.spawnAccumulator += dt * spawnRate;
        
        while (this.spawnAccumulator >= 1 && this.particles.length < maxParticles) {
            this.spawnAccumulator -= 1;
            
            // Find spawn sources
            const sources = elements.filter(e => 
                e.enabled && (e.type === 'source' || e.type === 'uniform')
            );
            
            if (sources.length === 0) {
                // Spawn randomly in view
                const x = randomRange(bounds.minX, bounds.maxX);
                const y = randomRange(bounds.minY, bounds.maxY);
                const particle = new Particle(x, y);
                this.particles.push(particle);
            } else {
                // Spawn from a random source
                const source = sources[Math.floor(Math.random() * sources.length)];
                const spawnPos = source.getSpawnPosition?.(
                    bounds.maxX - bounds.minX,
                    bounds.maxY - bounds.minY,
                    { zoom: 1, panX: 0, panY: 0 }
                );
                
                if (spawnPos) {
                    const particle = new Particle(spawnPos.x, spawnPos.y);
                    particle.spawnedBy = source.id;
                    this.particles.push(particle);
                } else if (source.type === 'source' && source.m > 0) {
                    // Source element
                    const angle = Math.random() * Math.PI * 2;
                    const r = 5 + Math.random() * 5;
                    const x = source.x + Math.cos(angle) * r;
                    const y = source.y + Math.sin(angle) * r;
                    const particle = new Particle(x, y);
                    particle.spawnedBy = source.id;
                    this.particles.push(particle);
                }
            }
        }
    }
    
    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
        this.spawnAccumulator = 0;
    }
    
    /**
     * Get particle count
     */
    get count() {
        return this.particles.length;
    }
}

/**
 * Generate streamlines using RK4 integration
 */
export function generateStreamlines(elements, bounds, density = 20) {
    const streamlines = [];
    const { minX, minY, maxX, maxY } = bounds;
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Grid of seed points
    const spacingX = width / density;
    const spacingY = height / density;
    
    for (let i = 0; i <= density; i++) {
        for (let j = 0; j <= density; j++) {
            const startX = minX + i * spacingX;
            const startY = minY + j * spacingY;
            
            // Integrate forward
            const forwardLine = integrateStreamline(
                elements, startX, startY, bounds, 1, 200
            );
            
            // Integrate backward
            const backwardLine = integrateStreamline(
                elements, startX, startY, bounds, -1, 200
            );
            
            // Combine (reverse backward and concatenate)
            const line = backwardLine.reverse().concat(forwardLine.slice(1));
            
            if (line.length > 2) {
                streamlines.push(line);
            }
        }
    }
    
    return streamlines;
}

/**
 * Integrate a single streamline
 */
function integrateStreamline(elements, startX, startY, bounds, direction, maxSteps) {
    const line = [{ x: startX, y: startY }];
    let x = startX;
    let y = startY;
    const dt = 0.5 * direction;
    
    for (let i = 0; i < maxSteps; i++) {
        const v = getSuperposedVelocity(elements, x, y);
        const speed = v.length();
        
        // Stop if velocity is too small or too large
        if (speed < 0.001 || speed > 1000) break;
        
        // RK4 integration
        const k1 = v;
        const v2 = getSuperposedVelocity(elements, x + k1.x * dt/2, y + k1.y * dt/2);
        const k2 = v2;
        const v3 = getSuperposedVelocity(elements, x + k2.x * dt/2, y + k2.y * dt/2);
        const k3 = v3;
        const v4 = getSuperposedVelocity(elements, x + k3.x * dt, y + k3.y * dt);
        const k4 = v4;
        
        // Update position
        x += (k1.x + 2*k2.x + 2*k3.x + k4.x) * dt / 6;
        y += (k1.y + 2*k2.y + 2*k3.y + k4.y) * dt / 6;
        
        // Check bounds
        if (x < bounds.minX || x > bounds.maxX || 
            y < bounds.minY || y > bounds.maxY) {
            break;
        }
        
        line.push({ x, y });
    }
    
    return line;
}

/**
 * Generate streaklines from particle trails
 */
export function generateStreaklines(particles) {
    return particles
        .filter(p => p.trail.length > 1)
        .map(p => p.trail.map(pos => ({ x: pos.x, y: pos.y })));
}
