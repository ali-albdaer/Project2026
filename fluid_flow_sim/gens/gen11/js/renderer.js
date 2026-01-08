/**
 * Renderer Module
 * Handles all canvas drawing operations
 */

import { Vector2, MathUtils } from './utils.js';
import { ColorGradient, QUANTITY_CONFIG, rgbToCss } from './colorGradients.js';

/**
 * View/Camera controller for pan and zoom
 */
export class ViewTransform {
    constructor() {
        this.offset = new Vector2(0, 0);
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 10;
    }

    reset() {
        this.offset.set(0, 0);
        this.zoom = 1;
    }

    pan(dx, dy) {
        this.offset.x += dx / this.zoom;
        this.offset.y += dy / this.zoom;
    }

    zoomAt(x, y, factor) {
        const oldZoom = this.zoom;
        this.zoom = MathUtils.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
        
        // Adjust offset to zoom towards mouse position
        const zoomRatio = this.zoom / oldZoom;
        this.offset.x = x - (x - this.offset.x) * zoomRatio;
        this.offset.y = y - (y - this.offset.y) * zoomRatio;
    }

    setZoom(zoom) {
        this.zoom = MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return new Vector2(
            (screenX / this.zoom) - this.offset.x,
            (screenY / this.zoom) - this.offset.y
        );
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        return new Vector2(
            (worldX + this.offset.x) * this.zoom,
            (worldY + this.offset.y) * this.zoom
        );
    }

