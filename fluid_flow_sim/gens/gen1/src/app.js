import { StableFluid2D } from './sim/stableFluid2D.js';
import { Renderer2D } from './render/renderer2d.js';
import {
  cylinderFlow,
  hagenPoiseuille,
  planePoiseuille,
  potentialDoublet,
  potentialSource,
  potentialUniform,
  potentialVortex,
  superposition,
  couette,
} from './flows/analyticFlows.js';
import { compileExpression, makeScope } from './expr.js';
import { clamp, debounce, formatNumber, nowSeconds } from './util.js';

const MODES = [
  { id: 'ns', name: 'Navier–Stokes (incompressible, viscous)' },
  { id: 'euler', name: 'Euler (inviscid, incompressible)' },
  { id: 'potential', name: 'Potential Flow (analytic, irrotational)' },
  { id: 'superposition', name: 'Potential Flow (superposition builder)' },
  { id: 'cylinder', name: 'Potential: Flow around cylinder (+ circulation)' },
  { id: 'plane_poiseuille', name: 'Viscous Exact: Plane Poiseuille (channel)' },
  { id: 'couette', name: 'Viscous Exact: Couette (moving plate)' },
  { id: 'hagen_poiseuille', name: 'Viscous Exact: Hagen–Poiseuille (pipe)' },
];

const QUANTITIES = [
  { id: 'speed', name: 'Speed |V|' },
  { id: 'u', name: 'Velocity u' },
  { id: 'v', name: 'Velocity v' },
  { id: 'pressure', name: 'Pressure p (proxy)' },
  { id: 'rho', name: 'Density ρ (passive scalar)' },
  { id: 'temp', name: 'Temperature T (passive scalar)' },
  { id: 'div', name: 'Divergence ∇·V (continuity)' },
  { id: 'vort', name: 'Vorticity ζz (rotation)' },
  { id: 'dilatation', name: 'Dilatation rate (∇·V)' },
  { id: 'shear', name: 'Shear rate γxy' },
  { id: 'psi', name: 'Stream function ψ' },
  { id: 'phi', name: 'Velocity potential φ' },
  { id: 'bernoulli', name: 'Bernoulli (p + 1/2|V|²) proxy' },
  { id: 'accel', name: 'Material acceleration |DV/Dt|' },
];

