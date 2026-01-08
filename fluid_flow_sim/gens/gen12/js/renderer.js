/**
 * Renderer
 * Canvas rendering and visualization
 */

import { Vec2, clamp, mapRange, formatNumber } from './math.js';
import { Config, State } from './config.js';
import { getSuperposedVelocity } from './flowElements.js';
import { getColor, getColorWithAlpha, getElementColor, gridColors } from './colorMaps.js';
import { calculateFieldRange } from './simulation.js';

/**
 * Renderer class handles all canvas drawing
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.fieldRange = { min: 0, max: 1 };
        this.lastFieldRangeUpdate = 0;
        
        this.resize();
    }
    
    /**
     * Handle window resize
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        
        this.ctx.scale(dpr, dpr);
    }
    
    /**
     * Clear canvas
     */
    clear() {
        this.ctx.fillStyle = '#050508';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    /**
     * Main render method
     */
    render(simulation) {
        this.clear();
        
        // Apply view transformation
        this.ctx.save();
        this.ctx.translate(this.width / 2 + Config.view.panX, this.height / 2 + Config.view.panY);
        this.ctx.scale(Config.view.zoom, Config.view.zoom);
        
        // Update field range for coloring
        this.updateFieldRange(simulation);
        
        // Draw grid
        this.drawGrid(simulation);
        
        // Draw streamlines
        if (Config.visualization.showStreamlines) {
            this.drawStreamlines(simulation.streamlines);
        }
        
        // Draw streaklines
        if (Config.visualization.showStreaklines) {
            this.drawStreaklines(simulation.streaklines);
        }
        
        // Draw static velocity field
        if (Config.visualization.showStaticVectors) {
            this.drawStaticVectors(simulation.staticVectors);
        }
        
        // Draw particles
        if (Config.visualization.showParticles) {
            this.drawParticles(simulation.particles);
        }
        
        // Draw flow elements
        this.drawFlowElements();
        
        this.ctx.restore();
    }
    
    /**
     * Update field range for color normalization
     */
    updateFieldRange(simulation) {
        const now = performance.now();
        if (now - this.lastFieldRangeUpdate > 1000) {
            const bounds = simulation.getBounds();
            this.fieldRange = calculateFieldRange(
                State.flowElements,
                bounds,
                Config.colors.quantity
            );
            this.lastFieldRangeUpdate = now;
        }
    }
    
    /**
     * Get color for a value based on current color settings
     */
    getValueColor(value, alpha = 1) {
        if (Config.colors.quantity === 'none') {
            return `rgba(255, 255, 255, ${alpha})`;
        }
        
        const { min, max } = this.fieldRange;
        const range = max - min;
        const t = range > 0 ? clamp((value - min) / range, 0, 1) : 0.5;
        
        return getColorWithAlpha(t, alpha, Config.colors.palette);
    }
    
    /**
     * Draw background grid
     */
    drawGrid(simulation) {
        const bounds = simulation.getBounds();
        const gridSpacing = 100;
        
        this.ctx.strokeStyle = gridColors.minor;
        this.ctx.lineWidth = 0.5 / Config.view.zoom;
        
        // Vertical lines
        const startX = Math.floor(bounds.minX / gridSpacing) * gridSpacing;
        for (let x = startX; x <= bounds.maxX; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, bounds.minY);
            this.ctx.lineTo(x, bounds.maxY);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        const startY = Math.floor(bounds.minY / gridSpacing) * gridSpacing;
        for (let y = startY; y <= bounds.maxY; y += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(bounds.minX, y);
            this.ctx.lineTo(bounds.maxX, y);
            this.ctx.stroke();
        }
        
        // Draw axes
        this.ctx.strokeStyle = gridColors.axis;
        this.ctx.lineWidth = 1 / Config.view.zoom;
        
        // X-axis
        this.ctx.beginPath();
        this.ctx.moveTo(bounds.minX, 0);
        this.ctx.lineTo(bounds.maxX, 0);
        this.ctx.stroke();
        
        // Y-axis
        this.ctx.beginPath();
        this.ctx.moveTo(0, bounds.minY);
        this.ctx.lineTo(0, bounds.maxY);
        this.ctx.stroke();
    }
    
    /**
     * Draw particles
     */
    drawParticles(particles) {
        const size = Config.particles.size;
        const showVectors = Config.visualization.showVelocityVectors;
        const vectorScale = Config.visualization.vectorScale;
        
        for (const particle of particles) {
            const { position, velocity } = particle;
            const speed = velocity.length();
            
            // Get color based on quantity
            let color;
            if (Config.colors.quantity === 'velocity') {
                color = this.getValueColor(speed);
            } else {
                color = this.getValueColor(this.getParticleQuantity(particle));
            }
            
            // Draw particle
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(position.x, position.y, size / Config.view.zoom, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw velocity vector
            if (showVectors && speed > 0.001) {
                this.drawVelocityVector(position.x, position.y, velocity, speed);
            }
        }
    }
    
    /**
     * Get quantity value for particle
     */
    getParticleQuantity(particle) {
        switch (Config.colors.quantity) {
            case 'velocity':
                return particle.velocity.length();
            case 'pressure':
                // Bernoulli approximation
                const speed = particle.velocity.length();
                return Config.physics.referencePressure - 0.5 * Config.fluid.density * speed * speed;
            case 'density':
                return Config.fluid.density;
            case 'temperature':
                return Config.fluid.temperature;
            default:
                return 0;
        }
    }
    
    /**
     * Draw velocity vector arrow
     */
    drawVelocityVector(x, y, velocity, magnitude) {
        const scale = Config.visualization.vectorScale / Config.view.zoom;
        const mode = Config.colors.vectorMode;
        
        // Normalize and scale
        let length;
        if (mode === 'length' || mode === 'both') {
            length = Math.min(magnitude * scale * 0.5, 50 / Config.view.zoom);
        } else {
            length = 15 / Config.view.zoom;  // Fixed length
        }
        
        const dir = velocity.normalize();
        const endX = x + dir.x * length;
        const endY = y + dir.y * length;
        
        // Color
        let color;
        if (mode === 'color' || mode === 'both') {
            color = this.getValueColor(magnitude, 0.8);
        } else {
            color = 'rgba(100, 180, 255, 0.6)';
        }
        
        // Draw line
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1 / Config.view.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrowhead
        const arrowSize = 4 / Config.view.zoom;
        const angle = Math.atan2(dir.y, dir.x);
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - arrowSize * Math.cos(angle - 0.5),
            endY - arrowSize * Math.sin(angle - 0.5)
        );
        this.ctx.lineTo(
            endX - arrowSize * Math.cos(angle + 0.5),
            endY - arrowSize * Math.sin(angle + 0.5)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    /**
     * Draw streamlines
     */
    drawStreamlines(streamlines) {
        const opacity = Config.visualization.lineOpacity;
        
        this.ctx.strokeStyle = `rgba(80, 160, 255, ${opacity})`;
        this.ctx.lineWidth = 1 / Config.view.zoom;
        
        for (const line of streamlines) {
            if (line.length < 2) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(line[0].x, line[0].y);
            
            for (let i = 1; i < line.length; i++) {
                this.ctx.lineTo(line[i].x, line[i].y);
            }
            
            this.ctx.stroke();
        }
    }
    
    /**
     * Draw streaklines (particle trails)
     */
    drawStreaklines(streaklines) {
        const opacity = Config.visualization.lineOpacity;
        
        for (const trail of streaklines) {
            if (trail.length < 2) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(trail[0].x, trail[0].y);
            
            for (let i = 1; i < trail.length; i++) {
                const alpha = opacity * (i / trail.length);
                this.ctx.strokeStyle = `rgba(255, 150, 80, ${alpha})`;
                this.ctx.lineTo(trail[i].x, trail[i].y);
            }
            
            this.ctx.lineWidth = 1.5 / Config.view.zoom;
            this.ctx.stroke();
        }
    }
    
    /**
     * Draw static velocity vectors
     */
    drawStaticVectors(vectors) {
        for (const vec of vectors) {
            if (vec.magnitude < 0.001) continue;
            
            const velocity = new Vec2(vec.vx, vec.vy);
            this.drawVelocityVector(vec.x, vec.y, velocity, vec.magnitude);
        }
    }
    
    /**
     * Draw flow elements (sources, sinks, etc.)
     */
    drawFlowElements() {
        for (const element of State.flowElements) {
            if (!element.enabled) continue;
            
            const color = getElementColor(element.type);
            const isSelected = element.selected || State.ui.selectedElement === element.id;
            
            switch (element.type) {
                case 'source':
                    this.drawSource(element.x, element.y, color, isSelected);
                    break;
                case 'sink':
                    this.drawSink(element.x, element.y, color, isSelected);
                    break;
                case 'vortex':
                    this.drawVortex(element.x, element.y, element.gamma > 0, color, isSelected);
                    break;
                case 'doublet':
                    this.drawDoublet(element.x, element.y, element.angle, color, isSelected);
                    break;
                case 'uniform':
                    this.drawUniform(element, color, isSelected);
                    break;
            }
        }
    }
    
    /**
     * Draw source symbol
     */
    drawSource(x, y, color, selected) {
        const size = (selected ? 15 : 12) / Config.view.zoom;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 / Config.view.zoom;
        
        // Circle with plus
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Plus sign
        this.ctx.beginPath();
        this.ctx.moveTo(x - size * 0.6, y);
        this.ctx.lineTo(x + size * 0.6, y);
        this.ctx.moveTo(x, y - size * 0.6);
        this.ctx.lineTo(x, y + size * 0.6);
        this.ctx.stroke();
        
        if (selected) {
            this.ctx.fillStyle = `${color}33`;
            this.ctx.fill();
        }
    }
    
    /**
     * Draw sink symbol
     */
    drawSink(x, y, color, selected) {
        const size = (selected ? 15 : 12) / Config.view.zoom;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 / Config.view.zoom;
        
        // Circle with minus
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Minus sign
        this.ctx.beginPath();
        this.ctx.moveTo(x - size * 0.6, y);
        this.ctx.lineTo(x + size * 0.6, y);
        this.ctx.stroke();
        
        if (selected) {
            this.ctx.fillStyle = `${color}33`;
            this.ctx.fill();
        }
    }
    
    /**
     * Draw vortex symbol
     */
    drawVortex(x, y, ccw, color, selected) {
        const size = (selected ? 15 : 12) / Config.view.zoom;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 / Config.view.zoom;
        
        // Spiral
        this.ctx.beginPath();
        for (let i = 0; i <= 720; i += 10) {
            const angle = (i * Math.PI) / 180 * (ccw ? 1 : -1);
            const r = size * 0.2 + (i / 720) * size * 0.8;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            
            if (i === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        this.ctx.stroke();
        
        // Center dot
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3 / Config.view.zoom, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * Draw doublet symbol
     */
    drawDoublet(x, y, angle, color, selected) {
        const size = (selected ? 15 : 12) / Config.view.zoom;
        const rad = (angle * Math.PI) / 180;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 / Config.view.zoom;
        
        // Two circles (source + sink)
        const offset = size * 0.4;
        const sx = x - Math.cos(rad) * offset;
        const sy = y - Math.sin(rad) * offset;
        const ex = x + Math.cos(rad) * offset;
        const ey = y + Math.sin(rad) * offset;
        
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(ex, ey, size * 0.5, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Arrow showing direction
        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.lineTo(ex, ey);
        this.ctx.stroke();
        
        // Fill + and -
        this.ctx.fillStyle = '#22c55e';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 2 / Config.view.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(ex, ey, 2 / Config.view.zoom, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * Draw uniform flow indicator
     */
    drawUniform(element, color, selected) {
        const size = (selected ? 20 : 15) / Config.view.zoom;
        const rad = (element.alpha * Math.PI) / 180;
        const x = element.x || 0;
        const y = element.y || 0;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 / Config.view.zoom;
        
        // Arrow showing flow direction
        const dx = Math.cos(rad) * size * 2;
        const dy = Math.sin(rad) * size * 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x - dx, y - dy);
        this.ctx.lineTo(x + dx, y + dy);
        this.ctx.stroke();
        
        // Arrowhead
        const arrowSize = 8 / Config.view.zoom;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x + dx, y + dy);
        this.ctx.lineTo(
            x + dx - arrowSize * Math.cos(rad - 0.5),
            y + dy - arrowSize * Math.sin(rad - 0.5)
        );
        this.ctx.lineTo(
            x + dx - arrowSize * Math.cos(rad + 0.5),
            y + dy - arrowSize * Math.sin(rad + 0.5)
        );
        this.ctx.closePath();
        this.ctx.fill();
        
        // U∞ label
        this.ctx.font = `${12 / Config.view.zoom}px sans-serif`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`U∞=${element.U.toFixed(1)}`, x, y - size * 1.5);
    }
    
    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        const x = (screenX - this.width / 2 - Config.view.panX) / Config.view.zoom;
        const y = (screenY - this.height / 2 - Config.view.panY) / Config.view.zoom;
        return new Vec2(x, y);
    }
    
    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        const x = worldX * Config.view.zoom + this.width / 2 + Config.view.panX;
        const y = worldY * Config.view.zoom + this.height / 2 + Config.view.panY;
        return new Vec2(x, y);
    }
}
