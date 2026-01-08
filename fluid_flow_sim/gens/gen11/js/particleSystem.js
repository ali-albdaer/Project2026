/**
 * Particle System Module
 * Manages fluid particles, their lifecycle, and movement
 */

import { Vector2, ObjectPool } from './utils.js';

/**
 * Single fluid particle
 */
export class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.position = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
        this.previousPositions = []; // For streaklines
        this.age = 0;
        this.maxAge = Infinity;
        this.alive = false;
        this.color = null;
        this.size = 2;
        this.opacity = 1;
    }

    spawn(x, y, maxAge = Infinity) {
        this.position.set(x, y);
        this.velocity.set(0, 0);
        this.previousPositions = [];
        this.age = 0;
        this.maxAge = maxAge;
        this.alive = true;
        return this;
    }

    update(dt, velocity) {
        if (!this.alive) return;

        // Store previous position for streaklines
        if (this.previousPositions.length >= 100) {
            this.previousPositions.shift();
        }
        this.previousPositions.push(this.position.clone());

        // Update velocity and position
        this.velocity.copy(velocity);
        this.position.x += velocity.x * dt;
        this.position.y += velocity.y * dt;

        // Update age
        this.age += dt;
        if (this.age > this.maxAge) {
            this.alive = false;
        }
    }

    kill() {
        this.alive = false;
    }
}

/**
 * Particle System Manager
 */
export class ParticleSystem {
    constructor(flowManager) {
        this.flowManager = flowManager;
        this.particles = [];
        this.maxParticles = 2000;
        this.particlePool = new ObjectPool(() => new Particle(), 500);
        
        // Spawn settings
        this.spawnRate = 50; // Particles per second from each source
        this.spawnAccumulator = 0;
        
        // Boundary settings
        this.dynamicBoundaries = true;
        this.periodicBoundaries = false;
        this.conserveParticles = true;
        this.particleLifespan = Infinity;
        this.boundarySize = 2000;
        
        // Visual settings
        this.particleSize = 2;
        this.particleOpacity = 0.8;
        this.streaklineLength = 50;
        
        // Stats
        this.activeCount = 0;
    }

    setFlowManager(flowManager) {
        this.flowManager = flowManager;
    }

    /**
     * Update all particles
     */
    update(dt, viewBounds) {
        if (!this.flowManager) return;

        const timeScale = dt;
        
        // Update existing particles
        this.activeCount = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            if (!particle.alive) continue;

            // Get velocity at particle position
            const velocity = this.flowManager.getVelocityAt(
                particle.position.x,
                particle.position.y
            );

            // Update particle
            particle.update(timeScale, velocity);
            
            // Check boundaries
            if (!this.handleBoundaries(particle, viewBounds)) {
                particle.kill();
                continue;
            }

            // Check if particle is absorbed by a sink
            if (this.checkSinkAbsorption(particle)) {
                particle.kill();
                continue;
            }

            this.activeCount++;
        }

        // Spawn new particles
        this.spawnParticles(dt, viewBounds);