function el(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element: ${id}`);
  return e;
}

function setStatus(text) {
  el('statusLine').textContent = text;
}

function setEqStatus(kind, text) {
  const node = el('eqStatus');
  node.classList.remove('eq__status--bad', 'eq__status--good');
  if (kind === 'bad') node.classList.add('eq__status--bad');
  if (kind === 'good') node.classList.add('eq__status--good');
  node.textContent = text;
}

function canvasToSimCoords(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  // Simulation domain for expressions is x,y in [-1,1]
  const x = u * 2 - 1;
  const y = (1 - v) * 2 - 1;
  return { u, v, x, y };
}

function simXYToGrid(n, x, y) {
  // Map [-1,1] to [0,n-1]
  const gx = clamp((x * 0.5 + 0.5) * (n - 1), 0, n - 1);
  const gy = clamp(((1 - (y * 0.5 + 0.5)) * (n - 1)), 0, n - 1); // y up -> grid down
  return { gx, gy };
}

function computeDerivedFromUV(n, u, v) {
  const size = n * n;
  const speed = new Float32Array(size);
  const div = new Float32Array(size);
  const vort = new Float32Array(size);
  const shear = new Float32Array(size);

  const h = 2 / (n - 1);
  const inv2h = 1 / (2 * h);

  const idx = (i, j) => i + j * n;
  const sample = (arr, i, j) => {
    i = clamp(i, 0, n - 1);
    j = clamp(j, 0, n - 1);
    return arr[idx(i, j)];
  };

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const id = idx(i, j);
      const ux = u[id];
      const vy = v[id];
      speed[id] = Math.hypot(ux, vy);

      const dudx = (sample(u, i + 1, j) - sample(u, i - 1, j)) * inv2h;
      const dvdy = (sample(v, i, j + 1) - sample(v, i, j - 1)) * inv2h;
      const dvdx = (sample(v, i + 1, j) - sample(v, i - 1, j)) * inv2h;
      const dudy = (sample(u, i, j + 1) - sample(u, i, j - 1)) * inv2h;

      div[id] = dudx + dvdy;
      vort[id] = dvdx - dudy;
      shear[id] = dvdx + dudy; // γxy
    }
  }

  return { speed, div, vort, shear };
}

function computeMaterialAcceleration(n, u, v, prevU, prevV, dt) {
  const size = n * n;
  const acc = new Float32Array(size);

  const h = 2 / (n - 1);
  const inv2h = 1 / (2 * h);
  const idx = (i, j) => i + j * n;
  const sample = (arr, i, j) => {
    i = clamp(i, 0, n - 1);
    j = clamp(j, 0, n - 1);
    return arr[idx(i, j)];
  };

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const id = idx(i, j);
      const uij = u[id];
      const vij = v[id];

      const du_dt = (u[id] - prevU[id]) / Math.max(dt, 1e-6);
      const dv_dt = (v[id] - prevV[id]) / Math.max(dt, 1e-6);

      const dudx = (sample(u, i + 1, j) - sample(u, i - 1, j)) * inv2h;
      const dudy = (sample(u, i, j + 1) - sample(u, i, j - 1)) * inv2h;
      const dvdx = (sample(v, i + 1, j) - sample(v, i - 1, j)) * inv2h;
      const dvdy = (sample(v, i, j + 1) - sample(v, i, j - 1)) * inv2h;

      const du_conv = uij * dudx + vij * dudy;
      const dv_conv = uij * dvdx + vij * dvdy;

      const ax = du_dt + du_conv;
      const ay = dv_dt + dv_conv;
      acc[id] = Math.hypot(ax, ay);
    }
  }

  return acc;
}

function buildSelect(select, options) {
  select.innerHTML = '';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.name;
    select.appendChild(opt);
  }
}

function makeModeParamsUI(container) {
  container.innerHTML = '';
  const nodes = new Map();

  function addNumber(id, label, value, step, min = null, max = null) {
    const wrap = document.createElement('label');
    wrap.className = 'field';

    const lab = document.createElement('span');
    lab.className = 'field__label';
    lab.textContent = label;

    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'number';
    input.value = String(value);
    input.step = String(step);
    if (min !== null) input.min = String(min);
    if (max !== null) input.max = String(max);

    wrap.appendChild(lab);
    wrap.appendChild(input);
    container.appendChild(wrap);
    nodes.set(id, input);
  }

  function addSelect(id, label, options, value) {
    const wrap = document.createElement('label');
    wrap.className = 'field';

    const lab = document.createElement('span');
    lab.className = 'field__label';
    lab.textContent = label;

    const select = document.createElement('select');
    select.className = 'select';
    for (const optDef of options) {
      const opt = document.createElement('option');
      opt.value = optDef.value;
      opt.textContent = optDef.label;
      if (optDef.value === value) opt.selected = true;
      select.appendChild(opt);
    }

    wrap.appendChild(lab);
    wrap.appendChild(select);
    container.appendChild(wrap);
    nodes.set(id, select);
  }

  return { nodes, addNumber, addSelect };
}

function main() {
  const canvas = el('canvas');
  const probe = el('probe');
  const panel = el('panel');

  const modeSelect = el('modeSelect');
  const quantitySelect = el('quantitySelect');

  const resSelect = el('resSelect');
  const dtInput = el('dtInput');
  const viscInput = el('viscInput');
  const diffInput = el('diffInput');
  const boundarySelect = el('boundarySelect');
  const cmapSelect = el('cmapSelect');
  const vectorsSelect = el('vectorsSelect');
  const autoscaleSelect = el('autoscaleSelect');

  const exprU = el('exprU');
  const exprV = el('exprV');
  const exprRho = el('exprRho');
  const exprTemp = el('exprTemp');
  const exprFx = el('exprFx');
  const exprFy = el('exprFy');
  const continuousSelect = el('continuousSelect');
  const applyEqBtn = el('applyEqBtn');

  buildSelect(modeSelect, MODES);
  buildSelect(quantitySelect, QUANTITIES);

  modeSelect.value = 'ns';
  quantitySelect.value = 'speed';

  const renderer = new Renderer2D(canvas);
  renderer.setColormap(cmapSelect.value);

  let fluid = new StableFluid2D(Number(resSelect.value));
  fluid.setBoundaryMode(boundarySelect.value);

  // Storage for analytic modes
  let analytic = null;
  let analyticMask = null;

  // Working buffers for computed quantities
  let quantityField = new Float32Array(fluid.n * fluid.n);
  let fieldU = new Float32Array(fluid.n * fluid.n);
  let fieldV = new Float32Array(fluid.n * fluid.n);
  let fieldP = new Float32Array(fluid.n * fluid.n);
  let fieldPhi = new Float32Array(fluid.n * fluid.n);
  let fieldPsi = new Float32Array(fluid.n * fluid.n);
  let fieldBern = new Float32Array(fluid.n * fluid.n);
  let fieldAccel = new Float32Array(fluid.n * fluid.n);

  let prevU = new Float32Array(fluid.n * fluid.n);
  let prevV = new Float32Array(fluid.n * fluid.n);

  // Expression compilation
  let compiled = {
    u: compileExpression(exprU.value),
    v: compileExpression(exprV.value),
    rho: compileExpression(exprRho.value),
    temp: compileExpression(exprTemp.value),
    fx: compileExpression(exprFx.value),
    fy: compileExpression(exprFy.value),
  };

  function recompileAll() {
    compiled = {
      u: compileExpression(exprU.value),
      v: compileExpression(exprV.value),
      rho: compileExpression(exprRho.value),
      temp: compileExpression(exprTemp.value),
      fx: compileExpression(exprFx.value),
      fy: compileExpression(exprFy.value),
    };

    const bad = Object.entries(compiled).find(([k, v]) => !v.ok);
    if (bad) {
      setEqStatus('bad', `Error in ${bad[0]}: ${bad[1].error}`);
      return false;
    }

    setEqStatus('good', 'Expressions compiled.');
    return true;
  }

  const debouncedRecompile = debounce(180, () => recompileAll());

  for (const input of [exprU, exprV, exprRho, exprTemp, exprFx, exprFy]) {
    input.addEventListener('input', () => debouncedRecompile());
  }

  function rebuildBuffers(n) {
    quantityField = new Float32Array(n * n);
    fieldU = new Float32Array(n * n);
    fieldV = new Float32Array(n * n);
    fieldP = new Float32Array(n * n);
    fieldPhi = new Float32Array(n * n);
    fieldPsi = new Float32Array(n * n);
    fieldBern = new Float32Array(n * n);
    fieldAccel = new Float32Array(n * n);

    prevU = new Float32Array(n * n);
    prevV = new Float32Array(n * n);
  }

  function resetAll() {
    fluid.clear();
    prevU.fill(0);
    prevV.fill(0);

    if (modeSelect.value === 'potential') {
      analytic = potentialUniform({ U: 1, angle: 0 });
    } else if (modeSelect.value === 'superposition') {
      analytic = superposition([
        potentialUniform({ U: 1, angle: 0 }),
        potentialSource({ m: 6, cx: 0, cy: 0 }),
        potentialVortex({ Gamma: 0, cx: 0, cy: 0 }),
      ]);
    } else if (modeSelect.value === 'cylinder') {
      analytic = cylinderFlow({ U: 1, R: 0.35, angle: 0, cx: 0, cy: 0, Gamma: 0 });
    } else if (modeSelect.value === 'plane_poiseuille') {
      analytic = planePoiseuille({ mu: 1, dPdx: -2, h: 0.65 });
    } else if (modeSelect.value === 'couette') {
      analytic = couette({ U: 1, b: 1.5, mu: 1, dPdx: 0 });
    } else if (modeSelect.value === 'hagen_poiseuille') {
      analytic = hagenPoiseuille({ mu: 1, dPdz: -2, R: 0.75 });
    } else {
      analytic = null;
    }

    analyticMask = null;
  }

  function applyExpressionsToFields(t) {
    if (!recompileAll()) return;

    const n = fluid.n;
    const idx = (i, j) => i + j * n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const y = (1 - (j / (n - 1))) * 2 - 1;
        const scope = makeScope({ x, y, t });
        const id = idx(i, j);
        fluid.u[id] = compiled.u.compiled(scope);
        fluid.v[id] = compiled.v.compiled(scope);
        fluid.rho[id] = compiled.rho.compiled(scope);
        fluid.temp[id] = compiled.temp.compiled(scope);
      }
    }

    setEqStatus('good', 'Applied expressions to fields.');
  }

  // Mode params UI
  const modeParamsContainer = el('modeParams');
  const modeUI = makeModeParamsUI(modeParamsContainer);

  let modeParams = {
    potential: { U: 1, angleDeg: 0 },
    superposition: { U: 1, angleDeg: 0, m: 6, Gamma: 0, kappa: 0, centerX: 0, centerY: 0 },
    cylinder: { U: 1, R: 0.35, angleDeg: 0, Gamma: 0, centerX: 0, centerY: 0 },
    plane_poiseuille: { mu: 1, dPdx: -2, h: 0.65 },
    couette: { U: 1, b: 1.5, mu: 1, dPdx: 0 },
    hagen_poiseuille: { mu: 1, dPdz: -2, R: 0.75 },
  };

  function rebuildModeParamsUI() {
    modeParamsContainer.innerHTML = '';
    modeUI.nodes.clear();

    const mode = modeSelect.value;

    if (mode === 'potential') {
      modeUI.addNumber('U', 'Uniform speed U', modeParams.potential.U, 0.1, -10, 10);
      modeUI.addNumber('angleDeg', 'Angle (deg)', modeParams.potential.angleDeg, 1, -180, 180);
    } else if (mode === 'superposition') {
      modeUI.addNumber('U', 'Uniform speed U', modeParams.superposition.U, 0.1, -10, 10);
      modeUI.addNumber('angleDeg', 'Uniform angle (deg)', modeParams.superposition.angleDeg, 1, -180, 180);
      modeUI.addNumber('m', 'Source strength m', modeParams.superposition.m, 0.5, -50, 50);
      modeUI.addNumber('Gamma', 'Vortex Γ', modeParams.superposition.Gamma, 0.5, -50, 50);
      modeUI.addNumber('kappa', 'Doublet κ', modeParams.superposition.kappa, 0.5, -50, 50);
      modeUI.addNumber('centerX', 'Center x', modeParams.superposition.centerX, 0.05, -1, 1);
      modeUI.addNumber('centerY', 'Center y', modeParams.superposition.centerY, 0.05, -1, 1);
    } else if (mode === 'cylinder') {
      modeUI.addNumber('U', 'Uniform speed U', modeParams.cylinder.U, 0.1, -10, 10);
      modeUI.addNumber('R', 'Cylinder radius R', modeParams.cylinder.R, 0.01, 0.05, 0.95);
      modeUI.addNumber('Gamma', 'Circulation Γ', modeParams.cylinder.Gamma, 0.5, -50, 50);
      modeUI.addNumber('angleDeg', 'Angle (deg)', modeParams.cylinder.angleDeg, 1, -180, 180);
      modeUI.addNumber('centerX', 'Center x', modeParams.cylinder.centerX, 0.05, -1, 1);
      modeUI.addNumber('centerY', 'Center y', modeParams.cylinder.centerY, 0.05, -1, 1);
    } else if (mode === 'plane_poiseuille') {
      modeUI.addNumber('mu', 'Dynamic viscosity μ', modeParams.plane_poiseuille.mu, 0.1, 0.01, 20);
      modeUI.addNumber('dPdx', 'Pressure gradient dP/dx', modeParams.plane_poiseuille.dPdx, 0.2, -20, 20);
      modeUI.addNumber('h', 'Half-gap h', modeParams.plane_poiseuille.h, 0.02, 0.1, 0.95);
    } else if (mode === 'couette') {
      modeUI.addNumber('U', 'Plate speed U', modeParams.couette.U, 0.1, -10, 10);
      modeUI.addNumber('b', 'Gap b', modeParams.couette.b, 0.05, 0.2, 2.0);
      modeUI.addNumber('mu', 'Dynamic viscosity μ', modeParams.couette.mu, 0.1, 0.01, 20);
      modeUI.addNumber('dPdx', 'Pressure gradient dP/dx', modeParams.couette.dPdx, 0.2, -20, 20);
    } else if (mode === 'hagen_poiseuille') {
      modeUI.addNumber('mu', 'Dynamic viscosity μ', modeParams.hagen_poiseuille.mu, 0.1, 0.01, 20);
      modeUI.addNumber('dPdz', 'Pressure gradient dP/dz', modeParams.hagen_poiseuille.dPdz, 0.2, -20, 20);
      modeUI.addNumber('R', 'Pipe radius R', modeParams.hagen_poiseuille.R, 0.02, 0.1, 0.95);
    } else {
      const msg = document.createElement('div');
      msg.className = 'panel__hint';
      msg.textContent = 'No extra parameters for this mode.';
      modeParamsContainer.appendChild(msg);
    }

    // Wire changes to regenerate analytic field
    for (const [key, input] of modeUI.nodes.entries()) {
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        if (modeParams[mode]) modeParams[mode][key] = v;
        rebuildAnalyticFromMode();
      });
    }
  }

  function rebuildAnalyticFromMode() {
    const mode = modeSelect.value;
    if (mode === 'potential') {
      const angle = (modeParams.potential.angleDeg * Math.PI) / 180;
      analytic = potentialUniform({ U: modeParams.potential.U, angle });
    } else if (mode === 'superposition') {
      const angle = (modeParams.superposition.angleDeg * Math.PI) / 180;
      const cx = modeParams.superposition.centerX;
      const cy = modeParams.superposition.centerY;
      const elements = [potentialUniform({ U: modeParams.superposition.U, angle })];
      if (modeParams.superposition.m !== 0) elements.push(potentialSource({ m: modeParams.superposition.m, cx, cy }));
      if (modeParams.superposition.Gamma !== 0) elements.push(potentialVortex({ Gamma: modeParams.superposition.Gamma, cx, cy }));
      if (modeParams.superposition.kappa !== 0) elements.push(potentialDoublet({ kappa: modeParams.superposition.kappa, angle, cx, cy }));
      analytic = superposition(elements);
    } else if (mode === 'cylinder') {
      const angle = (modeParams.cylinder.angleDeg * Math.PI) / 180;
      analytic = cylinderFlow({
        U: modeParams.cylinder.U,
        R: modeParams.cylinder.R,
        angle,
        Gamma: modeParams.cylinder.Gamma,
        cx: modeParams.cylinder.centerX,
        cy: modeParams.cylinder.centerY,
      });
    } else if (mode === 'plane_poiseuille') {
      analytic = planePoiseuille({
        mu: modeParams.plane_poiseuille.mu,
        dPdx: modeParams.plane_poiseuille.dPdx,
        h: modeParams.plane_poiseuille.h,
      });
    } else if (mode === 'couette') {
      analytic = couette({
        U: modeParams.couette.U,
        b: modeParams.couette.b,
        mu: modeParams.couette.mu,
        dPdx: modeParams.couette.dPdx,
      });
    } else if (mode === 'hagen_poiseuille') {
      analytic = hagenPoiseuille({
        mu: modeParams.hagen_poiseuille.mu,
        dPdz: modeParams.hagen_poiseuille.dPdz,
        R: modeParams.hagen_poiseuille.R,
      });
    } else {
      analytic = null;
    }
  }

  // Mouse interaction
  let mouse = {
    down: false,
    lastX: 0,
    lastY: 0,
    shift: false,
    hover: { clientX: 0, clientY: 0, inside: false },
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    mouse.down = true;
    mouse.shift = e.shiftKey;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
  });

  canvas.addEventListener('pointerup', (e) => {
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    mouse.hover.clientX = e.clientX;
    mouse.hover.clientY = e.clientY;
    mouse.hover.inside = true;

    if (!mouse.down) {
      return;
    }

    if (!['ns', 'euler'].includes(modeSelect.value)) {
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
      return;
    }

    const cur = canvasToSimCoords(canvas, e.clientX, e.clientY);
    const prev = canvasToSimCoords(canvas, mouse.lastX, mouse.lastY);

    const dx = cur.u - prev.u;
    const dy = cur.v - prev.v;

    const n = fluid.n;
    const grid = simXYToGrid(n, cur.x, cur.y);

    const strength = 60;
    const du = dx * strength;
    const dv = -dy * strength;

    if (e.shiftKey) {
      fluid.addScalar(fluid.rho, grid.gx, grid.gy, 40 * (dx - dy), 5);
      fluid.addScalar(fluid.temp, grid.gx, grid.gy, 30 * (dx + dy), 5);
    } else {
      fluid.addVelocity(grid.gx, grid.gy, du, dv, 5);
    }

    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
  });

  canvas.addEventListener('pointerleave', () => {
    mouse.hover.inside = false;
    probe.classList.remove('probe--show');
  });

  // Controls
  el('togglePanelBtn').addEventListener('click', () => {
    panel.classList.toggle('panel--hidden');
  });

  el('resetBtn').addEventListener('click', () => {
    resetAll();
  });

  let paused = false;
  el('pauseBtn').addEventListener('click', () => {
    paused = !paused;
    el('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
  });

  resSelect.addEventListener('change', () => {
    const n = Number(resSelect.value);
    fluid = new StableFluid2D(n);
    fluid.dt = Number(dtInput.value);
    fluid.visc = Number(viscInput.value);
    fluid.diff = Number(diffInput.value);
    fluid.setBoundaryMode(boundarySelect.value);
    rebuildBuffers(n);
    resetAll();
  });

  dtInput.addEventListener('change', () => {
    fluid.dt = Number(dtInput.value);
  });

  viscInput.addEventListener('change', () => {
    fluid.visc = Number(viscInput.value);
  });

  diffInput.addEventListener('change', () => {
    fluid.diff = Number(diffInput.value);
  });

  boundarySelect.addEventListener('change', () => {
    fluid.setBoundaryMode(boundarySelect.value);
  });

  cmapSelect.addEventListener('change', () => {
    renderer.setColormap(cmapSelect.value);
  });

  vectorsSelect.addEventListener('change', () => {
    renderer.setShowVectors(vectorsSelect.value === 'on');
  });

  autoscaleSelect.addEventListener('change', () => {
    renderer.setAutoScale(autoscaleSelect.value === 'on');
  });

  applyEqBtn.addEventListener('click', () => {
    applyExpressionsToFields(simTime);
  });

  modeSelect.addEventListener('change', () => {
    rebuildModeParamsUI();
    resetAll();
  });

  // Initial
  rebuildModeParamsUI();
  resetAll();
  recompileAll();

  // Simulation/render loop
  let simTime = 0;
  let lastFrameT = nowSeconds();
  let fpsAvg = 60;

  function fillAnalyticFields(t) {
    const n = fluid.n;
    const size = n * n;

    if (!analytic) {
      fieldU.fill(0);
      fieldV.fill(0);
      fieldP.fill(0);
      fieldPhi.fill(0);
      fieldPsi.fill(0);
      analyticMask = null;
      return;
    }

    if (analytic.maskSolid) {
      if (!analyticMask || analyticMask.length !== size) analyticMask = new Uint8Array(size);
    } else {
      analyticMask = null;
    }

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const id = i + j * n;
        const x = (i / (n - 1)) * 2 - 1;
        const y = (1 - (j / (n - 1))) * 2 - 1;

        if (analyticMask) analyticMask[id] = analytic.maskSolid(x, y) ? 1 : 0;

        const vv = analytic.velocity(x, y, t);
        fieldU[id] = vv.u;
        fieldV[id] = vv.v;

        fieldP[id] = analytic.pressure?.(x, y, t) ?? 0;
        fieldPhi[id] = analytic.phi?.(x, y, t) ?? 0;
        fieldPsi[id] = analytic.psi?.(x, y, t) ?? 0;
      }
    }
  }

  function applyContinuousForcing(dt, t) {
    if (continuousSelect.value !== 'on') return;
    if (!['ns', 'euler'].includes(modeSelect.value)) return;
    if (!recompileAll()) return;

    const n = fluid.n;
    const idx = (i, j) => i + j * n;

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const y = (1 - (j / (n - 1))) * 2 - 1;
        const scope = makeScope({ x, y, t });
        const id = idx(i, j);
        const fx = compiled.fx.compiled(scope);
        const fy = compiled.fy.compiled(scope);

        fluid.u[id] += fx * dt;
        fluid.v[id] += fy * dt;
      }
    }
  }

  function buildQuantityField(mode, quantityId, dt, t) {
    const n = fluid.n;

    let u = null;
    let v = null;
    let p = null;
    let rho = null;
    let temp = null;
    let psi = null;
    let phi = null;
    let div = null;
    let vort = null;
    let shear = null;

    if (['ns', 'euler'].includes(mode)) {
      u = fluid.u;
      v = fluid.v;
      p = fluid.p;
      rho = fluid.rho;
      temp = fluid.temp;
      psi = fluid.psi;
      // Not defined in general; only in irrotational potential flow.
      phi = null;

      const derived = computeDerivedFromUV(n, u, v);
      div = derived.div;
      vort = derived.vort;
      shear = derived.shear;

      // material acceleration
      fieldAccel = computeMaterialAcceleration(n, u, v, prevU, prevV, dt);

      // Bernoulli proxy: p + 1/2|V|^2 (ignore rho,g)
      for (let i = 0; i < n * n; i++) {
        const sp2 = u[i] * u[i] + v[i] * v[i];
        fieldBern[i] = (p?.[i] ?? 0) + 0.5 * sp2;
      }

    } else {
      // Analytic
      fillAnalyticFields(t);
      u = fieldU;
      v = fieldV;
      p = fieldP;
      rho = null;
      temp = null;
      psi = fieldPsi;
      phi = fieldPhi;

      const derived = computeDerivedFromUV(n, u, v);
      div = derived.div;
      vort = derived.vort;
      shear = derived.shear;

      fieldAccel = computeMaterialAcceleration(n, u, v, prevU, prevV, dt);

      for (let i = 0; i < n * n; i++) {
        const sp2 = u[i] * u[i] + v[i] * v[i];
        fieldBern[i] = (p?.[i] ?? 0) + 0.5 * sp2;
      }
    }

    const size = n * n;

    switch (quantityId) {
      case 'u': quantityField.set(u); break;
      case 'v': quantityField.set(v); break;
      case 'speed':
        for (let i = 0; i < size; i++) quantityField[i] = Math.hypot(u[i], v[i]);
        break;
      case 'pressure':
        if (p) quantityField.set(p); else quantityField.fill(0);
        break;
      case 'rho':
        if (rho) quantityField.set(rho); else quantityField.fill(0);
        break;
      case 'temp':
        if (temp) quantityField.set(temp); else quantityField.fill(0);
        break;
      case 'div':
      case 'dilatation':
        quantityField.set(div);
        break;
      case 'vort':
        quantityField.set(vort);
        break;
      case 'shear':
        quantityField.set(shear);
        break;
      case 'psi':
        if (psi) quantityField.set(psi); else quantityField.fill(0);
        break;
      case 'phi':
        if (phi) quantityField.set(phi); else quantityField.fill(0);
        break;
      case 'bernoulli':
        quantityField.set(fieldBern);
        break;
      case 'accel':
        quantityField.set(fieldAccel);
        break;
      default:
        quantityField.fill(0);
        break;
    }

    return { u, v, p, div, vort, shear, psi, phi, mask: analyticMask };
  }

  function updateProbe(mode, quantityId, derived, t) {
    if (!mouse.hover.inside) return;

    const { x, y } = canvasToSimCoords(canvas, mouse.hover.clientX, mouse.hover.clientY);
    const n = fluid.n;
    const { gx, gy } = simXYToGrid(n, x, y);
    const i = Math.round(gx);
    const j = Math.round(gy);
    const id = i + j * n;

    const u = derived.u?.[id] ?? 0;
    const v = derived.v?.[id] ?? 0;
    const sp = Math.hypot(u, v);
    const p = derived.p?.[id] ?? 0;
    const div = derived.div?.[id] ?? 0;
    const vort = derived.vort?.[id] ?? 0;
    const shear = derived.shear?.[id] ?? 0;
    const psi = derived.psi?.[id] ?? 0;
    const phi = derived.phi?.[id] ?? 0;
    const bern = fieldBern[id] ?? 0;
    const acc = fieldAccel[id] ?? 0;

    const rho = ['ns', 'euler'].includes(mode) ? (fluid.rho[id] ?? 0) : 0;
    const temp = ['ns', 'euler'].includes(mode) ? (fluid.temp[id] ?? 0) : 0;

    const lines = [];
    lines.push(`x=${formatNumber(x)}  y=${formatNumber(y)}  t=${formatNumber(t)}`);
    lines.push(`u=${formatNumber(u)}  v=${formatNumber(v)}  |V|=${formatNumber(sp)}`);
    lines.push(`p=${formatNumber(p)}  Bern=${formatNumber(bern)}  |DV/Dt|=${formatNumber(acc)}`);
    lines.push(`div(∇·V)=${formatNumber(div)}  ζz=${formatNumber(vort)}  γxy=${formatNumber(shear)}`);

    if (phi !== 0 || ['potential', 'superposition', 'cylinder'].includes(mode)) {
      lines.push(`ψ=${formatNumber(psi)}  φ=${formatNumber(phi)}`);
    } else {
      lines.push(`ψ=${formatNumber(psi)}`);
    }

    if (['ns', 'euler'].includes(mode)) {
      lines.push(`ρ=${formatNumber(rho)}  T=${formatNumber(temp)}`);
    }

    probe.textContent = lines.join('\n');

    const rect = canvas.getBoundingClientRect();
    const px = mouse.hover.clientX - rect.left;
    const py = mouse.hover.clientY - rect.top;

    probe.style.left = `${px}px`;
    probe.style.top = `${py}px`;
    probe.classList.add('probe--show');
  }

  function frame() {
    const tNow = nowSeconds();
    const dtReal = clamp(tNow - lastFrameT, 0, 0.05);
    lastFrameT = tNow;

    // Use user dt for simulation; keep UI responsive even if frame drops.
    const dtSim = clamp(Number(dtInput.value) || 0.016, 0.001, 0.1);
    simTime += paused ? 0 : dtSim;

    const mode = modeSelect.value;

    // Update simulation
    if (!paused) {
      if (mode === 'ns' || mode === 'euler') {
        // Keep prev for material derivative
        prevU.set(fluid.u);
        prevV.set(fluid.v);

        applyContinuousForcing(dtSim, simTime);

        const visc = mode === 'euler' ? 0 : (Number(viscInput.value) || 0);
        const diff = mode === 'euler' ? 0 : (Number(diffInput.value) || 0);

        fluid.dt = dtSim;
        fluid.visc = visc;
        fluid.diff = diff;

        fluid.step({ dt: dtSim, visc, diff });
      } else {
        // Analytic modes: update prev for acceleration
        prevU.set(fieldU);
        prevV.set(fieldV);
        rebuildAnalyticFromMode();
        fillAnalyticFields(simTime);
      }
    } else {
      // Keep analytic up-to-date even when paused
      if (!['ns', 'euler'].includes(mode)) {
        rebuildAnalyticFromMode();
        fillAnalyticFields(simTime);
      }
    }

    // Build and render selected quantity
    const derived = buildQuantityField(mode, quantitySelect.value, dtSim, simTime);

    const overlayVectors = { u: derived.u, v: derived.v };

    const { min, max } = renderer.renderScalarField({
      field: quantityField,
      n: fluid.n,
      mask: derived.mask,
      overlayVectors,
      overlayFn: (ctx, meta) => {
        // Cylinder outline, if applicable
        if (mode === 'cylinder' && analytic?.meta) {
          const { R, cx, cy } = analytic.meta;
          const w = meta.w;
          const h = meta.h;
          const toPx = (xx, yy) => {
            const u = (xx * 0.5 + 0.5) * w;
            const v = (1 - (yy * 0.5 + 0.5)) * h;
            return { u, v };
          };
          const c = toPx(cx, cy);
          const rp = R * 0.5 * w;
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.u, c.v, rp, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Axis line for plane Poiseuille (plates)
        if (mode === 'plane_poiseuille' && analytic?.meta) {
          const { h: hh } = analytic.meta;
          const yTop = (1 - ((hh * 0.5 + 0.5))) * meta.h;
          const yBot = (1 - (((-hh) * 0.5 + 0.5))) * meta.h;
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, yTop);
          ctx.lineTo(meta.w, yTop);
          ctx.moveTo(0, yBot);
          ctx.lineTo(meta.w, yBot);
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    fpsAvg = fpsAvg * 0.92 + (1 / Math.max(dtReal, 1e-6)) * 0.08;

    // Status line referencing concepts
    const qName = QUANTITIES.find(q => q.id === quantitySelect.value)?.name ?? quantitySelect.value;
    const modeName = MODES.find(m => m.id === mode)?.name ?? mode;

    setStatus(`${modeName} • ${qName} • range [${formatNumber(min)}, ${formatNumber(max)}] • FPS ~${formatNumber(fpsAvg)}`);

    updateProbe(mode, quantitySelect.value, derived, simTime);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
