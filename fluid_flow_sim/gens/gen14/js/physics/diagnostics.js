import { computeFrictionCoefficient, computeHeatTransferStanton, estimateBoundaryLayersForBody } from "./models.js";
import { norm2, safeDiv } from "../math.js";
import { CELL_SOLID } from "./grid.js";

function sdfNormal(body, x, y, eps) {
  const dx = body.sdf(x + eps, y) - body.sdf(x - eps, y);
  const dy = body.sdf(x, y + eps) - body.sdf(x, y - eps);
  const invLen = 1 / Math.max(Math.hypot(dx, dy), 1e-8);
  return { x: dx * invLen, y: dy * invLen };
}

export class DiagnosticsEngine {
  constructor() {
    this.boundaryLayerData = new Map();
    this.bodyForces = new Map();
  }

  updateVorticityAndDivergence(grid) {
    const nx = grid.nx;
    const ny = grid.ny;
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = grid.c(i, j);

        const uR = grid.u[grid.uIdx(i + 1, j)];
        const uL = grid.u[grid.uIdx(i, j)];
        const vT = grid.v[grid.vIdx(i, j + 1)];
        const vB = grid.v[grid.vIdx(i, j)];

        grid.divergence[c] = (uR - uL) * grid.invDx + (vT - vB) * grid.invDy;

        const duDy = (
          (j < ny - 1 ? (grid.u[grid.uIdx(i, j + 1)] + grid.u[grid.uIdx(i + 1, j + 1)]) : (uL + uR)) -
          (j > 0 ? (grid.u[grid.uIdx(i, j - 1)] + grid.u[grid.uIdx(i + 1, j - 1)]) : (uL + uR))
        ) * 0.25 * grid.invDy;

        const dvDx = (
          (i < nx - 1 ? (grid.v[grid.vIdx(i + 1, j)] + grid.v[grid.vIdx(i + 1, j + 1)]) : (vB + vT)) -
          (i > 0 ? (grid.v[grid.vIdx(i - 1, j)] + grid.v[grid.vIdx(i - 1, j + 1)]) : (vB + vT))
        ) * 0.25 * grid.invDx;

        grid.vorticity[c] = dvDx - duDy;
      }
    }
  }

  computeBodyForces(grid, body, params) {
    const eps = Math.max(grid.dx, grid.dy) * 0.5;
    const bb = body.boundingBox();
    const iMin = Math.max((bb.minX * grid.invDx) | 0, 1);
    const iMax = Math.min((bb.maxX * grid.invDx) | 0, grid.nx - 2);
    const jMin = Math.max((bb.minY * grid.invDy) | 0, 1);
    const jMax = Math.min((bb.maxY * grid.invDy) | 0, grid.ny - 2);

    let fx = 0;
    let fy = 0;
    let tauAccum = 0;
    let wallSamples = 0;

    for (let j = jMin; j <= jMax; j += 1) {
      for (let i = iMin; i <= iMax; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          continue;
        }

        const x = grid.cellCenterX(i);
        const y = grid.cellCenterY(j);
        const d = body.sdf(x, y);
        if (Math.abs(d) > eps * 1.2) {
          continue;
        }

        const n = sdfNormal(body, x, y, eps * 0.5);
        const area = grid.dx * grid.dy;
        const p = grid.pressure[c];

        const ux = 0.5 * (grid.u[grid.uIdx(i, j)] + grid.u[grid.uIdx(i + 1, j)]);
        const uy = 0.5 * (grid.v[grid.vIdx(i, j)] + grid.v[grid.vIdx(i, j + 1)]);

        const bVel = body.velocityAt(x, y);
        const relX = ux - bVel.x;
        const relY = uy - bVel.y;

        const tangX = -n.y;
        const tangY = n.x;
        const relTang = relX * tangX + relY * tangY;

        const tauW = params.rho * params.nu * relTang / Math.max(eps, 1e-6);
        tauAccum += Math.abs(tauW);
        wallSamples += 1;

        fx += (-p * n.x + tauW * tangX) * area;
        fy += (-p * n.y + tauW * tangY) * area;
      }
    }

    return {
      drag: fx,
      lift: fy,
      tauW: wallSamples > 0 ? tauAccum / wallSamples : 0
    };
  }

  compute(globalState) {
    const { grid, bodies, flow, sim } = globalState;
    const uxInf = flow.uxInf;
    const uyInf = flow.uyInf;
    const uInf = norm2(uxInf, uyInf);
    const charLength = Math.max(
      bodies.bodies.length > 0
        ? Math.max(...bodies.bodies.map((b) => Math.max(b.sizeA, b.sizeB) * 2))
        : 1,
      1e-4
    );

    const re = Math.max(uInf * charLength / Math.max(sim.viscosity, 1e-9), 1);
    const cf = computeFrictionCoefficient(re, sim.frictionModel);
    const st = computeHeatTransferStanton(cf, sim.prandtl);
    const fr = safeDiv(uInf, Math.sqrt(Math.max(sim.gravity * charLength, 1e-8)));
    const mach = safeDiv(uInf, 343.0);

    let drag = 0;
    let lift = 0;
    let tauW = 0;
    this.boundaryLayerData.clear();
    this.bodyForces.clear();

    for (let i = 0; i < bodies.bodies.length; i += 1) {
      const body = bodies.bodies[i];
      const force = this.computeBodyForces(grid, body, {
        rho: sim.density,
        nu: sim.viscosity
      });

      drag += force.drag;
      lift += force.lift;
      tauW += force.tauW;

      this.bodyForces.set(body.id, force);

      const bl = estimateBoundaryLayersForBody(body, uxInf, uyInf, sim.viscosity, 72);
      this.boundaryLayerData.set(body.id, bl);
    }

    const courant = uInf * sim.lastDt / Math.max(grid.dx, grid.dy);

    return {
      drag,
      lift,
      cf,
      tauW: bodies.bodies.length ? tauW / bodies.bodies.length : tauW,
      re,
      pr: sim.prandtl,
      st,
      fr,
      mach,
      courant
    };
  }
}
