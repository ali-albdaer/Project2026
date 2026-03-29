// ────────────────────────────────────────────
// main.js — Application entry point & main loop
// ────────────────────────────────────────────

import { DEFAULT_CONFIG, SHAPE_NAMES } from './config.js';
import { bus, EVT } from './events.js';
import { createSolver } from './solver/solver.js';
import { BodyManager } from './geometry/bodyManager.js';
import { Body } from './geometry/body.js';
import { Renderer } from './render/renderer.js';
import { Overlay } from './render/overlay.js';
import { Sidebar } from './ui/sidebar.js';
import { buildSimPanel, buildFlowPanel, buildBodyPanel, buildVisualPanel } from './ui/panels.js';
import { Monitor } from './ui/monitor.js';
import { KeybindManager } from './ui/keybinds.js';
import { InteractionManager } from './ui/interactions.js';
import { computeForcesLBM } from './analysis/forces.js';
import { computeBoundaryLayer } from './analysis/boundaryLayer.js';
import { computeQuantities } from './analysis/quantities.js';
import { SCENARIOS, getScenario } from './scenarios.js';

class App {
    constructor() {
        // Config
        this.config = { ...DEFAULT_CONFIG };
        this.nx = this.config.nx;
        this.ny = this.config.ny;

        // Expose Body class for interactions
        this.Body = Body;

        // FPS tracking
        this.fps = 0;
        this._frameCount = 0;
        this._lastFpsTime = performance.now();
        this._stepCount = 0;

        // Probe data
        this.probeData = { active: false, x: 0, y: 0, values: {} };

        // Lift history per body for Strouhal
        this.liftHistory = {};

        // BL data
        this.blData = {};

        // Body quantities for monitor
        this.bodyQuantities = [];
    }

    init() {
        // Create solver
        this.solver = createSolver(this.config.solverType, this.nx, this.ny, {
            uInf: this.config.uInf,
            uInfFunction: this.config.uInfFunction,
            viscosity: this.config.viscosity,
            density: this.config.density,
            collision: this.config.collision,
            turbModel: this.config.turbModel,
            smagorinskyCs: this.config.smagorinskyCs,
            periodicY: this.config.periodicY,
        });

        // Body manager
        this.bodyManager = new BodyManager();

        // WebGL renderer
        const flowCanvas = document.getElementById('flow-canvas');
        this.renderer = new Renderer(flowCanvas);
        this.renderer.init();
        this.renderer.setColormap(this.config.colormap);

        // Overlay
        const overlayCanvas = document.getElementById('overlay-canvas');
        this.overlay = new Overlay(overlayCanvas);

        // UI
        this._initSidebar();
        this._initScenarioBar();

        // Monitor
        this.monitor = new Monitor();

        // Keybinds
        this.keybinds = new KeybindManager(this);

        // Interactions
        this.interactions = new InteractionManager(overlayCanvas, this);

        // Events
        this._bindEvents();

        // Resize
        this._resize();
        window.addEventListener('resize', () => this._resize());

        // Load default scenario
        this._loadScenario('karman');

        // Start loop
        this._loop();
    }