    // Get visible bounds in world coordinates
    getWorldBounds(canvasWidth, canvasHeight) {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(canvasWidth, canvasHeight);
        
        return {
            left: topLeft.x,
            top: topLeft.y,
            right: bottomRight.x,
            bottom: bottomRight.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    // Apply transform to canvas context
    apply(ctx) {
        ctx.setTransform(
            this.zoom, 0,
            0, this.zoom,
            this.offset.x * this.zoom,
            this.offset.y * this.zoom
        );
    }
}

/**
 * Main Renderer class
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.view = new ViewTransform();
        
        // Rendering settings
        this.settings = {
            showParticles: true,
            showVelocityVectors: true,
            showStreamlines: false,
            showStreaklines: false,
            showStaticVectors: false,
            vectorDisplayMode: 'length', // 'length' or 'color'
            
            particleSize: 2,
            particleOpacity: 0.8,
            
            streamlineDensity: 20,
            streamlineOpacity: 0.6,
            streaklineLength: 50,
            
            gradientQuantity: 'none',
            colorPalette: 'viridis'
        };
        
        // Color gradient
        this.colorGradient = new ColorGradient('viridis');
        
        // Cache for streamlines
        this.streamlineCache = null;
        this.streamlineCacheValid = false;
        
        // Static field cache
        this.velocityFieldCache = null;
        this.velocityFieldCacheValid = false;
        
        // Performance
        this.lastFrameTime = 0;
        this.fps = 60;
        this.frameCount = 0;
        
        // Initialize canvas size
        this.resize();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.width = rect.width;
        this.height = rect.height;
        
        this.ctx.scale(dpr, dpr);
        
        // Invalidate caches
        this.invalidateCache();
    }

    invalidateCache() {
        this.streamlineCacheValid = false;
        this.velocityFieldCacheValid = false;
    }

    /**
     * Main render function
     */
    render(simulation, time) {
        const ctx = this.ctx;
        const bounds = this.view.getWorldBounds(this.width, this.height);
        
        // Clear canvas
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
        
        // Apply view transform
        ctx.save();
        this.view.apply(ctx);
        
        // Draw background grid
        this.drawGrid(ctx, bounds);
        
        // Draw static velocity field
        if (this.settings.showStaticVectors) {
            this.drawStaticVelocityField(ctx, simulation, bounds);
        }
        
        // Draw streamlines
        if (this.settings.showStreamlines) {
            this.drawStreamlines(ctx, simulation, bounds);
        }
        
        // Draw streaklines
        if (this.settings.showStreaklines) {
            this.drawStreaklines(ctx, simulation);
        }
        
        // Draw particles
        if (this.settings.showParticles) {
            this.drawParticles(ctx, simulation, bounds);
        }
        
        // Draw flow elements (sources, sinks, etc.)
        this.drawFlowElements(ctx, simulation);
        
        ctx.restore();
        
        // Update FPS
        this.updateFPS(time);
    }

    /**
     * Draw background grid
     */
    drawGrid(ctx, bounds) {
        const gridSize = this.getGridSize();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1 / this.view.zoom;
        
        const startX = Math.floor(bounds.left / gridSize) * gridSize;
        const startY = Math.floor(bounds.top / gridSize) * gridSize;
        
        ctx.beginPath();
        
        // Vertical lines
        for (let x = startX; x <= bounds.right; x += gridSize) {
            ctx.moveTo(x, bounds.top);
            ctx.lineTo(x, bounds.bottom);
        }
        
        // Horizontal lines
        for (let y = startY; y <= bounds.bottom; y += gridSize) {
            ctx.moveTo(bounds.left, y);
            ctx.lineTo(bounds.right, y);
        }
        
        ctx.stroke();
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2 / this.view.zoom;
        
        ctx.beginPath();
        ctx.moveTo(bounds.left, 0);
        ctx.lineTo(bounds.right, 0);
        ctx.moveTo(0, bounds.top);
        ctx.lineTo(0, bounds.bottom);
        ctx.stroke();
    }

    getGridSize() {
        const baseSize = 100;
        const zoom = this.view.zoom;
        
        if (zoom > 2) return baseSize / 2;
        if (zoom > 1) return baseSize;
        if (zoom > 0.5) return baseSize * 2;
        return baseSize * 4;
    }

    /**
     * Draw particles
     */
    drawParticles(ctx, simulation, bounds) {
        const particles = simulation.particleSystem;
        const physics = simulation.physics;
        const useGradient = this.settings.gradientQuantity !== 'none';
        const quantityConfig = QUANTITY_CONFIG[this.settings.gradientQuantity];
        
        for (const particle of particles) {
            const x = particle.position.x;
            const y = particle.position.y;
            
            // Skip if outside visible bounds (with margin)
            if (x < bounds.left - 50 || x > bounds.right + 50 ||
                y < bounds.top - 50 || y > bounds.bottom + 50) {
                continue;
            }
            
            // Get color
            let color;
            if (useGradient && quantityConfig) {
                const props = physics.getPropertiesAt(x, y);
                const value = quantityConfig.getValue(props);
                color = this.colorGradient.getColor(value, this.settings.particleOpacity);
            } else {
                color = `rgba(100, 180, 255, ${this.settings.particleOpacity})`;
            }
            
            // Draw particle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, this.settings.particleSize / this.view.zoom, 0, MathUtils.TWO_PI);
            ctx.fill();
            
            // Draw velocity vector
            if (this.settings.showVelocityVectors && particle.velocity.length() > 0.1) {
                const vx = particle.velocity.x;
                const vy = particle.velocity.y;
                const speed = particle.velocity.length();
                
                let arrowLength;
                let arrowColor;
                
                if (this.settings.vectorDisplayMode === 'length') {
                    arrowLength = Math.min(speed * 5, 30) / this.view.zoom;
                    arrowColor = `rgba(255, 200, 100, ${this.settings.particleOpacity * 0.8})`;
                } else {
                    arrowLength = 15 / this.view.zoom;
                    const rgb = this.colorGradient.getColorRGB(speed);
                    arrowColor = rgbToCss(rgb.r, rgb.g, rgb.b, this.settings.particleOpacity * 0.8);
                }
                
                const nx = vx / speed;
                const ny = vy / speed;
                
                ctx.strokeStyle = arrowColor;
                ctx.lineWidth = 1 / this.view.zoom;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + nx * arrowLength, y + ny * arrowLength);
                ctx.stroke();
            }
        }
    }

