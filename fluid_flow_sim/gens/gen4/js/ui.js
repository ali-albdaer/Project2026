/**
 * User Interface controller
 */

class UIController {
    constructor(simulation) {
        this.simulation = simulation;
        this.currentFlowType = 'uniform';
        this.parameterControls = {};
        
        this.setupEventListeners();
        this.initializeUI();
    }

    setupEventListeners() {
        // Flow type selection
        document.getElementById('flowType').addEventListener('change', (e) => {
            this.handleFlowTypeChange(e.target.value);
        });

        // Visualization mode
        document.getElementById('visualMode').addEventListener('change', (e) => {
            this.simulation.setVisualizationMode(e.target.value);
            this.updateColorScaleVisibility(e.target.value);
        });

        // Color map selection
        document.getElementById('colorMap').addEventListener('change', (e) => {
            this.simulation.setColorMap(e.target.value);
        });

        // Play/Pause button
        document.getElementById('playPause').addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Reset button
        document.getElementById('reset').addEventListener('click', () => {
            this.simulation.reset();
        });

        // Time step control
        const timeStepSlider = document.getElementById('timeStep');
        const timeStepValue = document.getElementById('timeStepValue');
        
        timeStepSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.simulation.setTimeStep(value);
            timeStepValue.textContent = value.toFixed(3);
        });

        // Grid controls
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.simulation.setGridVisible(e.target.checked);
        });

        document.getElementById('showBoundary').addEventListener('change', (e) => {
            this.simulation.setBoundaryVisible(e.target.checked);
        });

        document.getElementById('showProbe').addEventListener('change', (e) => {
            this.simulation.setProbeVisible(e.target.checked);
        });

        // Equation editor
        document.getElementById('applyEquation').addEventListener('click', () => {
            this.handleCustomEquation();
        });

        // Fluid properties
        ['density', 'viscosity', 'temperature'].forEach(prop => {
            const input = document.getElementById(prop);
            if (input) {
                input.addEventListener('change', () => {
                    this.updateFluidProperties();
                });
            }
        });
    }

    initializeUI() {
        // Set initial flow type
        this.handleFlowTypeChange('uniform');
        
        // Initialize color scale visibility
        this.updateColorScaleVisibility('velocity');
        
        // Set initial time step display
        document.getElementById('timeStepValue').textContent = '0.016';
        
        // Force initial render after a short delay
        setTimeout(() => {
            this.simulation.render();
        }, 500);    }

    handleFlowTypeChange(flowType) {
        this.currentFlowType = flowType;
        
        // Create parameter controls
        this.createParameterControls(flowType);
        
        // Set flow in simulation
        const parameters = this.getParameterValues();
        this.simulation.setFlowType(flowType, parameters);
        
        // Update equation editor visibility
        this.updateEquationEditorVisibility(flowType);
        
        // Update UI state
        this.updateUIState(flowType);
    }

    createParameterControls(flowType) {
        const container = document.getElementById('parameterControls');
        container.innerHTML = '';
        
        const defaultParams = FlowFactory.getDefaultParameters(flowType);
        this.parameterControls = {};

        const parameterConfigs = this.getParameterConfigs(flowType);

        Object.keys(parameterConfigs).forEach(paramName => {
            const config = parameterConfigs[paramName];
            const value = defaultParams[paramName] || config.default;
            
            const group = document.createElement('div');
            group.className = 'parameter-group';

            const label = document.createElement('label');
            label.textContent = config.label;
            group.appendChild(label);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'slider';
            slider.min = config.min;
            slider.max = config.max;
            slider.step = config.step;
            slider.value = value;
            slider.id = `param_${paramName}`;

            const valueDisplay = document.createElement('div');
            valueDisplay.className = 'parameter-value';
            valueDisplay.textContent = value.toFixed(config.decimals || 2);
            valueDisplay.id = `value_${paramName}`;

            slider.addEventListener('input', (e) => {
                const newValue = parseFloat(e.target.value);
                valueDisplay.textContent = newValue.toFixed(config.decimals || 2);
                
                // Update simulation
                const parameters = this.getParameterValues();
                this.simulation.updateFlowParameters(parameters);
            });

            this.parameterControls[paramName] = {
                slider,
                valueDisplay,
                config
            };

            group.appendChild(slider);
            group.appendChild(valueDisplay);
            container.appendChild(group);
        });
    }

    getParameterConfigs(flowType) {
        const configs = {
            uniform: {
                U: { label: 'Velocity (U)', min: 0, max: 5, step: 0.1, default: 1 },
                angle: { label: 'Angle (°)', min: -180, max: 180, step: 5, default: 0 }
            },
            source: {
                m: { label: 'Strength (m)', min: -10, max: 10, step: 0.1, default: 2 },
                x0: { label: 'X Position', min: -3, max: 3, step: 0.1, default: 0 },
                y0: { label: 'Y Position', min: -3, max: 3, step: 0.1, default: 0 }
            },
            vortex: {
                gamma: { label: 'Circulation (Γ)', min: -10, max: 10, step: 0.1, default: 2 },
                x0: { label: 'X Position', min: -3, max: 3, step: 0.1, default: 0 },
                y0: { label: 'Y Position', min: -3, max: 3, step: 0.1, default: 0 }
            },
            doublet: {
                kappa: { label: 'Strength (κ)', min: 0, max: 10, step: 0.1, default: 2 },
                x0: { label: 'X Position', min: -3, max: 3, step: 0.1, default: 0 },
                y0: { label: 'Y Position', min: -3, max: 3, step: 0.1, default: 0 },
                angle: { label: 'Angle (°)', min: -180, max: 180, step: 5, default: 0 }
            },
            halfbody: {
                U: { label: 'Velocity (U)', min: 0.1, max: 3, step: 0.1, default: 1 },
                m: { label: 'Source Strength', min: 0.1, max: 5, step: 0.1, default: 2 },
                x0: { label: 'Source X Position', min: -3, max: 0, step: 0.1, default: -1 },
                y0: { label: 'Source Y Position', min: -2, max: 2, step: 0.1, default: 0 }
            },
            cylinder: {
                U: { label: 'Velocity (U)', min: 0.1, max: 3, step: 0.1, default: 1 },
                R: { label: 'Radius (R)', min: 0.2, max: 2, step: 0.1, default: 1 },
                x0: { label: 'X Position', min: -2, max: 2, step: 0.1, default: 0 },
                y0: { label: 'Y Position', min: -2, max: 2, step: 0.1, default: 0 }
            },
            cylinderCirc: {
                U: { label: 'Velocity (U)', min: 0.1, max: 3, step: 0.1, default: 1 },
                R: { label: 'Radius (R)', min: 0.2, max: 2, step: 0.1, default: 1 },
                gamma: { label: 'Circulation (Γ)', min: -8, max: 8, step: 0.2, default: 4 },
                x0: { label: 'X Position', min: -2, max: 2, step: 0.1, default: 0 },
                y0: { label: 'Y Position', min: -2, max: 2, step: 0.1, default: 0 }
            },
            poiseuille: {
                dpdk: { label: 'Pressure Gradient', min: -5, max: 0, step: 0.1, default: -1, decimals: 1 },
                mu: { label: 'Viscosity (μ)', min: 0.0001, max: 0.01, step: 0.0001, default: 0.001, decimals: 4 },
                h: { label: 'Half Height (h)', min: 0.5, max: 2, step: 0.1, default: 1, decimals: 1 }
            },
            couette: {
                U: { label: 'Wall Velocity (U)', min: 0, max: 3, step: 0.1, default: 1 },
                dpdk: { label: 'Pressure Gradient', min: -2, max: 2, step: 0.1, default: 0, decimals: 1 },
                mu: { label: 'Viscosity (μ)', min: 0.0001, max: 0.01, step: 0.0001, default: 0.001, decimals: 4 },
                h: { label: 'Half Height (h)', min: 0.5, max: 2, step: 0.1, default: 1, decimals: 1 }
            }
        };

        return configs[flowType] || {};
    }

    getParameterValues() {
        const values = {};
        
        Object.keys(this.parameterControls).forEach(paramName => {
            const control = this.parameterControls[paramName];
            values[paramName] = parseFloat(control.slider.value);
            
            // Convert angle to radians
            if (paramName === 'angle') {
                values[paramName] = values[paramName] * Math.PI / 180;
            }
        });

        return values;
    }

    updateEquationEditorVisibility(flowType) {
        const equationSection = document.getElementById('equationEditor').parentElement;
        
        if (flowType === 'custom') {
            equationSection.style.display = 'block';
        } else {
            equationSection.style.display = 'none';
        }
    }

    handleCustomEquation() {
        const equationText = document.getElementById('customEquation').value;
        const lines = equationText.split('\n').filter(line => line.trim());
        
        let uEquation = '0';
        let vEquation = '0';

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('u =') || trimmed.startsWith('u=')) {
                uEquation = trimmed.split('=')[1].trim();
            } else if (trimmed.startsWith('v =') || trimmed.startsWith('v=')) {
                vEquation = trimmed.split('=')[1].trim();
            }
        });

        this.simulation.updateCustomEquations(uEquation, vEquation);
    }

    updateFluidProperties() {
        const density = parseFloat(document.getElementById('density').value);
        const viscosity = parseFloat(document.getElementById('viscosity').value);
        const temperature = parseFloat(document.getElementById('temperature').value);

        // These properties don't directly affect the current flow calculations
        // but could be used for more advanced simulations
        console.log(`Fluid properties updated: ρ=${density}, μ=${viscosity}, T=${temperature}`);
    }

    togglePlayPause() {
        const button = document.getElementById('playPause');
        const icon = button.querySelector('i');
        
        if (this.simulation.isRunning) {
            this.simulation.stop();
            icon.className = 'fas fa-play';
            button.innerHTML = '<i class="fas fa-play"></i> Start';
        } else {
            this.simulation.start();
            icon.className = 'fas fa-pause';
            button.innerHTML = '<i class="fas fa-pause"></i> Pause';
        }
    }

    updateColorScaleVisibility(visualMode) {
        const colorScale = document.getElementById('colorScale');
        
        if (visualMode === 'streamlines' || visualMode === 'velocity-vectors') {
            colorScale.style.display = 'none';
        } else {
            colorScale.style.display = 'flex';
        }
    }

    updateUIState(flowType) {
        // Update UI elements based on flow type
        const visualModeSelect = document.getElementById('visualMode');
        
        // Enable/disable certain visualization modes based on flow type
        const options = visualModeSelect.options;
        
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            
            // Disable potential/stream function for viscous flows
            if ((flowType === 'poiseuille' || flowType === 'couette') &&
                (option.value === 'potential' || option.value === 'stream-function')) {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        }

        // Auto-select appropriate visualization mode
        if (flowType === 'poiseuille' || flowType === 'couette') {
            if (visualModeSelect.value === 'potential' || visualModeSelect.value === 'stream-function') {
                visualModeSelect.value = 'velocity';
                this.simulation.setVisualizationMode('velocity');
            }
        }
    }

    // Utility methods
    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ff4444' : '#44ff44'};
            color: white;
            padding: 1rem;
            border-radius: 4px;
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    exportConfiguration() {
        const config = {
            flowType: this.currentFlowType,
            parameters: this.getParameterValues(),
            visualMode: document.getElementById('visualMode').value,
            colorMap: document.getElementById('colorMap').value,
            timeStep: parseFloat(document.getElementById('timeStep').value),
            showGrid: document.getElementById('showGrid').checked,
            showBoundary: document.getElementById('showBoundary').checked,
            showProbe: document.getElementById('showProbe').checked
        };

        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'fluid_simulation_config.json';
        link.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Configuration exported successfully!');
    }

    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Space bar to toggle play/pause
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.togglePlayPause();
            }
            
            // R key to reset
            if (e.code === 'KeyR' && e.ctrlKey) {
                e.preventDefault();
                this.simulation.reset();
                this.showNotification('Simulation reset');
            }
            
            // S key to export
            if (e.code === 'KeyS' && e.ctrlKey) {
                e.preventDefault();
                this.exportConfiguration();
            }
        });
    }

    // Add performance controls
    addPerformanceControls() {
        const controlsBottom = document.querySelector('.controls-bottom');
        
        const performanceGroup = document.createElement('div');
        performanceGroup.className = 'performance-controls';
        
        const qualitySelect = document.createElement('select');
        qualitySelect.innerHTML = `
            <option value="low">Low Quality</option>
            <option value="medium" selected>Medium Quality</option>
            <option value="high">High Quality</option>
        `;
        
        qualitySelect.addEventListener('change', (e) => {
            this.simulation.setQuality(e.target.value);
            this.showNotification(`Quality set to ${e.target.value}`);
        });
        
        const qualityLabel = document.createElement('label');
        qualityLabel.textContent = 'Quality: ';
        qualityLabel.appendChild(qualitySelect);
        
        performanceGroup.appendChild(qualityLabel);
        controlsBottom.appendChild(performanceGroup);
    }
}

// Export for global use
window.UIController = UIController;