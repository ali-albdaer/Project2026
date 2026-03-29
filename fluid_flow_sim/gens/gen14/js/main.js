import { DEFAULTS } from "./config.js";
import { MACGrid } from "./physics/grid.js";
import { BodyManager } from "./physics/bodies.js";
import { FlowController } from "./physics/flow.js";
import { FlowSolver } from "./physics/solver.js";
import { DiagnosticsEngine } from "./physics/diagnostics.js";
import { Renderer } from "./render/renderer.js";
import { ControlPanel } from "./ui/controls.js";
import { installKeybinds } from "./ui/keybinds.js";

const canvas = document.getElementById("simCanvas");
const fpsCounter = document.getElementById("fpsCounter");
const probeBox = document.getElementById("probeBox");

const state = {
  sim: {
    ...DEFAULTS.sim,
    lastDt: 1 / 60
  },
  visual: { ...DEFAULTS.visual },
  bodySpawn: { ...DEFAULTS.bodySpawn },
  flowExpr: {
    x: DEFAULTS.flow.uxExpr,
    y: DEFAULTS.flow.uyExpr
  },
  spawnArmed: false,
  dragBodiesEnabled: true,
  paused: false,
  time: 0,
  pointerWorld: null,
  pointerCanvas: null
};

let grid = new MACGrid(state.sim.resolution, state.sim.resolution);
let bodies = new BodyManager();
let flow = new FlowController(state.flowExpr.x, state.flowExpr.y);
let solver = new FlowSolver(grid);
let diagnostics = new DiagnosticsEngine();
const renderer = new Renderer(canvas);

state.grid = grid;
state.bodies = bodies;
state.flow = flow;

function createBodyParams(x, y) {
  return {
    type: state.bodySpawn.type,
    x,
    y,
    angle: state.bodySpawn.angleDeg * Math.PI / 180,
    sizeA: state.bodySpawn.sizeA,
    sizeB: state.bodySpawn.sizeB,
    mass: state.bodySpawn.mass,
    vx: 0,
    vy: 0,
    omega: 0
  };
}

function spawnBodyAt(x, y) {
  const body = bodies.addBody(createBodyParams(x, y));
  panel.updateBodyList(bodies.bodies);
  return body;
}

function rebuildGrid(newResolution) {
  state.sim.resolution = newResolution;
  grid = new MACGrid(newResolution, newResolution);
  solver = new FlowSolver(grid);

  state.grid = grid;
  state.sim.lastDt = 1 / 60;

  flow.applyInlet(grid, state.time);
  bodies.rasterizeToGrid(grid);
}

function resetSimulation() {
  grid.clear();
  state.time = 0;
  flow.applyInlet(grid, 0);
}

const panel = new ControlPanel(state, {
  onResolutionChange: (value) => rebuildGrid(value),
  onFlowExpressionChange: (exprX, exprY) => {
    state.flowExpr.x = exprX;
    state.flowExpr.y = exprY;
    flow.setExpressions(exprX, exprY);
  },
  onSpawnCenter: () => {
    spawnBodyAt(0.5, 0.5);
  },
  onRemoveBody: (id) => {
    bodies.removeBody(id);
    panel.updateBodyList(bodies.bodies);
  }
});

installKeybinds(state, panel, {
  reset: resetSimulation
});

spawnBodyAt(0.28, 0.5);

function eventToWorld(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) / Math.max(rect.width, 1);
  const y = 1 - (ev.clientY - rect.top) / Math.max(rect.height, 1);
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y))
  };
}

let dragBody = null;
let dragPrev = null;

canvas.addEventListener("pointerdown", (ev) => {
  const p = eventToWorld(ev);
  state.pointerWorld = p;

  if (state.dragBodiesEnabled) {
    const picked = bodies.pickBody(p.x, p.y);
    if (picked) {
      dragBody = picked;
      dragBody.dragging = true;
      dragPrev = {
        x: p.x,
        y: p.y,
        t: performance.now()
      };
      canvas.setPointerCapture(ev.pointerId);
      return;
    }
  }

  if (state.spawnArmed) {
    spawnBodyAt(p.x, p.y);
    state.spawnArmed = false;
    panel.el.spawnArmed.checked = false;
  }
});

