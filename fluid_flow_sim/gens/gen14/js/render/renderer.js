import { clamp, norm2 } from "../math.js";
import { sampleColormap } from "./colormaps.js";
import { CELL_SOLID } from "../physics/grid.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

    this.scalarCanvas = document.createElement("canvas");
    this.scalarCtx = this.scalarCanvas.getContext("2d", { alpha: false });
    this.imageData = null;

    this.viewWidth = 1;
    this.viewHeight = 1;
    this.resizeToDisplay();

    window.addEventListener("resize", () => this.resizeToDisplay());
  }

  resizeToDisplay() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    this.viewWidth = Math.max(1, Math.floor(rect.width * dpr));
    this.viewHeight = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== this.viewWidth || this.canvas.height !== this.viewHeight) {
      this.canvas.width = this.viewWidth;
      this.canvas.height = this.viewHeight;
    }
  }

  ensureScalarBuffer(nx, ny) {
    if (this.scalarCanvas.width === nx && this.scalarCanvas.height === ny && this.imageData) {
      return;
    }

    this.scalarCanvas.width = nx;
    this.scalarCanvas.height = ny;
    this.imageData = this.scalarCtx.createImageData(nx, ny);
  }

  fieldValue(grid, i, j, field) {
    const c = grid.c(i, j);
    switch (field) {
      case "pressure":
        return grid.pressure[c];
      case "vorticity":
        return grid.vorticity[c];
      case "divergence":
        return grid.divergence[c];
      case "temperature":
        return grid.temperature[c];
      case "speed":
      default: {
        const ux = 0.5 * (grid.u[grid.uIdx(i, j)] + grid.u[grid.uIdx(i + 1, j)]);
        const vy = 0.5 * (grid.v[grid.vIdx(i, j)] + grid.v[grid.vIdx(i, j + 1)]);
        return norm2(ux, vy);
      }
    }
  }

  computeRange(grid, field) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let j = 0; j < grid.ny; j += 1) {
      for (let i = 0; i < grid.nx; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID && field !== "pressure") {
          continue;
        }

        const v = this.fieldValue(grid, i, j, field);
        if (v < min) {
          min = v;
        }
        if (v > max) {
          max = v;
        }
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 1 };
    }

    if (Math.abs(max - min) < 1e-8) {
      max = min + 1;
    }

    return { min, max };
  }

  drawScalarField(state) {
    const { grid, visual } = state;
    this.ensureScalarBuffer(grid.nx, grid.ny);

    const field = visual.displayField;
    const palette = visual.colormap;
    const range = this.computeRange(grid, field);
    const inv = 1 / (range.max - range.min);

    const px = this.imageData.data;
    let p = 0;

    for (let j = grid.ny - 1; j >= 0; j -= 1) {
      for (let i = 0; i < grid.nx; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          px[p] = 20;
          px[p + 1] = 25;
          px[p + 2] = 34;
          px[p + 3] = 255;
          p += 4;
          continue;
        }

        const v = this.fieldValue(grid, i, j, field);
        const t = clamp((v - range.min) * inv, 0, 1);
        const col = sampleColormap(palette, t);

        px[p] = col[0];
        px[p + 1] = col[1];
        px[p + 2] = col[2];
        px[p + 3] = 255;
        p += 4;
      }
    }

    this.scalarCtx.putImageData(this.imageData, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.scalarCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  worldToScreen(x, y) {
    return {
      x: x * this.canvas.width,
      y: (1 - y) * this.canvas.height
    };
  }

  drawBodies(state) {
    const { bodies } = state;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = Math.max(1.2, this.canvas.width * 0.0012);
    ctx.strokeStyle = "rgba(245,245,242,0.95)";
    ctx.fillStyle = "rgba(14, 22, 34, 0.35)";

    for (let i = 0; i < bodies.bodies.length; i += 1) {
      const b = bodies.bodies[i];
      const p = this.worldToScreen(b.x, b.y);
      const rx = b.sizeA * this.canvas.width;
      const ry = b.sizeB * this.canvas.height;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-b.angle);

      if (b.type === "sphere" || b.type === "cylinder") {
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
      } else if (b.type === "rectangle") {
        ctx.beginPath();
        ctx.rect(-rx, -ry, 2 * rx, 2 * ry);
      } else if (b.type === "flatPlate") {
        const t = Math.max(ry * 0.2, 2);
        ctx.beginPath();
        ctx.rect(-rx, -t, 2 * rx, 2 * t);
      } else if (b.type === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0, -ry);
        ctx.lineTo(rx, 0);
        ctx.lineTo(0, ry);
        ctx.lineTo(-rx, 0);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.moveTo(-rx, 0);
        ctx.quadraticCurveTo(-0.2 * rx, -0.45 * ry, rx, 0);
        ctx.quadraticCurveTo(-0.2 * rx, 0.45 * ry, -rx, 0);
        ctx.closePath();
      }

      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  drawVectors(state) {
    const { grid } = state;
    const step = Math.max(6, (grid.nx / 40) | 0);
    const ctx = this.ctx;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;

    for (let j = 0; j < grid.ny; j += step) {
      for (let i = 0; i < grid.nx; i += step) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          continue;
        }

        const x = grid.cellCenterX(i);
        const y = grid.cellCenterY(j);
        const ux = 0.5 * (grid.u[grid.uIdx(i, j)] + grid.u[grid.uIdx(i + 1, j)]);
        const vy = 0.5 * (grid.v[grid.vIdx(i, j)] + grid.v[grid.vIdx(i, j + 1)]);

        const p0 = this.worldToScreen(x, y);
        const p1 = this.worldToScreen(x + ux * 0.01, y + vy * 0.01);

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawBoundaryLayers(state, diagnostics) {
    const { visual } = state;
    const showAny = visual.showDelta || visual.showDeltaStar || visual.showTheta;
    if (!showAny) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();

    diagnostics.boundaryLayerData.forEach((entry) => {
      const { points, metrics } = entry;

      if (visual.showDelta) {
        this.drawLayerLine(ctx, points, metrics, "delta", "rgba(255, 224, 102, 0.9)");
      }
      if (visual.showDeltaStar) {
        this.drawLayerLine(ctx, points, metrics, "deltaStar", "rgba(100, 245, 201, 0.9)");
      }
      if (visual.showTheta) {
        this.drawLayerLine(ctx, points, metrics, "theta", "rgba(255, 131, 141, 0.9)");
      }
    });

    ctx.restore();
  }

  drawLayerLine(ctx, points, metrics, key, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const m = metrics[i][key];
      const nx = points[(i + 1) % points.length].y - points[(i - 1 + points.length) % points.length].y;
      const ny = -(points[(i + 1) % points.length].x - points[(i - 1 + points.length) % points.length].x);
      const l = Math.hypot(nx, ny) || 1;
      const sx = p.x + (nx / l) * m;
      const sy = p.y + (ny / l) * m;

      const s = this.worldToScreen(sx, sy);
      if (i === 0) {
        ctx.moveTo(s.x, s.y);
      } else {
        ctx.lineTo(s.x, s.y);
      }
    }

    ctx.closePath();
    ctx.stroke();
  }

  render(state, diagnostics) {
    this.resizeToDisplay();
    this.drawScalarField(state);
    this.drawBodies(state);

    if (state.visual.showVectors) {
      this.drawVectors(state);
    }

    this.drawBoundaryLayers(state, diagnostics);
  }
}
