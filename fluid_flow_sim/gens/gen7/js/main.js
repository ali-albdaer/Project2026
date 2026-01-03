/**
 * Main Application
 * Initializes and coordinates all simulation components
 */

class FluidFlowApp {
    constructor() {
        // Get canvas elements
        this.flowCanvas = document.getElementById('flowCanvas');
        this.gridCanvas = document.getElementById('gridCanvas');
        this.uiCanvas = document.getElementById('uiCanvas');
        
        // Initialize components
        this.potentialFlow = new PotentialFlow();
        this.nsSolver = new NavierStokesSolver(128, 128);
        this.visualization = new FlowVisualization(this.flowCanvas);
        this.particles = new ParticleSystem(this.uiCanvas);
        
        // Grid canvas context
        this.gridCtx = this.gridCanvas.getContext('2d');
        
        // Obstacle type for NS mode
        this.obstacleType = 'none';
        
        // Animation state
        this.lastTime = 0;
        this.animationId = null;
        
        // Initialize UI controller
        this.ui = new UIController(this);
        
        // Setup
        this.resize();
        this.loadDefaultScene();
        
        // Initialize particles since they are enabled by default
        this.particles.init();
        
        this.start();
    }

    /**
     * Resize all canvases
     */
    resize() {
        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Resize all canvases
        [this.flowCanvas, this.gridCanvas, this.uiCanvas].forEach(canvas => {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            canvas.getContext('2d').scale(dpr, dpr);
        });
        
        // Update visualization size
        this.visualization.width = rect.width;
        this.visualization.height = rect.height;
        this.visualization.gradientNeedsUpdate = true;
        
        // Render grid
        this.renderGrid();
    }

    /**
     * Render grid overlay
     */
    renderGrid() {
        const ctx = this.gridCtx;
        const width = this.gridCanvas.width / (window.devicePixelRatio || 1);
        const height = this.gridCanvas.height / (window.devicePixelRatio || 1);
        
        ctx.clearRect(0, 0, width, height);
        
        if (!this.ui.showGrid) return;
        
        const domain = this.visualization.domain;
        const gridSpacing = 1; // 1 unit grid
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = Math.ceil(domain.xMin); x <= domain.xMax; x += gridSpacing) {
            const sx = this.visualization.worldToScreen(x, 0).x;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = Math.ceil(domain.yMin); y <= domain.yMax; y += gridSpacing) {
            const sy = this.visualization.worldToScreen(0, y).y;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(width, sy);
            ctx.stroke();
        }
        
        // Origin axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        
        const origin = this.visualization.worldToScreen(0, 0);
        
        // X axis
        ctx.beginPath();
        ctx.moveTo(0, origin.y);
        ctx.lineTo(width, origin.y);
        ctx.stroke();
        
        // Y axis
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, height);
        ctx.stroke();
        
        // Axis labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px sans-serif';
        ctx.fillText('x', width - 15, origin.y - 5);
        ctx.fillText('y', origin.x + 5, 15);
    }

    /**
     * Load default scene
     */
    loadDefaultScene() {
        // Start with cylinder flow preset
        this.potentialFlow.addElement(new UniformFlow(1, 0));
        this.potentialFlow.addElement(new Doublet(0, 0, 4, 0));
        this.ui.updateElementsList();
    }

    /**
     * Main animation loop
     */
    animate(currentTime) {
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        
        if (this.ui.mode === 'potential') {
            this.updatePotentialFlow(dt);
        } else {
            this.updateNavierStokes(dt);
        }
        
        this.animationId = requestAnimationFrame((t) => this.animate(t));
    }

    /**
     * Update potential flow mode
     */
    updatePotentialFlow(dt) {
        // Check if flow field changed and invalidate visualization cache
        if (this.potentialFlow.needsUpdate) {
            this.visualization.invalidateCache();
            // Note: needsUpdate will be reset by potentialFlow when it recalculates its fields
        }
        
        // Render flow field
        this.visualization.renderPotentialFlow(this.potentialFlow);
        
        // Update and render particles
        if (this.particles.enabled) {
            this.particles.setDomain(
                this.potentialFlow.domain.xMin,
                this.potentialFlow.domain.xMax,
                this.potentialFlow.domain.yMin,
                this.potentialFlow.domain.yMax
            );
            this.particles.setVelocityFunction((x, y) => this.potentialFlow.velocity(x, y));
            this.particles.maxVelocity = this.potentialFlow.getVinfinity() * 2;
            this.particles.update(dt);
            this.particles.clear();
            this.particles.render(this.visualization);
        } else {
            this.particles.clear();
        }
        
        // Update legend range
        this.updateLegendRange();
    }

    /**
     * Update Navier-Stokes mode
     */
    updateNavierStokes(dt) {
        // Step simulation if running
        if (this.nsSolver.isRunning) {
            // Multiple substeps for stability
            const substeps = 2;
            for (let i = 0; i < substeps; i++) {
                this.nsSolver.step();
            }
            
            // Add continuous inlet dye
            if (this.nsSolver.boundaryType === 'inlet-outlet') {
                for (let j = 0; j < 10; j++) {
                    const y = 0.3 + Math.random() * 0.4;
                    this.nsSolver.addDensity(0.02, y, 3);
                }
            }
        }
        
        // Render
        this.visualization.settings.showGradient = true;
        this.visualization.renderNavierStokes(this.nsSolver);
        
        // Particles for NS
        if (this.particles.enabled) {
            this.particles.setVelocityFunction((x, y) => this.nsSolver.getVelocity(x, y));
            this.particles.update(dt);
            this.particles.clear();
            this.particles.render(this.visualization);
        } else {
            this.particles.clear();
        }
        
        // Update legend range
        this.updateLegendRange();
    }

    /**
     * Update legend range display
     */
    updateLegendRange() {
        const quantity = this.visualization.settings.gradientQuantity;
        let range;
        
        if (this.ui.mode === 'potential') {
            const fieldData = this.potentialFlow.getFieldData(quantity);
            range = fieldData.range;
        } else {
            const fieldData = this.nsSolver.getFieldData(quantity);
            range = fieldData.range;
        }
        
        document.getElementById('legend-min').textContent = range.min.toFixed(2);
        document.getElementById('legend-max').textContent = range.max.toFixed(2);
        
        // Show/hide legend based on gradient setting
        const legend = document.getElementById('color-legend');
        if (this.visualization.settings.showGradient) {
            legend.classList.remove('hidden');
        } else {
            legend.classList.add('hidden');
        }
    }

    /**
     * Start animation
     */
    start() {
        this.lastTime = performance.now();
        this.animate(this.lastTime);
    }

    /**
     * Stop animation
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FluidFlowApp();
});
