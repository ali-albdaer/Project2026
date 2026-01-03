/**
 * Main application entry point
 */

class FluidApp {
    constructor() {
        this.simulation = null;
        this.ui = null;
        this.isInitialized = false;
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        try {
            console.log('Initializing Fluid Flow Simulation...');
            
            // Get canvas elements
            const canvas = document.getElementById('simulationCanvas');
            const colorBarCanvas = document.getElementById('colorBar');
            
            if (!canvas || !colorBarCanvas) {
                throw new Error('Required canvas elements not found');
            }

            // Initialize simulation
            this.simulation = new FluidSimulation(canvas, colorBarCanvas);
            
            // Initialize UI controller
            this.ui = new UIController(this.simulation);
            
            // Set up additional features
            this.setupAdditionalFeatures();
            
            this.isInitialized = true;
            console.log('Fluid Flow Simulation initialized successfully');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    setupAdditionalFeatures() {
        // Initialize keyboard shortcuts
        this.ui.initializeKeyboardShortcuts();
        
        // Add performance controls
        this.ui.addPerformanceControls();
        
        // Set up window resize handler
        this.setupResizeHandler();
        
        // Set up error handling
        this.setupErrorHandling();
        
        // Initialize tooltips and help system
        this.initializeHelpSystem();
    }

    setupResizeHandler() {
        let resizeTimeout;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.simulation) {
                    this.simulation.resize();
                }
            }, 250);
        });
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Application error:', event.error);
            this.showError('An unexpected error occurred. Some features may not work properly.');
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('A background operation failed. Please check the console for details.');
        });
    }

    initializeHelpSystem() {
        // Add help tooltips
        const helpTexts = {
            'flowType': 'Select different types of fluid flows to simulate',
            'visualMode': 'Choose how to visualize the flow field',
            'colorMap': 'Select color scheme for scalar field visualization',
            'timeStep': 'Control simulation speed and accuracy',
            'showGrid': 'Display coordinate grid overlay',
            'showBoundary': 'Show flow boundaries and obstacles',
            'showProbe': 'Enable mouse hover probe tool for detailed information'
        };

        Object.keys(helpTexts).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.title = helpTexts[id];
            }
        });

        // Add help button to header
        this.addHelpButton();
    }

    addHelpButton() {
        const headerControls = document.querySelector('.header-controls');
        
        const helpButton = document.createElement('button');
        helpButton.className = 'btn-secondary';
        helpButton.innerHTML = '<i class="fas fa-question-circle"></i> Help';
        helpButton.addEventListener('click', () => this.showHelpModal());
        
        headerControls.appendChild(helpButton);
    }

    showHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'help-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-info-circle"></i> Fluid Flow Simulation Help</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="help-section">
                        <h3>Flow Types</h3>
                        <ul>
                            <li><strong>Uniform Flow:</strong> Constant velocity field</li>
                            <li><strong>Source/Sink:</strong> Radial flow from/to a point</li>
                            <li><strong>Vortex:</strong> Circular flow around a point</li>
                            <li><strong>Doublet:</strong> Combination of source and sink</li>
                            <li><strong>Half-Body:</strong> Flow around a streamlined body</li>
                            <li><strong>Cylinder:</strong> Potential flow around circular cylinder</li>
                            <li><strong>Cylinder + Circulation:</strong> Cylinder with lift generation</li>
                            <li><strong>Poiseuille:</strong> Viscous flow between parallel plates</li>
                            <li><strong>Couette:</strong> Viscous shear flow</li>
                            <li><strong>Custom:</strong> User-defined velocity equations</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h3>Visualization Modes</h3>
                        <ul>
                            <li><strong>Velocity:</strong> Color-coded velocity magnitude</li>
                            <li><strong>Pressure:</strong> Pressure distribution</li>
                            <li><strong>Streamlines:</strong> Flow path lines</li>
                            <li><strong>Vorticity:</strong> Local rotation of fluid</li>
                            <li><strong>Velocity Vectors:</strong> Arrow representation of velocity</li>
                            <li><strong>Potential:</strong> Velocity potential function</li>
                            <li><strong>Stream Function:</strong> Stream function contours</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h3>Controls</h3>
                        <ul>
                            <li><strong>Space:</strong> Toggle play/pause</li>
                            <li><strong>Ctrl+R:</strong> Reset simulation</li>
                            <li><strong>Ctrl+S:</strong> Export configuration</li>
                            <li><strong>Mouse Hover:</strong> Probe tool (when enabled)</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h3>Mathematical Background</h3>
                        <p>This simulation implements various solutions to the Navier-Stokes equations and related fluid mechanics principles including:</p>
                        <ul>
                            <li>Continuity equation (conservation of mass)</li>
                            <li>Momentum conservation (Euler and Navier-Stokes equations)</li>
                            <li>Potential flow theory (irrotational, inviscid flows)</li>
                            <li>Exact viscous flow solutions</li>
                            <li>Stream function and velocity potential concepts</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const modalContent = modal.querySelector('.modal-content');
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            padding: 2rem;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        // Close button functionality
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        document.body.appendChild(modal);
    }

    showWelcomeMessage() {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'welcome-message';
        welcomeMsg.innerHTML = `
            <div class="welcome-content">
                <h3><i class="fas fa-rocket"></i> Welcome to Fluid Flow Simulation!</h3>
                <p>Explore various fluid mechanics concepts through interactive visualizations.</p>
                <p>Use the controls on the left to select different flow types and visualization modes.</p>
                <button class="btn-primary" onclick="this.parentElement.parentElement.remove()">
                    Get Started <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `;

        welcomeMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #64ffda;
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            z-index: 1000;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        `;

        document.body.appendChild(welcomeMsg);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (welcomeMsg.parentElement) {
                welcomeMsg.remove();
            }
        }, 10000);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4444;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 1rem;
            box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
        `;

        document.body.appendChild(errorDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // Public API for external control
    getSimulation() {
        return this.simulation;
    }

    getUI() {
        return this.ui;
    }

    isReady() {
        return this.isInitialized;
    }

    // Performance monitoring
    getPerformanceInfo() {
        if (!this.simulation) return null;

        return {
            isRunning: this.simulation.isRunning,
            currentTime: this.simulation.time,
            frameRate: this.simulation.frameCount,
            renderMode: this.simulation.visualMode
        };
    }

    // Debug utilities
    enableDebugMode() {
        console.log('Debug mode enabled');
        
        // Add debug panel
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.8rem;
            z-index: 1000;
        `;
        document.body.appendChild(debugPanel);

        // Update debug info periodically
        const updateDebug = () => {
            if (!this.simulation) return;
            
            const info = this.getPerformanceInfo();
            debugPanel.innerHTML = `
                <div>Running: ${info.isRunning}</div>
                <div>Time: ${info.currentTime.toFixed(2)}s</div>
                <div>Mode: ${info.renderMode}</div>
                <div>Memory: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(1) || 'N/A'}MB</div>
            `;
        };

        setInterval(updateDebug, 1000);
    }
}

// Initialize application when script loads
const app = new FluidApp();

// Expose app globally for debugging
window.fluidApp = app;

// Add some global utility functions
window.exportSimulationData = function() {
    if (app.isReady()) {
        const data = app.getSimulation().exportData();
        console.log('Simulation data:', data);
        return data;
    }
};

window.toggleDebugMode = function() {
    app.enableDebugMode();
};

// Service Worker registration for offline capability (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered:', registration))
        //     .catch(error => console.log('SW registration failed:', error));
    });
}