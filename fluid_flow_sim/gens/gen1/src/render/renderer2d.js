import { clamp } from '../util.js';
import { sampleColormap } from './colormaps.js';

export class Renderer2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    this.cmap = 'turbo';
    this.autoScale = true;
    this.fixedMin = -1;
    this.fixedMax = 1;

    this.showVectors = false;

    this._image = null;
    this._imageData = null;
  }

  setColormap(name) {
    this.cmap = name;
  }

  setAutoScale(on) {
    this.autoScale = on;
  }

  setShowVectors(on) {
    this.showVectors = on;
  }

  ensureSize(w, h) {
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  renderScalarField({ field, n, mask = null, overlayVectors = null, overlayFn = null, label = '' }) {
    // field is Float32Array length n*n.
    const w = this.canvas.width;
    const h = this.canvas.height;

    const pxW = n;
    const pxH = n;

    if (!this._imageData || this._imageData.width !== pxW || this._imageData.height !== pxH) {
      this._imageData = this.ctx.createImageData(pxW, pxH);
    }

    let min = Infinity;
    let max = -Infinity;
    if (this.autoScale) {
      for (let i = 0; i < field.length; i++) {
        if (mask && mask[i]) continue;
        const v = field[i];
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
        min = -1;
        max = 1;
      }
    } else {
      min = this.fixedMin;
      max = this.fixedMax;
      if (min === max) { min -= 1; max += 1; }
    }

    const inv = 1 / (max - min);
    const data = this._imageData.data;

    for (let y = 0; y < pxH; y++) {
      for (let x = 0; x < pxW; x++) {
        const id = x + y * pxW;
        const off = id * 4;

        if (mask && mask[id]) {
          data[off + 0] = 14;
          data[off + 1] = 14;
          data[off + 2] = 18;
          data[off + 3] = 255;
          continue;
        }

        let v = field[id];
        if (!Number.isFinite(v)) v = 0;
        const t = clamp((v - min) * inv, 0, 1);
        const [r, g, b] = sampleColormap(this.cmap, t);
        data[off + 0] = r;
        data[off + 1] = g;
        data[off + 2] = b;
        data[off + 3] = 255;
      }
    }

    // Draw to canvas with smoothing off (pixel-art) then scale up.
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = true;

    // Draw into an offscreen temporary canvas by putImageData then drawImage scaled
    const tmp = document.createElement('canvas');
    tmp.width = pxW;
    tmp.height = pxH;
    const tctx = tmp.getContext('2d', { alpha: false });
    tctx.putImageData(this._imageData, 0, 0);

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(tmp, 0, 0, w, h);

    if (overlayFn) {
      overlayFn(this.ctx, { w, h, n, min, max, label });
    }

    if (this.showVectors && overlayVectors) {
      this.drawVectors(overlayVectors, { w, h, n });
    }

    this.ctx.restore();

    return { min, max };
  }

  drawVectors({ u, v }, { w, h, n }) {
    const ctx = this.ctx;
    const stride = Math.max(6, Math.floor(n / 24));

    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;

    for (let j = 0; j < n; j += stride) {
      for (let i = 0; i < n; i += stride) {
        const id = i + j * n;
        const vx = u[id];
        const vy = v[id];
        const x = (i + 0.5) * (w / n);
        const y = (j + 0.5) * (h / n);
        const s = 0.06 * (w / n);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx * s, y + vy * s);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
