// app.js — Main application bootstrapper, event wiring, and simulation loop

import { bus } from './core/event-bus.js';
import { GPU } from './core/gpu.js';
import { LBMSolver } from './physics/lbm-solver.js';
import { ProjectionSolver } from './physics/projection-solver.js';
import { BodyManager } from './physics/bodies.js';
import { FlowAnalysis } from './physics/analysis.js';
import { createColormapTextures } from './rendering/colormaps.js';
import { FlowRenderer } from './rendering/renderer.js';
import { Overlays } from './rendering/overlays.js';
import { Panel } from './ui/panel.js';
import { SimSettings } from './ui/sim-settings.js';
import { FlowSettings } from './ui/flow-settings.js';
import { BodySettings } from './ui/body-settings.js';
import { VisualSettings } from './ui/visual-settings.js';
import { Monitor } from './ui/monitor.js';
import { ProbeTool } from './ui/probe.js';
import { Keybinds } from './ui/keybinds.js';
import { SCENARIOS } from './scenarios/presets.js';

/* ═══════════ State ═══════════ */
let gpu, solver, renderer, overlays, analysis;
let bodyManager, panel, simSettings, flowSettings, bodySettings, visualSettings, monitor, probe, keybinds;
let colormapTextures;
let paused = false;
let substeps = 4;
let frameCount = 0;
let lastTime = 0;
let fpsAccum = 0, fpsFrames = 0, fpsDisplay = 0;
const fpsEl = document.getElementById('fps-counter');
const simCanvas = document.getElementById('sim-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');

/* ═══════════ Canvas Sizing ═══════════ */
function resizeCanvases() {
    const dpr = 1; // Use 1 for performance (simulation runs at sim resolution anyway)
    simCanvas.width = window.innerWidth * dpr;
    simCanvas.height = window.innerHeight * dpr;
    overlayCanvas.width = window.innerWidth * dpr;
    overlayCanvas.height = window.innerHeight * dpr;
}

/* ═══════════ Solver Management ═══════════ */
function createSolver(type, resolution) {
    if (solver) solver.destroy();

    const aspect = window.innerWidth / window.innerHeight;
    const h = resolution;
    const w = Math.round(h * aspect);

    if (type === 'lbm') {
        solver = new LBMSolver();
    } else {
        solver = new ProjectionSolver();
    }

    const nu = flowSettings ? flowSettings.viscosity : 0.02;
    const inletU = flowSettings ? [flowSettings.inletUx, flowSettings.inletUy] : [0.1, 0];

    solver.init(gpu, w, h, {
        tau: 3 * nu + 0.5,
        viscosity: nu,
        inletU: inletU,
    });

    // Re-render obstacle mask
    solver.updateObstacleMask(bodyManager.bodies);
}

/* ═══════════ Body Interaction (drag) ═══════════ */
let dragging = null;
let dragOffsetX = 0, dragOffsetY = 0;

function setupBodyInteraction() {
    simCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const rect = simCanvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = 1.0 - (e.clientY - rect.top) / rect.height;

        const hit = bodyManager.hitTest(nx, ny);
        if (hit) {
            dragging = hit;
            dragOffsetX = nx - hit.x;
            dragOffsetY = ny - hit.y;
            bodyManager.select(hit.id);
            bus.emit('body-selected', hit.id);
        } else {
            bodyManager.select(-1);
            bus.emit('body-selected', -1);
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = simCanvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = 1.0 - (e.clientY - rect.top) / rect.height;

        dragging.x = Math.max(0.02, Math.min(0.98, nx - dragOffsetX));
        dragging.y = Math.max(0.02, Math.min(0.98, ny - dragOffsetY));

        // Smooth update: just re-render obstacle mask, flow continues
        solver.updateObstacleMask(bodyManager.bodies);
    });

    window.addEventListener('mouseup', () => {
        dragging = null;
    });
}

/* ═══════════ Scenarios ═══════════ */
function buildScenarioUI(container) {
    SCENARIOS.forEach(scenario => {
        const btn = document.createElement('button');
        btn.className = 'scenario-btn';
        btn.innerHTML = `${scenario.name}<div class="scenario-desc">${scenario.desc}</div>`;
        btn.addEventListener('click', () => loadScenario(scenario));
        container.appendChild(btn);
    });
}

