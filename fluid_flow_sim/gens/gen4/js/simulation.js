/**
 * Main simulation engine
 */

class FluidSimulation {
    constructor(canvas, colorBarCanvas) {
        this.canvas = canvas;
        this.renderer = new FlowRenderer(canvas);
        this.colorBarCanvas = colorBarCanvas;
        
        // Simulation state
        this.isRunning = false;
        this.time = 0;
        this.timeStep = 0.016; // ~60 FPS
        this.lastFrameTime = 0;
        
        // Current flow field - start with uniform flow
        this.flowField = FlowFactory.createFlow('uniform', { U: 1, angle: 0 });
        this.visualMode = 'velocity';
        
        // Animation frame ID for cleanup
        this.animationId = null;
        
        // Performance monitoring
        this.frameCount = 0;
        this.fpsStartTime = Date.now();
        
        this.setupEventListeners();
        this.resize();
        
        // Force initial render
        setTimeout(() => {
            this.render();
        }, 100);
        
        // Add test render to ensure canvas is working
        setTimeout(() => {
            this.testRender();
        }, 200);
    }

    setupEventListeners() {
        // Handle canvas resize
        window.addEventListener('resize', () => this.resize());
        
        // Handle mouse movement for probe tool
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.hideProbeInfo();
        });
    }

    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size with device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(rect.width, 400); // Minimum width
        const height = Math.max(rect.height, 300); // Minimum height
        
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // Scale context for device pixel ratio
        const ctx = this.canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        // Update renderer
        this.renderer.resize(width * dpr, height * dpr);
        
        // Force render current frame
        this.render();
    }

    setFlowType(type, parameters = {}) {
        const defaultParams = FlowFactory.getDefaultParameters(type);
        const mergedParams = { ...defaultParams, ...parameters };
        
        this.flowField = FlowFactory.createFlow(type, mergedParams);
        
        // Update domain based on flow type
        this.updateDomain(type);
        
        if (!this.isRunning) {
            this.render();
        }
    }

    updateDomain(flowType) {
        // Adjust domain based on flow characteristics
        switch (flowType) {
            case 'poiseuille':
            case 'couette':
                this.renderer.setDomain(-3, 8, -2, 2);
                break;
            case 'cylinder':
            case 'cylinderCirc':
                this.renderer.setDomain(-3, 5, -3, 3);
                break;
            case 'halfbody':
                this.renderer.setDomain(-2, 6, -3, 3);
                break;
            default:
                this.renderer.setDomain(-4, 4, -3, 3);
        }
    }

    setVisualizationMode(mode) {
        this.visualMode = mode;
        
        // Update renderer settings based on mode
        switch (mode) {
            case 'velocity-vectors':
                this.renderer.showVectors = true;
                break;
            case 'streamlines':
                this.renderer.streamlineDensity = 15;
                break;
            default:
                this.renderer.showVectors = false;
                break;
        }
        
        if (!this.isRunning) {
            this.render();
        }
    }

    setColorMap(colorMap) {
        this.renderer.colorMap = colorMap;
        this.updateColorBar();
        
        if (!this.isRunning) {
            this.render();
        }
    }

    updateFlowParameters(parameters) {
        if (this.flowField && this.flowField.parameters) {
            Object.assign(this.flowField.parameters, parameters);
            
            // Special handling for flows that need reconstruction
            if (this.flowField.constructor.name === 'HalfBodyFlow') {
                this.flowField.uniform.parameters.U = parameters.U || this.flowField.parameters.U;
                this.flowField.source.parameters.m = parameters.m || this.flowField.parameters.m;
            } else if (this.flowField.constructor.name === 'CylinderFlow') {
                this.flowField.uniform.parameters.U = parameters.U || this.flowField.parameters.U;
                this.flowField.doublet.parameters.kappa = 
                    (parameters.U || this.flowField.parameters.U) * 
                    Math.pow(parameters.R || this.flowField.parameters.R, 2);
            } else if (this.flowField.constructor.name === 'CylinderCirculationFlow') {
                this.flowField.uniform.parameters.U = parameters.U || this.flowField.parameters.U;
                this.flowField.doublet.parameters.kappa = 
                    (parameters.U || this.flowField.parameters.U) * 
                    Math.pow(parameters.R || this.flowField.parameters.R, 2);
                this.flowField.vortex.parameters.gamma = parameters.gamma || this.flowField.parameters.gamma;
            }
            
            if (!this.isRunning) {
                this.render();
            }
        }
    }

    updateCustomEquations(uEquation, vEquation) {
        if (this.flowField instanceof CustomFlow) {
            this.flowField.setEquations(uEquation, vEquation);
            
            if (!this.isRunning) {
                this.render();
            }
        }
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            this.animate();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.time = 0;
        this.flowField.time = 0;
        
        if (!this.isRunning) {
            this.render();
        }
    }

    animate() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = currentTime;

        // Update simulation
        this.update(deltaTime);
        
        // Render frame
        this.render();
        
        // Schedule next frame
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Update FPS counter
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            const now = Date.now();
            const fps = 60000 / (now - this.fpsStartTime);
            this.fpsStartTime = now;
            // console.log(`FPS: ${fps.toFixed(1)}`);
        }
    }

    update(deltaTime) {
        // Use fixed time step for stability
        this.time += this.timeStep;
        
        if (this.flowField) {
            this.flowField.update(this.timeStep);
        }
    }

    render() {
        try {
            // Ensure we have a valid flow field
            if (!this.flowField) {
                this.flowField = FlowFactory.createFlow('uniform');
            }
            
            // Main visualization
            this.renderer.render(this.flowField, this.visualMode);
            
            // Update color bar
            this.updateColorBar();
            
        } catch (error) {
            console.error('Rendering error:', error);
            // Try to recover with a simple uniform flow
            this.flowField = FlowFactory.createFlow('uniform');
            if (this.renderer) {
                this.renderer.render(this.flowField, 'velocity');
            }
        }
    }

    updateColorBar() {
        if (this.colorBarCanvas && this.visualMode !== 'streamlines' && this.visualMode !== 'velocity-vectors') {
            this.renderer.renderColorBar(
                this.colorBarCanvas, 
                this.renderer.colorMap,
                this.renderer.valueRange.min,
                this.renderer.valueRange.max
            );
            
            // Update scale labels
            const scaleMin = document.querySelector('.scale-min');
            const scaleMax = document.querySelector('.scale-max');
            
            if (scaleMin && scaleMax) {
                scaleMin.textContent = this.renderer.valueRange.min.toFixed(2);
                scaleMax.textContent = this.renderer.valueRange.max.toFixed(2);
            }
        }
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convert to world coordinates
        const world = this.renderer.screenToWorld(x, y);
        
        // Check if point is within domain
        if (world.x >= this.renderer.domain.xMin && world.x <= this.renderer.domain.xMax &&
            world.y >= this.renderer.domain.yMin && world.y <= this.renderer.domain.yMax) {
            
            this.updateProbeInfo(world.x, world.y);
            this.showProbeInfo();
        } else {
            this.hideProbeInfo();
        }
    }

    updateProbeInfo(x, y) {
        if (!this.flowField) return;

        try {
            // Get flow properties at probe location
            const velocity = this.flowField.getVelocity(x, y);
            const pressure = this.flowField.getPressure ? this.flowField.getPressure(x, y) : 0;
            const vorticity = MathUtils.vorticity(this.flowField, x, y);

            // Update probe display
            document.getElementById('probeX').textContent = x.toFixed(2);
            document.getElementById('probeY').textContent = y.toFixed(2);
            document.getElementById('probeU').textContent = velocity.x.toFixed(3);
            document.getElementById('probeV').textContent = velocity.y.toFixed(3);
            document.getElementById('probeP').textContent = pressure.toFixed(3);
            document.getElementById('probeVort').textContent = vorticity.toFixed(3);

        } catch (error) {
            console.error('Error updating probe info:', error);
        }
    }

    showProbeInfo() {
        const probeElement = document.getElementById('probeInfo');
        if (probeElement && document.getElementById('showProbe').checked) {
            probeElement.classList.add('visible');
        }
    }

    hideProbeInfo() {
        const probeElement = document.getElementById('probeInfo');
        if (probeElement) {
            probeElement.classList.remove('visible');
        }
    }

    // Utility methods for external control
    setTimeStep(timeStep) {
        this.timeStep = Math.max(0.001, Math.min(0.1, timeStep));
    }

    setGridVisible(visible) {
        this.renderer.showGrid = visible;
        if (!this.isRunning) {
            this.render();
        }
    }

    setBoundaryVisible(visible) {
        this.renderer.showBoundary = visible;
        if (!this.isRunning) {
            this.render();
        }
    }

    setProbeVisible(visible) {
        if (!visible) {
            this.hideProbeInfo();
        }
    }

    // Export simulation data
    exportData() {
        const data = {
            time: this.time,
            flowType: this.flowField.constructor.name,
            parameters: this.flowField.parameters,
            visualMode: this.visualMode,
            colorMap: this.renderer.colorMap,
            domain: this.renderer.domain
        };
        
        return JSON.stringify(data, null, 2);
    }

    // Performance optimization
    setQuality(level) {
        switch (level) {
            case 'low':
                this.renderer.gridResolution = 50;
                this.renderer.streamlineDensity = 8;
                break;
            case 'medium':
                this.renderer.gridResolution = 100;
                this.renderer.streamlineDensity = 12;
                break;
            case 'high':
                this.renderer.gridResolution = 150;
                this.renderer.streamlineDensity = 20;
                break;
        }
        
        if (!this.isRunning) {
            this.render();
        }
    }    
    testRender() {
        console.log('Testing canvas render...');
        const ctx = this.canvas.getContext('2d');
        
        // Clear and fill with gradient
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 100, 100);
        
        ctx.fillStyle = 'blue';
        ctx.fillRect(this.canvas.width - 100, 0, 100, 100);
        
        ctx.fillStyle = 'green';
        ctx.fillRect(0, this.canvas.height - 100, 100, 100);
        
        ctx.fillStyle = 'yellow';
        ctx.fillRect(this.canvas.width - 100, this.canvas.height - 100, 100, 100);
        
        // Text
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText('TEST RENDER', this.canvas.width/2 - 60, this.canvas.height/2);
        
        console.log('Test render complete - canvas size:', this.canvas.width, 'x', this.canvas.height);
    }}

// Export for global use
window.FluidSimulation = FluidSimulation;