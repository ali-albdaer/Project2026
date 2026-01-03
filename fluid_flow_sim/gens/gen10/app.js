(() => {
  const flowCanvas = document.getElementById('flowCanvas');
  const flowCtx = flowCanvas.getContext('2d');
  const fluidCanvas = document.getElementById('fluidCanvas');
  const fluidCtx = fluidCanvas.getContext('2d');

  const state = {
    mode: 'builder',
    showGrid: true,
    showUI: true,
    showStream: true,
    showPotential: true,
    showMarkers: true,
    field: 'velocity',
    palette: 'viridis',
  };

  const DEG2RAD = Math.PI / 180;
  const EPS = 1e-5;

  const palettes = {
    viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
    inferno: ['#000004', '#1f0c48', '#550f6d', '#88226a', '#b63655', '#e65137', '#fca50a', '#f6d746', '#fcffa4'],
    magma: ['#0b0725', '#2a0a4a', '#4a0c6b', '#6a176e', '#8c2368', '#b5345f', '#dc503a', '#f6892e', '#f7d03c', '#f9f8b7'],
  };

  const hexToRgb = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [v >> 16, (v >> 8) & 255, v & 255];
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpColor = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

  const paletteToLUT = (name) => palettes[name].map(hexToRgb);
  const paletteLUTs = {
    viridis: paletteToLUT('viridis'),
    inferno: paletteToLUT('inferno'),
    magma: paletteToLUT('magma'),
  };

  const mapToPalette = (value, min, max, lut) => {
    const t = Math.min(1, Math.max(0, (value - min) / (max - min + EPS)));
    const scaled = t * (lut.length - 1);
    const i = Math.floor(scaled);
    const frac = scaled - i;
    const c1 = lut[i];
    const c2 = lut[Math.min(i + 1, lut.length - 1)];
    const c = lerpColor(c1, c2, frac);
    return `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
  };

  // ---------------------- Superposition builder ----------------------
  let flows = [];
  let selectedFlowId = null;

  const scenarioPresets = {
    halfBody: () => [
      { id: crypto.randomUUID(), type: 'uniform', strength: 1.2, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'source', strength: 180, angle: 0, x: -120, y: 0 },
    ],
    cylinder: () => [
      { id: crypto.randomUUID(), type: 'uniform', strength: 1.5, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'doublet', strength: 26000, angle: 0, x: 0, y: 0 },
    ],
    rotatingCylinder: () => [
      { id: crypto.randomUUID(), type: 'uniform', strength: 1.5, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'doublet', strength: 26000, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'vortex', strength: 4000, angle: 0, x: 0, y: 0 },
    ],
    rankineOval: () => [
      { id: crypto.randomUUID(), type: 'uniform', strength: 1.4, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'doublet', strength: 24000, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'source', strength: 120, angle: 0, x: -60, y: 0 },
      { id: crypto.randomUUID(), type: 'source', strength: -120, angle: 0, x: 60, y: 0 },
    ],
    shear: () => [
      { id: crypto.randomUUID(), type: 'uniform', strength: 1.2, angle: 0, x: 0, y: 0 },
      { id: crypto.randomUUID(), type: 'uniform', strength: 0.8, angle: 180, x: 0, y: 80 },
      { id: crypto.randomUUID(), type: 'uniform', strength: 0.6, angle: 0, x: 0, y: -80 },
    ],
  };

  const sampleFlowField = (x, y) => {
    let u = 0, v = 0, phi = 0, psi = 0;
    for (const f of flows) {
      const dx = x - f.x;
      const dy = y - f.y;
      const r2 = Math.max(dx * dx + dy * dy, EPS);
      const r4 = r2 * r2;
      const angle = (f.angle || 0) * DEG2RAD;
      switch (f.type) {
        case 'uniform': {
          const ux = f.strength * Math.cos(angle);
          const uy = f.strength * Math.sin(angle);
          u += ux; v += uy;
          phi += ux * x + uy * y;
          psi += uy * x - ux * y;
          break;
        }
        case 'doublet': {
          const k = f.strength;
          u += (k / (2 * Math.PI)) * ((dx * dx - dy * dy) / r4);
          v += (k / (2 * Math.PI)) * ((2 * dx * dy) / r4);
          phi += (-k / (2 * Math.PI)) * (dx / r2);
          psi += (-k / (2 * Math.PI)) * (dy / r2);
          break;
        }
        case 'vortex': {
          const g = f.strength;
          u += -(g / (2 * Math.PI)) * (dy / r2);
          v += (g / (2 * Math.PI)) * (dx / r2);
          phi += (g / (2 * Math.PI)) * Math.atan2(dy, dx);
          psi += -(g / (4 * Math.PI)) * Math.log(r2);
          break;
        }
        case 'source': {
          const m = f.strength;
          u += (m / (2 * Math.PI)) * (dx / r2);
          v += (m / (2 * Math.PI)) * (dy / r2);
          phi += (m / (4 * Math.PI)) * Math.log(r2);
          psi += (m / (2 * Math.PI)) * Math.atan2(dy, dx);
          break;
        }
        default:
          break;
      }
    }
    return { u, v, phi, psi };
  };

  const drawBuilder = () => {
    const { width: W, height: H } = flowCanvas;
    flowCtx.clearRect(0, 0, W, H);
    flowCtx.save();
    flowCtx.translate(W / 2, H / 2);

    if (state.showGrid) {
      flowCtx.strokeStyle = 'rgba(255,255,255,0.04)';
      flowCtx.lineWidth = 1;
      flowCtx.beginPath();
      for (let x = -W / 2; x <= W / 2; x += 60) { flowCtx.moveTo(x, -H / 2); flowCtx.lineTo(x, H / 2); }
      for (let y = -H / 2; y <= H / 2; y += 60) { flowCtx.moveTo(-W / 2, y); flowCtx.lineTo(W / 2, y); }
      flowCtx.stroke();
    }

    drawScalarField();
    if (state.showStream) drawStreamlines(false);
    if (state.showPotential) drawStreamlines(true);
    if (state.showMarkers) drawFlowMarkers();

    flowCtx.restore();
    requestAnimationFrame(drawBuilder);
  };

  const drawScalarField = () => {
    const lut = paletteLUTs[state.palette];
    const { width: W, height: H } = flowCanvas;
    const cols = 64, rows = 36;
    let min = Infinity, max = -Infinity;
    const field = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (i / (cols - 1) - 0.5) * W;
        const y = (j / (rows - 1) - 0.5) * H;
        const f = sampleFlowField(x, y);
        let val = 0;
        if (state.field === 'velocity') val = Math.hypot(f.u, f.v);
        if (state.field === 'pressure') val = 1 - 0.5 * (f.u * f.u + f.v * f.v);
        if (state.field === 'phi') val = f.phi;
        if (state.field === 'psi') val = f.psi;
        field.push(val);
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    }
    const cellW = flowCanvas.width / cols;
    const cellH = flowCanvas.height / rows;
    let idx = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++, idx++) {
        const val = field[idx];
        flowCtx.fillStyle = mapToPalette(val, min, max, lut);
        flowCtx.fillRect(i * cellW - flowCanvas.width / 2, j * cellH - flowCanvas.height / 2, cellW + 1, cellH + 1);
      }
    }
  };

  const drawStreamlines = (potentialInstead) => {
    const { width: W, height: H } = flowCanvas;
    const seeds = [];
    const edges = 18;
    for (let i = 0; i < edges; i++) {
      const t = i / (edges - 1);
      seeds.push({ x: -W / 2, y: lerp(-H / 2, H / 2, t) });
      seeds.push({ x: W / 2, y: lerp(-H / 2, H / 2, t) });
      seeds.push({ x: lerp(-W / 2, W / 2, t), y: -H / 2 });
      seeds.push({ x: lerp(-W / 2, W / 2, t), y: H / 2 });
    }
    flowCtx.lineWidth = 1.2;
    flowCtx.strokeStyle = potentialInstead ? 'rgba(255, 179, 71, 0.7)' : 'rgba(31, 195, 170, 0.9)';
    for (const s of seeds) {
      const path = integrateLine(s.x, s.y, potentialInstead);
      flowCtx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        if (i === 0) flowCtx.moveTo(p.x, p.y); else flowCtx.lineTo(p.x, p.y);
      }
      flowCtx.stroke();
    }
  };

  const integrateLine = (x0, y0, usePotential) => {
    const pts = [];
    let x = x0, y = y0;
    const { width: W, height: H } = flowCanvas;
    for (let i = 0; i < 140; i++) {
      const f = sampleFlowField(x, y);
      let vx = f.u, vy = f.v;
      if (usePotential) { const tx = -vy; const ty = vx; vx = tx; vy = ty; }
      const speed = Math.hypot(vx, vy) + EPS;
      const h = 4;
      const nx = x + (vx / speed) * h;
      const ny = y + (vy / speed) * h;
      pts.push({ x, y });
      x = nx; y = ny;
      if (Math.abs(x) > W || Math.abs(y) > H) break;
    }
    return pts;
  };

  const drawFlowMarkers = () => {
    for (const f of flows) {
      flowCtx.beginPath();
      flowCtx.strokeStyle = f.id === selectedFlowId ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)';
      flowCtx.fillStyle = f.type === 'source' ? '#ffb347' : f.type === 'vortex' ? '#6ece58' : f.type === 'doublet' ? '#3e8ed0' : '#1fc3aa';
      flowCtx.lineWidth = 2;
      flowCtx.arc(f.x, f.y, 8, 0, Math.PI * 2);
      flowCtx.fill();
      flowCtx.stroke();
    }
  };

  const renderFlowList = () => {
    const list = document.getElementById('flowList');
    if (!flows.length) {
      list.innerHTML = '<div class="meta">No elements yet. Add one or load a scenario.</div>';
      return;
    }
    list.innerHTML = flows.map(f => {
      const strong = f.type === 'uniform' ? `U=${f.strength.toFixed(2)}` : f.type === 'doublet' ? `κ=${f.strength.toFixed(0)}` : f.type === 'vortex' ? `Γ=${f.strength.toFixed(0)}` : `m=${f.strength.toFixed(1)}`;
      const ang = f.angle ? `${f.angle.toFixed(0)}°` : '0°';
      return `<div class="flow-card" data-id="${f.id}">
        <div class="meta"><strong>${f.type}</strong> · ${strong} · θ ${ang} · (${f.x.toFixed(0)}, ${f.y.toFixed(0)})</div>
        <button data-remove="${f.id}">Remove</button>
      </div>`;
    }).join('');
  };

  const addFlow = () => {
    const type = document.getElementById('flowType').value;
    const strength = parseFloat(document.getElementById('flowStrength').value) || 0;
    const angle = parseFloat(document.getElementById('flowAngle').value) || 0;
    const x = parseFloat(document.getElementById('flowX').value) || 0;
    const y = parseFloat(document.getElementById('flowY').value) || 0;
    flows.push({ id: crypto.randomUUID(), type, strength, angle, x, y });
    renderFlowList();
  };

  const loadScenario = (key) => {
    if (scenarioPresets[key]) {
      flows = scenarioPresets[key]();
      renderFlowList();
    }
  };

  document.getElementById('addFlow').addEventListener('click', addFlow);
  document.getElementById('resetFlows').addEventListener('click', () => { flows = []; renderFlowList(); });
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    if (e.target.value !== 'custom') loadScenario(e.target.value);
  });
  document.getElementById('flowList').addEventListener('click', (e) => {
    const id = e.target.getAttribute('data-remove');
    if (id) {
      flows = flows.filter(f => f.id !== id);
      renderFlowList();
    }
  });
  document.getElementById('fieldSelect').addEventListener('change', (e) => state.field = e.target.value);
  document.getElementById('showStream').addEventListener('change', (e) => state.showStream = e.target.checked);
  document.getElementById('showPotential').addEventListener('change', (e) => state.showPotential = e.target.checked);
  document.getElementById('showMarkers').addEventListener('change', (e) => state.showMarkers = e.target.checked);

  const flowProbe = document.getElementById('probeInfo');
  const toWorld = (evt, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width * canvas.width - canvas.width / 2;
    const y = (evt.clientY - rect.top) / rect.height * canvas.height - canvas.height / 2;
    return { x, y };
  };

  flowCanvas.addEventListener('mousemove', (e) => {
    const p = toWorld(e, flowCanvas);
    const f = sampleFlowField(p.x, p.y);
    flowProbe.textContent = `x ${p.x.toFixed(1)}, y ${p.y.toFixed(1)} | u ${f.u.toFixed(3)}, v ${f.v.toFixed(3)} | |u| ${Math.hypot(f.u, f.v).toFixed(3)} | φ ${f.phi.toFixed(2)} | ψ ${f.psi.toFixed(2)}`;
  });

  let dragging = false;
  flowCanvas.addEventListener('pointerdown', (e) => {
    const p = toWorld(e, flowCanvas);
    let nearest = null, nd = Infinity;
    for (const f of flows) {
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < nd && d < 18) { nd = d; nearest = f; }
    }
    if (nearest) {
      selectedFlowId = nearest.id;
      dragging = true;
    } else {
      selectedFlowId = null;
    }
  });
  window.addEventListener('pointerup', () => dragging = false);
  flowCanvas.addEventListener('pointermove', (e) => {
    if (!dragging || !selectedFlowId) return;
    const p = toWorld(e, flowCanvas);
    const f = flows.find(fl => fl.id === selectedFlowId);
    if (f) { f.x = p.x; f.y = p.y; }
  });

  // ---------------------- Stable fluid solver ----------------------
  class StableFluid {
    constructor(n) {
      this.n = n;
      const size = (n + 2) * (n + 2);
      this.u = new Float32Array(size);
      this.v = new Float32Array(size);
      this.uPrev = new Float32Array(size);
      this.vPrev = new Float32Array(size);
      this.d = new Float32Array(size);
      this.dPrev = new Float32Array(size);
      this.p = new Float32Array(size);
      this.div = new Float32Array(size);
      this.dt = 0.016;
      this.visc = 0.002;
      this.iter = 12;
      this.enableBuoyancy = true;
      this.enableVorticity = true;
      this.enableDye = true;
    }
    IX(x, y) { return x + (this.n + 2) * y; }
    addSource(x, s, dt) {
      for (let i = 0; i < x.length; i++) x[i] += dt * s[i];
    }
    setBnd(b, x) {
      const n = this.n;
      for (let i = 1; i <= n; i++) {
        x[this.IX(0, i)] = b === 1 ? -x[this.IX(1, i)] : x[this.IX(1, i)];
        x[this.IX(n + 1, i)] = b === 1 ? -x[this.IX(n, i)] : x[this.IX(n, i)];
        x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
        x[this.IX(i, n + 1)] = b === 2 ? -x[this.IX(i, n)] : x[this.IX(i, n)];
      }
      x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
      x[this.IX(0, n + 1)] = 0.5 * (x[this.IX(1, n + 1)] + x[this.IX(0, n)]);
      x[this.IX(n + 1, 0)] = 0.5 * (x[this.IX(n, 0)] + x[this.IX(n + 1, 1)]);
      x[this.IX(n + 1, n + 1)] = 0.5 * (x[this.IX(n, n + 1)] + x[this.IX(n + 1, n)]);
    }
    linSolve(b, x, x0, a, c) {
      const n = this.n;
      for (let k = 0; k < this.iter; k++) {
        for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= n; j++) {
            x[this.IX(i, j)] = (x0[this.IX(i, j)] + a * (
              x[this.IX(i - 1, j)] + x[this.IX(i + 1, j)] + x[this.IX(i, j - 1)] + x[this.IX(i, j + 1)]
            )) / c;
          }
        }
        this.setBnd(b, x);
      }
    }
    diffuse(b, x, x0, diff, dt) {
      const a = dt * diff * this.n * this.n;
      this.linSolve(b, x, x0, a, 1 + 4 * a);
    }
    advect(b, d, d0, u, v, dt) {
      const n = this.n;
      const dt0 = dt * n;
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          let x = i - dt0 * u[this.IX(i, j)];
          let y = j - dt0 * v[this.IX(i, j)];
          if (x < 0.5) x = 0.5; if (x > n + 0.5) x = n + 0.5;
          if (y < 0.5) y = 0.5; if (y > n + 0.5) y = n + 0.5;
          const i0 = Math.floor(x), i1 = i0 + 1;
          const j0 = Math.floor(y), j1 = j0 + 1;
          const s1 = x - i0, s0 = 1 - s1;
          const t1 = y - j0, t0 = 1 - t1;
          d[this.IX(i, j)] = s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) + s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
        }
      }
      this.setBnd(b, d);
    }
    project(u, v, p, div) {
      const n = this.n;
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          div[this.IX(i, j)] = -0.5 * (
            u[this.IX(i + 1, j)] - u[this.IX(i - 1, j)] + v[this.IX(i, j + 1)] - v[this.IX(i, j - 1)]
          ) / n;
          p[this.IX(i, j)] = 0;
        }
      }
      this.setBnd(0, div); this.setBnd(0, p);
      this.linSolve(0, p, div, 1, 4);
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          u[this.IX(i, j)] -= 0.5 * n * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]);
          v[this.IX(i, j)] -= 0.5 * n * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]);
        }
      }
      this.setBnd(1, u); this.setBnd(2, v);
    }
    vorticityConfinement(u, v, dt, eps = 4.0) {
      const n = this.n;
      const curl = new Float32Array((n + 2) * (n + 2));
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          const dwdy = (u[this.IX(i, j + 1)] - u[this.IX(i, j - 1)]) * 0.5;
          const dwdx = (v[this.IX(i + 1, j)] - v[this.IX(i - 1, j)]) * 0.5;
          curl[this.IX(i, j)] = dwdx - dwdy;
        }
      }
      for (let i = 2; i < n; i++) {
        for (let j = 2; j < n; j++) {
          const Nc = Math.abs(curl[this.IX(i + 1, j)]) - Math.abs(curl[this.IX(i - 1, j)]);
          const Nr = Math.abs(curl[this.IX(i, j + 1)]) - Math.abs(curl[this.IX(i, j - 1)]);
          const len = Math.hypot(Nc, Nr) + 1e-6;
          const Ncx = Nc / len, Nry = Nr / len;
          const force = eps * (Nry * curl[this.IX(i, j)]);
          u[this.IX(i, j)] += dt * force;
          v[this.IX(i, j)] -= dt * (Ncx * curl[this.IX(i, j)]);
        }
      }
      this.setBnd(1, u); this.setBnd(2, v);
    }
    step() {
      const n = this.n;
      const dt = this.dt;
      this.addSource(this.u, this.uPrev, dt); this.addSource(this.v, this.vPrev, dt); this.addSource(this.d, this.dPrev, dt);
      [this.uPrev, this.u] = [this.u, this.uPrev];
      [this.vPrev, this.v] = [this.v, this.vPrev];
      this.diffuse(1, this.u, this.uPrev, this.visc, dt);
      this.diffuse(2, this.v, this.vPrev, this.visc, dt);
      this.project(this.u, this.v, this.p, this.div);
      [this.uPrev, this.u] = [this.u, this.uPrev];
      [this.vPrev, this.v] = [this.v, this.vPrev];
      this.advect(1, this.u, this.uPrev, this.uPrev, this.vPrev, dt);
      this.advect(2, this.v, this.vPrev, this.uPrev, this.vPrev, dt);
      this.project(this.u, this.v, this.p, this.div);
      if (this.enableVorticity) this.vorticityConfinement(this.u, this.v, dt, 6.0);
      [this.dPrev, this.d] = [this.d, this.dPrev];
      if (this.enableDye) {
        this.diffuse(0, this.d, this.dPrev, 0.0001, dt);
        this.advect(0, this.d, this.dPrev, this.u, this.v, dt);
      }
      this.uPrev.fill(0); this.vPrev.fill(0); this.dPrev.fill(0);
      if (this.enableBuoyancy) {
        for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= n; j++) {
            const buoy = 0.1 * this.d[this.IX(i, j)];
            this.v[this.IX(i, j)] -= dt * buoy;
          }
        }
      }
    }
    addImpulse(px, py, fx, fy, dye = 0) {
      const n = this.n;
      const i = Math.max(1, Math.min(n, Math.round(px)));
      const j = Math.max(1, Math.min(n, Math.round(py)));
      this.uPrev[this.IX(i, j)] += fx;
      this.vPrev[this.IX(i, j)] += fy;
      if (this.enableDye) this.dPrev[this.IX(i, j)] += dye;
    }
    sampleSpeed(i, j) { return Math.hypot(this.u[this.IX(i, j)], this.v[this.IX(i, j)]); }
    sampleVorticity(i, j) {
      const w = (this.v[this.IX(i + 1, j)] - this.v[this.IX(i - 1, j)] - this.u[this.IX(i, j + 1)] + this.u[this.IX(i, j - 1)]) * 0.5;
      return w;
    }
  }

  const fluid = new StableFluid(96);
  const solverProbe = document.getElementById('solverProbe');
  const equationText = document.getElementById('equationText');
  const viscSlider = document.getElementById('viscosity');
  const dtSlider = document.getElementById('dt');
  const paletteSelect = document.getElementById('paletteSelect');
  const solverField = document.getElementById('solverField');

  const renderFluid = () => {
    fluid.visc = parseFloat(viscSlider.value);
    fluid.dt = parseFloat(dtSlider.value);
    fluid.enableBuoyancy = document.getElementById('enableBuoy').checked;
    fluid.enableVorticity = document.getElementById('enableVorticity').checked;
    fluid.enableDye = document.getElementById('enableDye').checked;
    state.palette = paletteSelect.value;

    fluid.step();

    const lut = paletteLUTs[state.palette];
    const { width: W, height: H } = fluidCanvas;
    const cell = 2;
    const n = fluid.n;
    let min = Infinity, max = -Infinity;
    const samples = [];
    for (let j = 0; j < H; j += cell) {
      for (let i = 0; i < W; i += cell) {
        const gx = 1 + Math.floor((i / W) * n);
        const gy = 1 + Math.floor((j / H) * n);
        let val = 0;
        if (solverField.value === 'speed') val = fluid.sampleSpeed(gx, gy);
        else if (solverField.value === 'pressure') val = fluid.p[fluid.IX(gx, gy)];
        else if (solverField.value === 'vorticity') val = fluid.sampleVorticity(gx, gy);
        else val = fluid.d[fluid.IX(gx, gy)];
        samples.push({ i, j, val });
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    for (const s of samples) {
      fluidCtx.fillStyle = mapToPalette(s.val, min, max, lut);
      fluidCtx.fillRect(s.i, s.j, cell + 1, cell + 1);
    }

    if (state.showGrid) {
      fluidCtx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x <= W; x += 64) { fluidCtx.beginPath(); fluidCtx.moveTo(x, 0); fluidCtx.lineTo(x, H); fluidCtx.stroke(); }
      for (let y = 0; y <= H; y += 64) { fluidCtx.beginPath(); fluidCtx.moveTo(0, y); fluidCtx.lineTo(W, y); fluidCtx.stroke(); }
    }

    requestAnimationFrame(renderFluid);
  };

  const fluidHud = document.getElementById('fluidHud');
  let injecting = false;
  let lastPointer = null;
  const toGrid = (evt) => {
    const rect = fluidCanvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    return { x: x * fluid.n, y: y * fluid.n };
  };

  const inject = (evt) => {
    const g = toGrid(evt);
    if (!lastPointer) lastPointer = g;
    const dx = g.x - lastPointer.x;
    const dy = g.y - lastPointer.y;
    const strength = 40;
    fluid.addImpulse(g.x, g.y, dx * strength, dy * strength, 3.5);
    lastPointer = g;
  };

  fluidCanvas.addEventListener('pointerdown', (e) => { injecting = true; inject(e); });
  window.addEventListener('pointerup', () => { injecting = false; lastPointer = null; });
  fluidCanvas.addEventListener('pointermove', (e) => { if (injecting) inject(e); const g = toGrid(e); const i = Math.round(g.x), j = Math.round(g.y); solverProbe.textContent = `i ${i}, j ${j} | |u| ${fluid.sampleSpeed(i, j).toFixed(3)} | p ${fluid.p[fluid.IX(i, j)].toFixed(3)} | ω ${fluid.sampleVorticity(i, j).toFixed(3)} | dye ${fluid.d[fluid.IX(i, j)].toFixed(3)}`; });

  document.getElementById('kickForce').addEventListener('click', () => {
    for (let i = 0; i < 14; i++) {
      const x = 10 + Math.random() * (fluid.n - 20);
      const y = 10 + Math.random() * (fluid.n - 20);
      const ang = Math.random() * Math.PI * 2;
      fluid.addImpulse(x, y, Math.cos(ang) * 60, Math.sin(ang) * 60, 6);
    }
  });
  document.getElementById('clearFluid').addEventListener('click', () => {
    fluid.u.fill(0); fluid.v.fill(0); fluid.d.fill(0); fluid.p.fill(0);
  });

  equationText.addEventListener('input', () => {
    const txt = equationText.value;
    const nu = txt.match(/nu\s*=\s*([0-9.]+)/i);
    if (nu && nu[1]) {
      const val = Math.min(0.02, parseFloat(nu[1]));
      viscSlider.value = val;
    }
    const hasVort = /vort/i.test(txt);
    const hasBuoy = /buoy|beta|T0/i.test(txt);
    document.getElementById('enableVorticity').checked = hasVort;
    document.getElementById('enableBuoy').checked = hasBuoy;
  });

  paletteSelect.addEventListener('change', (e) => { state.palette = e.target.value; });

  // ---------------------- Global UI wiring ----------------------
  const builderPanel = document.getElementById('builderPanel');
  const solverPanel = document.getElementById('solverPanel');
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      builderPanel.classList.toggle('hidden', state.mode !== 'builder');
      solverPanel.classList.toggle('hidden', state.mode !== 'solver');
    });
  });

  document.getElementById('toggleGrid').addEventListener('change', (e) => state.showGrid = e.target.checked);
  document.getElementById('toggleUI').addEventListener('change', (e) => {
    state.showUI = e.target.checked;
    document.querySelectorAll('.controls, .hud').forEach(el => el.style.display = state.showUI ? '' : 'none');
  });

  // Kick things off
  loadScenario('cylinder');
  renderFlowList();
  drawBuilder();
  renderFluid();
})();