function loadScenario(scenario) {
    const s = scenario.settings;

    // Update UI state
    if (simSettings) {
        simSettings.resolution = s.resolution;
        simSettings.solver = s.solver;
        simSettings.substeps = s.substeps || 4;
    }
    if (flowSettings) {
        flowSettings.inletUx = s.inletUx;
        flowSettings.inletUy = s.inletUy;
        flowSettings.viscosity = s.viscosity;
        flowSettings.uxExpr = String(s.inletUx);
        flowSettings.uyExpr = String(s.inletUy);
    }

    substeps = s.substeps || 4;

    // Clear and add bodies
    bodyManager.clear();
    scenario.bodies.forEach(b => {
        const body = bodyManager.add(b.type, b.x, b.y, b.params);
        if (body && b.rotation) body.rotation = b.rotation;
    });

    // Recreate solver at new resolution
    createSolver(s.solver, s.resolution);

    // Refresh body settings UI
    if (bodySettings) bodySettings.refresh();
}

/* ═══════════ Event Wiring ═══════════ */
function wireEvents() {
    bus.on('resolution-changed', (res) => {
        createSolver(simSettings.solver, res);
    });

    bus.on('solver-changed', (type) => {
        createSolver(type, simSettings.resolution);
    });

    bus.on('substeps-changed', (n) => { substeps = n; });

    bus.on('jacobi-changed', (n) => {
        if (solver && solver.jacobiIterations !== undefined) {
            solver.jacobiIterations = n;
        }
    });

    bus.on('inlet-changed', (data) => {
        if (solver) solver.setInletVelocity(data.ux, data.uy);
    });

    bus.on('viscosity-changed', (nu) => {
        if (solver) solver.setViscosity(nu);
    });

    bus.on('bodies-changed', () => {
        if (solver) solver.updateObstacleMask(bodyManager.bodies);
    });

    bus.on('body-selected', (id) => {
        overlays.selectedBodyId = id;
    });

    bus.on('quantity-changed', (q) => {
        renderer.quantity = q;
    });

    bus.on('set-quantity', (q) => {
        renderer.quantity = q;
        // Update visual settings UI state
        if (visualSettings) visualSettings.quantity = q;
    });

    bus.on('colormap-changed', (name) => {
        renderer.setColormap(colormapTextures[name]);
    });

    bus.on('toggle-pause', () => {
        paused = !paused;
        if (solver) solver.paused = paused;
    });

    bus.on('reset', () => {
        if (solver) {
            solver.reset();
            solver.updateObstacleMask(bodyManager.bodies);
        }
    });

    bus.on('toggle-panel', () => { panel.toggle(); });

    bus.on('toggle-ui', () => {
        const panelEl = document.getElementById('panel');
        const fpsEl2 = document.getElementById('fps-counter');
        if (panelEl.style.display === 'none') {
            panelEl.style.display = '';
            fpsEl2.style.display = '';
        } else {
            panelEl.style.display = 'none';
            fpsEl2.style.display = 'none';
        }
    });

    bus.on('toggle-probe', () => {
        if (visualSettings) {
            visualSettings.showProbe = !visualSettings.showProbe;
            bus.emit('probe-toggled', visualSettings.showProbe);
        }
    });

    bus.on('deselect', () => {
        bodyManager.select(-1);
        bus.emit('body-selected', -1);
    });

    bus.on('delete-body', () => {
        const sel = bodyManager.getSelected();
        if (sel) {
            bodyManager.remove(sel.id);
            bus.emit('bodies-changed');
            if (bodySettings) bodySettings.refresh();
        }
    });

    bus.on('resolution-up', () => {
        const newRes = Math.min(2048, simSettings.resolution + 64);
        simSettings.resolution = newRes;
        bus.emit('resolution-changed', newRes);
    });

    bus.on('resolution-down', () => {
        const newRes = Math.max(64, simSettings.resolution - 64);
        simSettings.resolution = newRes;
        bus.emit('resolution-changed', newRes);
    });

    bus.on('probe-sample', (data) => {
        if (solver && analysis) {
            const result = analysis.probeAt(gpu, solver, data.nx, data.ny);
            if (result) {
                result.screenX = data.screenX;
                result.screenY = data.screenY;
                bus.emit('probe-result', result);
            }
        }
    });

    bus.on('bl-display-changed', (opts) => {
        overlays.showBLDelta = opts.delta;
        overlays.showBLDeltaStar = opts.deltaStar;
        overlays.showBLTheta = opts.theta;
    });
}