    /**
     * Draw streaklines (particle trails)
     */
    drawStreaklines(ctx, simulation) {
        const particles = simulation.particleSystem;
        const maxLength = this.settings.streaklineLength;
        
        ctx.strokeStyle = `rgba(100, 200, 255, ${this.settings.streamlineOpacity * 0.5})`;
        ctx.lineWidth = 1 / this.view.zoom;
        
        for (const particle of particles) {
            const trail = particle.previousPositions;
            if (trail.length < 2) continue;
            
            const start = Math.max(0, trail.length - maxLength);
            
            ctx.beginPath();
            ctx.moveTo(trail[start].x, trail[start].y);
            
            for (let i = start + 1; i < trail.length; i++) {
                ctx.lineTo(trail[i].x, trail[i].y);
            }
            
            // Connect to current position
            ctx.lineTo(particle.position.x, particle.position.y);
            ctx.stroke();
        }
    }

    /**
     * Draw streamlines
     */
    drawStreamlines(ctx, simulation, bounds) {
        // Generate streamlines if cache is invalid
        if (!this.streamlineCacheValid) {
            this.streamlineCache = simulation.streamlineGenerator.generateStreamlines(
                bounds,
                this.settings.streamlineDensity
            );
            this.streamlineCacheValid = true;
        }
        
        ctx.strokeStyle = `rgba(150, 220, 255, ${this.settings.streamlineOpacity})`;
        ctx.lineWidth = 1.5 / this.view.zoom;
        
        for (const streamline of this.streamlineCache) {
            if (streamline.length < 2) continue;
            
            ctx.beginPath();
            ctx.moveTo(streamline[0].x, streamline[0].y);
            
            for (let i = 1; i < streamline.length; i++) {
                ctx.lineTo(streamline[i].x, streamline[i].y);
            }
            
            ctx.stroke();
        }
    }