canvas.addEventListener("pointermove", (ev) => {
  const p = eventToWorld(ev);
  state.pointerWorld = p;
  state.pointerCanvas = { x: ev.clientX, y: ev.clientY };

  if (!dragBody) {
    return;
  }

  const now = performance.now();
  const dt = Math.max((now - dragPrev.t) * 0.001, 1e-5);
  dragBody.x = p.x;
  dragBody.y = p.y;
  dragBody.vx = (p.x - dragPrev.x) / dt;
  dragBody.vy = (p.y - dragPrev.y) / dt;
  dragPrev = { x: p.x, y: p.y, t: now };
});

canvas.addEventListener("pointerup", () => {
  if (!dragBody) {
    return;
  }
  dragBody.dragging = false;
  dragBody = null;
  dragPrev = null;
});

canvas.addEventListener("pointerleave", () => {
  state.pointerWorld = null;
  if (dragBody) {
    dragBody.dragging = false;
    dragBody = null;
    dragPrev = null;
  }
});

function updateProbe() {
  if (!state.visual.showProbe || !state.pointerWorld) {
    probeBox.classList.add("hidden");
    return;
  }

  const p = state.pointerWorld;
  const c = grid.nearestCell(p.x, p.y);
  const idx = grid.c(c.i, c.j);

  const ux = 0.5 * (grid.u[grid.uIdx(c.i, c.j)] + grid.u[grid.uIdx(c.i + 1, c.j)]);
  const vy = 0.5 * (grid.v[grid.vIdx(c.i, c.j)] + grid.v[grid.vIdx(c.i, c.j + 1)]);

  const speed = Math.hypot(ux, vy);
  const localRe = speed * Math.max(grid.dx, grid.dy) / Math.max(state.sim.viscosity, 1e-9);

  probeBox.innerHTML = [
    `x: ${p.x.toFixed(3)} y: ${p.y.toFixed(3)}`,
    `u: ${ux.toExponential(3)} v: ${vy.toExponential(3)}`,
    `|U|: ${speed.toExponential(3)}`,
    `p: ${grid.pressure[idx].toExponential(3)}`,
    `w: ${grid.vorticity[idx].toExponential(3)}`,
    `div: ${grid.divergence[idx].toExponential(3)}`,
    `T: ${grid.temperature[idx].toFixed(2)}`,
    `Re_local: ${localRe.toExponential(3)}`
  ].join("<br>");

  probeBox.classList.remove("hidden");
}

let lastTs = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;

function tick(ts) {
  const frameDt = Math.min(0.033, (ts - lastTs) * 0.001);
  lastTs = ts;

  if (!state.paused) {
    flow.sampleFreestream(state.time);
    state.sim.uxInf = flow.uxInf;

    bodies.integrate(state.sim.lastDt);
    solver.step({ grid, sim: state.sim, flow, bodies }, frameDt, state.time);
    diagnostics.updateVorticityAndDivergence(grid);

    const metrics = diagnostics.compute({
      grid,
      bodies,
      flow,
      sim: state.sim
    });

    panel.updateMetrics(metrics);

    const forceScale = 1 / Math.max(state.sim.density * 10, 1);
    bodies.bodies.forEach((body) => {
      const f = diagnostics.bodyForces.get(body.id);
      if (!f) {
        return;
      }
      body.ax += -f.drag * forceScale / Math.max(body.mass, 1e-3);
      body.ay += f.lift * forceScale / Math.max(body.mass, 1e-3);
    });

    state.time += state.sim.lastDt;
  }

  renderer.render({ grid, bodies, visual: state.visual }, diagnostics);
  updateProbe();

  fpsAcc += frameDt;
  fpsFrames += 1;
  if (fpsAcc > 0.35) {
    const fps = fpsFrames / fpsAcc;
    fpsCounter.textContent = `${fps.toFixed(1)} fps`;
    fpsAcc = 0;
    fpsFrames = 0;
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
