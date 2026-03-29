import { clamp, norm2 } from "../math.js";

export function computeFrictionCoefficient(re, model) {
  const Re = Math.max(re, 1e-4);
  switch (model) {
    case "blasius":
      return Re < 5e5 ? 1.328 / Math.sqrt(Re) : 0.074 / Math.pow(Re, 0.2);
    case "ittc57": {
      const lg = Math.log10(Math.max(Re, 10));
      const denom = Math.max((lg - 2) * (lg - 2), 1e-6);
      return 0.075 / denom;
    }
    case "schlichting":
      return Re < 5e5
        ? 1.328 / Math.sqrt(Re)
        : 0.455 / Math.pow(Math.log10(Math.max(Re, 10)), 2.58);
    default:
      return 0.003;
  }
}

export function computeHeatTransferStanton(cf, pr) {
  const Pr = Math.max(pr, 0.2);
  return 0.5 * cf / Math.pow(Pr, 2 / 3);
}

export function computeEddyViscosity(grid, solverMode, baseNu) {
  const nx = grid.nx;
  const ny = grid.ny;
  const eddy = new Float32Array(nx * ny);

  if (solverMode === "projection") {
    return eddy;
  }

  const h = Math.sqrt(grid.dx * grid.dy);
  const cs = solverMode === "vorticityProjection" ? 0.16 : 0.22;

  for (let j = 1; j < ny - 1; j += 1) {
    for (let i = 1; i < nx - 1; i += 1) {
      const c = grid.c(i, j);
      if (grid.cellType[c] !== 0) {
        continue;
      }

      const duDx = (grid.u[grid.uIdx(i + 1, j)] - grid.u[grid.uIdx(i - 1, j)]) * 0.5 * grid.invDx;
      const dvDy = (grid.v[grid.vIdx(i, j + 1)] - grid.v[grid.vIdx(i, j - 1)]) * 0.5 * grid.invDy;

      const duDy = (
        (grid.u[grid.uIdx(i, j + 1)] - grid.u[grid.uIdx(i, j - 1)]) +
        (grid.u[grid.uIdx(i + 1, j + 1)] - grid.u[grid.uIdx(i + 1, j - 1)])
      ) * 0.25 * grid.invDy;

      const dvDx = (
        (grid.v[grid.vIdx(i + 1, j)] - grid.v[grid.vIdx(i - 1, j)]) +
        (grid.v[grid.vIdx(i + 1, j + 1)] - grid.v[grid.vIdx(i - 1, j + 1)])
      ) * 0.25 * grid.invDx;

      const s2 = 2 * duDx * duDx + 2 * dvDy * dvDy + (duDy + dvDx) * (duDy + dvDx);
      const sMag = Math.sqrt(Math.max(s2, 0));

      let mix = cs * h;
      if (solverMode === "boundaryLayerRans") {
        const yWall = Math.min((j + 0.5) * grid.dy, (ny - j - 0.5) * grid.dy);
        mix *= 1 - Math.exp(-yWall / (4 * h));
      }

      eddy[c] = mix * mix * sMag;

      if (solverMode === "boundaryLayerRans") {
        eddy[c] = clamp(eddy[c], 0, baseNu * 300);
      }
    }
  }

  return eddy;
}

function boundaryLayerScales(x, reX, turbulent) {
  if (!turbulent) {
    return {
      delta: 5.0 * x / Math.sqrt(Math.max(reX, 1e-6)),
      deltaStar: 1.72 * x / Math.sqrt(Math.max(reX, 1e-6)),
      theta: 0.664 * x / Math.sqrt(Math.max(reX, 1e-6))
    };
  }

  return {
    delta: 0.37 * x / Math.pow(Math.max(reX, 1e-6), 0.2),
    deltaStar: 0.046 * x / Math.pow(Math.max(reX, 1e-6), 0.2),
    theta: 0.036 * x / Math.pow(Math.max(reX, 1e-6), 0.2)
  };
}

function bodyCharacteristicLength(body) {
  switch (body.type) {
    case "sphere":
    case "cylinder":
      return Math.max(body.sizeA * 2, 1e-4);
    case "flatPlate":
      return Math.max(body.sizeA * 2, 1e-4);
    case "airfoil":
      return Math.max(body.sizeA * 2, 1e-4);
    case "rectangle":
      return Math.max(body.sizeA * 2, 1e-4);
    default:
      return Math.max(body.sizeA * 2, 1e-4);
  }
}

export function estimateBoundaryLayersForBody(body, uInfX, uInfY, nu, sampleCount = 80) {
  const speedInf = norm2(uInfX, uInfY);
  const L = bodyCharacteristicLength(body);
  const reL = Math.max(speedInf * L / Math.max(nu, 1e-9), 1);

  const points = new Array(sampleCount);
  const metrics = new Array(sampleCount);
  const turbulentTransition = 5e5;

  for (let k = 0; k < sampleCount; k += 1) {
    const t = k / (sampleCount - 1 || 1);
    const theta = t * Math.PI * 2;

    const localRadiusX = Math.max(body.sizeA, 0.005);
    const localRadiusY = Math.max(body.sizeB, 0.003);

    const pxLocal = Math.cos(theta) * localRadiusX;
    const pyLocal = Math.sin(theta) * localRadiusY;

    const ca = Math.cos(body.angle);
    const sa = Math.sin(body.angle);
    const px = body.x + pxLocal * ca - pyLocal * sa;
    const py = body.y + pxLocal * sa + pyLocal * ca;

    const xAlong = t * L;
    const reX = Math.max(speedInf * xAlong / Math.max(nu, 1e-9), 1);
    const turbulent = reX > turbulentTransition || reL > turbulentTransition;
    const bl = boundaryLayerScales(Math.max(xAlong, L * 0.01), reX, turbulent);

    points[k] = { x: px, y: py };
    metrics[k] = bl;
  }

  return { points, metrics, reL };
}