    /**
     * Draw static velocity field
     */
    drawStaticVelocityField(ctx, simulation, bounds) {
        // Generate field if cache is invalid
        if (!this.velocityFieldCacheValid) {
            const spacing = 40 / this.view.zoom;
            this.velocityFieldCache = simulation.velocityFieldGenerator.generateField(
                bounds,
                Math.max(30, spacing)
            );
            this.velocityFieldCacheValid = true;
        }
        
        // Find max speed for normalization
        let maxSpeed = 0;
        for (const point of this.velocityFieldCache) {
            if (point.speed > maxSpeed) maxSpeed = point.speed;
        }
        if (maxSpeed < 0.01) maxSpeed = 1;
        
        const arrowSize = 12 / this.view.zoom;
        const headSize = 4 / this.view.zoom;
        
        for (const point of this.velocityFieldCache) {
            const { x, y, vx, vy, speed } = point;
            
            let length, color;
            
            if (this.settings.vectorDisplayMode === 'length') {
                length = (speed / maxSpeed) * arrowSize;
                color = 'rgba(200, 200, 255, 0.4)';
            } else {
                length = arrowSize * 0.8;
                const rgb = this.colorGradient.getColorRGB(speed);
                color = rgbToCss(rgb.r, rgb.g, rgb.b, 0.6);
            }
            
            if (length < 1 / this.view.zoom) continue;
            
            const nx = vx / speed;
            const ny = vy / speed;
            const endX = x + nx * length;
            const endY = y + ny * length;
            
            // Draw arrow line
            ctx.strokeStyle = color;
            ctx.lineWidth = 1 / this.view.zoom;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Draw arrow head
            const angle = Math.atan2(ny, nx);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - headSize * Math.cos(angle - 0.4),
                endY - headSize * Math.sin(angle - 0.4)
            );
            ctx.lineTo(
                endX - headSize * Math.cos(angle + 0.4),
                endY - headSize * Math.sin(angle + 0.4)
            );
            ctx.closePath();
            ctx.fill();
        }
    }

    /**
     * Draw flow elements (sources, sinks, vortices, doublets)
     */
    drawFlowElements(ctx, simulation) {
        for (const element of simulation.flowManager) {
            if (!element.enabled) continue;
            if (element.type === 'uniform') continue; // Uniform flow has no visual representation
            
            const x = element.position.x;
            const y = element.position.y;
            const size = 15 / this.view.zoom;
            
            ctx.save();
            ctx.translate(x, y);
            
            // Draw based on type
            switch (element.type) {
                case 'source':
                    this.drawSource(ctx, size, element.selected);
                    break;
                case 'sink':
                    this.drawSink(ctx, size, element.selected);
                    break;
                case 'vortex':
                    this.drawVortex(ctx, size, element.gamma, element.selected);
                    break;
                case 'doublet':
                    this.drawDoublet(ctx, size, element.orientation, element.selected);
                    break;
            }
            
            ctx.restore();
        }
    }

    drawSource(ctx, size, selected) {
        ctx.fillStyle = selected ? '#6fff9f' : '#4aff9f';
        ctx.strokeStyle = selected ? '#ffffff' : '#2a9f5f';
        ctx.lineWidth = 2 / this.view.zoom;
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, MathUtils.TWO_PI);
        ctx.fill();
        ctx.stroke();
        
        // Plus sign
        ctx.strokeStyle = '#1a5f3f';
        ctx.lineWidth = 3 / this.view.zoom;
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, 0);
        ctx.lineTo(size * 0.5, 0);
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(0, size * 0.5);
        ctx.stroke();
    }

    drawSink(ctx, size, selected) {
        ctx.fillStyle = selected ? '#ff6a8a' : '#ff4a6a';
        ctx.strokeStyle = selected ? '#ffffff' : '#9f2a4a';
        ctx.lineWidth = 2 / this.view.zoom;
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, MathUtils.TWO_PI);
        ctx.fill();
        ctx.stroke();
        
        // Minus sign
        ctx.strokeStyle = '#5f1a2a';
        ctx.lineWidth = 3 / this.view.zoom;
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, 0);
        ctx.lineTo(size * 0.5, 0);
        ctx.stroke();
    }

    drawVortex(ctx, size, gamma, selected) {
        ctx.fillStyle = selected ? '#9b7cff' : '#7b5cff';
        ctx.strokeStyle = selected ? '#ffffff' : '#4b3c9f';
        ctx.lineWidth = 2 / this.view.zoom;
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, MathUtils.TWO_PI);
        ctx.fill();
        ctx.stroke();
        
        // Rotation arrow
        ctx.strokeStyle = '#3b2c6f';
        ctx.lineWidth = 2 / this.view.zoom;
        
        const dir = gamma >= 0 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 1.5 * dir);
        ctx.stroke();
        
        // Arrow head
        const angle = Math.PI * 1.5 * dir;
        const headX = Math.cos(angle) * size * 0.5;
        const headY = Math.sin(angle) * size * 0.5;
        const headSize = 4 / this.view.zoom;
        
        ctx.fillStyle = '#3b2c6f';
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX + headSize * dir, headY - headSize);
        ctx.lineTo(headX - headSize * dir, headY - headSize);
        ctx.closePath();
        ctx.fill();
    }

    drawDoublet(ctx, size, orientation, selected) {
        ctx.save();
        ctx.rotate(orientation);
        
        ctx.fillStyle = selected ? '#ffb86a' : '#ffb84a';
        ctx.strokeStyle = selected ? '#ffffff' : '#9f7a2a';
        ctx.lineWidth = 2 / this.view.zoom;
        
        // Left half (source-like)
        ctx.beginPath();
        ctx.arc(0, 0, size, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#4aff9f';
        ctx.fill();
        ctx.stroke();
        
        // Right half (sink-like)
        ctx.beginPath();
        ctx.arc(0, 0, size, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fillStyle = '#ff4a6a';
        ctx.fill();
        ctx.stroke();
        
        // Center line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2 / this.view.zoom;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.stroke();
        
        ctx.restore();
    }

    /**
     * Update FPS counter
     */
    updateFPS(time) {
        this.frameCount++;
        if (time - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = time;
        }
    }

    /**
     * Settings setters
     */
    setSetting(key, value) {
        this.settings[key] = value;
        
        // Handle special cases
        if (key === 'colorPalette') {
            this.colorGradient.setPalette(value);
        }
        
        if (key === 'streamlineDensity') {
            this.streamlineCacheValid = false;
        }
        
        if (key === 'showStaticVectors' || key === 'gradientQuantity') {
            this.velocityFieldCacheValid = false;
        }
    }

    // Getters
    getView() {
        return this.view;
    }

    getFPS() {
        return this.fps;
    }

    getWorldBounds() {
        return this.view.getWorldBounds(this.width, this.height);
    }
}
