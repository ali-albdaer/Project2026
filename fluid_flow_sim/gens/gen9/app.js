import { PotentialFlow } from './src/potentialFlow.js';
import { FluidSim } from './src/fluidSim.js';
import { Palettes } from './src/palettes.js';
import { clamp, fmt, lerp } from './src/util.js';

const canvas = document.getElementById('canvas');
const panel = document.getElementById('panel');
const topbar = document.getElementById('topbar');
const body = document.body;

const modePotentialBtn = document.getElementById('modePotentialBtn');
const modeFluidBtn = document.getElementById('modeFluidBtn');
const potentialSection = document.getElementById('potentialSection');
const fluidSection = document.getElementById('fluidSection');

const toggleUiBtn = document.getElementById('toggleUiBtn');
const toggleGridBtn = document.getElementById('toggleGridBtn');
const resetBtn = document.getElementById('resetBtn');
const statusBadge = document.getElementById('statusBadge');
const probeEl = document.getElementById('probe');

// Potential-flow UI
const scenarioSelect = document.getElementById('scenarioSelect');
const showStreamlines = document.getElementById('showStreamlines');
const showEquipotentials = document.getElementById('showEquipotentials');
const lineDensity = document.getElementById('lineDensity');
const uniformU = document.getElementById('uniformU');
const uniformAngle = document.getElementById('uniformAngle');
const addSourceBtn = document.getElementById('addSourceBtn');
const addVortexBtn = document.getElementById('addVortexBtn');
const addDoubletBtn = document.getElementById('addDoubletBtn');
const elementsList = document.getElementById('elementsList');

// Fluid UI
const fluidRes = document.getElementById('fluidRes');
const dtEl = document.getElementById('dt');
const viscosityEl = document.getElementById('viscosity');
const vortConfEl = document.getElementById('vortConf');
const displayQuantity = document.getElementById('displayQuantity');
const paletteSel = document.getElementById('palette');
const fxExpr = document.getElementById('fxExpr');
const fyExpr = document.getElementById('fyExpr');
const rhoExpr = document.getElementById('rhoExpr');
const tempExpr = document.getElementById('tempExpr');
const applyEquations = document.getElementById('applyEquations');
const mouseForce = document.getElementById('mouseForce');
const mouseDensity = document.getElementById('mouseDensity');

const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

let mode = 'potential'; // 'potential' | 'fluid'
let running = true;
let showGrid = true;
let showUi = true;

function setMode(next) {
  mode = next;
  const isPotential = mode === 'potential';
  modePotentialBtn.classList.toggle('seg__btn--active', isPotential);
  modeFluidBtn.classList.toggle('seg__btn--active', !isPotential);
  modePotentialBtn.setAttribute('aria-selected', String(isPotential));
  modeFluidBtn.setAttribute('aria-selected', String(!isPotential));
  potentialSection.hidden = !isPotential;
  fluidSection.hidden = isPotential;
}

const potential = new PotentialFlow();
const fluid = new FluidSim();

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- Potential flow wiring ----------
const scenarios = potential.getScenarios();
for (const s of scenarios) {
  const opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = s.name;
  scenarioSelect.appendChild(opt);
}
scenarioSelect.value = 'flow_over_cylinder';

function refreshElementsList() {
  elementsList.innerHTML = '';
  const elements = potential.elements;
  for (const el of elements) {
    const card = document.createElement('div');
    card.className = 'card';

    const top = document.createElement('div');
    top.className = 'card__top';

    const title = document.createElement('div');
    title.className = 'card__title';
    title.textContent = el.label;

    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.textContent = `x=${fmt(el.x, 3)}, y=${fmt(el.y, 3)}`;
    el._pill = pill;

    const del = document.createElement('button');
    del.className = 'btn btn--ghost danger';
    del.textContent = 'Remove';
    del.addEventListener('click', () => {
      potential.removeElement(el.id);
      refreshElementsList();
    });

    top.appendChild(title);
    top.appendChild(pill);
    top.appendChild(del);

    const controls = document.createElement('div');
    controls.className = 'card__controls';

    const common = (labelText, value, step, onInput) => {
      const wrap = document.createElement('div');
      const lab = document.createElement('label');
      lab.className = 'label';
      lab.textContent = labelText;
      const inp = document.createElement('input');
      inp.className = 'input';
      inp.type = 'number';
      inp.step = step;
      inp.value = value;
      inp.addEventListener('input', () => onInput(parseFloat(inp.value)));
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      return wrap;
    };

    if (el.type === 'source') {
      controls.appendChild(common('Strength m', el.m, '0.1', (v) => (el.m = v)));
      controls.appendChild(common('Core a', el.core, '0.01', (v) => (el.core = Math.max(0.01, v))));
    } else if (el.type === 'vortex') {
      controls.appendChild(common('Circulation Γ', el.gamma, '0.1', (v) => (el.gamma = v)));
      controls.appendChild(common('Core a', el.core, '0.01', (v) => (el.core = Math.max(0.01, v))));
    } else if (el.type === 'doublet') {
      controls.appendChild(common('Strength κ', el.kappa, '0.1', (v) => (el.kappa = v)));
      controls.appendChild(common('Angle (deg)', el.angleDeg, '1', (v) => (el.angleDeg = v)));
    }

    card.appendChild(top);
    card.appendChild(controls);
    elementsList.appendChild(card);
  }
}