    _initSidebar() {
        const sidebarContent = document.getElementById('sidebar-content');
        this.sidebar = new Sidebar(sidebarContent);

        const onConfigChange = (changes) => {
            this._applyConfigChanges(changes);
        };

        this.sidebar.addPanel('sim', 'Simulation', '[1]',
            buildSimPanel(this.config, onConfigChange));
        this.sidebar.addPanel('flow', 'Flow', '[2]',
            buildFlowPanel(this.config, onConfigChange));
        this.sidebar.addPanel('body', 'Bodies', '[3]',
            buildBodyPanel(this.config, this.bodyManager, onConfigChange));
        this.sidebar.addPanel('visual', 'Visual', '[4]',
            buildVisualPanel(this.config, onConfigChange));

        // Sidebar toggle button
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            this.sidebar.toggle();
        });
    }

    _initScenarioBar() {
        const bar = document.getElementById('scenario-bar');
        for (const scenario of SCENARIOS) {
            const btn = document.createElement('button');
            btn.className = 'scenario-btn';
            btn.textContent = scenario.name;
            btn.title = scenario.description;
            btn.addEventListener('click', () => this._loadScenario(scenario.id));
            bar.appendChild(btn);
        }
    }

    _bindEvents() {
        bus.on(EVT.SOLVER_RESET, () => this._resetSolver());

        bus.on(EVT.CONFIG_CHANGED, (changes) => {
            this._applyConfigChanges(changes);
        });

        bus.on(EVT.BODY_MOVED, () => this._rasterizeBodies());
        bus.on(EVT.BODY_UPDATED, () => this._rasterizeBodies());
        bus.on(EVT.BODY_ADDED, () => this._rasterizeBodies());
        bus.on(EVT.BODY_REMOVED, () => this._rasterizeBodies());
    }

    _applyConfigChanges(changes) {
        const prevSolverType = this.config.solverType;
        const prevNx = this.config.nx;

        Object.assign(this.config, changes);

        // Handle resolution change
        if (changes.nx !== undefined || changes.ny !== undefined) {
            this.nx = this.config.nx;
            this.ny = this.config.ny || Math.round(this.config.nx / 2);
            this.config.ny = this.ny;
            this.solver.resize(this.nx, this.ny);
            this._rasterizeBodies();
            this.solver.init();
            this._resize();
        }

        // Handle solver type change
        if (changes.solverType && changes.solverType !== prevSolverType) {
            this.solver = createSolver(this.config.solverType, this.nx, this.ny, {
                uInf: this.config.uInf,
                uInfFunction: this.config.uInfFunction,
                viscosity: this.config.viscosity,
                density: this.config.density,
                collision: this.config.collision,
                turbModel: this.config.turbModel,
                smagorinskyCs: this.config.smagorinskyCs,
                periodicY: this.config.periodicY,
            });
            this._rasterizeBodies();
        }

        // Update solver config
        this.solver.updateConfig({
            uInf: this.config.uInf,
            uInfFunction: this.config.uInfFunction,
            viscosity: this.config.viscosity,
            density: this.config.density,
            collision: this.config.collision,
            turbModel: this.config.turbModel,
            smagorinskyCs: this.config.smagorinskyCs,
            periodicY: this.config.periodicY,
        });

        // Update renderer
        if (changes.colormap) {
            this.renderer.setColormap(this.config.colormap);
        }

        // Handle single step
        if (changes.singleStep) {
            this.config.paused = true;
            this.singleStep();
            delete this.config.singleStep;
        }

        // Update pause button appearance
        if (changes.paused !== undefined) {
            this.updatePauseButton();
        }

        // Update Re display
        this._updateReDisplay();
    }

    _loadScenario(id) {
        const scenario = getScenario(id);
        if (!scenario) return;

        // Apply config
        Object.assign(this.config, scenario.config);
        this.nx = this.config.nx;
        this.ny = this.config.ny || Math.round(this.nx / 2);
        this.config.ny = this.ny;

        // Recreate solver
        this.solver = createSolver(this.config.solverType, this.nx, this.ny, {
            uInf: this.config.uInf,
            uInfFunction: this.config.uInfFunction || null,
            viscosity: this.config.viscosity,
            density: this.config.density,
            collision: this.config.collision,
            turbModel: this.config.turbModel,
            smagorinskyCs: this.config.smagorinskyCs,
            periodicY: this.config.periodicY,
        });

        // Clear and add bodies
        this.bodyManager.clear();
        for (const b of (scenario.bodies || [])) {
            this.bodyManager.addBody(b.type, b.x, b.y, b.params, b.angle || 0);
        }

        this._rasterizeBodies();
        this.solver.init();
        this._resize();

        // Update renderer colormap
        this.renderer.setColormap(this.config.colormap);

        // Clear analysis state
        this.liftHistory = {};
        this.blData = {};
        this._stepCount = 0;

        // Update UI
        this._updateUIFromConfig();
        this._updateReDisplay();
    }

    _rasterizeBodies() {
        this.bodyManager.rasterizeAll(this.solver.solid, this.nx, this.ny);
        this.renderer.setSolid(this.solver.solid, this.nx, this.ny);
    }

    _resetSolver() {
        this.solver.resize(this.nx, this.ny);
        this._rasterizeBodies();
        this.solver.init();
        this.liftHistory = {};
        this.blData = {};
        this._stepCount = 0;
    }

    singleStep() {
        this.solver.step();
        this._stepCount++;
        this._doAnalysis();
    }

    _resize() {
        const container = document.getElementById('canvas-container');
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Maintain aspect ratio of simulation
        const aspect = this.nx / this.ny;
        let canvasW, canvasH;
        if (w / h > aspect) {
            canvasH = h;
            canvasW = h * aspect;
        } else {
            canvasW = w;
            canvasH = w / aspect;
        }

        this.renderer.resize(canvasW, canvasH);
        this.overlay.resize(canvasW, canvasH);

        const flowCanvas = document.getElementById('flow-canvas');
        const overlayCanvas = document.getElementById('overlay-canvas');
        flowCanvas.style.width = canvasW + 'px';
        flowCanvas.style.height = canvasH + 'px';
        overlayCanvas.style.width = canvasW + 'px';
        overlayCanvas.style.height = canvasH + 'px';
    }

    _loop() {
        requestAnimationFrame(() => this._loop());

        // FPS calculation
        this._frameCount++;
        const now = performance.now();
        if (now - this._lastFpsTime >= 1000) {
            this.fps = this._frameCount;
            this._frameCount = 0;
            this._lastFpsTime = now;
        }

        // Solver steps
        if (!this.config.paused) {
            for (let s = 0; s < this.config.stepsPerFrame; s++) {
                this.solver.step();
                this._stepCount++;
            }
        }

        // Analysis (every N frames)
        if (this._stepCount % this.config.monitorUpdateInterval === 0) {
            this._doAnalysis();
        }

        // Render
        const fieldData = this.solver.getField(this.config.field);
        this.renderer.setField(fieldData, this.nx, this.ny);
        this.renderer.draw();

        // Overlay
        this.overlay.draw({
            bodies: this.bodyManager.bodies,
            selectedId: this.bodyManager.selectedId,
            blData: this.blData,
            probeData: this.config.probeEnabled ? this.probeData : null,
            fps: this.fps,
            config: this.config,
            nx: this.nx,
            ny: this.ny,
            spawnMode: this.interactions.spawnMode,
            spawnPreview: this.interactions.spawnMode ?
                this._createPreviewBody() : null,
        });

        // Monitor
        if (!this.monitor.collapsed) {
            this.monitor.update(this.bodyQuantities);
        }
    }

    _doAnalysis() {
        this.bodyQuantities = [];

        for (const body of this.bodyManager.bodies) {
            // Forces
            const forces = computeForcesLBM(this.solver, body, this.nx, this.ny);

            // Lift history for Strouhal
            if (!this.liftHistory[body.id]) this.liftHistory[body.id] = [];
            this.liftHistory[body.id].push(forces.Fy);
            if (this.liftHistory[body.id].length > 500) {
                this.liftHistory[body.id].shift();
            }

            // Boundary layer
            if (this.config.showBoundaryLayer) {
                this.blData[body.id] = computeBoundaryLayer(
                    this.solver, body, this.nx, this.ny, 60
                );
            }

            // Quantities
            const quantities = computeQuantities({
                Fx: forces.Fx,
                Fy: forces.Fy,
                wallShear: forces.wallShear,
                uInf: this.config.uInf,
                charLength: body.characteristicLength,
                nu: this.config.viscosity,
                rho: this.config.density,
                liftHistory: this.liftHistory[body.id],
                dt: 1,
            });

            this.bodyQuantities.push({
                bodyId: body.id,
                bodyName: `${SHAPE_NAMES[body.type] || body.type} #${body.id}`,
                quantities,
            });
        }
    }

    _createPreviewBody() {
        try {
            return new Body(
                this.interactions.spawnType,
                this.interactions.spawnPreviewX,
                this.interactions.spawnPreviewY
            );
        } catch {
            return null;
        }
    }

    toggleUI() {
        this.config.uiVisible = !this.config.uiVisible;
        document.getElementById('sidebar').classList.toggle('hidden', !this.config.uiVisible);
        document.getElementById('monitor').classList.toggle('hidden', !this.config.uiVisible);
        document.getElementById('scenario-bar').classList.toggle('hidden', !this.config.uiVisible);
    }

    updatePauseButton() {
        const btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = this.config.paused ? 'Resume' : 'Pause';
    }

    cancelSpawnMode() {
        this.interactions.cancelSpawn();
    }

    _updateReDisplay() {
        const reEl = document.getElementById('re-display');
        if (reEl) {
            const U = this.config.uInf || 0.08;
            const nu = this.config.viscosity || 0.02;
            // Use first body's char length, or default
            const L = this.bodyManager.bodies.length > 0
                ? this.bodyManager.bodies[0].characteristicLength
                : 20;
            const Re = U * L / Math.max(nu, 1e-15);
            reEl.textContent = Re.toFixed(1);
        }
    }

    _updateUIFromConfig() {
        // Update slider values
        const resSlider = document.getElementById('res-slider');
        if (resSlider) { resSlider.value = this.config.nx; }
        const resVal = document.getElementById('res-slider-val');
        if (resVal) { resVal.textContent = this.config.nx; }

        const stepsSlider = document.getElementById('steps-frame');
        if (stepsSlider) { stepsSlider.value = this.config.stepsPerFrame; }
        const stepsVal = document.getElementById('steps-frame-val');
        if (stepsVal) { stepsVal.textContent = this.config.stepsPerFrame; }

        const uInfInput = document.getElementById('u-inf');
        if (uInfInput) { uInfInput.value = this.config.uInf; }

        const viscInput = document.getElementById('viscosity');
        if (viscInput) { viscInput.value = this.config.viscosity; }

        const densityInput = document.getElementById('density');
        if (densityInput) { densityInput.value = this.config.density; }

        const solverType = document.getElementById('solver-type');
        if (solverType) { solverType.value = this.config.solverType; }

        const collision = document.getElementById('collision');
        if (collision) { collision.value = this.config.collision; }

        const turbModel = document.getElementById('turb-model');
        if (turbModel) { turbModel.value = this.config.turbModel; }

        const smagCs = document.getElementById('smag-cs');
        if (smagCs) { smagCs.value = this.config.smagorinskyCs; }
        const smagCsVal = document.getElementById('smag-cs-val');
        if (smagCsVal) { smagCsVal.textContent = this.config.smagorinskyCs; }

        const fieldSel = document.getElementById('display-field');
        if (fieldSel) { fieldSel.value = this.config.field; }

        const colormapSel = document.getElementById('colormap');
        if (colormapSel) { colormapSel.value = this.config.colormap; }

        const periodicCb = document.getElementById('periodic-y');
        if (periodicCb) { periodicCb.checked = this.config.periodicY; }

        const showBodiesCb = document.getElementById('show-bodies');
        if (showBodiesCb) { showBodiesCb.checked = this.config.showBodies; }

        const showBlCb = document.getElementById('show-bl');
        if (showBlCb) { showBlCb.checked = this.config.showBoundaryLayer; }

        this.updatePauseButton();
    }
}

// ── Bootstrap ─────────────────────────────

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
