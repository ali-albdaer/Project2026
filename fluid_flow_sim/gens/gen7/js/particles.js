/**
 * Particle System for Flow Visualization
 * Advects particles through the velocity field
 */

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Particle settings
        this.count = 1000;
        this.speed = 1;
        this.trailLength = 5;
        this.particleSize = 2;
        this.fadeRate = 0.95;
        
        // Particles array
        this.particles = [];
        
        // Domain
        this.domain = {
            xMin: -5,
            xMax: 5,
            yMin: -5,
            yMax: 5
        };
        
        // Velocity function (set externally)
        this.velocityFunc = null;
        
        // Color settings
        this.colorByVelocity = true;
        this.palette = 'viridis';
        this.maxVelocity = 2;
        
        // Conservation mode - particles only despawn when leaving view
        this.conserveParticles = false;
        
        // State
        this.enabled = true;
    }

    /**
     * Initialize particles
     */
    init(count = this.count) {
        this.count = count;
        this.particles = [];
        
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }
    }

    /**
     * Create a new particle at random position
     */
    createParticle() {
        return {
            x: this.domain.xMin + Math.random() * (this.domain.xMax - this.domain.xMin),
            y: this.domain.yMin + Math.random() * (this.domain.yMax - this.domain.yMin),
            trail: [],
            age: 0,
            maxAge: 200 + Math.random() * 200
        };
    }

    /**
     * Set domain
     */
    setDomain(xMin, xMax, yMin, yMax) {
        this.domain = { xMin, xMax, yMin, yMax };
    }

    /**
     * Set velocity function
     */
    setVelocityFunction(func) {
        this.velocityFunc = func;
    }

    /**
     * Update particles
     */
    update(dt = 0.016) {
        if (!this.velocityFunc || !this.enabled) return;
        
        const speedScale = this.speed * dt;
        const maxVelClamp = 10; // Clamp extreme velocities
        
        for (const p of this.particles) {
            // Get velocity at particle position
            const vel = this.velocityFunc(p.x, p.y);
            let vmag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
            
            // Clamp extreme velocities (near sinks/sources)
            if (vmag > maxVelClamp) {
                const scale = maxVelClamp / vmag;
                vel.u *= scale;
                vel.v *= scale;
                vmag = maxVelClamp;
            }
            
            // Store trail position (with clamped velocity)
            if (this.trailLength > 0 && vmag < maxVelClamp * 0.9) {
                p.trail.push({ x: p.x, y: p.y, vmag: Math.min(vmag, this.maxVelocity) });
                if (p.trail.length > this.trailLength) {
                    p.trail.shift();
                }
            }
            
            // Advect particle
            if (vmag > MathUtils.EPSILON && vmag < maxVelClamp) {
                p.x += vel.u * speedScale;
                p.y += vel.v * speedScale;
            } else if (vmag >= maxVelClamp) {
                // Near singularity - respawn
                p.trail = [];
                this.respawnParticle(p);
                continue;
            } else {
                // Random walk in stagnant regions
                p.x += (Math.random() - 0.5) * 0.01;
                p.y += (Math.random() - 0.5) * 0.01;
            }
            
            // Age particle
            p.age++;
            
            // Check if out of bounds
            const outOfBounds = p.x < this.domain.xMin || p.x > this.domain.xMax ||
                p.y < this.domain.yMin || p.y > this.domain.yMax;
            
            // Respawn logic based on conservation mode
            if (this.conserveParticles) {
                // Only respawn if out of bounds
                if (outOfBounds) {
                    this.respawnParticle(p);
                }
            } else {
                // Original behavior: respawn if out of bounds or too old
                if (outOfBounds || p.age > p.maxAge) {
                    this.respawnParticle(p);
                }
            }
        }
    }

    /**
     * Respawn particle
     */
    respawnParticle(p) {
        // Respawn from left edge (inlet) or random position
        if (Math.random() < 0.3) {
            // Left edge inlet
            p.x = this.domain.xMin + (this.domain.xMax - this.domain.xMin) * 0.01;
            p.y = this.domain.yMin + Math.random() * (this.domain.yMax - this.domain.yMin);
        } else {
            // Random position
            p.x = this.domain.xMin + Math.random() * (this.domain.xMax - this.domain.xMin);
            p.y = this.domain.yMin + Math.random() * (this.domain.yMax - this.domain.yMin);
        }
        p.trail = [];
        p.age = 0;
        p.maxAge = 200 + Math.random() * 200;
    }

    /**
     * Render particles
     */
    render(visualization) {
        if (!this.enabled) return;
        
        const ctx = this.ctx;
        
        for (const p of this.particles) {
            // Get current velocity for color
            const vel = this.velocityFunc ? this.velocityFunc(p.x, p.y) : { u: 0, v: 0 };
            const vmag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
            const t = MathUtils.clamp(vmag / this.maxVelocity, 0, 1);
            
            // Get color
            let color;
            if (this.colorByVelocity) {
                color = ColorPalettes.getColorCSS(this.palette, t, 0.8);
            } else {
                color = 'rgba(255, 255, 255, 0.8)';
            }
            
            // Draw trail
            if (p.trail.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = this.particleSize * 0.5;
                
                const startPos = visualization.worldToScreen(p.trail[0].x, p.trail[0].y);
                ctx.moveTo(startPos.x, startPos.y);
                
                for (let i = 1; i < p.trail.length; i++) {
                    const pos = visualization.worldToScreen(p.trail[i].x, p.trail[i].y);
                    ctx.lineTo(pos.x, pos.y);
                }
                
                const currentPos = visualization.worldToScreen(p.x, p.y);
                ctx.lineTo(currentPos.x, currentPos.y);
                ctx.stroke();
            }
            
            // Draw particle head
            const pos = visualization.worldToScreen(p.x, p.y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, this.particleSize, 0, MathUtils.TWO_PI);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }

    /**
     * Set settings
     */
    setSettings(settings) {
        if (settings.count !== undefined && settings.count !== this.count) {
            this.count = settings.count;
            this.init(this.count);
        }
        if (settings.speed !== undefined) this.speed = settings.speed;
        if (settings.trailLength !== undefined) this.trailLength = settings.trailLength;
        if (settings.palette !== undefined) this.palette = settings.palette;
        if (settings.maxVelocity !== undefined) this.maxVelocity = settings.maxVelocity;
        if (settings.conserveParticles !== undefined) this.conserveParticles = settings.conserveParticles;
    }

    /**
     * Enable/disable
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled && this.particles.length === 0) {
            this.init();
        }
    }

    /**
     * Resize handling
     */
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
    }

    /**
     * Clear
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Export
window.ParticleSystem = ParticleSystem;