function applyScenario(id) {
  const s = scenarios.find((x) => x.id === id) || scenarios[0];
  potential.loadScenario(s);
  uniformU.value = String(potential.uniform.U);
  uniformAngle.value = String(potential.uniform.angleDeg);
  refreshElementsList();
}
scenarioSelect.addEventListener('change', () => applyScenario(scenarioSelect.value));
applyScenario(scenarioSelect.value);

addSourceBtn.addEventListener('click', () => {
  potential.addSource({ x: 0.0, y: 0.0, m: 5.0, core: 0.06 });
  refreshElementsList();
});
addVortexBtn.addEventListener('click', () => {
  potential.addVortex({ x: 0.0, y: 0.0, gamma: 8.0, core: 0.06 });
  refreshElementsList();
});
addDoubletBtn.addEventListener('click', () => {
  potential.addDoublet({ x: 0.0, y: 0.0, kappa: 2.0, angleDeg: 0 });
  refreshElementsList();
});

uniformU.addEventListener('input', () => (potential.uniform.U = parseFloat(uniformU.value)));
uniformAngle.addEventListener('input', () => (potential.uniform.angleDeg = parseFloat(uniformAngle.value)));

// ---------- Fluid wiring ----------
function rebuildFluid() {
  const n = parseInt(fluidRes.value, 10);
  fluid.resize(n, n);
}
fluidRes.addEventListener('change', rebuildFluid);
rebuildFluid();

function applyFluidParams() {
  fluid.dt = clamp(parseFloat(dtEl.value), 0.001, 0.08);
  fluid.viscosity = clamp(parseFloat(viscosityEl.value), 0.0, 0.02);
  fluid.vorticityConfinement = clamp(parseFloat(vortConfEl.value), 0.0, 80);
}
[dtEl, viscosityEl, vortConfEl].forEach((el) => el.addEventListener('input', applyFluidParams));
applyFluidParams();

function compileExpr(expr, fallback = '0') {
  const src = (expr || '').trim();
  const safe = src.length ? src : fallback;
  // eslint-disable-next-line no-new-func
  return new Function('x', 'y', 't', `"use strict"; const Math_ = Math; const Math = Math_; return (${safe});`);
}

function applyEquationSet() {
  try {
    fluid.forceFx = compileExpr(fxExpr.value);
    fluid.forceFy = compileExpr(fyExpr.value);
    fluid.sourceRho = compileExpr(rhoExpr.value);
    fluid.sourceTemp = compileExpr(tempExpr.value);
    statusBadge.textContent = 'Equations applied';
    setTimeout(() => (statusBadge.textContent = running ? 'Running' : 'Paused'), 800);
  } catch (e) {
    statusBadge.textContent = 'Equation error';
    console.error(e);
  }
}
applyEquations.addEventListener('click', applyEquationSet);
applyEquationSet();

// ---------- Global UI ----------
modePotentialBtn.addEventListener('click', () => setMode('potential'));
modeFluidBtn.addEventListener('click', () => setMode('fluid'));

toggleGridBtn.addEventListener('click', () => (showGrid = !showGrid));
toggleUiBtn.addEventListener('click', () => {
  showUi = !showUi;
  body.classList.toggle('ui-hidden', !showUi);
  // Layout changes affect canvas size.
  setTimeout(resizeCanvas, 0);
});

resetBtn.addEventListener('click', () => {
  if (mode === 'potential') {
    applyScenario(scenarioSelect.value);
  } else {
    fluid.reset();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    running = !running;
    statusBadge.textContent = running ? 'Running' : 'Paused';
  } else if (e.key.toLowerCase() === 'g') {
    showGrid = !showGrid;
  } else if (e.key.toLowerCase() === 'h') {
    toggleUiBtn.click();
  } else if (e.key.toLowerCase() === 'r') {
    resetBtn.click();
  }
});

