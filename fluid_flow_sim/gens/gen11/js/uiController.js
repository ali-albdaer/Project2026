/**
 * UI Controller Module
 * Manages all UI interactions and updates
 */

import { MathUtils, debounce } from './utils.js';
import { createFlowElement } from './flowElements.js';
import { createPreset, getPresetInfo } from './presets.js';
import { ColorGradient } from './colorGradients.js';

/**
 * UI Controller class
 */
export class UIController {
    constructor(simulation) {
        this.simulation = simulation;
        this.selectedElement = null;
        
        // Cache DOM elements
        this.cacheElements();
        
        // Bind events
        this.bindEvents();
        
        // Initial UI state
        this.updateUI();
    }

    cacheElements() {
        // Menus
        this.leftMenu = document.getElementById('left-menu');
        this.rightMenu = document.getElementById('right-menu');
        
        // Presets
        this.presetSelect = document.getElementById('preset-select');
        this.loadPresetBtn = document.getElementById('load-preset');
        
        // Element buttons
        this.elementButtons = document.querySelectorAll('.element-btn');
        this.clearAllBtn = document.getElementById('clear-all-elements');
        this.activeElementsList = document.getElementById('active-elements-list');
        
        // Visualization checkboxes
        this.showParticles = document.getElementById('show-particles');
        this.showVelocityVectors = document.getElementById('show-velocity-vectors');
        this.showStreamlines = document.getElementById('show-streamlines');
        this.showStreaklines = document.getElementById('show-streaklines');
        this.showStaticVectors = document.getElementById('show-static-vectors');
        this.vectorDisplayMode = document.getElementById('vector-display-mode');
        
        // Color mapping
        this.gradientQuantity = document.getElementById('gradient-quantity');
        this.colorPalette = document.getElementById('color-palette');
        
        // Particle settings
        this.particleCount = document.getElementById('particle-count');
        this.particleSize = document.getElementById('particle-size');
        this.particleOpacity = document.getElementById('particle-opacity');
        
        // Line settings
        this.streamlineDensity = document.getElementById('streamline-density');
        this.streamlineOpacity = document.getElementById('streamline-opacity');
        this.streaklineLength = document.getElementById('streakline-length');
        
        // Physics settings
        this.viscosity = document.getElementById('viscosity');
        this.temperature = document.getElementById('temperature');
        this.density = document.getElementById('density');
        this.timeScale = document.getElementById('time-scale');
        
        // Boundary settings
        this.dynamicBoundaries = document.getElementById('dynamic-boundaries');
        this.periodicBoundaries = document.getElementById('periodic-boundaries');
        this.conserveParticles = document.getElementById('conserve-particles');
        this.boundarySize = document.getElementById('boundary-size');
        this.particleLifespan = document.getElementById('particle-lifespan');
        
        // Probe
        this.enableProbe = document.getElementById('enable-probe');
        this.probeQuantities = document.getElementById('probe-quantities');
        
        // View controls
        this.resetViewBtn = document.getElementById('reset-view');
        this.toggleUIBtn = document.getElementById('toggle-ui');
        this.zoomLevel = document.getElementById('zoom-level');
        this.panPosition = document.getElementById('pan-position');
        
        // Status bar
        this.fpsCounter = document.getElementById('fps-counter');
        this.particleCounter = document.getElementById('particle-counter');
        this.simStatus = document.getElementById('sim-status');
        this.pauseBtn = document.getElementById('pause-btn');
        this.helpBtn = document.getElementById('help-btn');
        
        // Modal
        this.modal = document.getElementById('element-editor-modal');
        this.editorTitle = document.getElementById('editor-title');
        this.editorBody = document.getElementById('editor-body');
        this.editorSave = document.getElementById('editor-save');
        this.editorCancel = document.getElementById('editor-cancel');
        this.modalClose = this.modal.querySelector('.modal-close');
        
        // Shortcuts help
        this.shortcutsHelp = document.getElementById('shortcuts-help');
        this.closeShortcuts = document.getElementById('close-shortcuts');
        
        // Menu toggles
        this.toggleLeftMenu = document.getElementById('toggle-left-menu');
        this.toggleRightMenu = document.getElementById('toggle-right-menu');
    }

