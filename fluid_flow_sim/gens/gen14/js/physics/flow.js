import { compileScalarFieldExpression } from "../math.js";

export class FlowController {
  constructor(exprX, exprY) {
    this.setExpressions(exprX, exprY);
    this.uxInf = 1;
    this.uyInf = 0;
  }

  setExpressions(exprX, exprY) {
    this.exprX = exprX;
    this.exprY = exprY;
    this.fx = compileScalarFieldExpression(exprX, 1);
    this.fy = compileScalarFieldExpression(exprY, 0);
  }

  sampleFreestream(t) {
    let ux = 0;
    let uy = 0;
    const n = 8;

    for (let k = 0; k < n; k += 1) {
      const y = (k + 0.5) / n;
      ux += this.fx(0, y, t);
      uy += this.fy(0, y, t);
    }

    this.uxInf = ux / n;
    this.uyInf = uy / n;
  }

  applyInlet(grid, t) {
    this.sampleFreestream(t);
    grid.setInletFromFunctions(this.fx, this.fy, t);

    for (let j = 0; j < grid.ny; j += 1) {
      const y = (j + 0.5) * grid.dy;
      const target = this.fx(0.02, y, t);
      for (let i = 0; i < 3; i += 1) {
        const idx = grid.uIdx(i, j);
        grid.u[idx] = 0.85 * grid.u[idx] + 0.15 * target;
      }
    }
  }
}