        // Clean up dead particles
        this.cleanupDeadParticles();
    }

    /**
     * Handle boundary conditions
     */
    handleBoundaries(particle, viewBounds) {
        const x = particle.position.x;
        const y = particle.position.y;
        
        let minX, maxX, minY, maxY;
        
        if (this.dynamicBoundaries && viewBounds) {
            // Use screen bounds with some margin
            const margin = 100;
            minX = viewBounds.left - margin;
            maxX = viewBounds.right + margin;
            minY = viewBounds.top - margin;
            maxY = viewBounds.bottom + margin;
        } else {
            // Use fixed boundary size
            const half = this.boundarySize / 2;
            minX = -half;
            maxX = half;
            minY = -half;
            maxY = half;
        }

        if (this.periodicBoundaries) {
            // Wrap particles
            const width = maxX - minX;
            const height = maxY - minY;
            
            if (x < minX) particle.position.x = maxX - ((minX - x) % width);
            else if (x > maxX) particle.position.x = minX + ((x - maxX) % width);
            
            if (y < minY) particle.position.y = maxY - ((minY - y) % height);
            else if (y > maxY) particle.position.y = minY + ((y - maxY) % height);
            
            return true;
        } else {
            // Kill particles outside bounds
            if (x < minX || x > maxX || y < minY || y > maxY) {
                return false;
            }
            return true;
        }
    }

    /**
     * Check if particle is absorbed by a sink
     */
    checkSinkAbsorption(particle) {
        const sinks = this.flowManager.getSinks();
        for (const sink of sinks) {
            const dx = particle.position.x - sink.position.x;
            const dy = particle.position.y - sink.position.y;
            const dist2 = dx * dx + dy * dy;
            const absorbRadius = Math.max(5, Math.abs(sink.m) * 0.1);
            if (dist2 < absorbRadius * absorbRadius) {
                return true;
            }
        }
        return false;
    }

    /**
     * Spawn new particles from sources and uniform flows
     */
    spawnParticles(dt, viewBounds) {
        if (this.activeCount >= this.maxParticles) return;

        // Spawn from point sources
        const sources = this.flowManager.getSources();
        for (const source of sources) {
            const rate = Math.abs(source.m) * 0.5;
            this.spawnAccumulator += rate * dt;
            
            while (this.spawnAccumulator >= 1 && this.activeCount < this.maxParticles) {
                this.spawnAccumulator -= 1;
                this.spawnParticleAt(
                    source.position.x + (Math.random() - 0.5) * 10,
                    source.position.y + (Math.random() - 0.5) * 10
                );
            }
        }

        // Spawn from uniform flows (from left edge)
        const uniformFlows = this.flowManager.getUniformFlows();
        for (const flow of uniformFlows) {
            if (Math.abs(flow.U) < 0.1) continue;
            
            const rate = Math.abs(flow.U) * 5;
            this.spawnAccumulator += rate * dt;
            
            if (viewBounds) {
                while (this.spawnAccumulator >= 1 && this.activeCount < this.maxParticles) {
                    this.spawnAccumulator -= 1;
                    
                    // Spawn at appropriate edge based on flow direction
                    let x, y;
                    const cos_a = Math.cos(flow.alpha);
                    const sin_a = Math.sin(flow.alpha);
                    
                    if (Math.abs(cos_a) > Math.abs(sin_a)) {
                        // Primarily horizontal flow
                        x = cos_a > 0 ? viewBounds.left - 20 : viewBounds.right + 20;
                        y = viewBounds.top + Math.random() * (viewBounds.bottom - viewBounds.top);
                    } else {
                        // Primarily vertical flow
                        x = viewBounds.left + Math.random() * (viewBounds.right - viewBounds.left);
                        y = sin_a > 0 ? viewBounds.top - 20 : viewBounds.bottom + 20;
                    }
                    
                    this.spawnParticleAt(x, y);
                }
            }
        }

        // If no sources or uniform flows, spawn randomly
        if (sources.length === 0 && uniformFlows.length === 0 && viewBounds) {
            // Maintain a base number of particles
            while (this.activeCount < Math.min(100, this.maxParticles)) {
                const x = viewBounds.left + Math.random() * (viewBounds.right - viewBounds.left);
                const y = viewBounds.top + Math.random() * (viewBounds.bottom - viewBounds.top);
                this.spawnParticleAt(x, y);
            }
        }
    }

    /**
     * Spawn a single particle at position
     */
    spawnParticleAt(x, y) {
        // Check if near singularity
        if (this.flowManager.isNearSingularity(x, y)) {
            return null;
        }

        let particle;
        
        // Try to reuse dead particle first
        for (const p of this.particles) {
            if (!p.alive) {
                particle = p;
                break;
            }
        }
        
        // Otherwise get from pool or create new
        if (!particle) {
            if (this.particles.length >= this.maxParticles) {
                return null;
            }
            particle = this.particlePool.acquire();
            this.particles.push(particle);
        }
        
        const maxAge = this.conserveParticles ? Infinity : this.particleLifespan;
        particle.spawn(x, y, maxAge);
        particle.size = this.particleSize;
        particle.opacity = this.particleOpacity;
        this.activeCount++;
        
        return particle;
    }

    /**
     * Clean up dead particles (periodically)
     */
    cleanupDeadParticles() {
        // Only cleanup occasionally to reduce overhead
        if (Math.random() > 0.01) return;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (!this.particles[i].alive) {
                const particle = this.particles.splice(i, 1)[0];
                particle.reset();
                this.particlePool.release(particle);
            }
        }
    }

    /**
     * Clear all particles
     */
    clear() {
        for (const particle of this.particles) {
            particle.reset();
            this.particlePool.release(particle);
        }
        this.particles = [];
        this.activeCount = 0;
        this.spawnAccumulator = 0;
    }

    /**
     * Get all active particles
     */
    getActiveParticles() {
        return this.particles.filter(p => p.alive);
    }

    /**
     * Get particles for rendering
     */
    *[Symbol.iterator]() {
        for (const particle of this.particles) {
            if (particle.alive) {
                yield particle;
            }
        }
    }

    /**
     * Settings setters
     */
    setMaxParticles(count) {
        this.maxParticles = count;
        // Kill excess particles if needed
        while (this.activeCount > this.maxParticles) {
            for (const p of this.particles) {
                if (p.alive) {
                    p.kill();
                    this.activeCount--;
                    break;
                }
            }
        }
    }

    setDynamicBoundaries(enabled) {
        this.dynamicBoundaries = enabled;
    }

    setPeriodicBoundaries(enabled) {
        this.periodicBoundaries = enabled;
    }

    setConserveParticles(enabled) {
        this.conserveParticles = enabled;
        if (enabled) {
            for (const p of this.particles) {
                if (p.alive) p.maxAge = Infinity;
            }
        } else {
            for (const p of this.particles) {
                if (p.alive && p.maxAge === Infinity) {
                    p.maxAge = p.age + this.particleLifespan;
                }
            }
        }
    }

    setParticleLifespan(lifespan) {
        this.particleLifespan = lifespan;
    }

    setBoundarySize(size) {
        this.boundarySize = size;
    }

    setParticleSize(size) {
        this.particleSize = size;
    }

    setParticleOpacity(opacity) {
        this.particleOpacity = opacity;
    }

    setStreaklineLength(length) {
        this.streaklineLength = length;
    }
}
