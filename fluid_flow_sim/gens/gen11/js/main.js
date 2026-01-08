/**
 * Main Application Controller
 * Entry point for the 2D Flow Simulation
 */

import { FlowElementsManager } from './flowElements.js';
import { ParticleSystem } from './particleSystem.js';
import { FluidProperties, NavierStokesSolver, StreamlineGenerator, VelocityFieldGenerator } from './physics.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './inputHandler.js';
import { UIController } from './uiController.js';
import { ProbeTool } from './probeTool.js';
import { createPreset } from './presets.js';

/**
 * Main Simulation Class
 */
class FlowSimulation {
    constructor() {
        // Get canvas element
        this.canvas = document.getElementById('simulation-canvas');
        
        // Core systems
        this.flowManager = new FlowElementsManager();
        this.particleSystem = new ParticleSystem(this.flowManager);
        
        // Physics
        this.fluidProperties = new FluidProperties();
        this.physics = new NavierStokesSolver(this.flowManager, this.fluidProperties);
        this.streamlineGenerator = new StreamlineGenerator(this.flowManager);
        this.velocityFieldGenerator = new VelocityFieldGenerator(this.flowManager);
        
        // Rendering
        this.renderer = new Renderer(this.canvas);
        
        // Input handling
        this.input = new InputHandler(this.canvas, this.renderer.view);
        
        // Probe tool
        this.probe = new ProbeTool(document.getElementById('probe-display'));
        
        // UI Controller
        this.ui = new UIController(this);
        
        // Simulation state
        this.paused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.time = 0;
        
        // Initialize
        this.init();
    }

    init() {
        // Set up event listeners
        this.setupInputHandlers();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.renderer.resize();
            this.renderer.invalidateCache();
        });
        
        // Load a default preset
        this.loadDefaultPreset();
        
        // Start the animation loop
        requestAnimationFrame(this.animate.bind(this));
    }

    setupInputHandlers() {
        // Click to add element at position (when clicking on empty space)
        this.input.on('click', e => {
            // Check if clicking on an existing element
            const element = this.flowManager.getElementAt(e.world.x, e.world.y);
            
            if (element) {
                // Select the element
                this.ui.selectElement(element.id);
            }
        });
        
        // Double-click to edit element
        this.input.on('dblclick', e => {
            const element = this.flowManager.getElementAt(e.world.x, e.world.y);
            if (element) {
                this.ui.openElementEditor(element.id);
            }
        });
        
        // Mouse down on element - start dragging
        this.input.on('mousedown', e => {
            if (e.button !== 0) return;
            
            const element = this.flowManager.getElementAt(e.world.x, e.world.y);
            if (element && element.type !== 'uniform') {
                this.input.setDraggingElement(element);
            }
        });
        
        // Element drag
        this.input.on('elementdrag', e => {
            e.element.position.add(e.delta);
            this.renderer.invalidateCache();
        });
        
        // View change (pan/zoom)
        this.input.on('viewchange', () => {
            this.renderer.invalidateCache();
            this.ui.updateViewInfo();
        });
        
        // Mouse move for probe
        this.input.on('mousemove', e => {
            if (this.probe.enabled) {
                this.probe.updatePosition(e.screen.x, e.screen.y, e.world.x, e.world.y);
            }
        });
    }

    loadDefaultPreset() {
        // Start with flow over cylinder
        const elements = createPreset('cylinder');
        for (const element of elements) {
            this.flowManager.add(element);
        }
        this.ui.updateElementsList();
    }

    /**
     * Main animation loop
     */
    animate(timestamp) {
        // Calculate delta time
        this.deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;
        
        if (!this.paused) {
            this.time += this.deltaTime * this.fluidProperties.timeScale;
            this.update(this.deltaTime * this.fluidProperties.timeScale);
        }
        
        this.render(timestamp);
        
        // Update UI stats
        this.ui.updateStats(this.renderer.getFPS(), this.particleSystem.activeCount);
        
        // Continue loop
        requestAnimationFrame(this.animate.bind(this));
    }

    /**
     * Update simulation state
     */
    update(dt) {
        // Get view bounds for particle system
        const viewBounds = this.renderer.getWorldBounds();
        
        // Update particle system
        this.particleSystem.update(dt, viewBounds);
        
        // Update probe if enabled
        if (this.probe.enabled) {
            this.probe.update(this.physics, this.time * 1000);
        }
    }

    /**
     * Render the simulation
     */
    render(timestamp) {
        this.renderer.render(this, timestamp);
    }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.simulation = new FlowSimulation();
});
