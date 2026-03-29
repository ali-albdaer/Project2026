(() => {
  "use strict";

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const offscreen = document.createElement("canvas");
  const offCtx = offscreen.getContext("2d", { alpha: false });

  const controls = {
    resolution: document.getElementById("resolution"),
    dt: document.getElementById("dt"),
    substeps: document.getElementById("substeps"),
    viscosity: document.getElementById("viscosity"),
    diffusion: document.getElementById("diffusion"),
    inflow: document.getElementById("inflow"),
    buoyancy: document.getElementById("buoyancy"),
    confinement: document.getElementById("confinement"),
    gain: document.getElementById("gain"),
    quantity: document.getElementById("quantity"),
    palette: document.getElementById("palette"),
    toolMode: document.getElementById("toolMode"),
    objectType: document.getElementById("objectType"),
    size: document.getElementById("size"),
    angle: document.getElementById("angle"),
    thickness: document.getElementById("thickness"),
    camber: document.getElementById("camber"),
    camberPos: document.getElementById("camberPos"),
    boundarySolver: document.getElementById("boundarySolver"),
    pauseBtn: document.getElementById("pauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    removeSelected: document.getElementById("removeSelected"),
    clearObjects: document.getElementById("clearObjects")
  };

  const labels = {
    resolution: document.getElementById("resolutionValue"),
    dt: document.getElementById("dtValue"),
    substeps: document.getElementById("substepsValue"),
    viscosity: document.getElementById("viscosityValue"),
    diffusion: document.getElementById("diffusionValue"),
    inflow: document.getElementById("inflowValue"),
    buoyancy: document.getElementById("buoyancyValue"),
    confinement: document.getElementById("confinementValue"),
    gain: document.getElementById("gainValue"),
    size: document.getElementById("sizeValue"),
    angle: document.getElementById("angleValue"),
    thickness: document.getElementById("thicknessValue"),
    camber: document.getElementById("camberValue"),
    camberPos: document.getElementById("camberPosValue")
  };

  const metricsContainer = document.getElementById("metrics");
  const fpsReadout = document.getElementById("fpsReadout");
  const objectReadout = document.getElementById("objectReadout");
  const gradientBar = document.getElementById("gradientBar");
  const valueMin = document.getElementById("valueMin");
  const valueMax = document.getElementById("valueMax");

  const metricOrder = [
    "Re", "Fr", "Pr", "Pe", "Ma", "St",
    "Rex", "delta99", "deltaStar", "theta", "Cf", "H"
  ];

  const metricNames = {
    Re: "Reynolds Re",
    Fr: "Froude Fr",
    Pr: "Prandtl Pr",
    Pe: "Peclet Pe",
    Ma: "Mach Ma",
    St: "Strouhal St",
    Rex: "Re_x",
    delta99: "delta_99 / L",
    deltaStar: "delta* / L",
    theta: "theta / L",
    Cf: "C_f",
    H: "Shape H"
  };

  const metricsEls = {};
  metricOrder.forEach((key) => {
    const item = document.createElement("div");
    item.className = "metric-item";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = metricNames[key];

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = "--";

    item.appendChild(label);
    item.appendChild(value);
    metricsContainer.appendChild(item);
    metricsEls[key] = value;
  });

  const sim = {
    N: parseInt(controls.resolution.value, 10),
    dt: parseFloat(controls.dt.value),
    substeps: parseInt(controls.substeps.value, 10),
    viscosity: parseFloat(controls.viscosity.value),
    diffusion: parseFloat(controls.diffusion.value),
    inflow: parseFloat(controls.inflow.value),
    buoyancy: parseFloat(controls.buoyancy.value),
    confinement: parseFloat(controls.confinement.value),
    gain: parseFloat(controls.gain.value)
  };

  const state = {
    running: true,
    nextObjectId: 1,
    selectedObjectId: null,
    frameDt: 1 / 60,
    fps: 0,
    fpsSmoothing: 0.08,
    statsTick: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragging: false,
    mouseDown: false,
    mouseX: 0.5,
    mouseY: 0.5
  };

  const objects = [];

  const paletteStops = {
    viridis: [
      [68, 1, 84], [71, 45, 123], [59, 82, 139], [44, 113, 142],
      [33, 144, 141], [39, 173, 129], [92, 200, 99], [170, 220, 50], [253, 231, 37]
    ],
    jet: [
      [0, 0, 130], [0, 0, 255], [0, 180, 255], [95, 255, 160],
      [255, 255, 75], [255, 145, 0], [220, 20, 20], [130, 0, 0]
    ],
    magma: [
      [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
      [181, 54, 122], [229, 80, 100], [251, 136, 97], [253, 194, 140], [252, 253, 191]
    ],
    plasma: [
      [13, 8, 135], [70, 3, 159], [114, 1, 168], [156, 23, 158],
      [193, 54, 136], [223, 87, 110], [244, 126, 86], [253, 169, 58], [240, 249, 33]
    ],
    inferno: [
      [0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106],
      [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164]
    ],
    cividis: [
      [0, 32, 76], [0, 45, 99], [0, 58, 110], [52, 74, 109],
      [88, 93, 109], [122, 113, 109], [157, 135, 110], [194, 159, 110], [233, 186, 96], [255, 219, 76]
    ],
    turbo: [
      [48, 18, 59], [50, 34, 120], [28, 71, 197], [20, 108, 244], [53, 144, 249],
      [93, 178, 224], [134, 205, 186], [174, 221, 133], [212, 227, 76], [242, 216, 30],
      [252, 185, 20], [248, 137, 31], [229, 87, 53], [198, 41, 71], [158, 1, 66]
    ]
  };

  const paletteLUT = {};
  let activePalette = new Uint8ClampedArray(256 * 3);

  let N = sim.N;
  let size = N * N;

  let u;
  let v;
  let u0;
  let v0;
  let p;
  let div;
  let dens;
  let dens0;
  let temp;
  let temp0;
  let curl;
  let solid;
  let solidUx;
  let solidUy;
  let linearScratch;
  let renderField;
  let imageData;

  const quantityRange = {
    velocity: { min: 0, max: 2 },
    pressure: { min: -0.4, max: 0.4 },
    density: { min: 0, max: 1 },
    temperature: { min: 0, max: 1 },
    vorticity: { min: 0, max: 6 }
  };

  function idx(i, j) {
    return i + j * N;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function selectedObject() {
    return objects.find((obj) => obj.id === state.selectedObjectId) || null;
  }

  function nacaFromType(type) {
    if (type === "naca0012") {
      return { m: 0, p: 0.4, t: 0.12 };
    }
    if (type === "naca2412") {
      return { m: 0.02, p: 0.4, t: 0.12 };
    }
    if (type === "naca4415") {
      return { m: 0.04, p: 0.4, t: 0.15 };
    }
    return {
      m: parseFloat(controls.camber.value) / 100,
      p: parseFloat(controls.camberPos.value) / 100,
      t: parseFloat(controls.thickness.value) / 100
    };
  }

  function isAirfoilType(type) {
    return type.startsWith("naca");
  }

  function buildPaletteLUT(stops) {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i += 1) {
      const t = i / 255;
      const pos = t * (stops.length - 1);
      const a = Math.floor(pos);
      const b = Math.min(stops.length - 1, a + 1);
      const f = pos - a;
      lut[i * 3 + 0] = Math.round(stops[a][0] * (1 - f) + stops[b][0] * f);
      lut[i * 3 + 1] = Math.round(stops[a][1] * (1 - f) + stops[b][1] * f);
      lut[i * 3 + 2] = Math.round(stops[a][2] * (1 - f) + stops[b][2] * f);
    }
    return lut;
  }

  function setPalette(name) {
    activePalette = paletteLUT[name] || paletteLUT.viridis;

    const stops = paletteStops[name] || paletteStops.viridis;
    const cssGradient = stops.map((c, i) => {
      const pct = Math.round((i / (stops.length - 1)) * 100);
      return `rgb(${c[0]}, ${c[1]}, ${c[2]}) ${pct}%`;
    }).join(", ");

    gradientBar.style.background = `linear-gradient(90deg, ${cssGradient})`;
  }

  function allocateFields() {
    N = sim.N;
    size = N * N;

    u = new Float32Array(size);
    v = new Float32Array(size);
    u0 = new Float32Array(size);
    v0 = new Float32Array(size);
    p = new Float32Array(size);
    div = new Float32Array(size);
    dens = new Float32Array(size);
    dens0 = new Float32Array(size);
    temp = new Float32Array(size);
    temp0 = new Float32Array(size);
    curl = new Float32Array(size);
    solid = new Uint8Array(size);
    solidUx = new Float32Array(size);
    solidUy = new Float32Array(size);
    linearScratch = new Float32Array(size);
    renderField = new Float32Array(size);

    offscreen.width = N;
    offscreen.height = N;
    imageData = offCtx.createImageData(N, N);

    for (let j = 0; j < N; j += 1) {
      const y = (j + 0.5) / N;
      for (let i = 0; i < N; i += 1) {
        const k = idx(i, j);
        u[k] = sim.inflow * (0.85 + 0.3 * Math.sin(y * Math.PI * 2));
        v[k] = 0;
        dens[k] = 0.02;
        temp[k] = 0.02;
      }
    }
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const targetWidth = Math.max(2, Math.floor(displayWidth * dpr));
    const targetHeight = Math.max(2, Math.floor(displayHeight * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }

  function sampleBilinear(field, x, y) {
    const xx = clamp(x, 0.5, N - 1.5);
    const yy = clamp(y, 0.5, N - 1.5);

    const i0 = Math.floor(xx);
    const j0 = Math.floor(yy);
    const i1 = i0 + 1;
    const j1 = j0 + 1;

    const sx = xx - i0;
    const sy = yy - j0;

    const k00 = idx(i0, j0);
    const k10 = idx(i1, j0);
    const k01 = idx(i0, j1);
    const k11 = idx(i1, j1);

    const a = field[k00] * (1 - sx) + field[k10] * sx;
    const b = field[k01] * (1 - sx) + field[k11] * sx;
    return a * (1 - sy) + b * sy;
  }

  function setBoundary(field) {
    for (let i = 0; i < N; i += 1) {
      field[idx(i, 0)] = field[idx(i, 1)];
      field[idx(i, N - 1)] = field[idx(i, N - 2)];
    }

    for (let j = 0; j < N; j += 1) {
      field[idx(0, j)] = field[idx(1, j)];
      field[idx(N - 1, j)] = field[idx(N - 2, j)];
    }
  }

  function applyVelocityBoundary() {
    for (let j = 1; j < N - 1; j += 1) {
      const left = idx(0, j);
      const right = idx(N - 1, j);
      u[left] = sim.inflow;
      v[left] = 0;

      u[right] = u[idx(N - 2, j)];
      v[right] = v[idx(N - 2, j)];
    }

    for (let i = 0; i < N; i += 1) {
      u[idx(i, 0)] = u[idx(i, 1)];
      u[idx(i, N - 1)] = u[idx(i, N - 2)];
      v[idx(i, 0)] = 0;
      v[idx(i, N - 1)] = 0;
    }

    for (let k = 0; k < size; k += 1) {
      if (solid[k]) {
        u[k] = solidUx[k];
        v[k] = solidUy[k];
      }
    }
  }

  function applyScalarBoundary(field) {
    setBoundary(field);

    for (let j = 1; j < N - 1; j += 1) {
      const left = idx(0, j);
      field[left] = Math.max(field[left], 0.08);
    }

    for (let k = 0; k < size; k += 1) {
      if (solid[k]) {
        field[k] *= 0.7;
      }
    }
  }

  function addInflowScalars() {
    const band = Math.max(2, Math.round(N * 0.02));
    for (let j = band; j < N - band; j += 1) {
      const k = idx(1, j);
      dens[k] = Math.max(dens[k], 0.4);
      temp[k] = Math.max(temp[k], 0.22);
    }
  }

  function advect(out, src, velX, velY, dt) {
    const scale = dt * N;

    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          out[k] = src[k];
          continue;
        }

        const x = i - scale * velX[k];
        const y = j - scale * velY[k];
        out[k] = sampleBilinear(src, x, y);
      }
    }
  }

  function solveLinear(target, source, alpha, iterations) {
    const inv = 1 / (1 + 4 * alpha);
    target.set(source);

    for (let iter = 0; iter < iterations; iter += 1) {
      for (let j = 1; j < N - 1; j += 1) {
        for (let i = 1; i < N - 1; i += 1) {
          const k = idx(i, j);
          if (solid[k]) {
            linearScratch[k] = source[k];
            continue;
          }

          const left = target[idx(i - 1, j)];
          const right = target[idx(i + 1, j)];
          const down = target[idx(i, j - 1)];
          const up = target[idx(i, j + 1)];

          linearScratch[k] = (source[k] + alpha * (left + right + down + up)) * inv;
        }
      }

      target.set(linearScratch);
      setBoundary(target);
    }
  }

  function project() {
    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          div[k] = 0;
          p[k] = 0;
          continue;
        }

        div[k] = -0.5 * (
          u[idx(i + 1, j)] - u[idx(i - 1, j)] +
          v[idx(i, j + 1)] - v[idx(i, j - 1)]
        ) / N;

        p[k] = 0;
      }
    }

    for (let iter = 0; iter < 42; iter += 1) {
      for (let j = 1; j < N - 1; j += 1) {
        for (let i = 1; i < N - 1; i += 1) {
          const k = idx(i, j);
          if (solid[k]) {
            linearScratch[k] = 0;
            continue;
          }

          linearScratch[k] = (
            div[k] +
            p[idx(i - 1, j)] +
            p[idx(i + 1, j)] +
            p[idx(i, j - 1)] +
            p[idx(i, j + 1)]
          ) * 0.25;
        }
      }

      p.set(linearScratch);
      setBoundary(p);
    }

    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          continue;
        }

        u[k] -= 0.5 * N * (p[idx(i + 1, j)] - p[idx(i - 1, j)]);
        v[k] -= 0.5 * N * (p[idx(i, j + 1)] - p[idx(i, j - 1)]);
      }
    }

    applyVelocityBoundary();
  }

  function addBuoyancyAndConfinement(dt) {
    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          continue;
        }

        v[k] += dt * sim.buoyancy * (temp[k] - 0.6 * dens[k]);
      }
    }

    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          curl[k] = 0;
          continue;
        }

        const dvdx = (v[idx(i + 1, j)] - v[idx(i - 1, j)]) * 0.5 * N;
        const dudy = (u[idx(i, j + 1)] - u[idx(i, j - 1)]) * 0.5 * N;
        curl[k] = dvdx - dudy;
      }
    }

    for (let j = 2; j < N - 2; j += 1) {
      for (let i = 2; i < N - 2; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          continue;
        }

        const nx = Math.abs(curl[idx(i, j + 1)]) - Math.abs(curl[idx(i, j - 1)]);
        const ny = Math.abs(curl[idx(i - 1, j)]) - Math.abs(curl[idx(i + 1, j)]);
        const mag = Math.hypot(nx, ny) + 1e-5;
        const nxx = nx / mag;
        const nyy = ny / mag;
        const force = sim.confinement * curl[k];

        u[k] += dt * nyy * force;
        v[k] -= dt * nxx * force;
      }
    }

    applyVelocityBoundary();
  }

  function coolScalars(dt) {
    const cooling = Math.max(0.93, 1 - dt * 0.45);
    for (let i = 0; i < size; i += 1) {
      dens[i] *= 0.9994;
      temp[i] *= cooling;
    }
  }

  function toObjectLocal(pointX, pointY, obj) {
    const dx = pointX - obj.x;
    const dy = pointY - obj.y;
    const c = Math.cos(-obj.angle);
    const s = Math.sin(-obj.angle);
    return {
      x: dx * c - dy * s,
      y: dx * s + dy * c
    };
  }

  function nacaSurface(xi, m, p, t) {
    const x = clamp(xi, 0, 1);
    const yt = 5 * t * (
      0.2969 * Math.sqrt(Math.max(x, 1e-6)) -
      0.1260 * x -
      0.3516 * x * x +
      0.2843 * x * x * x -
      0.1015 * x * x * x * x
    );

    let yc = 0;
    let dyc = 0;

    if (m > 0 && p > 0 && p < 1) {
      if (x < p) {
        yc = (m / (p * p)) * (2 * p * x - x * x);
        dyc = (2 * m / (p * p)) * (p - x);
      } else {
        const d = 1 - p;
        yc = (m / (d * d)) * (1 - 2 * p + 2 * p * x - x * x);
        dyc = (2 * m / (d * d)) * (p - x);
      }
    }

    const theta = Math.atan(dyc);
    return {
      upper: yc + yt * Math.cos(theta),
      lower: yc - yt * Math.cos(theta),
      yc,
      theta
    };
  }

  function pointInsideObject(px, py, obj) {
    if (obj.type === "sphere" || obj.type === "cylinder") {
      const dx = px - obj.x;
      const dy = py - obj.y;
      return dx * dx + dy * dy <= obj.radius * obj.radius;
    }

    if (isAirfoilType(obj.type)) {
      const local = toObjectLocal(px, py, obj);
      const c = obj.chord;
      const xi = local.x / c + 0.5;

      if (xi < 0 || xi > 1) {
        return false;
      }

      const surf = nacaSurface(xi, obj.camber, obj.camberPos, obj.thickness);
      const yN = local.y / c;
      return yN <= surf.upper && yN >= surf.lower;
    }

    return false;
  }

  function clampObjectIntoDomain(obj) {
    const margin = obj.type === "sphere" || obj.type === "cylinder" ? obj.radius : obj.chord * 0.7;
    obj.x = clamp(obj.x, margin, 1 - margin);
    obj.y = clamp(obj.y, margin, 1 - margin);
  }

  function updateSolidMask() {
    solid.fill(0);
    solidUx.fill(0);
    solidUy.fill(0);

    objects.forEach((obj) => {
      clampObjectIntoDomain(obj);

      const extent = obj.type === "sphere" || obj.type === "cylinder" ? obj.radius : obj.chord * 0.7;
      const iMin = clamp(Math.floor((obj.x - extent) * N), 1, N - 2);
      const iMax = clamp(Math.ceil((obj.x + extent) * N), 1, N - 2);
      const jMin = clamp(Math.floor((obj.y - extent) * N), 1, N - 2);
      const jMax = clamp(Math.ceil((obj.y + extent) * N), 1, N - 2);

      for (let j = jMin; j <= jMax; j += 1) {
        const y = (j + 0.5) / N;
        for (let i = iMin; i <= iMax; i += 1) {
          const x = (i + 0.5) / N;
          if (!pointInsideObject(x, y, obj)) {
            continue;
          }

          const k = idx(i, j);
          solid[k] = 1;
          solidUx[k] = obj.vx;
          solidUy[k] = obj.vy;

          dens[k] *= 0.5;
          temp[k] *= 0.6;
        }
      }
    });
  }

  function createObjectAt(x, y) {
    const type = controls.objectType.value;
    const sizePct = parseFloat(controls.size.value) / 100;
    const angle = parseFloat(controls.angle.value) * Math.PI / 180;
    const naca = nacaFromType(type);

    const obj = {
      id: state.nextObjectId,
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      angle,
      radius: sizePct * 0.5,
      chord: sizePct,
      thickness: naca.t,
      camber: naca.m,
      camberPos: naca.p
    };

    if (obj.type === "sphere") {
      obj.radius = sizePct * 0.45;
    } else if (obj.type === "cylinder") {
      obj.radius = sizePct * 0.48;
    } else {
      obj.chord = sizePct;
    }

    clampObjectIntoDomain(obj);
    objects.push(obj);
    state.selectedObjectId = obj.id;
    state.nextObjectId += 1;
    objectReadout.textContent = `Objects: ${objects.length}`;
  }

  function findObjectAt(x, y) {
    for (let i = objects.length - 1; i >= 0; i -= 1) {
      if (pointInsideObject(x, y, objects[i])) {
        return objects[i];
      }
    }

    return null;
  }

  function removeSelectedObject() {
    if (state.selectedObjectId === null) {
      return;
    }

    const index = objects.findIndex((o) => o.id === state.selectedObjectId);
    if (index >= 0) {
      objects.splice(index, 1);
    }

    state.selectedObjectId = objects.length ? objects[objects.length - 1].id : null;
    objectReadout.textContent = `Objects: ${objects.length}`;
  }

  function syncSelectedFromControls() {
    const obj = selectedObject();
    if (!obj) {
      return;
    }

    obj.angle = parseFloat(controls.angle.value) * Math.PI / 180;

    if (obj.type === "sphere" || obj.type === "cylinder") {
      obj.radius = parseFloat(controls.size.value) / 100 * (obj.type === "sphere" ? 0.45 : 0.48);
    } else {
      obj.chord = parseFloat(controls.size.value) / 100;
      obj.thickness = parseFloat(controls.thickness.value) / 100;
      obj.camber = parseFloat(controls.camber.value) / 100;
      obj.camberPos = parseFloat(controls.camberPos.value) / 100;
    }

    clampObjectIntoDomain(obj);
  }

  function syncControlsFromSelected() {
    const obj = selectedObject();
    if (!obj) {
      return;
    }

    controls.angle.value = (obj.angle * 180 / Math.PI).toFixed(0);

    if (obj.type === "sphere" || obj.type === "cylinder") {
      const sizeV = obj.type === "sphere" ? obj.radius / 0.45 : obj.radius / 0.48;
      controls.size.value = Math.round(sizeV * 100);
    } else {
      controls.size.value = Math.round(obj.chord * 100);
      controls.thickness.value = Math.round(obj.thickness * 100);
      controls.camber.value = (obj.camber * 100).toFixed(1);
      controls.camberPos.value = Math.round(obj.camberPos * 100);
    }

    refreshLabels();
  }

  function paintImpulse(x, y) {
    const centerI = Math.floor(x * N);
    const centerJ = Math.floor(y * N);
    const radius = Math.max(2, Math.floor(N * 0.018));

    for (let j = centerJ - radius; j <= centerJ + radius; j += 1) {
      if (j < 1 || j > N - 2) {
        continue;
      }
      for (let i = centerI - radius; i <= centerI + radius; i += 1) {
        if (i < 1 || i > N - 2) {
          continue;
        }

        const dx = i - centerI;
        const dy = j - centerJ;
        const dist = Math.sqrt(dx * dx + dy * dy) / Math.max(radius, 1);
        if (dist > 1) {
          continue;
        }

        const k = idx(i, j);
        if (solid[k]) {
          continue;
        }

        const w = (1 - dist) * 0.25;
        u[k] += w * 2;
        v[k] += w * (Math.random() - 0.5) * 0.8;
        dens[k] = Math.min(3, dens[k] + w * 0.8);
        temp[k] = Math.min(3, temp[k] + w * 0.35);
      }
    }
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  }

  function setupInteraction() {
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

    canvas.addEventListener("mousedown", (ev) => {
      state.mouseDown = true;
      const point = screenToWorld(ev.clientX, ev.clientY);
      state.mouseX = point.x;
      state.mouseY = point.y;

      const mode = controls.toolMode.value;
      if (mode === "spawn") {
        if (ev.button === 0) {
          createObjectAt(point.x, point.y);
        } else {
          paintImpulse(point.x, point.y);
        }
        return;
      }

      if (mode === "erase") {
        const victim = findObjectAt(point.x, point.y);
        if (victim) {
          const index = objects.findIndex((o) => o.id === victim.id);
          objects.splice(index, 1);
          if (state.selectedObjectId === victim.id) {
            state.selectedObjectId = null;
          }
          objectReadout.textContent = `Objects: ${objects.length}`;
        }
        return;
      }

      if (mode === "drag") {
        const hit = findObjectAt(point.x, point.y);
        if (!hit) {
          state.selectedObjectId = null;
          return;
        }

        state.selectedObjectId = hit.id;
        state.dragging = true;
        state.dragOffsetX = hit.x - point.x;
        state.dragOffsetY = hit.y - point.y;
        syncControlsFromSelected();
      }
    });

    window.addEventListener("mousemove", (ev) => {
      const point = screenToWorld(ev.clientX, ev.clientY);
      state.mouseX = point.x;
      state.mouseY = point.y;

      if (!state.dragging || controls.toolMode.value !== "drag") {
        return;
      }

      const obj = selectedObject();
      if (!obj) {
        return;
      }

      const oldX = obj.x;
      const oldY = obj.y;

      obj.x = point.x + state.dragOffsetX;
      obj.y = point.y + state.dragOffsetY;
      clampObjectIntoDomain(obj);

      const dt = Math.max(1e-4, state.frameDt);
      obj.vx = (obj.x - oldX) / dt;
      obj.vy = (obj.y - oldY) / dt;
    });

    window.addEventListener("mouseup", () => {
      state.mouseDown = false;
      state.dragging = false;
    });

    canvas.addEventListener("wheel", (ev) => {
      const obj = selectedObject();
      if (!obj || !ev.shiftKey) {
        return;
      }

      ev.preventDefault();
      obj.angle += ev.deltaY * 0.004;
      controls.angle.value = (obj.angle * 180 / Math.PI).toFixed(0);
      refreshLabels();
    }, { passive: false });
  }

  function stepSimulation(dtFrame) {
    if (!state.running) {
      return;
    }

    const substeps = sim.substeps;
    const dt = sim.dt / substeps;

    for (let s = 0; s < substeps; s += 1) {
      updateSolidMask();
      addInflowScalars();
      addBuoyancyAndConfinement(dt);

      u0.set(u);
      v0.set(v);
      advect(u, u0, u0, v0, dt);
      advect(v, v0, u0, v0, dt);

      const velDiff = sim.viscosity * dt * N * N;
      if (velDiff > 0) {
        u0.set(u);
        solveLinear(u, u0, velDiff, 12);
        v0.set(v);
        solveLinear(v, v0, velDiff, 12);
      }

      project();

      dens0.set(dens);
      advect(dens, dens0, u, v, dt);

      temp0.set(temp);
      advect(temp, temp0, u, v, dt);

      const scalarDiff = sim.diffusion * dt * N * N;
      if (scalarDiff > 0) {
        dens0.set(dens);
        solveLinear(dens, dens0, scalarDiff, 10);

        temp0.set(temp);
        solveLinear(temp, temp0, scalarDiff, 10);
      }

      coolScalars(dt);
      applyVelocityBoundary();
      applyScalarBoundary(dens);
      applyScalarBoundary(temp);
    }

    const damping = Math.max(0, 1 - dtFrame * 4.0);
    objects.forEach((obj) => {
      if (!state.dragging || obj.id !== state.selectedObjectId) {
        obj.vx *= damping;
        obj.vy *= damping;
      }
    });
  }

  function fillRenderField(quantity) {
    if (quantity === "none") {
      return { min: 0, max: 1 };
    }

    let minV = Infinity;
    let maxV = -Infinity;

    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          renderField[k] = 0;
          continue;
        }

        let value = 0;
        if (quantity === "velocity") {
          value = Math.hypot(u[k], v[k]);
        } else if (quantity === "pressure") {
          value = p[k];
        } else if (quantity === "density") {
          value = dens[k];
        } else if (quantity === "temperature") {
          value = temp[k];
        } else if (quantity === "vorticity") {
          value = Math.abs(curl[k]);
        }

        renderField[k] = value;
        if (value < minV) {
          minV = value;
        }
        if (value > maxV) {
          maxV = value;
        }
      }
    }

    if (!Number.isFinite(minV) || !Number.isFinite(maxV) || Math.abs(maxV - minV) < 1e-7) {
      minV = 0;
      maxV = 1;
    }

    const range = quantityRange[quantity];
    range.min = range.min * 0.86 + minV * 0.14;
    range.max = range.max * 0.86 + maxV * 0.14;

    if (range.max < range.min + 1e-6) {
      range.max = range.min + 1e-6;
    }

    return { min: range.min, max: range.max };
  }

  function drawBaseBackground() {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#0f2830");
    grad.addColorStop(1, "#102f38");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#8fd4da";
    const spacing = Math.max(22, Math.floor(canvas.width / 24));
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawFlowField() {
    const quantity = controls.quantity.value;

    if (quantity === "none") {
      drawBaseBackground();
      valueMin.textContent = "-";
      valueMax.textContent = "-";
      return;
    }

    const range = fillRenderField(quantity);
    const minVal = range.min;
    const maxVal = range.max;
    const span = Math.max(1e-6, maxVal - minVal);
    const gain = sim.gain;

    const pixels = imageData.data;

    for (let j = 0; j < N; j += 1) {
      for (let i = 0; i < N; i += 1) {
        const k = idx(i, j);
        const pix = k * 4;

        if (solid[k]) {
          pixels[pix + 0] = 26;
          pixels[pix + 1] = 38;
          pixels[pix + 2] = 39;
          pixels[pix + 3] = 255;
          continue;
        }

        let t = (renderField[k] - minVal) / span;
        t = clamp((t - 0.5) * gain + 0.5, 0, 1);

        const ci = Math.round(t * 255) * 3;
        pixels[pix + 0] = activePalette[ci + 0];
        pixels[pix + 1] = activePalette[ci + 1];
        pixels[pix + 2] = activePalette[ci + 2];
        pixels[pix + 3] = 255;
      }
    }

    offCtx.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

    valueMin.textContent = minVal.toExponential(2);
    valueMax.textContent = maxVal.toExponential(2);
  }

  function drawAirfoilOutline(obj) {
    const segments = 70;
    const c = obj.chord;

    ctx.beginPath();

    for (let n = 0; n <= segments; n += 1) {
      const xi = n / segments;
      const surf = nacaSurface(xi, obj.camber, obj.camberPos, obj.thickness);
      const xLocal = (xi - 0.5) * c;
      const yLocal = surf.upper * c;
      const wx = obj.x + xLocal * Math.cos(obj.angle) - yLocal * Math.sin(obj.angle);
      const wy = obj.y + xLocal * Math.sin(obj.angle) + yLocal * Math.cos(obj.angle);

      const sx = wx * canvas.width;
      const sy = wy * canvas.height;
      if (n === 0) {
        ctx.moveTo(sx, sy);
      } else {
        ctx.lineTo(sx, sy);
      }
    }

    for (let n = segments; n >= 0; n -= 1) {
      const xi = n / segments;
      const surf = nacaSurface(xi, obj.camber, obj.camberPos, obj.thickness);
      const xLocal = (xi - 0.5) * c;
      const yLocal = surf.lower * c;
      const wx = obj.x + xLocal * Math.cos(obj.angle) - yLocal * Math.sin(obj.angle);
      const wy = obj.y + xLocal * Math.sin(obj.angle) + yLocal * Math.cos(obj.angle);
      ctx.lineTo(wx * canvas.width, wy * canvas.height);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawObjects() {
    objects.forEach((obj) => {
      const selected = obj.id === state.selectedObjectId;

      ctx.save();
      ctx.fillStyle = selected ? "rgba(255, 244, 170, 0.68)" : "rgba(236, 239, 241, 0.45)";
      ctx.strokeStyle = selected ? "rgba(255, 225, 96, 1)" : "rgba(226, 244, 247, 0.9)";
      ctx.lineWidth = selected ? 2.4 : 1.4;

      if (obj.type === "sphere" || obj.type === "cylinder") {
        ctx.beginPath();
        ctx.arc(obj.x * canvas.width, obj.y * canvas.height, obj.radius * canvas.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        drawAirfoilOutline(obj);
      }

      if (selected) {
        const tx = obj.x * canvas.width;
        const ty = obj.y * canvas.height;
        const len = (obj.type === "sphere" || obj.type === "cylinder" ? obj.radius * 2.2 : obj.chord * 1.1) * canvas.width;
        ctx.strokeStyle = "rgba(255, 185, 86, 0.95)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(obj.angle) * len, ty + Math.sin(obj.angle) * len);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  function computeStats() {
    let speedSum = 0;
    let speedMax = 0;
    let count = 0;
    let probeSignal = 0;
    let probeCount = 0;

    const probeI = Math.floor(N * 0.75);
    const probeJ0 = Math.floor(N * 0.4);
    const probeJ1 = Math.floor(N * 0.6);

    for (let j = 1; j < N - 1; j += 1) {
      for (let i = 1; i < N - 1; i += 1) {
        const k = idx(i, j);
        if (solid[k]) {
          continue;
        }

        const sp = Math.hypot(u[k], v[k]);
        speedSum += sp;
        speedMax = Math.max(speedMax, sp);
        count += 1;

        if (i === probeI && j >= probeJ0 && j <= probeJ1) {
          probeSignal += v[k];
          probeCount += 1;
        }
      }
    }

    const U = count > 0 ? speedSum / count : 0;
    const Uchar = Math.max(U, 1e-6);
    const L = selectedObject()
      ? ((selectedObject().type === "sphere" || selectedObject().type === "cylinder")
        ? selectedObject().radius * 2
        : selectedObject().chord)
      : 0.2;

    const nu = Math.max(sim.viscosity, 1e-8);
    const alpha = Math.max(sim.diffusion, 1e-8);
    const g = 9.81;

    const Re = Uchar * L / nu;
    const Fr = Uchar / Math.sqrt(Math.max(g * L, 1e-8));
    const Pr = nu / alpha;
    const Pe = Uchar * L / alpha;
    const Ma = Uchar / 20;

    const signal = probeCount > 0 ? probeSignal / probeCount : 0;
    const St = clamp(Math.abs(signal) * 0.7 / Uchar, 0, 2.5);

    const xRef = Math.max(0.55 * L, 1e-5);
    const Rex = Uchar * xRef / nu;

    let delta99 = 0;
    let deltaStar = 0;
    let theta = 0;
    let Cf = 0;
    let H = 0;

    const solver = controls.boundarySolver.value;
    if (solver === "blasius") {
      const root = Math.sqrt(Math.max(Rex, 1e-7));
      delta99 = 5 * xRef / root;
      deltaStar = 1.72 * xRef / root;
      theta = 0.664 * xRef / root;
      Cf = 0.664 / root;
      H = deltaStar / Math.max(theta, 1e-9);
    } else if (solver === "thwaites") {
      theta = Math.sqrt(0.45 * nu * xRef / Uchar);
      H = 2.59;
      deltaStar = H * theta;
      delta99 = 4.9 * theta;
      Cf = 0.45 * Math.sqrt(nu / Math.max(Uchar * xRef, 1e-9));
    } else {
      const rex = Math.max(Rex, 1e3);
      const pwr = Math.pow(rex, 0.2);
      delta99 = 0.37 * xRef / pwr;
      deltaStar = 0.046 * xRef / pwr;
      theta = 0.036 * xRef / pwr;
      Cf = 0.0592 / pwr;
      H = deltaStar / Math.max(theta, 1e-9);
    }

    return {
      Re,
      Fr,
      Pr,
      Pe,
      Ma,
      St,
      Rex,
      delta99: delta99 / L,
      deltaStar: deltaStar / L,
      theta: theta / L,
      Cf,
      H,
      U,
      Umax: speedMax
    };
  }

  function formatMetric(v) {
    if (!Number.isFinite(v)) {
      return "--";
    }

    if (Math.abs(v) >= 1000 || Math.abs(v) < 1e-3) {
      return v.toExponential(2);
    }

    return v.toFixed(4);
  }

  function updateMetrics(stats) {
    metricOrder.forEach((key) => {
      metricsEls[key].textContent = formatMetric(stats[key]);
    });
  }

  function render() {
    drawFlowField();
    drawObjects();
  }

  function refreshLabels() {
    labels.resolution.textContent = `${controls.resolution.value} x ${controls.resolution.value}`;
    labels.dt.textContent = Number(controls.dt.value).toFixed(3);
    labels.substeps.textContent = controls.substeps.value;
    labels.viscosity.textContent = Number(controls.viscosity.value).toExponential(2);
    labels.diffusion.textContent = Number(controls.diffusion.value).toExponential(2);
    labels.inflow.textContent = Number(controls.inflow.value).toFixed(2);
    labels.buoyancy.textContent = Number(controls.buoyancy.value).toFixed(2);
    labels.confinement.textContent = Number(controls.confinement.value).toFixed(2);
    labels.gain.textContent = Number(controls.gain.value).toFixed(2);
    labels.size.textContent = `${controls.size.value}%`;
    labels.angle.textContent = `${controls.angle.value} deg`;
    labels.thickness.textContent = `${controls.thickness.value}%`;
    labels.camber.textContent = `${controls.camber.value}%`;
    labels.camberPos.textContent = `${controls.camberPos.value}%`;
  }

  function setupControls() {
    const sliderKeys = [
      "resolution", "dt", "substeps", "viscosity", "diffusion", "inflow", "buoyancy",
      "confinement", "gain", "size", "angle", "thickness", "camber", "camberPos"
    ];

    sliderKeys.forEach((key) => {
      controls[key].addEventListener("input", () => {
        refreshLabels();
      });
    });

    controls.resolution.addEventListener("change", () => {
      sim.N = parseInt(controls.resolution.value, 10);
      allocateFields();
      updateSolidMask();
    });

    controls.dt.addEventListener("input", () => {
      sim.dt = parseFloat(controls.dt.value);
    });

    controls.substeps.addEventListener("input", () => {
      sim.substeps = parseInt(controls.substeps.value, 10);
    });

    controls.viscosity.addEventListener("input", () => {
      sim.viscosity = parseFloat(controls.viscosity.value);
    });

    controls.diffusion.addEventListener("input", () => {
      sim.diffusion = parseFloat(controls.diffusion.value);
    });

    controls.inflow.addEventListener("input", () => {
      sim.inflow = parseFloat(controls.inflow.value);
    });

    controls.buoyancy.addEventListener("input", () => {
      sim.buoyancy = parseFloat(controls.buoyancy.value);
    });

    controls.confinement.addEventListener("input", () => {
      sim.confinement = parseFloat(controls.confinement.value);
    });

    controls.gain.addEventListener("input", () => {
      sim.gain = parseFloat(controls.gain.value);
    });

    controls.palette.addEventListener("change", () => {
      setPalette(controls.palette.value);
    });

    controls.objectType.addEventListener("change", () => {
      const selected = selectedObject();
      if (selected && controls.toolMode.value === "drag") {
        selected.type = controls.objectType.value;
        if (isAirfoilType(selected.type)) {
          const n = nacaFromType(selected.type);
          selected.camber = n.m;
          selected.camberPos = n.p;
          selected.thickness = n.t;
        }
      }
    });

    [controls.size, controls.angle, controls.thickness, controls.camber, controls.camberPos].forEach((el) => {
      el.addEventListener("input", () => {
        syncSelectedFromControls();
      });
    });

    controls.pauseBtn.addEventListener("click", () => {
      state.running = !state.running;
      controls.pauseBtn.textContent = state.running ? "Pause" : "Resume";
    });

    controls.resetBtn.addEventListener("click", () => {
      allocateFields();
      updateSolidMask();
    });

    controls.removeSelected.addEventListener("click", () => {
      removeSelectedObject();
    });

    controls.clearObjects.addEventListener("click", () => {
      objects.length = 0;
      state.selectedObjectId = null;
      objectReadout.textContent = "Objects: 0";
      updateSolidMask();
    });

    refreshLabels();
  }

  function loop(nowMs) {
    if (!loop.lastMs) {
      loop.lastMs = nowMs;
    }

    const dt = Math.min(0.05, (nowMs - loop.lastMs) / 1000);
    loop.lastMs = nowMs;
    state.frameDt = dt;

    const fpsInst = dt > 0 ? 1 / dt : 0;
    state.fps = state.fps * (1 - state.fpsSmoothing) + fpsInst * state.fpsSmoothing;

    resizeCanvas();
    stepSimulation(dt);
    render();

    state.statsTick += 1;
    if (state.statsTick % 4 === 0) {
      const stats = computeStats();
      updateMetrics(stats);
      fpsReadout.textContent = `FPS: ${state.fps.toFixed(1)}`;
    }

    requestAnimationFrame(loop);
  }

  Object.keys(paletteStops).forEach((name) => {
    paletteLUT[name] = buildPaletteLUT(paletteStops[name]);
  });

  setPalette(controls.palette.value);
  setupControls();
  setupInteraction();
  allocateFields();
  resizeCanvas();
  updateSolidMask();
  requestAnimationFrame(loop);
})();
