import { METRIC_KEYS } from "../config.js";

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export class ControlPanel {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;

    this.el = {
      panel: document.getElementById("leftPanel"),
      panelToggle: document.getElementById("panelToggle"),
      resolution: document.getElementById("resolution"),
      resolutionReadout: document.getElementById("resolutionReadout"),
      primarySolver: document.getElementById("primarySolver"),
      pressureSolver: document.getElementById("pressureSolver"),
      frictionModel: document.getElementById("frictionModel"),
      assumeIncompressible: document.getElementById("assumeIncompressible"),
      assumeBoussinesq: document.getElementById("assumeBoussinesq"),
      assumeInviscidCore: document.getElementById("assumeInviscidCore"),
      assumeNoSlip: document.getElementById("assumeNoSlip"),
      uExprX: document.getElementById("uExprX"),
      uExprY: document.getElementById("uExprY"),
      temperature: document.getElementById("temperature"),
      viscosity: document.getElementById("viscosity"),
      density: document.getElementById("density"),
      prandtl: document.getElementById("prandtl"),
      gravity: document.getElementById("gravity"),
      bodyType: document.getElementById("bodyType"),
      bodySizeA: document.getElementById("bodySizeA"),
      bodySizeB: document.getElementById("bodySizeB"),
      bodyAngle: document.getElementById("bodyAngle"),
      bodyMass: document.getElementById("bodyMass"),
      spawnArmed: document.getElementById("spawnArmed"),
      spawnBody: document.getElementById("spawnBody"),
      dragBodies: document.getElementById("dragBodies"),
      bodyList: document.getElementById("bodyList"),
      removeBody: document.getElementById("removeBody"),
      displayField: document.getElementById("displayField"),
      colorMap: document.getElementById("colorMap"),
      probeEnabled: document.getElementById("probeEnabled"),
      showDelta: document.getElementById("showDelta"),
      showDeltaStar: document.getElementById("showDeltaStar"),
      showTheta: document.getElementById("showTheta"),
      showVectors: document.getElementById("showVectors"),
      metricGrid: document.getElementById("metricGrid")
    };

    this.panelVisible = true;
    this.metricNodeMap = new Map();
    this.createPanelHandle();
    this.createMetricSlots();
    this.bindGroupToggles();
    this.bindInputs();
    this.applyStateToControls();
  }

  createPanelHandle() {
    this.panelHandle = document.createElement("button");
    this.panelHandle.type = "button";
    this.panelHandle.textContent = "Menu";
    this.panelHandle.className = "small-btn";
    this.panelHandle.style.position = "fixed";
    this.panelHandle.style.left = "10px";
    this.panelHandle.style.top = "10px";
    this.panelHandle.style.zIndex = "20";
    this.panelHandle.style.display = "none";
    document.body.appendChild(this.panelHandle);

    this.panelHandle.addEventListener("click", () => this.togglePanel());
    this.el.panelToggle.addEventListener("click", () => this.togglePanel());
  }

  bindGroupToggles() {
    const groups = Array.from(document.querySelectorAll(".group"));
    groups.forEach((group) => {
      const title = group.querySelector(".group-title");
      const body = group.querySelector(".group-body");
      title.addEventListener("click", () => {
        body.classList.toggle("hidden");
      });
    });
  }

  bindInputs() {
    const e = this.el;

    e.resolution.addEventListener("input", () => {
      const value = toNum(e.resolution.value, 256) | 0;
      e.resolutionReadout.textContent = String(value);
    });

    e.resolution.addEventListener("change", () => {
      const value = toNum(e.resolution.value, 256) | 0;
      this.handlers.onResolutionChange(value);
    });

    e.primarySolver.addEventListener("change", () => {
      this.state.sim.primarySolver = e.primarySolver.value;
    });
    e.pressureSolver.addEventListener("change", () => {
      this.state.sim.pressureSolver = e.pressureSolver.value;
    });
    e.frictionModel.addEventListener("change", () => {
      this.state.sim.frictionModel = e.frictionModel.value;
    });

    e.assumeIncompressible.addEventListener("change", () => {
      this.state.sim.strictIncompressible = e.assumeIncompressible.checked;
    });
    e.assumeBoussinesq.addEventListener("change", () => {
      this.state.sim.boussinesq = e.assumeBoussinesq.checked;
    });
    e.assumeInviscidCore.addEventListener("change", () => {
      this.state.sim.inviscidCore = e.assumeInviscidCore.checked;
    });
    e.assumeNoSlip.addEventListener("change", () => {
      this.state.sim.noSlipWalls = e.assumeNoSlip.checked;
    });

    const flowChange = () => {
      this.state.sim.temperature = toNum(e.temperature.value, this.state.sim.temperature);
      this.state.sim.viscosity = Math.max(toNum(e.viscosity.value, this.state.sim.viscosity), 1e-8);
      this.state.sim.density = Math.max(toNum(e.density.value, this.state.sim.density), 0.01);
      this.state.sim.prandtl = Math.max(toNum(e.prandtl.value, this.state.sim.prandtl), 0.1);
      this.state.sim.gravity = Math.max(toNum(e.gravity.value, this.state.sim.gravity), 0.01);
      this.handlers.onFlowExpressionChange(e.uExprX.value, e.uExprY.value);
    };

    e.uExprX.addEventListener("change", flowChange);
    e.uExprY.addEventListener("change", flowChange);
    e.temperature.addEventListener("change", flowChange);
    e.viscosity.addEventListener("change", flowChange);
    e.density.addEventListener("change", flowChange);
    e.prandtl.addEventListener("change", flowChange);
    e.gravity.addEventListener("change", flowChange);

    const bodySpawnChange = () => {
      this.state.bodySpawn.type = e.bodyType.value;
      this.state.bodySpawn.sizeA = Math.max(toNum(e.bodySizeA.value, this.state.bodySpawn.sizeA), 0.003);
      this.state.bodySpawn.sizeB = Math.max(toNum(e.bodySizeB.value, this.state.bodySpawn.sizeB), 0.002);
      this.state.bodySpawn.angleDeg = toNum(e.bodyAngle.value, this.state.bodySpawn.angleDeg);
      this.state.bodySpawn.mass = Math.max(toNum(e.bodyMass.value, this.state.bodySpawn.mass), 0.1);
    };

    e.bodyType.addEventListener("change", bodySpawnChange);
    e.bodySizeA.addEventListener("change", bodySpawnChange);
    e.bodySizeB.addEventListener("change", bodySpawnChange);
    e.bodyAngle.addEventListener("change", bodySpawnChange);
    e.bodyMass.addEventListener("change", bodySpawnChange);

    e.spawnArmed.addEventListener("change", () => {
      this.state.spawnArmed = e.spawnArmed.checked;
    });

    e.spawnBody.addEventListener("click", () => {
      bodySpawnChange();
      this.handlers.onSpawnCenter();
    });

    e.dragBodies.addEventListener("change", () => {
      this.state.dragBodiesEnabled = e.dragBodies.checked;
    });

    e.removeBody.addEventListener("click", () => {
      const selected = e.bodyList.value;
      if (!selected) {
        return;
      }
      this.handlers.onRemoveBody(Number(selected));
    });

    e.displayField.addEventListener("change", () => {
      this.state.visual.displayField = e.displayField.value;
    });
    e.colorMap.addEventListener("change", () => {
      this.state.visual.colormap = e.colorMap.value;
    });

    e.probeEnabled.addEventListener("change", () => {
      this.state.visual.showProbe = e.probeEnabled.checked;
    });
    e.showDelta.addEventListener("change", () => {
      this.state.visual.showDelta = e.showDelta.checked;
    });
    e.showDeltaStar.addEventListener("change", () => {
      this.state.visual.showDeltaStar = e.showDeltaStar.checked;
    });
    e.showTheta.addEventListener("change", () => {
      this.state.visual.showTheta = e.showTheta.checked;
    });
    e.showVectors.addEventListener("change", () => {
      this.state.visual.showVectors = e.showVectors.checked;
    });
  }

  applyStateToControls() {
    const e = this.el;
    const { sim, visual, bodySpawn, flowExpr } = this.state;

    e.resolution.value = String(sim.resolution);
    e.resolutionReadout.textContent = String(sim.resolution);

    e.primarySolver.value = sim.primarySolver;
    e.pressureSolver.value = sim.pressureSolver;
    e.frictionModel.value = sim.frictionModel;

    e.assumeIncompressible.checked = sim.strictIncompressible;
    e.assumeBoussinesq.checked = sim.boussinesq;
    e.assumeInviscidCore.checked = sim.inviscidCore;
    e.assumeNoSlip.checked = sim.noSlipWalls;

    e.uExprX.value = flowExpr.x;
    e.uExprY.value = flowExpr.y;
    e.temperature.value = String(sim.temperature);
    e.viscosity.value = String(sim.viscosity);
    e.density.value = String(sim.density);
    e.prandtl.value = String(sim.prandtl);
    e.gravity.value = String(sim.gravity);

    e.bodyType.value = bodySpawn.type;
    e.bodySizeA.value = String(bodySpawn.sizeA);
    e.bodySizeB.value = String(bodySpawn.sizeB);
    e.bodyAngle.value = String(bodySpawn.angleDeg);
    e.bodyMass.value = String(bodySpawn.mass);

    e.displayField.value = visual.displayField;
    e.colorMap.value = visual.colormap;
    e.probeEnabled.checked = visual.showProbe;
    e.showDelta.checked = visual.showDelta;
    e.showDeltaStar.checked = visual.showDeltaStar;
    e.showTheta.checked = visual.showTheta;
    e.showVectors.checked = visual.showVectors;
  }

  createMetricSlots() {
    METRIC_KEYS.forEach((key) => {
      const row = document.createElement("div");
      row.className = "metric-row";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = key;

      const value = document.createElement("div");
      value.className = "value";
      value.textContent = "0";

      row.appendChild(name);
      row.appendChild(value);
      this.el.metricGrid.appendChild(row);

      this.metricNodeMap.set(key, value);
    });
  }

  updateMetrics(metrics) {
    METRIC_KEYS.forEach((key) => {
      const node = this.metricNodeMap.get(key);
      if (!node) {
        return;
      }
      const v = metrics[key] ?? 0;
      node.textContent = Number.isFinite(v) ? v.toExponential(3) : "0";
    });
  }

  updateBodyList(bodyArray) {
    const list = this.el.bodyList;
    const selectedBefore = list.value;
    list.innerHTML = "";

    bodyArray.forEach((body) => {
      const opt = document.createElement("option");
      opt.value = String(body.id);
      opt.textContent = `${body.id} ${body.type}`;
      list.appendChild(opt);
    });

    if (selectedBefore) {
      list.value = selectedBefore;
    }
  }

  togglePanel() {
    this.panelVisible = !this.panelVisible;

    if (this.panelVisible) {
      this.el.panel.classList.remove("collapsed");
      this.el.panelToggle.textContent = "Hide";
      this.panelHandle.style.display = "none";
    } else {
      this.el.panel.classList.add("collapsed");
      this.panelHandle.style.display = "block";
    }
  }
}
