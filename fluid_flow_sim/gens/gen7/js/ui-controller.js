/**
 * UI Controller
 * Handles all user interface interactions and state management
 */

class UIController {
    constructor(app) {
        this.app = app;
        this.mode = 'potential'; // 'potential' or 'navier-stokes'
        this.selectedElementId = null;
        this.isDragging = false;
        this.dragElement = null;
        this.showUI = true;
        this.showGrid = true;
        this.showProbe = true;
        this.isZenMode = false;
        
        // Mouse state
        this.mousePos = { x: 0, y: 0 };
        this.worldPos = { x: 0, y: 0 };
        this.isMouseDown = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        this.init();
    }

    /**
     * Initialize UI event listeners
     */
    init() {
        // Mode selector
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
        });

        // Header controls
        document.getElementById('zenMode').addEventListener('click', () => this.toggleZenMode());
        document.getElementById('toggleProbe').addEventListener('click', () => this.toggleProbe());
        document.getElementById('toggleUI').addEventListener('click', () => this.toggleUI());
        document.getElementById('toggleGrid').addEventListener('click', () => this.toggleGrid());
        document.getElementById('resetView').addEventListener('click', () => this.resetView());

        // ESC key to exit zen mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isZenMode) {
                this.toggleZenMode();
            }
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => this.loadPreset(btn.dataset.preset));
        });

        // Element buttons
        document.querySelectorAll('.element-btn').forEach(btn => {
            btn.addEventListener('click', () => this.addElement(btn.dataset.type));
        });

        // Clear elements
        document.getElementById('clearElements').addEventListener('click', () => this.clearElements());

        // Visualization checkboxes
        this.initCheckbox('show-streamlines', 'showStreamlines');
        this.initCheckbox('show-potential', 'showPotentialLines');
        this.initCheckbox('show-vectors', 'showVectors');
        this.initCheckbox('show-particles', 'showParticles', (val) => {
            this.app.particles.setEnabled(val);
        });
        this.initCheckbox('show-gradient', 'showGradient');

        // Gradient controls
        document.getElementById('gradient-quantity').addEventListener('change', (e) => {
            this.app.visualization.updateSettings({ gradientQuantity: e.target.value });
            this.updateLegend();
        });

        document.getElementById('color-palette').addEventListener('change', (e) => {
            this.app.visualization.updateSettings({ palette: e.target.value });
            this.app.particles.palette = e.target.value;
            this.updateLegendGradient();
        });

        // Line settings
        this.initSlider('num-lines', 'lines-val', (val) => {
            this.app.visualization.updateSettings({ numLines: parseInt(val) });
        });

        this.initSlider('line-thickness', 'thickness-val', (val) => {
            this.app.visualization.updateSettings({ lineThickness: parseFloat(val) });
        });

        this.initSlider('line-opacity', 'opacity-val', (val) => {
            this.app.visualization.updateSettings({ lineOpacity: parseFloat(val) });
        });

        // Particle settings
        this.initCheckbox('conserve-particles', 'conserveParticles', (val) => {
            this.app.particles.setSettings({ conserveParticles: val });
        });

        this.initSlider('particle-count', 'particles-val', (val) => {
            this.app.particles.setSettings({ count: parseInt(val) });
        });

        this.initSlider('particle-speed', 'pspeed-val', (val) => {
            this.app.particles.setSettings({ speed: parseFloat(val) });
        });

        this.initSlider('trail-length', 'trail-val', (val) => {
            this.app.particles.setSettings({ trailLength: parseInt(val) });
        });

        // Zoom
        this.initSlider('zoom-level', 'zoom-val', (val) => {
            this.setZoom(parseFloat(val));
        }, (val) => val + 'x');

        // Navier-Stokes controls
        this.initSlider('ns-viscosity', 'viscosity-val', (val) => {
            this.app.nsSolver.setParams({ viscosity: parseFloat(val) });
        });

        this.initSlider('ns-density', 'density-val', (val) => {
            this.app.nsSolver.setParams({ density: parseFloat(val) });
        });

        this.initSlider('ns-dt', 'dt-val', (val) => {
            this.app.nsSolver.setParams({ dt: parseFloat(val) });
        });

        this.initSlider('ns-iterations', 'iterations-val', (val) => {
            this.app.nsSolver.setParams({ iterations: parseInt(val) });
        });

        this.initSlider('ns-inlet', 'inlet-val', (val) => {
            this.app.nsSolver.setParams({ inletVelocity: parseFloat(val) });
        });

        document.getElementById('ns-boundary-type').addEventListener('change', (e) => {
            this.app.nsSolver.setParams({ boundaryType: e.target.value });
            this.app.nsSolver.reset();
        });

        // NS control buttons
        document.getElementById('ns-play').addEventListener('click', () => {
            this.app.nsSolver.isRunning = true;
            document.getElementById('ns-play').classList.add('active');
            document.getElementById('ns-pause').classList.remove('active');
        });

        document.getElementById('ns-pause').addEventListener('click', () => {
            this.app.nsSolver.isRunning = false;
            document.getElementById('ns-play').classList.remove('active');
            document.getElementById('ns-pause').classList.add('active');
        });

        document.getElementById('ns-reset').addEventListener('click', () => {
            this.app.nsSolver.reset();
        });

        // Obstacle type
        document.getElementById('obstacle-type').addEventListener('change', (e) => {
            this.app.obstacleType = e.target.value;
        });

        // Apply equations button
        document.getElementById('applyEquations').addEventListener('click', () => {
            this.applyCustomEquations();
        });

        // Modal controls
        document.getElementById('modal-save').addEventListener('click', () => this.saveModalElement());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-delete').addEventListener('click', () => this.deleteModalElement());

        // Canvas mouse events
        this.initCanvasEvents();

        // Window resize
        window.addEventListener('resize', () => this.app.resize());

        // Initial legend update
        this.updateLegendGradient();
    }

    /**
     * Initialize a checkbox
     */
    initCheckbox(id, settingName, callback = null) {
        const checkbox = document.getElementById(id);
        checkbox.addEventListener('change', () => {
            const val = checkbox.checked;
            this.app.visualization.updateSettings({ [settingName]: val });
            if (callback) callback(val);
        });
    }

    /**
     * Initialize a slider
     */
    initSlider(sliderId, displayId, callback, formatter = (val) => val) {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(displayId);
        
        const update = () => {
            const val = slider.value;
            display.textContent = formatter(val);
            callback(val);
        };
        
        slider.addEventListener('input', update);
    }

    /**
     * Initialize canvas mouse events
     */
    initCanvasEvents() {
        const canvas = document.getElementById('uiCanvas');
        
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Touch events
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        const rect = e.target.getBoundingClientRect();
        this.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.worldPos = this.app.visualization.screenToWorld(this.mousePos.x, this.mousePos.y);
        
        // Update probe
        this.updateProbe();
        
        // Drag element
        if (this.isDragging && this.dragElement) {
            this.dragElement.x = this.worldPos.x;
            this.dragElement.y = this.worldPos.y;
            this.app.potentialFlow.invalidate();
        }
        
        // NS interaction - add velocity/density
        if (this.isMouseDown && this.mode === 'navier-stokes') {
            const nx = this.mousePos.x / this.app.visualization.width;
            const ny = 1 - this.mousePos.y / this.app.visualization.height;
            const dx = this.mousePos.x - this.lastMousePos.x;
            const dy = this.mousePos.y - this.lastMousePos.y;
            
            // Add velocity in direction of mouse movement
            this.app.nsSolver.addVelocity(nx, ny, dx * 0.5, -dy * 0.5);
            this.app.nsSolver.addDensity(nx, ny, 10);
        }
        
        this.lastMousePos = { ...this.mousePos };
    }

    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        this.isMouseDown = true;
        
        if (this.mode === 'potential') {
            // Check if clicking on an element
            const clickedElement = this.findElementAt(this.worldPos.x, this.worldPos.y);
            
            if (clickedElement) {
                if (e.button === 0) {
                    // Left click - drag
                    this.isDragging = true;
                    this.dragElement = clickedElement;
                    this.selectElement(clickedElement.id);
                } else if (e.button === 2) {
                    // Right click - edit
                    this.openElementModal(clickedElement);
                }
            } else {
                this.selectElement(null);
            }
        } else if (this.mode === 'navier-stokes') {
            // Add obstacle on click
            if (this.app.obstacleType !== 'none' && e.button === 0) {
                const nx = this.mousePos.x / this.app.visualization.width;
                const ny = 1 - this.mousePos.y / this.app.visualization.height;
                
                switch (this.app.obstacleType) {
                    case 'circle':
                        this.app.nsSolver.addCircleObstacle(nx, ny, 0.05);
                        break;
                    case 'square':
                        this.app.nsSolver.addSquareObstacle(nx, ny, 0.08);
                        break;
                    case 'airfoil':
                        this.app.nsSolver.addAirfoilObstacle(nx, ny, 0.15);
                        break;
                }
            }
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        this.isMouseDown = false;
        this.isDragging = false;
        this.dragElement = null;
    }

    /**
     * Mouse leave handler
     */
    onMouseLeave(e) {
        document.getElementById('probe-display').classList.add('hidden');
        this.isMouseDown = false;
        this.isDragging = false;
        this.dragElement = null;
    }

    /**
     * Wheel handler (zoom)
     */
    onWheel(e) {
        e.preventDefault();
        const zoomSlider = document.getElementById('zoom-level');
        let zoom = parseFloat(zoomSlider.value);
        // Scale zoom step based on current level for smoother zooming
        const step = zoom < 1 ? 0.05 : 0.2;
        zoom += e.deltaY > 0 ? -step : step;
        zoom = MathUtils.clamp(zoom, 0.1, 10);
        zoomSlider.value = zoom;
        this.setZoom(zoom);
        document.getElementById('zoom-val').textContent = zoom.toFixed(1) + 'x';
    }

    /**
     * Touch handlers
     */
    onTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.onMouseDown({ 
                clientX: touch.clientX, 
                clientY: touch.clientY, 
                target: e.target,
                button: 0 
            });
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = e.target.getBoundingClientRect();
            this.onMouseMove({ 
                clientX: touch.clientX, 
                clientY: touch.clientY,
                target: e.target
            });
        }
    }

    onTouchEnd(e) {
        this.onMouseUp(e);
    }

    /**
     * Find element at world position
     */
    findElementAt(x, y) {
        const threshold = 0.3;
        for (const element of this.app.potentialFlow.elements) {
            if (element.type === 'uniform') continue; // Uniform has no position
            const dist = MathUtils.distance(x, y, element.x, element.y);
            if (dist < threshold) {
                return element;
            }
        }
        return null;
    }

    /**
     * Set simulation mode
     */
    setMode(mode) {
        this.mode = mode;
        
        // Update buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update panels
        document.getElementById('potential-panel').classList.toggle('active', mode === 'potential');
        document.getElementById('ns-panel').classList.toggle('active', mode === 'navier-stokes');
        
        // Reset and configure NS if switching to it
        if (mode === 'navier-stokes') {
            this.app.nsSolver.reset();
            this.app.visualization.updateSettings({ showGradient: true });
            document.getElementById('show-gradient').checked = true;
            
            // Auto-start the simulation
            this.app.nsSolver.isRunning = true;
            document.getElementById('ns-play').classList.add('active');
            document.getElementById('ns-pause').classList.remove('active');
            
            // Set up inlet-outlet boundary by default for visible results
            const boundarySelect = document.getElementById('ns-boundary-type');
            if (boundarySelect.value === 'periodic') {
                boundarySelect.value = 'inlet-outlet';
                this.app.nsSolver.setParams({ boundaryType: 'inlet-outlet' });
                this.app.nsSolver.reset();
                this.app.nsSolver.isRunning = true;
            }
        }
    }

    /**
     * Toggle UI panels
     */
    toggleUI() {
        this.showUI = !this.showUI;
        document.getElementById('left-panel').classList.toggle('hidden', !this.showUI);
        document.getElementById('right-panel').classList.toggle('hidden', !this.showUI);
    }

    /**
     * Toggle probe display
     */
    toggleProbe() {
        this.showProbe = !this.showProbe;
        document.getElementById('toggleProbe').classList.toggle('active', this.showProbe);
    }

    /**
     * Toggle zen mode (fullscreen with no UI)
     */
    toggleZenMode() {
        this.isZenMode = !this.isZenMode;
        document.body.classList.toggle('zen-mode', this.isZenMode);
        
        if (this.isZenMode) {
            // Force resize after transition
            setTimeout(() => this.app.resize(), 100);
        } else {
            this.app.resize();
        }
    }

    /**
     * Toggle grid
     */
    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.app.renderGrid();
    }

    /**
     * Reset view
     */
    resetView() {
        document.getElementById('zoom-level').value = 1;
        document.getElementById('zoom-val').textContent = '1x';
        this.setZoom(1);
        
        if (this.mode === 'navier-stokes') {
            this.app.nsSolver.reset();
        }
    }

    /**
     * Set zoom level
     */
    setZoom(zoom) {
        const baseSize = 5;
        const size = baseSize / zoom;
        
        this.app.potentialFlow.setDomain(-size, size, -size, size);
        this.app.nsSolver.domain = { xMin: -size, xMax: size, yMin: -size, yMax: size };
        this.app.visualization.setDomain(-size, size, -size, size);
        this.app.particles.setDomain(-size, size, -size, size);
        
        // Update domain display
        document.getElementById('domain-x-min').textContent = (-size).toFixed(1);
        document.getElementById('domain-x-max').textContent = size.toFixed(1);
        document.getElementById('domain-y-min').textContent = (-size).toFixed(1);
        document.getElementById('domain-y-max').textContent = size.toFixed(1);
        
        this.app.potentialFlow.invalidate();
    }

    /**
     * Add a new flow element
     */
    addElement(type) {
        const element = FlowElementFactory.create(type);
        if (element) {
            this.app.potentialFlow.addElement(element);
            this.updateElementsList();
            this.selectElement(element.id);
        }
    }

    /**
     * Clear all elements
     */
    clearElements() {
        this.app.potentialFlow.clearElements();
        this.updateElementsList();
        this.selectElement(null);
    }

    /**
     * Update elements list UI
     */
    updateElementsList() {
        const list = document.getElementById('elements-list');
        list.innerHTML = '';
        
        for (const element of this.app.potentialFlow.elements) {
            const item = document.createElement('div');
            item.className = 'element-item';
            item.dataset.id = element.id;
            
            if (element.id === this.selectedElementId) {
                item.classList.add('selected');
            }
            
            const info = FlowElementFactory.getTypeInfo(element.type);
            item.innerHTML = `
                <div>
                    <span class="type">${info.icon} ${info.name}</span>
                    <div class="name">${element.getName()}</div>
                </div>
                <div class="controls">
                    <button class="edit-btn" title="Edit">✏️</button>
                    <button class="toggle-btn" title="Toggle">${element.enabled ? '👁️' : '🚫'}</button>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.selectElement(element.id);
                }
            });
            
            item.querySelector('.edit-btn').addEventListener('click', () => {
                this.openElementModal(element);
            });
            
            item.querySelector('.toggle-btn').addEventListener('click', (e) => {
                element.enabled = !element.enabled;
                e.target.textContent = element.enabled ? '👁️' : '🚫';
                this.app.potentialFlow.invalidate();
            });
            
            list.appendChild(item);
        }
    }

    /**
     * Select an element
     */
    selectElement(id) {
        this.selectedElementId = id;
        
        document.querySelectorAll('.element-item').forEach(item => {
            item.classList.toggle('selected', parseInt(item.dataset.id) === id);
        });
    }

    /**
     * Open element editing modal
     */
    openElementModal(element) {
        const modal = document.getElementById('element-modal');
        const title = document.getElementById('modal-title');
        const params = document.getElementById('modal-params');
        
        title.textContent = `Edit ${FlowElementFactory.getTypeInfo(element.type).name}`;
        params.innerHTML = '';
        params.dataset.elementId = element.id;
        
        const elementParams = element.getParams();
        
        for (const [key, config] of Object.entries(elementParams)) {
            const group = document.createElement('div');
            group.className = 'param-group';
            group.innerHTML = `
                <label>${config.label}</label>
                <input type="number" 
                    id="modal-${key}" 
                    value="${config.value}" 
                    min="${config.min}" 
                    max="${config.max}" 
                    step="${config.step}">
            `;
            params.appendChild(group);
        }
        
        modal.classList.remove('hidden');
    }

    /**
     * Save modal element changes
     */
    saveModalElement() {
        const params = document.getElementById('modal-params');
        const elementId = parseInt(params.dataset.elementId);
        const element = this.app.potentialFlow.getElement(elementId);
        
        if (element) {
            const newParams = {};
            const inputs = params.querySelectorAll('input');
            
            inputs.forEach(input => {
                const key = input.id.replace('modal-', '');
                newParams[key] = parseFloat(input.value);
            });
            
            element.setParams(newParams);
            this.app.potentialFlow.invalidate();
            this.updateElementsList();
        }
        
        this.closeModal();
    }

    /**
     * Delete modal element
     */
    deleteModalElement() {
        const params = document.getElementById('modal-params');
        const elementId = parseInt(params.dataset.elementId);
        
        this.app.potentialFlow.removeElement(elementId);
        this.updateElementsList();
        this.closeModal();
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('element-modal').classList.add('hidden');
    }

    /**
     * Load preset scenario
     */
    loadPreset(preset) {
        this.app.potentialFlow.clearElements();
        
        switch (preset) {
            case 'half-body':
                this.app.potentialFlow.addElement(new UniformFlow(1, 0));
                this.app.potentialFlow.addElement(new SourceSink(0, 0, 3));
                break;
                
            case 'cylinder':
                this.app.potentialFlow.addElement(new UniformFlow(1, 0));
                this.app.potentialFlow.addElement(new Doublet(0, 0, 4, 0));
                break;
                
            case 'rotating-cylinder':
                this.app.potentialFlow.addElement(new UniformFlow(1, 0));
                this.app.potentialFlow.addElement(new Doublet(0, 0, 4, 0));
                this.app.potentialFlow.addElement(new Vortex(0, 0, -4));
                break;
                
            case 'rankine-oval':
                this.app.potentialFlow.addElement(new UniformFlow(1, 0));
                this.app.potentialFlow.addElement(new SourceSink(-1.5, 0, 3));
                this.app.potentialFlow.addElement(new SourceSink(1.5, 0, -3));
                break;
                
            case 'source-sink':
                this.app.potentialFlow.addElement(new SourceSink(-2, 0, 3));
                this.app.potentialFlow.addElement(new SourceSink(2, 0, -3));
                break;
                
            case 'doublet-array':
                this.app.potentialFlow.addElement(new UniformFlow(1, 0));
                this.app.potentialFlow.addElement(new Doublet(-2, 0, 2, 0));
                this.app.potentialFlow.addElement(new Doublet(0, 0, 2, 0));
                this.app.potentialFlow.addElement(new Doublet(2, 0, 2, 0));
                break;
        }
        
        this.app.potentialFlow.invalidate();
        this.updateElementsList();
    }

    /**
     * Update probe display
     */
    updateProbe() {
        const probeDisplay = document.getElementById('probe-display');
        
        if (!this.showProbe) {
            probeDisplay.classList.add('hidden');
            return;
        }
        
        probeDisplay.classList.remove('hidden');
        
        document.getElementById('probe-x').textContent = this.worldPos.x.toFixed(3);
        document.getElementById('probe-y').textContent = this.worldPos.y.toFixed(3);
        
        if (this.mode === 'potential') {
            const psi = this.app.potentialFlow.psi(this.worldPos.x, this.worldPos.y);
            const phi = this.app.potentialFlow.phi(this.worldPos.x, this.worldPos.y);
            const vel = this.app.potentialFlow.velocity(this.worldPos.x, this.worldPos.y);
            const vmag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
            const Vinf = this.app.potentialFlow.getVinfinity();
            const cp = 1 - (vmag / Vinf) ** 2;
            
            document.getElementById('probe-psi').textContent = psi.toFixed(3);
            document.getElementById('probe-phi').textContent = phi.toFixed(3);
            document.getElementById('probe-vel').textContent = vmag.toFixed(3);
            document.getElementById('probe-u').textContent = vel.u.toFixed(3);
            document.getElementById('probe-v').textContent = vel.v.toFixed(3);
            document.getElementById('probe-p').textContent = cp.toFixed(3);
        } else {
            const vel = this.app.nsSolver.getVelocity(this.worldPos.x, this.worldPos.y);
            const vmag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
            const p = this.app.nsSolver.getPressure(this.worldPos.x, this.worldPos.y);
            const d = this.app.nsSolver.getDensity(this.worldPos.x, this.worldPos.y);
            
            document.getElementById('probe-psi').textContent = '-';
            document.getElementById('probe-phi').textContent = '-';
            document.getElementById('probe-vel').textContent = vmag.toFixed(3);
            document.getElementById('probe-u').textContent = vel.u.toFixed(3);
            document.getElementById('probe-v').textContent = vel.v.toFixed(3);
            document.getElementById('probe-p').textContent = p.toFixed(3);
        }
    }

    /**
     * Update legend
     */
    updateLegend() {
        const legend = document.getElementById('color-legend');
        const title = legend.querySelector('.legend-title');
        const quantity = document.getElementById('gradient-quantity').value;
        
        const titles = {
            velocity: 'Velocity Magnitude',
            pressure: 'Pressure Coefficient',
            vorticity: 'Vorticity',
            stream: 'Stream Function',
            potential: 'Velocity Potential'
        };
        
        title.textContent = titles[quantity] || quantity;
        
        if (this.app.visualization.settings.showGradient) {
            legend.classList.remove('hidden');
        } else {
            legend.classList.add('hidden');
        }
    }

    /**
     * Update legend gradient
     */
    updateLegendGradient() {
        const gradient = document.querySelector('.legend-gradient');
        const palette = document.getElementById('color-palette').value;
        gradient.style.background = ColorPalettes.createGradientCSS(palette);
        this.updateLegend();
    }

    /**
     * Apply custom equations (placeholder - equations are display only)
     */
    applyCustomEquations() {
        // In a full implementation, this would parse and apply custom equations
        // For now, just show confirmation
        console.log('Custom equations applied (standard NS solver used)');
    }
}

// Export
window.UIController = UIController;