// ---------- Interaction (drag markers / mouse injection / probe) ----------
let pointer = { x: 0, y: 0, down: false, vx: 0, vy: 0 };
let draggingId = null;

function canvasToWorld(px, py) {
  const rect = canvas.getBoundingClientRect();
  const x = (px - rect.left) / rect.width;
  const y = (py - rect.top) / rect.height;
  // world coords in [-1,1]
  return { x: x * 2 - 1, y: (1 - y) * 2 - 1 };
}

function worldToCanvas(wx, wy) {
  const rect = canvas.getBoundingClientRect();
  const x = (wx + 1) * 0.5 * rect.width;
  const y = (1 - (wy + 1) * 0.5) * rect.height;
  return { x, y };
}

function onPointerMove(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  pointer.vx = x - pointer.x;
  pointer.vy = y - pointer.y;
  pointer.x = x;
  pointer.y = y;

  const w = canvasToWorld(ev.clientX, ev.clientY);

  if (mode === 'potential' && pointer.down && draggingId) {
    potential.setElementPos(draggingId, w.x, w.y);
    refreshElementsList();
  }

  if (mode === 'fluid' && pointer.down) {
    const inject = {
      x: w.x,
      y: w.y,
      fx: (mouseForce.checked ? pointer.vx : 0),
      fy: (mouseForce.checked ? -pointer.vy : 0),
      rho: (mouseDensity.checked ? 2.0 : 0),
      temp: (mouseDensity.checked ? 1.0 : 0),
    };
    fluid.injectFromPointer(inject);
  }

  updateProbe(w.x, w.y);
}

function onPointerDown(ev) {
  pointer.down = true;
  const w = canvasToWorld(ev.clientX, ev.clientY);

  if (mode === 'potential') {
    draggingId = potential.pickElement(w.x, w.y, 0.09);
  }
  onPointerMove(ev);
}

function onPointerUp() {
  pointer.down = false;
  draggingId = null;
}

canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointerup', onPointerUp);

function updateProbe(wx, wy) {
  if (mode === 'potential') {
    const v = potential.velocityAt(wx, wy);
    const phi = potential.phiAt(wx, wy);
    const psi = potential.psiAt(wx, wy);
    probeEl.textContent = `Potential mode\n` +
      `x=${fmt(wx,3)} y=${fmt(wy,3)}\n` +
      `u=${fmt(v.u,4)} v=${fmt(v.v,4)} |V|=${fmt(Math.hypot(v.u,v.v),4)}\n` +
      `phi=${fmt(phi,5)} psi=${fmt(psi,5)}`;
  } else {
    const s = fluid.sample(wx, wy);
    probeEl.textContent = `Navier–Stokes mode\n` +
      `x=${fmt(wx,3)} y=${fmt(wy,3)}\n` +
      `u=${fmt(s.u,4)} v=${fmt(s.v,4)} |V|=${fmt(Math.hypot(s.u,s.v),4)}\n` +
      `p=${fmt(s.p,5)} rho=${fmt(s.rho,4)} T=${fmt(s.temp,4)} ω=${fmt(s.vort,5)}`;
  }
}

// ---------- Render loop ----------
let t0 = performance.now();
let simTime = 0;

function drawGrid() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function frame(now) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    requestAnimationFrame(frame);
    return;
  }

  const dtWall = (now - t0) / 1000;
  t0 = now;

  if (running) simTime += dtWall;

  // Background
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, rect.width, rect.height);

  if (mode === 'potential') {
    potential.uniform.U = parseFloat(uniformU.value);
    potential.uniform.angleDeg = parseFloat(uniformAngle.value);

    const density = parseInt(lineDensity.value, 10);
    const opts = {
      showStreamlines: showStreamlines.checked,
      showEquipotentials: showEquipotentials.checked,
      density,
      time: simTime,
      showGrid,
    };

    potential.render(ctx, rect.width, rect.height, opts);

    // markers
    potential.renderMarkers(ctx, rect.width, rect.height, worldToCanvas);

  } else {
    applyFluidParams();

    if (running) {
      fluid.step(simTime);
    }

    const pal = Palettes.get(paletteSel.value);
    const quantity = displayQuantity.value;
    fluid.render(ctx, rect.width, rect.height, {
      palette: pal,
      quantity,
      showGrid,
    });
  }

  if (showGrid) drawGrid();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
