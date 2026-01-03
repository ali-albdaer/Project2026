import { Utils } from './utils.js';

export class PotentialFlow {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.elements = [];
        this.width = canvas.width;
        this.height = canvas.height;
        this.scale = 50; // pixels per unit
        this.baseScale = 50;
        this.zoom = 1.0;
        this.offsetX = this.width / 2;
        this.offsetY = this.height / 2;
        this.colormapName = 'viridis';
        
        this.config = {
            showStreamlines: true,
            showPotential: false,
            showVelocity: false,
            showGrid: false,
            density: 40
        };
    }

    setZoom(z) {
        this.zoom = z;
        this.scale = this.baseScale * z;
    }

    setColormap(name) {
        this.colormapName = name;
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.offsetX = w / 2;
        this.offsetY = h / 2;
    }

    reset() {
        this.elements = [];
    }

    addElement(type, params = {}) {
        const id = Date.now();
        let element = { id, type, ...params };
        
        // Defaults
        if (type === 'uniform') {
            element.U = params.U || 1;
            element.alpha = params.alpha || 0; // radians
        } else if (type === 'source' || type === 'sink') {
            element.m = params.m || 100; // Strength
            element.x = params.x || 0;
            element.y = params.y || 0;
        } else if (type === 'vortex') {
            element.gamma = params.gamma || 100;
            element.x = params.x || 0;
            element.y = params.y || 0;
        } else if (type === 'doublet') {
            element.kappa = params.kappa || 500;
            element.x = params.x || 0;
            element.y = params.y || 0;
            element.alpha = params.alpha || 0;
        }

        this.elements.push(element);
        return element;
    }

    removeElement(id) {
        this.elements = this.elements.filter(e => e.id !== id);
    }

    loadScenario(name) {
        this.reset();
        if (name === 'uniform') {
            this.addElement('uniform', { U: 1, alpha: 0 });
        } else if (name === 'source_sink') {
            // this.addElement('uniform', { U: 0.5 }); // Removed uniform to make source/sink clearer
            this.addElement('source', { m: 300, x: -2, y: 0 });
            this.addElement('source', { m: -300, x: 2, y: 0 }); // Sink is negative source
        } else if (name === 'cylinder') {
            // Uniform + Doublet
            this.addElement('uniform', { U: 1 });
            this.addElement('doublet', { kappa: 400, x: 0, y: 0 }); // R = sqrt(kappa/U) = 20
        } else if (name === 'rotating_cylinder') {
            this.addElement('uniform', { U: 1 });
            this.addElement('doublet', { kappa: 400, x: 0, y: 0 });
            this.addElement('vortex', { gamma: 500, x: 0, y: 0 });
        } else if (name === 'rankine') {
            this.addElement('uniform', { U: 1 });
            this.addElement('source', { m: 200, x: -2, y: 0 });
            this.addElement('source', { m: -200, x: 2, y: 0 });
        }
    }

    // Calculate Complex Potential w = phi + i*psi at point z = x + iy
    getPotential(x, y) {
        // Convert screen coords to physical coords
        const px = (x - this.offsetX) / this.scale;
        const py = -(y - this.offsetY) / this.scale; // Y is up in math, down in canvas

        let phi = 0;
        let psi = 0;

        for (const el of this.elements) {
            if (el.type === 'uniform') {
                // w = U * z * e^(-i*alpha)
                // z = px + i*py
                // e^(-i*alpha) = cos(-a) + i*sin(-a)
                const cosA = Math.cos(-el.alpha);
                const sinA = Math.sin(-el.alpha);
                const zx = px * cosA - py * sinA;
                const zy = px * sinA + py * cosA;
                phi += el.U * zx;
                psi += el.U * zy;
            } else if (el.type === 'source') {
                // w = (m / 2pi) * ln(z - z0)
                const dx = px - el.x;
                const dy = py - el.y;
                const r = Math.sqrt(dx*dx + dy*dy);
                const theta = Math.atan2(dy, dx);
                const k = el.m / (2 * Math.PI);
                phi += k * Math.log(r);
                psi += k * theta;
            } else if (el.type === 'vortex') {
                // w = (-i * gamma / 2pi) * ln(z - z0)
                // -i * (ln r + i theta) = -i ln r + theta
                const dx = px - el.x;
                const dy = py - el.y;
                const r = Math.sqrt(dx*dx + dy*dy);
                const theta = Math.atan2(dy, dx);
                const k = el.gamma / (2 * Math.PI);
                phi += k * theta;
                psi += -k * Math.log(r);
            } else if (el.type === 'doublet') {
                // w = kappa / (z - z0)
                // 1/(x+iy) = (x-iy)/(x^2+y^2)
                const dx = px - el.x;
                const dy = py - el.y;
                const r2 = dx*dx + dy*dy;
                if (r2 > 0.0001) {
                    phi += el.kappa * dx / r2;
                    psi += el.kappa * (-dy) / r2;
                }
            }
        }
        return { phi, psi };
    }

    getVelocity(x, y) {
        // Numerical differentiation for simplicity, or analytical
        const eps = 1;
        const p1 = this.getPotential(x + eps, y);
        const p2 = this.getPotential(x - eps, y);
        const p3 = this.getPotential(x, y + eps);
        const p4 = this.getPotential(x, y - eps);

        // u = dphi/dx = dpsi/dy
        // v = dphi/dy = -dpsi/dx
        // We use screen coords for display, but need to be careful with signs
        // Let's just use the potential gradient
        const u = (p1.phi - p2.phi) / (2 * eps);
        const v = (p3.phi - p4.phi) / (2 * eps); // Note: Y is inverted in screen
        return { u, v, mag: Math.sqrt(u*u + v*v) };
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const step = 2; // Finer step for better visuals
        const density = this.config.density;
        
        const imgData = this.ctx.createImageData(this.width, this.height);
        const data = imgData.data;

        // Pre-calculate colormap if needed
        // For simplicity, we'll compute color on the fly or use a simple lookup
        // But since we have Utils.getColormapColor, we can use that.

        for (let y = 0; y < this.height; y += step) {
            for (let x = 0; x < this.width; x += step) {
                const pot = this.getPotential(x, y);
                let velMag = 0;
                if (this.config.showVelocity) {
                    const vel = this.getVelocity(x, y);
                    velMag = vel.mag;
                }

                let r = 0, g = 0, b = 0, a = 0;

                // Velocity Map Background
                if (this.config.showVelocity) {
                    // Map magnitude to 0-1 roughly. Assume max speed around 2-3 usually
                    const t = Math.min(velMag / 3.0, 1.0);
                    const color = Utils.getColormapColor(this.colormapName, t);
                    r = color[0] * 255;
                    g = color[1] * 255;
                    b = color[2] * 255;
                    a = 255;
                }

                // Streamlines / Potential Lines
                let isLine = false;
                if (this.config.showStreamlines) {
                    // Use a sine wave to create bands
                    // Sharper lines: abs(sin(...)) < threshold
                    const val = Math.sin(pot.psi * (density / 100));
                    if (Math.abs(val) < 0.15) {
                        isLine = true;
                        // Mix line color
                        r = 255; g = 255; b = 255; a = 255;
                    }
                }
                if (this.config.showPotential) {
                    const val = Math.sin(pot.phi * (density / 100));
                    if (Math.abs(val) < 0.15) {
                        isLine = true;
                        r = 255; g = 200; b = 100; a = 255;
                    }
                }

                // Grid
                if (this.config.showGrid) {
                    if (x % 50 < 2 || y % 50 < 2) {
                        r += 50; g += 50; b += 50; a = 255;
                    }
                }

                if (a > 0) {
                    // Fill the block
                    for (let dy = 0; dy < step; dy++) {
                        for (let dx = 0; dx < step; dx++) {
                            if (x+dx < this.width && y+dy < this.height) {
                                const idx = ((y+dy) * this.width + (x+dx)) * 4;
                                data[idx] = r;
                                data[idx+1] = g;
                                data[idx+2] = b;
                                data[idx+3] = a;
                            }
                        }
                    }
                }
            }
        }
        
        this.ctx.putImageData(imgData, 0, 0);

        // Draw elements
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.fillStyle = '#ff4444';
        this.ctx.lineWidth = 2;
        for (const el of this.elements) {
            const sx = el.x * this.scale + this.offsetX;
            const sy = -el.y * this.scale + this.offsetY;
            
            this.ctx.beginPath();
            this.ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            if (el.type === 'uniform') {
                // Draw arrow
                this.ctx.beginPath();
                this.ctx.moveTo(sx, sy);
                this.ctx.lineTo(sx + 30 * Math.cos(-el.alpha), sy + 30 * Math.sin(-el.alpha));
                this.ctx.stroke();
            }
        }
    }
}
