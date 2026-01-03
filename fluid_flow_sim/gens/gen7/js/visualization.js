/**
 * Visualization Module
 * Handles rendering of flow fields, streamlines, gradients, and vectors
 */

class FlowVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Settings
        this.settings = {
            showStreamlines: true,
            showPotentialLines: false,
            showVectors: false,
            showParticles: true,
            showGradient: false,
            numLines: 30,
            lineThickness: 1,
            lineOpacity: 0.8,
            palette: 'viridis',
            gradientQuantity: 'velocity'
        };
        
        // Domain
        this.domain = {
            xMin: -5,
            xMax: 5,
            yMin: -5,
            yMax: 5
        };
        
        // Caching for performance
        this.cache = {
            streamlines: null,
            potentialLines: null,
            lastNumLines: 30,
            lastDomainStr: '',
            needsStreamlineUpdate: true,
            needsPotentialUpdate: true
        };
        
        // Offscreen canvas for gradient (much faster)
        this.gradientCanvas = document.createElement('canvas');
        this.gradientCtx = this.gradientCanvas.getContext('2d');
        this.gradientResolution = 80; // Low res for speed
        this.gradientCanvas.width = this.gradientResolution;
        this.gradientCanvas.height = this.gradientResolution;
    }

    /**
     * Resize canvas to fit container
     */
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
        
        this.invalidateCache();
    }

    /**
     * Invalidate all caches
     */
    invalidateCache() {
        this.cache.needsStreamlineUpdate = true;
        this.cache.needsPotentialUpdate = true;
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(x, y) {
        const sx = ((x - this.domain.xMin) / (this.domain.xMax - this.domain.xMin)) * this.width;
        const sy = this.height - ((y - this.domain.yMin) / (this.domain.yMax - this.domain.yMin)) * this.height;
        return { x: sx, y: sy };
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(sx, sy) {
        const x = this.domain.xMin + (sx / this.width) * (this.domain.xMax - this.domain.xMin);
        const y = this.domain.yMax - (sy / this.height) * (this.domain.yMax - this.domain.yMin);
        return { x, y };
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        if (newSettings.numLines !== undefined && newSettings.numLines !== this.settings.numLines) {
            this.cache.needsStreamlineUpdate = true;
            this.cache.needsPotentialUpdate = true;
        }
        Object.assign(this.settings, newSettings);
    }

    /**
     * Set domain
     */
    setDomain(xMin, xMax, yMin, yMax) {
        const domainStr = `${xMin},${xMax},${yMin},${yMax}`;
        if (this.cache.lastDomainStr !== domainStr) {
            this.domain = { xMin, xMax, yMin, yMax };
            this.cache.lastDomainStr = domainStr;
            this.invalidateCache();
        }
    }

    /**
     * Render gradient background (optimized with offscreen canvas)
     */
    renderGradient(fieldData) {
        if (!this.settings.showGradient) return;
        
        const { data, range, nx, ny } = fieldData;
        const gw = this.gradientResolution;
        const gh = this.gradientResolution;
        
        // Render to small offscreen canvas
        const imageData = this.gradientCtx.createImageData(gw, gh);
        const pixels = imageData.data;
        
        for (let sy = 0; sy < gh; sy++) {
            for (let sx = 0; sx < gw; sx++) {
                // Map to field grid using nearest neighbor (fast)
                const i = Math.floor((sx / gw) * (nx - 1));
                const j = Math.floor(((gh - 1 - sy) / gh) * (ny - 1));
                const value = data[j * nx + i] || 0;
                
                const t = MathUtils.normalize(value, range.min, range.max);
                const color = ColorPalettes.getColor(this.settings.palette, t);
                
                const idx = (sy * gw + sx) * 4;
                pixels[idx] = Math.round(color.r * 255);
                pixels[idx + 1] = Math.round(color.g * 255);
                pixels[idx + 2] = Math.round(color.b * 255);
                pixels[idx + 3] = 180;
            }
        }
        
        this.gradientCtx.putImageData(imageData, 0, 0);
        
        // Scale up to main canvas with smoothing
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'medium';
        this.ctx.drawImage(this.gradientCanvas, 0, 0, this.width, this.height);
    }

    /**
     * Render streamlines using marching squares contours
     */
    renderStreamlines(segments, color = '#58a6ff') {
        if (!this.settings.showStreamlines || segments.length === 0) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = this.settings.lineThickness;
        this.ctx.globalAlpha = this.settings.lineOpacity;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        
        for (const seg of segments) {
            const p1 = this.worldToScreen(seg.x1, seg.y1);
            const p2 = this.worldToScreen(seg.x2, seg.y2);
            
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
        }
        
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
    }

    /**
     * Render potential lines
     */
    renderPotentialLines(segments, color = '#3fb950') {
        if (!this.settings.showPotentialLines || segments.length === 0) return;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = this.settings.lineThickness * 0.75;
        this.ctx.globalAlpha = this.settings.lineOpacity * 0.6;
        this.ctx.setLineDash([4, 4]);
        
        this.ctx.beginPath();
        
        for (const seg of segments) {
            const p1 = this.worldToScreen(seg.x1, seg.y1);
            const p2 = this.worldToScreen(seg.x2, seg.y2);
            
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;
    }

    /**
     * Render velocity vectors
     */
    renderVelocityVectors(velocityFunc, spacing = 20) {
        if (!this.settings.showVectors) return;
        
        const arrowSize = 8;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.6;
        
        for (let sx = spacing / 2; sx < this.width; sx += spacing) {
            for (let sy = spacing / 2; sy < this.height; sy += spacing) {
                const world = this.screenToWorld(sx, sy);
                const vel = velocityFunc(world.x, world.y);
                const mag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
                
                if (mag < MathUtils.EPSILON) continue;
                
                // Normalize and scale
                const scale = Math.min(spacing * 0.8, mag * spacing * 0.3);
                const dx = (vel.u / mag) * scale;
                const dy = -(vel.v / mag) * scale; // Flip y for screen coords
                
                // Draw arrow
                this.ctx.beginPath();
                this.ctx.moveTo(sx, sy);
                this.ctx.lineTo(sx + dx, sy + dy);
                this.ctx.stroke();
                
                // Arrowhead
                const angle = Math.atan2(dy, dx);
                this.ctx.beginPath();
                this.ctx.moveTo(sx + dx, sy + dy);
                this.ctx.lineTo(
                    sx + dx - arrowSize * Math.cos(angle - 0.4),
                    sy + dy - arrowSize * Math.sin(angle - 0.4)
                );
                this.ctx.lineTo(
                    sx + dx - arrowSize * Math.cos(angle + 0.4),
                    sy + dy - arrowSize * Math.sin(angle + 0.4)
                );
                this.ctx.closePath();
                this.ctx.fill();
            }
        }
        
        this.ctx.globalAlpha = 1;
    }

    /**
     * Render flow element markers
     */
    renderElementMarkers(elements) {
        for (const element of elements) {
            if (!element.enabled) continue;
            
            const pos = this.worldToScreen(element.x, element.y);
            const color = ColorPalettes.getElementColor(element.type);
            
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            
            // Draw marker based on type
            switch (element.type) {
                case 'uniform':
                    // Arrow symbol at center
                    this.drawArrow(this.width / 2, this.height / 2, element.U * 20, element.alpha, color);
                    break;
                    
                case 'source':
                    this.drawCircleMarker(pos.x, pos.y, 8, color, '+');
                    break;
                    
                case 'sink':
                    this.drawCircleMarker(pos.x, pos.y, 8, color, '−');
                    break;
                    
                case 'doublet':
                    this.drawDoubletMarker(pos.x, pos.y, 10, color, element.angle);
                    break;
                    
                case 'vortex':
                    this.drawVortexMarker(pos.x, pos.y, 10, color, element.gamma > 0);
                    break;
            }
        }
    }

    /**
     * Draw circle marker with symbol
     */
    drawCircleMarker(x, y, r, color, symbol) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, MathUtils.TWO_PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(symbol, x, y);
    }

    /**
     * Draw arrow for uniform flow
     */
    drawArrow(x, y, length, angle, color) {
        const dx = length * Math.cos(angle);
        const dy = -length * Math.sin(angle);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(x - dx, y - dy);
        this.ctx.lineTo(x + dx, y + dy);
        this.ctx.stroke();
        
        // Arrowhead
        const headLen = 10;
        const headAngle = Math.atan2(-dy, dx);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x + dx, y + dy);
        this.ctx.lineTo(
            x + dx - headLen * Math.cos(headAngle - 0.4),
            y + dy - headLen * Math.sin(headAngle - 0.4)
        );
        this.ctx.lineTo(
            x + dx - headLen * Math.cos(headAngle + 0.4),
            y + dy - headLen * Math.sin(headAngle + 0.4)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Draw doublet marker
     */
    drawDoubletMarker(x, y, r, color, angle) {
        const dx = r * Math.cos(angle);
        const dy = -r * Math.sin(angle);
        
        // Plus side
        this.ctx.beginPath();
        this.ctx.arc(x - dx * 0.5, y - dy * 0.5, r * 0.6, 0, MathUtils.TWO_PI);
        this.ctx.fillStyle = '#3fb950';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();
        
        // Minus side
        this.ctx.beginPath();
        this.ctx.arc(x + dx * 0.5, y + dy * 0.5, r * 0.6, 0, MathUtils.TWO_PI);
        this.ctx.fillStyle = '#f85149';
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Draw vortex marker
     */
    drawVortexMarker(x, y, r, color, counterclockwise) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        
        // Spiral
        this.ctx.beginPath();
        for (let t = 0; t < MathUtils.TWO_PI * 1.5; t += 0.1) {
            const rr = r * (0.3 + t / (MathUtils.TWO_PI * 2));
            const dir = counterclockwise ? 1 : -1;
            const px = x + rr * Math.cos(dir * t);
            const py = y + rr * Math.sin(dir * t);
            
            if (t === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        this.ctx.stroke();
        
        // Center dot
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, MathUtils.TWO_PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    /**
     * Render NS obstacles
     */
    renderObstacles(obstacles, N, M) {
        this.ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        
        const cellWidth = this.width / N;
        const cellHeight = this.height / M;
        
        for (let j = 0; j < M; j++) {
            for (let i = 0; i < N; i++) {
                const idx = (i + 1) + (N + 2) * (j + 1);
                if (obstacles[idx]) {
                    const sx = i * cellWidth;
                    const sy = (M - 1 - j) * cellHeight;
                    this.ctx.fillRect(sx, sy, cellWidth + 1, cellHeight + 1);
                }
            }
        }
    }

    /**
     * Render for potential flow mode (with caching)
     */
    renderPotentialFlow(potentialFlow) {
        this.clear();
        
        // Sync domain
        this.setDomain(
            potentialFlow.domain.xMin,
            potentialFlow.domain.xMax,
            potentialFlow.domain.yMin,
            potentialFlow.domain.yMax
        );
        
        // Gradient background
        if (this.settings.showGradient) {
            const fieldData = potentialFlow.getFieldData(this.settings.gradientQuantity);
            this.renderGradient(fieldData);
        }
        
        // Cached streamlines - only recalculate when needed
        if (this.settings.showStreamlines) {
            if (this.cache.needsStreamlineUpdate || !this.cache.streamlines) {
                this.cache.streamlines = potentialFlow.getStreamlines(this.settings.numLines);
                this.cache.needsStreamlineUpdate = false;
            }
            this.renderStreamlines(this.cache.streamlines);
        }
        
        // Cached potential lines
        if (this.settings.showPotentialLines) {
            if (this.cache.needsPotentialUpdate || !this.cache.potentialLines) {
                this.cache.potentialLines = potentialFlow.getPotentialLines(this.settings.numLines);
                this.cache.needsPotentialUpdate = false;
            }
            this.renderPotentialLines(this.cache.potentialLines);
        }
        
        // Velocity vectors
        if (this.settings.showVectors) {
            this.renderVelocityVectors((x, y) => potentialFlow.velocity(x, y));
        }
        
        // Element markers
        this.renderElementMarkers(potentialFlow.elements);
    }

    /**
     * Render for Navier-Stokes mode
     */
    renderNavierStokes(nsSolver) {
        this.clear();
        
        // Gradient background
        const fieldData = nsSolver.getFieldData(this.settings.gradientQuantity);
        this.renderGradient(fieldData);
        
        // Velocity vectors
        if (this.settings.showVectors) {
            this.renderVelocityVectors((x, y) => nsSolver.getVelocity(x, y));
        }
        
        // Obstacles
        this.renderObstacles(nsSolver.obstacle, nsSolver.N, nsSolver.M);
    }
}

// Export
window.FlowVisualization = FlowVisualization;