    bindEvents() {
        // Menu toggles
        this.toggleLeftMenu.addEventListener('click', () => this.toggleMenu('left'));
        this.toggleRightMenu.addEventListener('click', () => this.toggleMenu('right'));
        
        // Preset loading
        this.loadPresetBtn.addEventListener('click', () => this.loadPreset());
        
        // Element buttons
        this.elementButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.addElement(type);
            });
        });
        
        // Clear all
        this.clearAllBtn.addEventListener('click', () => this.clearAllElements());
        
        // Visualization checkboxes
        this.showParticles.addEventListener('change', e => {
            this.simulation.renderer.setSetting('showParticles', e.target.checked);
        });
        this.showVelocityVectors.addEventListener('change', e => {
            this.simulation.renderer.setSetting('showVelocityVectors', e.target.checked);
        });
        this.showStreamlines.addEventListener('change', e => {
            this.simulation.renderer.setSetting('showStreamlines', e.target.checked);
            this.simulation.renderer.invalidateCache();
        });
        this.showStreaklines.addEventListener('change', e => {
            this.simulation.renderer.setSetting('showStreaklines', e.target.checked);
        });
        this.showStaticVectors.addEventListener('change', e => {
            this.simulation.renderer.setSetting('showStaticVectors', e.target.checked);
            this.simulation.renderer.invalidateCache();
        });
        this.vectorDisplayMode.addEventListener('change', e => {
            this.simulation.renderer.setSetting('vectorDisplayMode', e.target.value);
        });
        
        // Color mapping
        this.gradientQuantity.addEventListener('change', e => {
            this.simulation.renderer.setSetting('gradientQuantity', e.target.value);
            this.simulation.renderer.colorGradient.reset();
        });
        this.colorPalette.addEventListener('change', e => {
            this.simulation.renderer.setSetting('colorPalette', e.target.value);
        });
        
        // Particle settings
        this.particleCount.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            document.getElementById('particle-count-value').textContent = value;
            this.simulation.particleSystem.setMaxParticles(value);
        });
        this.particleSize.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('particle-size-value').textContent = value;
            this.simulation.renderer.setSetting('particleSize', value);
            this.simulation.particleSystem.setParticleSize(value);
        });
        this.particleOpacity.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('particle-opacity-value').textContent = value;
            this.simulation.renderer.setSetting('particleOpacity', value);
            this.simulation.particleSystem.setParticleOpacity(value);
        });
        
        // Line settings
        this.streamlineDensity.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            document.getElementById('streamline-density-value').textContent = value;
            this.simulation.renderer.setSetting('streamlineDensity', value);
            this.simulation.renderer.invalidateCache();
        });
        this.streamlineOpacity.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('streamline-opacity-value').textContent = value;
            this.simulation.renderer.setSetting('streamlineOpacity', value);
        });
        this.streaklineLength.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            document.getElementById('streakline-length-value').textContent = value;
            this.simulation.renderer.setSetting('streaklineLength', value);
            this.simulation.particleSystem.setStreaklineLength(value);
        });
        
        // Physics settings
        this.viscosity.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('viscosity-value').textContent = value.toFixed(3);
            this.simulation.physics.fluid.setViscosity(value);
        });
        this.temperature.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('temperature-value').textContent = value;
            this.simulation.physics.fluid.setTemperature(value);
        });
        this.density.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('density-value').textContent = value.toFixed(1);
            this.simulation.physics.fluid.setDensity(value);
        });
        this.timeScale.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('time-scale-value').textContent = value.toFixed(1);
            this.simulation.physics.fluid.setTimeScale(value);
        });
        
        // Boundary settings
        this.dynamicBoundaries.addEventListener('change', e => {
            this.simulation.particleSystem.setDynamicBoundaries(e.target.checked);
            this.boundarySize.disabled = e.target.checked;
        });
        this.periodicBoundaries.addEventListener('change', e => {
            this.simulation.particleSystem.setPeriodicBoundaries(e.target.checked);
        });
        this.conserveParticles.addEventListener('change', e => {
            this.simulation.particleSystem.setConserveParticles(e.target.checked);
            this.particleLifespan.disabled = e.target.checked;
            document.getElementById('particle-lifespan-value').textContent = 
                e.target.checked ? '∞' : this.particleLifespan.value + 's';
        });
        this.boundarySize.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            document.getElementById('boundary-size-value').textContent = value;
            this.simulation.particleSystem.setBoundarySize(value);
        });
        this.particleLifespan.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            document.getElementById('particle-lifespan-value').textContent = value + 's';
            this.simulation.particleSystem.setParticleLifespan(value);
        });
        
        // Probe
        this.enableProbe.addEventListener('change', e => {
            this.simulation.probe.setEnabled(e.target.checked);
        });
        this.probeQuantities.addEventListener('change', () => {
            const selected = Array.from(this.probeQuantities.selectedOptions).map(o => o.value);
            this.simulation.probe.setQuantities(selected);
        });
        
        // View controls
        this.resetViewBtn.addEventListener('click', () => {
            this.simulation.renderer.view.reset();
            this.updateViewInfo();
        });
        this.toggleUIBtn.addEventListener('click', () => this.toggleUI());
        
        // Status bar
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.helpBtn.addEventListener('click', () => this.toggleShortcuts());
        this.closeShortcuts.addEventListener('click', () => this.toggleShortcuts(false));
        
        // Modal
        this.editorCancel.addEventListener('click', () => this.closeModal());
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.editorSave.addEventListener('click', () => this.saveElementEdit());
        this.modal.addEventListener('click', e => {
            if (e.target === this.modal) this.closeModal();
        });
        
        // Keyboard shortcuts
        this.simulation.input.on('keydown', e => this.handleKeyboard(e));
    }

    handleKeyboard(e) {
        if (e.repeat) return;
        
        const key = e.key.toLowerCase();
        
        switch (key) {
            case 'h':
                this.toggleUI();
                break;
            case 'l':
                this.toggleMenu('left');
                break;
            case 'r':
                this.toggleMenu('right');
                break;
            case 'p':
                this.enableProbe.checked = !this.enableProbe.checked;
                this.enableProbe.dispatchEvent(new Event('change'));
                break;
            case ' ':
                this.togglePause();
                break;
            case 'u':
                this.addElement('uniform');
                break;
            case 's':
                this.addElement('source');
                break;
            case 'k':
                this.addElement('sink');
                break;
            case 'd':
                this.addElement('doublet');
                break;
            case 'v':
                this.addElement('vortex');
                break;
            case 'c':
                this.clearAllElements();
                break;
            case '1':
                this.showParticles.checked = !this.showParticles.checked;
                this.showParticles.dispatchEvent(new Event('change'));
                break;
            case '2':
                this.showVelocityVectors.checked = !this.showVelocityVectors.checked;
                this.showVelocityVectors.dispatchEvent(new Event('change'));
                break;
            case '3':
                this.showStreamlines.checked = !this.showStreamlines.checked;
                this.showStreamlines.dispatchEvent(new Event('change'));
                break;
            case '4':
                this.showStreaklines.checked = !this.showStreaklines.checked;
                this.showStreaklines.dispatchEvent(new Event('change'));
                break;
            case '5':
                this.showStaticVectors.checked = !this.showStaticVectors.checked;
                this.showStaticVectors.dispatchEvent(new Event('change'));
                break;
            case 'b':
                this.dynamicBoundaries.checked = !this.dynamicBoundaries.checked;
                this.dynamicBoundaries.dispatchEvent(new Event('change'));
                break;
            case 'home':
                this.simulation.renderer.view.reset();
                this.updateViewInfo();
                break;
            case '?':
                this.toggleShortcuts();
                break;
            case 'escape':
                this.closeModal();
                this.toggleShortcuts(false);
                break;
        }
    }

    toggleMenu(side) {
        if (side === 'left') {
            this.leftMenu.classList.toggle('collapsed');
            this.toggleLeftMenu.textContent = this.leftMenu.classList.contains('collapsed') ? '▶' : '◀';
        } else {
            this.rightMenu.classList.toggle('collapsed');
            this.toggleRightMenu.textContent = this.rightMenu.classList.contains('collapsed') ? '◀' : '▶';
        }
    }

    toggleUI() {
        document.body.classList.toggle('ui-hidden');
        this.toggleUIBtn.textContent = document.body.classList.contains('ui-hidden') ? 'Show UI' : 'Hide UI';
    }

    togglePause() {
        this.simulation.paused = !this.simulation.paused;
        this.pauseBtn.textContent = this.simulation.paused ? '▶' : '⏸';
        this.simStatus.textContent = this.simulation.paused ? 'Paused' : 'Running';
        this.simStatus.classList.toggle('paused', this.simulation.paused);
    }

    toggleShortcuts(show = null) {
        if (show === null) {
            this.shortcutsHelp.classList.toggle('hidden');
        } else {
            this.shortcutsHelp.classList.toggle('hidden', !show);
        }
    }

    loadPreset() {
        const presetName = this.presetSelect.value;
        if (presetName === 'none') return;
        
        // Clear existing elements
        this.simulation.flowManager.clear();
        this.simulation.particleSystem.clear();
        
        // Load preset elements
        const elements = createPreset(presetName);
        for (const element of elements) {
            this.simulation.flowManager.add(element);
        }
        
        // Invalidate caches
        this.simulation.renderer.invalidateCache();
        
        // Update UI
        this.updateElementsList();
        
        // Reset preset dropdown
        this.presetSelect.value = 'none';
    }

    addElement(type) {
        // Get center of view for position
        const bounds = this.simulation.renderer.getWorldBounds();
        const x = (bounds.left + bounds.right) / 2;
        const y = (bounds.top + bounds.bottom) / 2;
        
        const options = { x, y };
        
        // Set default parameters based on type
        switch (type) {
            case 'uniform':
                options.U = 1.5;
                options.alpha = 0;
                break;
            case 'source':
                options.m = 80;
                break;
            case 'sink':
                options.m = 80;
                break;
            case 'doublet':
                options.kappa = 500;
                options.orientation = 0;
                break;
            case 'vortex':
                options.gamma = 150;
                break;
        }
        
        const element = createFlowElement(type, options);
        this.simulation.flowManager.add(element);
        
        // Invalidate caches
        this.simulation.renderer.invalidateCache();
        
        this.updateElementsList();
    }

    clearAllElements() {
        this.simulation.flowManager.clear();
        this.simulation.particleSystem.clear();
        this.simulation.renderer.invalidateCache();
        this.updateElementsList();
    }

    updateElementsList() {
        const elements = Array.from(this.simulation.flowManager);
        
        if (elements.length === 0) {
            this.activeElementsList.innerHTML = '<div class="empty-state">No elements added</div>';
            return;
        }
        
        let html = '';
        for (const element of elements) {
            const hiddenClass = element.enabled ? '' : 'hidden-element';
            const selectedClass = element === this.selectedElement ? 'selected' : '';
            
            html += `
                <div class="element-item ${hiddenClass} ${selectedClass}" data-id="${element.id}" data-type="${element.type}">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="element-icon">${element.getIcon()}</span>
                    <div class="element-info">
                        <div class="element-name">${element.getDisplayName()}</div>
                        <div class="element-params">${element.getParamsString()}</div>
                    </div>
                    <div class="element-actions">
                        <button class="edit" title="Edit">✎</button>
                        <button class="hide" title="Hide/Show">👁</button>
                        <button class="delete" title="Delete">✕</button>
                    </div>
                </div>
            `;
        }
        
        this.activeElementsList.innerHTML = html;
        
        // Bind element actions
        this.activeElementsList.querySelectorAll('.element-item').forEach(item => {
            const id = item.dataset.id;
            
            item.addEventListener('click', () => {
                this.selectElement(id);
            });
            
            item.querySelector('.edit').addEventListener('click', e => {
                e.stopPropagation();
                this.openElementEditor(id);
            });
            
            item.querySelector('.hide').addEventListener('click', e => {
                e.stopPropagation();
                this.toggleElementVisibility(id);
            });
            
            item.querySelector('.delete').addEventListener('click', e => {
                e.stopPropagation();
                this.deleteElement(id);
            });
        });
    }

    selectElement(id) {
        const element = this.simulation.flowManager.get(id);
        if (!element) return;
        
        // Deselect previous
        if (this.selectedElement) {
            this.selectedElement.selected = false;
        }
        
        // Select new
        element.selected = true;
        this.selectedElement = element;
        
        this.updateElementsList();
    }

    openElementEditor(id) {
        const element = this.simulation.flowManager.get(id);
        if (!element) return;
        
        this.editingElement = element;
        this.editorTitle.textContent = `Edit ${element.getDisplayName()}`;
        
        // Generate form based on element type
        let formHTML = '';
        
        switch (element.type) {
            case 'uniform':
                formHTML = `
                    <div class="form-group">
                        <label>Velocity Magnitude (U)</label>
                        <input type="number" id="edit-U" value="${element.U}" step="0.1">
                    </div>
                    <div class="form-group">
                        <label>Flow Angle (degrees)</label>
                        <input type="number" id="edit-alpha" value="${(element.alpha * MathUtils.RAD_TO_DEG).toFixed(1)}" step="1">
                    </div>
                `;
                break;
            case 'source':
            case 'sink':
                formHTML = `
                    <div class="form-group input-row">
                        <div>
                            <label>Position X</label>
                            <input type="number" id="edit-x" value="${element.position.x.toFixed(1)}" step="1">
                        </div>
                        <div>
                            <label>Position Y</label>
                            <input type="number" id="edit-y" value="${element.position.y.toFixed(1)}" step="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Strength (m)</label>
                        <input type="number" id="edit-m" value="${Math.abs(element.m).toFixed(1)}" step="1" min="0">
                    </div>
                `;
                break;
            case 'doublet':
                formHTML = `
                    <div class="form-group input-row">
                        <div>
                            <label>Position X</label>
                            <input type="number" id="edit-x" value="${element.position.x.toFixed(1)}" step="1">
                        </div>
                        <div>
                            <label>Position Y</label>
                            <input type="number" id="edit-y" value="${element.position.y.toFixed(1)}" step="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Strength (κ)</label>
                        <input type="number" id="edit-kappa" value="${element.kappa.toFixed(1)}" step="10">
                    </div>
                    <div class="form-group">
                        <label>Orientation (degrees)</label>
                        <input type="number" id="edit-orientation" value="${(element.orientation * MathUtils.RAD_TO_DEG).toFixed(1)}" step="1">
                    </div>
                `;
                break;
            case 'vortex':
                formHTML = `
                    <div class="form-group input-row">
                        <div>
                            <label>Position X</label>
                            <input type="number" id="edit-x" value="${element.position.x.toFixed(1)}" step="1">
                        </div>
                        <div>
                            <label>Position Y</label>
                            <input type="number" id="edit-y" value="${element.position.y.toFixed(1)}" step="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Circulation (Γ)</label>
                        <input type="number" id="edit-gamma" value="${element.gamma.toFixed(1)}" step="10">
                        <small>Positive = CCW, Negative = CW</small>
                    </div>
                `;
                break;
        }
        
        this.editorBody.innerHTML = formHTML;
        this.modal.classList.remove('hidden');
    }

    saveElementEdit() {
        if (!this.editingElement) return;
        
        const element = this.editingElement;
        
        switch (element.type) {
            case 'uniform':
                element.U = parseFloat(document.getElementById('edit-U').value) || 1;
                element.alpha = (parseFloat(document.getElementById('edit-alpha').value) || 0) * MathUtils.DEG_TO_RAD;
                break;
            case 'source':
            case 'sink':
                element.position.x = parseFloat(document.getElementById('edit-x').value) || 0;
                element.position.y = parseFloat(document.getElementById('edit-y').value) || 0;
                const m = Math.abs(parseFloat(document.getElementById('edit-m').value) || 50);
                element.m = element.type === 'sink' ? -m : m;
                break;
            case 'doublet':
                element.position.x = parseFloat(document.getElementById('edit-x').value) || 0;
                element.position.y = parseFloat(document.getElementById('edit-y').value) || 0;
                element.kappa = parseFloat(document.getElementById('edit-kappa').value) || 100;
                element.orientation = (parseFloat(document.getElementById('edit-orientation').value) || 0) * MathUtils.DEG_TO_RAD;
                break;
            case 'vortex':
                element.position.x = parseFloat(document.getElementById('edit-x').value) || 0;
                element.position.y = parseFloat(document.getElementById('edit-y').value) || 0;
                element.gamma = parseFloat(document.getElementById('edit-gamma').value) || 100;
                break;
        }
        
        this.closeModal();
        this.simulation.renderer.invalidateCache();
        this.updateElementsList();
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.editingElement = null;
    }

    toggleElementVisibility(id) {
        const element = this.simulation.flowManager.get(id);
        if (!element) return;
        
        element.enabled = !element.enabled;
        this.simulation.renderer.invalidateCache();
        this.updateElementsList();
    }

    deleteElement(id) {
        this.simulation.flowManager.remove(id);
        
        if (this.selectedElement && this.selectedElement.id === id) {
            this.selectedElement = null;
        }
        
        this.simulation.renderer.invalidateCache();
        this.updateElementsList();
    }

    updateUI() {
        this.updateElementsList();
    }

    updateViewInfo() {
        const view = this.simulation.renderer.view;
        this.zoomLevel.textContent = Math.round(view.zoom * 100);
        this.panPosition.textContent = `${Math.round(view.offset.x)}, ${Math.round(view.offset.y)}`;
    }

    updateStats(fps, particleCount) {
        this.fpsCounter.textContent = `FPS: ${fps}`;
        this.particleCounter.textContent = `Particles: ${particleCount}`;
    }
}
