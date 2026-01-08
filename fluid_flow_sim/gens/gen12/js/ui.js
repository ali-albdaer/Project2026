/**
 * UI Manager
 * Handles all user interface interactions
 */

import { Config, State, updateConfig } from './config.js';
import { createElement, elementParamDefs } from './flowElements.js';
import { loadPreset } from './presets.js';
import { formatNumber } from './math.js';
import { getElementColor } from './colorMaps.js';

/**
 * UI Manager class
 */
export class UIManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.modalCallback = null;
        
        this.cacheElements();
        this.setupEventListeners();
        this.initializeUI();
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Top bar
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.stepBtn = document.getElementById('stepBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.simTimeEl = document.getElementById('simTime');
        this.fpsCounterEl = document.getElementById('fpsCounter');
        this.hideUIBtn = document.getElementById('hideUIBtn');
        this.zoomLevelEl = document.getElementById('zoomLevel');
        
        // Menus
        this.leftMenu = document.getElementById('leftMenu');
        this.rightMenu = document.getElementById('rightMenu');
        this.toggleLeftMenuBtn = document.getElementById('toggleLeftMenu');
        this.toggleRightMenuBtn = document.getElementById('toggleRightMenu');
        
        // Element management
        this.elementTypeSelect = document.getElementById('elementType');
        this.addElementBtn = document.getElementById('addElementBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.elementList = document.getElementById('elementList');
        
        // Modal
        this.modal = document.getElementById('elementModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalBody = document.getElementById('modalBody');
        this.modalSave = document.getElementById('modalSave');
        this.modalCancel = document.getElementById('modalCancel');
        this.modalClose = document.querySelector('.modal-close');
        
        // Probe
        this.probeTooltip = document.getElementById('probeTooltip');
        
        // Boundary sliders container
        this.boundarySliders = document.getElementById('boundarySliders');
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Top bar controls
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.stepBtn.addEventListener('click', () => this.step());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.hideUIBtn.addEventListener('click', () => this.toggleUIHidden());
        
        // Menu toggles
        this.toggleLeftMenuBtn.addEventListener('click', () => this.toggleLeftMenu());
        this.toggleRightMenuBtn.addEventListener('click', () => this.toggleRightMenu());
        
        // Element management
        this.addElementBtn.addEventListener('click', () => this.addElement());
        this.clearAllBtn.addEventListener('click', () => this.clearAllElements());
        
        // Modal
        this.modalSave.addEventListener('click', () => this.saveModal());
        this.modalCancel.addEventListener('click', () => this.closeModal());
        this.modalClose.addEventListener('click', () => this.closeModal());
        
        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => this.loadPreset(btn.dataset.preset));
        });
        
        // Visualization checkboxes
        this.setupCheckbox('showParticles', 'visualization');
        this.setupCheckbox('showVelocityVectors', 'visualization');
        this.setupCheckbox('showStreamlines', 'visualization');
        this.setupCheckbox('showStreaklines', 'visualization');
        this.setupCheckbox('showStaticVectors', 'visualization');
        
        // Particle sliders
        this.setupSlider('maxParticles', 'particles', 'maxCount');
        this.setupSlider('spawnRate', 'particles', 'spawnRate');
        this.setupSlider('particleSize', 'particles', 'size');
        
        // Line sliders
        this.setupSlider('streamlineDensity', 'visualization', 'streamlineDensity');
        this.setupSlider('lineOpacity', 'visualization', 'lineOpacity');
        
        // Fluid property sliders
        this.setupSlider('viscosity', 'fluid', 'viscosity');
        this.setupSlider('temperature', 'fluid', 'temperature');
        this.setupSlider('fluidDensity', 'fluid', 'density');
        
        // Boundary settings
        this.setupCheckbox('dynamicBoundaries', 'boundaries', 'dynamic');
        this.setupCheckbox('periodicBoundaries', 'boundaries', 'periodic');
        this.setupCheckbox('conserveParticles', 'boundaries', 'conserveParticles');
        this.setupSlider('mapWidth', 'boundaries', 'mapWidth');
        this.setupSlider('mapHeight', 'boundaries', 'mapHeight');
        this.setupSlider('particleLifespan', 'particles', 'lifespan');
        
        // Dynamic boundaries toggle
        document.getElementById('dynamicBoundaries').addEventListener('change', (e) => {
            this.boundarySliders.style.opacity = e.target.checked ? '0.5' : '1';
            this.boundarySliders.style.pointerEvents = e.target.checked ? 'none' : 'auto';
        });
        
        // Color settings
        this.setupSelect('colorQuantity', 'colors', 'quantity');
        this.setupSelect('colorPalette', 'colors', 'palette');
        this.setupSelect('vectorMode', 'colors', 'vectorMode');
        
        // Probe settings
        this.setupCheckbox('enableProbe', 'probe', 'enabled');
        
        // Probe quantity checkboxes
        document.querySelectorAll('.probeQuantity').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const quantity = checkbox.dataset.quantity;
                Config.probe.quantities[quantity] = checkbox.checked;
            });
        });
        
        // Reset view button
        document.getElementById('resetViewBtn').addEventListener('click', () => {
            Config.view.zoom = 1.0;
            Config.view.panX = 0;
            Config.view.panY = 0;
            this.updateZoomDisplay();
        });
    }
    
    /**
     * Initialize UI state
     */
    initializeUI() {
        this.updatePlayPauseButton();
        this.updateElementList();
        this.updateZoomDisplay();
        
        // Set initial slider values
        document.getElementById('maxParticlesValue').textContent = Config.particles.maxCount;
        document.getElementById('spawnRateValue').textContent = Config.particles.spawnRate;
        document.getElementById('particleSizeValue').textContent = Config.particles.size;
        document.getElementById('streamlineDensityValue').textContent = Config.visualization.streamlineDensity;
        document.getElementById('lineOpacityValue').textContent = Config.visualization.lineOpacity;
        document.getElementById('viscosityValue').textContent = Config.fluid.viscosity;
        document.getElementById('temperatureValue').textContent = Config.fluid.temperature;
        document.getElementById('densityValue').textContent = Config.fluid.density;
        document.getElementById('mapWidthValue').textContent = Config.boundaries.mapWidth;
        document.getElementById('mapHeightValue').textContent = Config.boundaries.mapHeight;
        document.getElementById('lifespanValue').textContent = Config.particles.lifespan;
        
        // Set initial boundary slider state
        this.boundarySliders.style.opacity = Config.boundaries.dynamic ? '0.5' : '1';
        this.boundarySliders.style.pointerEvents = Config.boundaries.dynamic ? 'none' : 'auto';
    }
    
    /**
     * Set up a checkbox binding
     */
    setupCheckbox(id, configSection, configKey = null) {
        const checkbox = document.getElementById(id);
        if (!checkbox) return;
        
        const key = configKey || id;
        checkbox.checked = Config[configSection][key];
        
        checkbox.addEventListener('change', () => {
            Config[configSection][key] = checkbox.checked;
        });
    }
    
    /**
     * Set up a slider binding
     */
    setupSlider(id, configSection, configKey = null) {
        const slider = document.getElementById(id);
        const valueEl = document.getElementById(`${id}Value`);
        if (!slider) return;
        
        const key = configKey || id;
        slider.value = Config[configSection][key];
        
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            Config[configSection][key] = value;
            if (valueEl) valueEl.textContent = value;
        });
    }
    
    /**
     * Set up a select binding
     */
    setupSelect(id, configSection, configKey = null) {
        const select = document.getElementById(id);
        if (!select) return;
        
        const key = configKey || id;
        select.value = Config[configSection][key];
        
        select.addEventListener('change', () => {
            Config[configSection][key] = select.value;
        });
    }
    
    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        State.isPlaying = !State.isPlaying;
        this.updatePlayPauseButton();
    }
    
    /**
     * Update play/pause button
     */
    updatePlayPauseButton() {
        const icon = this.playPauseBtn.querySelector('.icon');
        icon.textContent = State.isPlaying ? '⏸' : '▶';
    }
    
    /**
     * Step simulation
     */
    step() {
        this.simulation.step();
        this.updateTimeDisplay();
    }
    
    /**
     * Reset simulation
     */
    reset() {
        this.simulation.reset();
        this.updateTimeDisplay();
    }
    
    /**
     * Toggle UI hidden
     */
    toggleUIHidden() {
        State.ui.hidden = !State.ui.hidden;
        document.body.classList.toggle('ui-hidden', State.ui.hidden);
        document.getElementById('hiddenUIIndicator').classList.toggle('hidden', !State.ui.hidden);
    }
    
    /**
     * Toggle left menu
     */
    toggleLeftMenu() {
        State.ui.leftMenuCollapsed = !State.ui.leftMenuCollapsed;
        this.leftMenu.classList.toggle('collapsed', State.ui.leftMenuCollapsed);
        this.toggleLeftMenuBtn.textContent = State.ui.leftMenuCollapsed ? '▶' : '◀';
    }
    
    /**
     * Toggle right menu
     */
    toggleRightMenu() {
        State.ui.rightMenuCollapsed = !State.ui.rightMenuCollapsed;
        this.rightMenu.classList.toggle('collapsed', State.ui.rightMenuCollapsed);
        this.toggleRightMenuBtn.textContent = State.ui.rightMenuCollapsed ? '◀' : '▶';
    }
    
    /**
     * Update time display
     */
    updateTimeDisplay() {
        this.simTimeEl.textContent = State.time.toFixed(2);
    }
    
    /**
     * Update FPS display
     */
    updateFPSDisplay(fps) {
        this.fpsCounterEl.textContent = Math.round(fps);
    }
    
    /**
     * Update zoom display
     */
    updateZoomDisplay() {
        this.zoomLevelEl.textContent = Math.round(Config.view.zoom * 100);
    }
    
    /**
     * Add a new element
     */
    addElement() {
        const type = this.elementTypeSelect.value;
        const element = createElement(type, { x: 0, y: 0 });
        
        if (element) {
            State.flowElements.push(element);
            State.ui.selectedElement = element.id;
            this.updateElementList();
            
            // Open edit modal for new element
            this.openEditModal(element);
        }
    }
    
    /**
     * Clear all elements
     */
    clearAllElements() {
        State.flowElements = [];
        State.ui.selectedElement = null;
        this.updateElementList();
        this.simulation.reset();
    }
    
    /**
     * Load a preset
     */
    loadPreset(presetName) {
        // Clear existing
        State.flowElements = [];
        
        // Load preset elements
        const elements = loadPreset(presetName);
        State.flowElements = elements;
        
        // Reset simulation
        this.simulation.reset();
        
        // Update UI
        this.updateElementList();
        
        // Update preset button states
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });
    }
    
    /**
     * Update element list
     */
    updateElementList() {
        this.elementList.innerHTML = '';
        
        for (const element of State.flowElements) {
            const card = this.createElementCard(element);
            this.elementList.appendChild(card);
        }
    }
    
    /**
     * Create element card
     */
    createElementCard(element) {
        const card = document.createElement('div');
        card.className = 'element-card';
        card.dataset.id = element.id;
        
        if (element.id === State.ui.selectedElement) {
            card.classList.add('selected');
        }
        if (!element.enabled) {
            card.classList.add('disabled');
        }
        
        const color = getElementColor(element.type);
        
        card.innerHTML = `
            <div class="element-card-header">
                <span class="element-type" style="color: ${color}">${this.getElementTypeName(element.type)}</span>
                <div class="element-card-actions">
                    <button class="edit-btn" title="Edit">✏️</button>
                    <button class="toggle-btn" title="Toggle">${element.enabled ? '👁' : '👁‍🗨'}</button>
                    <button class="delete-btn delete" title="Delete">🗑️</button>
                </div>
            </div>
            <div class="element-params">${this.getElementParamsString(element)}</div>
        `;
        
        // Event listeners
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                State.ui.selectedElement = element.id;
                this.updateElementList();
            }
        });
        
        card.querySelector('.edit-btn').addEventListener('click', () => {
            this.openEditModal(element);
        });
        
        card.querySelector('.toggle-btn').addEventListener('click', () => {
            element.enabled = !element.enabled;
            this.updateElementList();
        });
        
        card.querySelector('.delete-btn').addEventListener('click', () => {
            this.deleteElement(element.id);
        });
        
        return card;
    }
    
    /**
     * Get element type display name
     */
    getElementTypeName(type) {
        const names = {
            uniform: 'Uniform Flow',
            source: 'Source',
            sink: 'Sink',
            doublet: 'Doublet',
            vortex: 'Vortex'
        };
        return names[type] || type;
    }
    
    /**
     * Get element parameters as string
     */
    getElementParamsString(element) {
        const params = [];
        
        if (element.type === 'uniform') {
            params.push(`U=${element.U.toFixed(2)}`);
            params.push(`α=${element.alpha.toFixed(1)}°`);
        } else if (element.type === 'source' || element.type === 'sink') {
            params.push(`m=${element.m.toFixed(2)}`);
            params.push(`pos=(${element.x.toFixed(0)}, ${element.y.toFixed(0)})`);
        } else if (element.type === 'doublet') {
            params.push(`κ=${element.kappa.toFixed(1)}`);
            params.push(`θ=${element.angle.toFixed(1)}°`);
            params.push(`pos=(${element.x.toFixed(0)}, ${element.y.toFixed(0)})`);
        } else if (element.type === 'vortex') {
            params.push(`Γ=${element.gamma.toFixed(1)}`);
            params.push(`pos=(${element.x.toFixed(0)}, ${element.y.toFixed(0)})`);
        }
        
        return params.join(' | ');
    }
    
    /**
     * Delete an element
     */
    deleteElement(id) {
        State.flowElements = State.flowElements.filter(e => e.id !== id);
        if (State.ui.selectedElement === id) {
            State.ui.selectedElement = null;
        }
        this.updateElementList();
    }
    
    /**
     * Open edit modal for an element
     */
    openEditModal(element) {
        State.ui.editingElement = element.id;
        
        this.modalTitle.textContent = `Edit ${this.getElementTypeName(element.type)}`;
        this.modalBody.innerHTML = this.createEditForm(element);
        
        this.modal.classList.remove('hidden');
    }
    
    /**
     * Create edit form HTML
     */
    createEditForm(element) {
        const paramDefs = elementParamDefs[element.type] || [];
        let html = '';
        
        // Position fields (for non-uniform flows)
        if (element.type !== 'uniform') {
            html += `
                <div class="modal-form-row">
                    <div class="modal-form-group">
                        <label>X Position</label>
                        <input type="number" id="edit-x" value="${element.x}" step="10">
                    </div>
                    <div class="modal-form-group">
                        <label>Y Position</label>
                        <input type="number" id="edit-y" value="${element.y}" step="10">
                    </div>
                </div>
            `;
        }
        
        // Parameter fields
        for (const def of paramDefs) {
            let value = element[def.key];
            if (def.negate) value = Math.abs(value);
            
            html += `
                <div class="modal-form-group">
                    <label>${def.label}</label>
                    <input type="number" id="edit-${def.key}" 
                           value="${value}" 
                           min="${def.min}" 
                           max="${def.max}" 
                           step="${def.step}">
                </div>
            `;
        }
        
        return html;
    }
    
    /**
     * Save modal changes
     */
    saveModal() {
        const element = State.flowElements.find(e => e.id === State.ui.editingElement);
        if (!element) return;
        
        const paramDefs = elementParamDefs[element.type] || [];
        
        // Update position
        if (element.type !== 'uniform') {
            const xInput = document.getElementById('edit-x');
            const yInput = document.getElementById('edit-y');
            if (xInput) element.x = parseFloat(xInput.value);
            if (yInput) element.y = parseFloat(yInput.value);
        }
        
        // Update parameters
        for (const def of paramDefs) {
            const input = document.getElementById(`edit-${def.key}`);
            if (input) {
                let value = parseFloat(input.value);
                if (def.negate) value = -Math.abs(value);
                element[def.key] = value;
            }
        }
        
        this.closeModal();
        this.updateElementList();
    }
    
    /**
     * Close modal
     */
    closeModal() {
        this.modal.classList.add('hidden');
        State.ui.editingElement = null;
    }
    
    /**
     * Update probe tooltip
     */
    updateProbeTooltip(screenX, screenY, worldPos) {
        if (!Config.probe.enabled) {
            this.probeTooltip.classList.add('hidden');
            return;
        }
        
        // Get flow data at position
        const data = this.simulation.getFlowDataAtPoint(worldPos.x, worldPos.y);
        
        // Build tooltip content
        let html = '<h4>Flow Data</h4>';
        
        const quantities = Config.probe.quantities;
        
        if (quantities.velocity) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">Velocity</span>
                    <span class="probe-value">(${formatNumber(data.velocity.x)}, ${formatNumber(data.velocity.y)})</span>
                </div>
                <div class="probe-row">
                    <span class="probe-label">Speed</span>
                    <span class="probe-value">${formatNumber(data.speed)} m/s</span>
                </div>
            `;
        }
        
        if (quantities.pressure) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">Pressure</span>
                    <span class="probe-value">${formatNumber(data.pressure, 0)} Pa</span>
                </div>
            `;
        }
        
        if (quantities.density) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">Density</span>
                    <span class="probe-value">${formatNumber(data.density)} kg/m³</span>
                </div>
            `;
        }
        
        if (quantities.temperature) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">Temperature</span>
                    <span class="probe-value">${formatNumber(data.temperature, 1)} K</span>
                </div>
            `;
        }
        
        if (quantities.streamFunction) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">ψ (stream)</span>
                    <span class="probe-value">${formatNumber(data.streamFunction)}</span>
                </div>
            `;
        }
        
        if (quantities.potentialFunction) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">φ (potential)</span>
                    <span class="probe-value">${formatNumber(data.potentialFunction)}</span>
                </div>
            `;
        }
        
        if (quantities.vorticity) {
            html += `
                <div class="probe-row">
                    <span class="probe-label">Vorticity</span>
                    <span class="probe-value">${formatNumber(data.vorticity)}</span>
                </div>
            `;
        }
        
        // Position info
        html += `
            <div class="probe-row" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                <span class="probe-label">Position</span>
                <span class="probe-value">(${formatNumber(worldPos.x, 1)}, ${formatNumber(worldPos.y, 1)})</span>
            </div>
        `;
        
        this.probeTooltip.innerHTML = html;
        
        // Position tooltip
        const tooltipWidth = 220;
        const tooltipHeight = this.probeTooltip.offsetHeight;
        
        let x = screenX + 15;
        let y = screenY + 15;
        
        // Keep on screen
        if (x + tooltipWidth > window.innerWidth) {
            x = screenX - tooltipWidth - 15;
        }
        if (y + tooltipHeight > window.innerHeight) {
            y = screenY - tooltipHeight - 15;
        }
        
        this.probeTooltip.style.left = `${x}px`;
        this.probeTooltip.style.top = `${y}px`;
        this.probeTooltip.classList.remove('hidden');
    }
    
    /**
     * Hide probe tooltip
     */
    hideProbeTooltip() {
        this.probeTooltip.classList.add('hidden');
    }
}