/* ═══════════ Main Loop ═══════════ */
function frame(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // FPS
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 500) {
        fpsDisplay = Math.round(fpsFrames / (fpsAccum / 1000));
        fpsEl.textContent = fpsDisplay + ' FPS';
        fpsAccum = 0;
        fpsFrames = 0;
    }

    // Physics steps
    if (!paused && solver) {
        for (let i = 0; i < substeps; i++) {
            solver.step();
        }
    }

    // Analysis (throttled)
    if (solver && analysis && frameCount % 5 === 0) {
        const flowParams = {
            inletU: solver.inletU,
            viscosity: solver.getViscosity(),
            density: flowSettings ? flowSettings.density : 1.0,
            charLength: getCharLength(),
        };
        analysis.compute(gpu, solver, bodyManager.bodies, flowParams);
        monitor.update(analysis.results);
    }

    // Render flow field
    if (solver && renderer) {
        renderer.render(solver, simCanvas);
    }

    // Render overlays
    if (overlays) {
        let blProfiles = [];
        if ((overlays.showBLDelta || overlays.showBLDeltaStar || overlays.showBLTheta) &&
            bodyManager.bodies.length > 0 && frameCount % 15 === 0 && analysis) {
            const flowParams = {
                inletU: solver.inletU,
                viscosity: solver.getViscosity(),
            };
            blProfiles = analysis.computeBoundaryLayer(gpu, solver, bodyManager.bodies[0], flowParams);
            overlays._cachedBL = blProfiles;
        }
        overlays.render(
            bodyManager.bodies,
            overlays._cachedBL || [],
            solver ? solver.width : 256,
            solver ? solver.height : 144
        );
    }

    frameCount++;
    requestAnimationFrame(frame);
}

function getCharLength() {
    if (!solver || bodyManager.bodies.length === 0) return solver ? solver.height * 0.1 : 20;
    const b = bodyManager.bodies[0];
    const p = b.params;
    const h = solver.height;
    switch (b.type) {
        case 'CIRCLE': return p.radius * 2 * h;
        case 'RECTANGLE': return p.height * h;
        case 'AIRFOIL': return p.chord * h;
        case 'FLAT_PLATE': return p.length * h;
        default: return (p.radius || p.height || p.width || 0.05) * h;
    }
}

/* ═══════════ Boot ═══════════ */
function init() {
    // Resize canvases
    resizeCanvases();
    window.addEventListener('resize', () => {
        resizeCanvases();
        // Optionally recreate solver on resize — skip for performance
    });

    // GPU context
    gpu = new GPU(simCanvas);

    // Colormaps
    colormapTextures = createColormapTextures(gpu);

    // Body manager
    bodyManager = new BodyManager();

    // Analysis
    analysis = new FlowAnalysis();

    // Renderer
    renderer = new FlowRenderer();
    renderer.init(gpu);
    renderer.setColormap(colormapTextures.viridis);

    // Overlays
    overlays = new Overlays();
    overlays.init(overlayCanvas);

    // UI
    panel = new Panel();
    simSettings = new SimSettings();
    simSettings.init(document.getElementById('sim-content'));

    flowSettings = new FlowSettings();
    flowSettings.init(document.getElementById('flow-content'));

    bodySettings = new BodySettings(bodyManager);
    bodySettings.init(document.getElementById('bodies-content'));

    visualSettings = new VisualSettings();
    visualSettings.init(document.getElementById('visual-content'));

    monitor = new Monitor();
    monitor.init(document.getElementById('analysis-content'));

    probe = new ProbeTool();
    probe.init(simCanvas);

    keybinds = new Keybinds();
    keybinds.init();

    // Scenario buttons
    buildScenarioUI(document.getElementById('scenarios-content'));

    // Wire up all events
    wireEvents();

    // Create initial solver (default: LBM at 256)
    createSolver('lbm', simSettings.resolution);

    // Body interaction (drag)
    setupBodyInteraction();

    // Start
    requestAnimationFrame(frame);
}

// Boot when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
