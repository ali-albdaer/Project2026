// overlays.js — 2D canvas overlay for body outlines, boundary layer curves, probe display

export class Overlays {
    constructor() {
        /** @type {CanvasRenderingContext2D} */
        this.ctx = null;
        this.canvas = null;
        this.showBodies = true;
        this.showBLDelta = false;
        this.showBLDeltaStar = false;
        this.showBLTheta = false;
        this.selectedBodyId = -1;
    }

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render all overlays.
     * @param {import('../physics/bodies.js').Body[]} bodies
     * @param {Array} blProfiles - boundary layer profiles
     * @param {number} simW - simulation width
     * @param {number} simH - simulation height
     */
    render(bodies, blProfiles, simW, simH) {
        this.clear();
        const ctx = this.ctx;
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        if (this.showBodies) {
            this._drawBodyOutlines(ctx, bodies, cw, ch);
        }

        if ((this.showBLDelta || this.showBLDeltaStar || this.showBLTheta) && blProfiles.length > 0) {
            this._drawBoundaryLayers(ctx, blProfiles, cw, ch);
        }
    }

    _drawBodyOutlines(ctx, bodies, cw, ch) {
        for (const body of bodies) {
            const isSelected = body.id === this.selectedBodyId;
            ctx.strokeStyle = isSelected ? '#4a9eff' : 'rgba(200, 200, 220, 0.4)';
            ctx.lineWidth = isSelected ? 2 : 1;

            const cx = body.x * cw;
            const cy = (1 - body.y) * ch; // flip Y for canvas
            const aspect = cw / ch;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-body.rotation);

            const p = body.params;
            const sx = cw; // scale factor
            const sy = ch;

            switch (body.type) {
                case 'CIRCLE':
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.radius * sx, p.radius * sy, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'ELLIPSE':
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.rx * sx, p.ry * sy, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'RECTANGLE':
                case 'FLAT_PLATE':
                    const rw = (p.width || p.length) * sx;
                    const rh = (p.height || p.thickness) * sy;
                    ctx.strokeRect(-rw/2, -rh/2, rw, rh);
                    break;
                case 'ROUNDED_RECT': {
                    const rrw = p.width * sx, rrh = p.height * sy, cr = p.cornerR * Math.min(sx,sy);
                    this._roundedRect(ctx, -rrw/2, -rrh/2, rrw, rrh, cr);
                    ctx.stroke();
                    break;
                }
                case 'AIRFOIL':
                case 'BICONVEX': {
                    ctx.beginPath();
                    const chord = (p.chord || 0.15) * sx;
                    const nPts = 40;
                    for (let side = 0; side < 2; side++) {
                        for (let i = 0; i <= nPts; i++) {
                            const t = i / nPts;
                            const x = t;
                            let yt;
                            if (body.type === 'AIRFOIL') {
                                yt = 5 * p.thickness * (
                                    0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*x*x
                                    + 0.2843*x*x*x - 0.1015*x*x*x*x
                                );
                                const yc = this._camber(x, p.camber || 0, p.camberPos || 0.4);
                                const py = side === 0 ? yc + yt : yc - yt;
                                const px = (x - 0.5) * chord;
                                const pyc = -py * chord;
                                if (i === 0 && side === 0) ctx.moveTo(px, pyc);
                                else ctx.lineTo(px, pyc);
                            } else {
                                yt = 2 * p.thickness * x * (1 - x);
                                const py = side === 0 ? yt : -yt;
                                const px = (x - 0.5) * chord;
                                const pyc = -py * chord;
                                if (i === 0 && side === 0) ctx.moveTo(px, pyc);
                                else ctx.lineTo(px, pyc);
                            }
                        }
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                case 'TRIANGLE': {
                    const b2 = p.base * sx / 2;
                    const th = p.height * sy;
                    ctx.beginPath();
                    ctx.moveTo(0, -th * 2/3);
                    ctx.lineTo(b2, th / 3);
                    ctx.lineTo(-b2, th / 3);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                case 'HEXAGON': {
                    const r = p.radius * Math.min(sx, sy);
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const a = (Math.PI / 3) * i - Math.PI / 6;
                        const hx = r * Math.cos(a), hy = r * Math.sin(a);
                        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                case 'SEMICIRCLE': {
                    const sr = p.radius * Math.min(sx, sy);
                    ctx.beginPath();
                    ctx.arc(0, 0, sr, 0, Math.PI);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                case 'DIAMOND': {
                    const dw = p.width * sx / 2, dh = p.height * sy / 2;
                    ctx.beginPath();
                    ctx.moveTo(0, -dh); ctx.lineTo(dw, 0);
                    ctx.lineTo(0, dh); ctx.lineTo(-dw, 0);
                    ctx.closePath();
                    ctx.stroke();
                    break;
                }
                default: {
                    // Generic circle fallback
                    const rad = (p.radius || 0.05) * Math.min(sx, sy);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rad, rad, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }
    }

    _drawBoundaryLayers(ctx, profiles, cw, ch) {
        if (profiles.length < 2) return;

        const drawCurve = (key, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            for (let i = 0; i < profiles.length; i++) {
                const p = profiles[i];
                const x = p.x * cw;
                const y = (1 - p.y - p[key]) * ch;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            // Mirror (bottom side)
            ctx.beginPath();
            for (let i = 0; i < profiles.length; i++) {
                const p = profiles[i];
                const x = p.x * cw;
                const y = (1 - p.y + p[key]) * ch;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        };

        if (this.showBLDelta)     drawCurve('delta',     'rgba(100, 220, 100, 0.7)');
        if (this.showBLDeltaStar) drawCurve('deltaStar', 'rgba(255, 180, 50, 0.7)');
        if (this.showBLTheta)     drawCurve('theta',     'rgba(100, 180, 255, 0.7)');
    }

    _camber(x, m, pp) {
        if (m < 0.001) return 0;
        if (x < pp) return m / (pp * pp) * (2 * pp * x - x * x);
        return m / ((1-pp)*(1-pp)) * ((1 - 2*pp) + 2*pp*x - x*x);
    }

    _roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}
