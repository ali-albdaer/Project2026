/**
 * Main Entry Point
 * Initializes and runs the flow simulation
 */

import { Config, State } from './config.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { UIManager } from './ui.js';
import { loadPreset } from './presets.js';

/**
 * Application class
 */
class FlowSimApp {
    constructor() {
        this.canvas = document.getElementById('flowCanvas');
        this.simulation = null;
        this.renderer = null;
        this.input = null;
        this.ui = null;
        
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.currentFps = 60;
        
        this.init();
    }
    
    /**
     * Initialize application
     */
    init() {
        console.log('FlowSim - 2D Flow Simulation');
        console.log('Initializing...');
        
        // Create core components
        this.simulation = new Simulation();
        this.renderer = new Renderer(this.canvas);
        this.ui = new UIManager(this.simulation);
        this.input = new InputHandler(this.canvas, this.renderer, this.simulation, this.ui);
        
        // Load default preset
        this.loadInitialPreset();
        
        // Start animation loop
        this.lastFrameTime = performance.now();
        this.animate();
        
        console.log('Initialization complete');
        console.log('Keyboard shortcuts:');
        console.log('  Space - Play/Pause');
        console.log('  H - Hide UI');
        console.log('  P - Toggle Particles');
        console.log('  V - Toggle Velocity Vectors');
        console.log('  S - Toggle Streamlines');
        console.log('  K - Toggle Streaklines');
        console.log('  F - Toggle Static Vector Field');
        console.log('  T - Toggle Probe Tool');
        console.log('  R - Reset View');
        console.log('  Q/E - Toggle Left/Right Menu');
        console.log('  Delete - Delete Selected Element');
        console.log('  Backspace - Reset Simulation');
    }
    
    /**
     * Load initial preset
     */
    loadInitialPreset() {
        // Start with cylinder flow as it's visually interesting
        const elements = loadPreset('cylinder');
        State.flowElements = elements;
        this.ui.updateElementList();
        
        // Activate preset button
        document.querySelector('[data-preset="cylinder"]')?.classList.add('active');
    }
    
    /**
     * Main animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = performance.now();
        const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
        this.lastFrameTime = now;
        
        // Update FPS counter
        this.frameCount++;
        if (now - this.fpsUpdateTime >= 500) {
            this.currentFps = this.frameCount / ((now - this.fpsUpdateTime) / 1000);
            this.ui.updateFPSDisplay(this.currentFps);
            this.frameCount = 0;
            this.fpsUpdateTime = now;
        }
        
        // Update simulation
        this.simulation.update(dt);
        
        // Update time display
        this.ui.updateTimeDisplay();
        
        // Render
        this.renderer.render(this.simulation);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FlowSimApp();
});
