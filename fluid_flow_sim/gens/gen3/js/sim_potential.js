class PotentialSim {
    constructor(renderer) {
        this.renderer = renderer;
        this.width = 128;
        this.height = 128;
        this.data = new Float32Array(this.width * this.height * 4);
        this.texture = renderer.createTexture(this.width, this.height, null);
        
        this.elements = [];
        this.addDefaultElements();
    }

    addDefaultElements() {
        this.elements.push({ type: 'uniform', u: 1, v: 0 });
        this.elements.push({ type: 'source', x: 0, y: 0, strength: 5 });
    }

    addElement(type) {
        if (type === 'uniform') this.elements.push({ type: 'uniform', u: 1, v: 0 });
        else if (type === 'source') this.elements.push({ type: 'source', x: 0, y: 0, strength: 5 });
        else if (type === 'vortex') this.elements.push({ type: 'vortex', x: 0, y: 0, strength: 5 });
        else if (type === 'doublet') this.elements.push({ type: 'doublet', x: 0, y: 0, strength: 5, angle: 0 });
    }

    removeElement(index) {
        this.elements.splice(index, 1);
    }

    update(dt) {
        // Compute potential flow field
        const range = 5.0; // Coordinate range -5 to 5
        
        for (let j = 0; j < this.height; j++) {
            for (let i = 0; i < this.width; i++) {
                const x = (i / this.width - 0.5) * range * 2;
                const y = (j / this.height - 0.5) * range * 2;
                
                let u = 0, v = 0, phi = 0, psi = 0;
                
                for (const el of this.elements) {
                    const dx = x - (el.x || 0);
                    const dy = y - (el.y || 0);
                    const r2 = dx*dx + dy*dy;
                    const r = Math.sqrt(r2);
                    const theta = Math.atan2(dy, dx);
                    
                    if (el.type === 'uniform') {
                        u += el.u;
                        v += el.v;
                        phi += el.u * x + el.v * y;
                        psi += el.u * y - el.v * x;
                    } else if (el.type === 'source') {
                        // V_r = m / (2pi r)
                        const m_2pi = el.strength / (2 * Math.PI);
                        const ur = m_2pi / (r + 1e-6);
                        u += ur * Math.cos(theta);
                        v += ur * Math.sin(theta);
                        phi += m_2pi * Math.log(r + 1e-6);
                        psi += m_2pi * theta;
                    } else if (el.type === 'vortex') {
                        // V_theta = Gamma / (2pi r)
                        const g_2pi = el.strength / (2 * Math.PI);
                        const ut = g_2pi / (r + 1e-6);
                        u -= ut * Math.sin(theta);
                        v += ut * Math.cos(theta);
                        phi += g_2pi * theta;
                        psi -= g_2pi * Math.log(r + 1e-6);
                    } else if (el.type === 'doublet') {
                        // Superposition of source and sink close together
                        // phi = - K cos(theta - alpha) / r
                        // psi = K sin(theta - alpha) / r
                        const K = el.strength / (2 * Math.PI);
                        const ang = theta - el.angle;
                        const cosA = Math.cos(ang);
                        const sinA = Math.sin(ang);
                        
                        phi -= K * cosA / (r + 1e-6);
                        psi += K * sinA / (r + 1e-6);
                        
                        // Velocity is gradient of phi
                        // Vr = K cos(ang) / r^2
                        // Vt = K sin(ang) / r^2
                        const Vr = -K * cosA / (r2 + 1e-6); // Derivative of -1/r is 1/r^2
                        // Wait, d/dr(-1/r) = 1/r^2. So Vr = K cos / r^2.
                        // d/dtheta(cos) = -sin. 1/r d/dtheta = -sin/r.
                        // Vt = 1/r * (K sin / r) = K sin / r^2.
                        
                        // Let's recheck doublet formulas.
                        // Phi = - mu * x / (x^2+y^2) for doublet along x.
                        // Phi = - mu * cos(theta) / r.
                        // Vr = dPhi/dr = mu * cos(theta) / r^2.
                        // Vtheta = 1/r dPhi/dtheta = 1/r * (mu * sin(theta) / r) = mu * sin(theta) / r^2.
                        
                        const Vr_val = K * cosA / (r2 + 1e-6);
                        const Vt_val = K * sinA / (r2 + 1e-6);
                        
                        u += Vr_val * Math.cos(theta) - Vt_val * Math.sin(theta);
                        v += Vr_val * Math.sin(theta) + Vt_val * Math.cos(theta);
                    }
                }
                
                const idx = (j * this.width + i) * 4;
                this.data[idx] = u;
                this.data[idx + 1] = v;
                this.data[idx + 2] = phi;
                this.data[idx + 3] = psi;
            }
        }
        
        const gl = this.renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.data);
    }

    draw(mode) {
        let type = 1;
        let channel = 0;
        let scale = 0.2;
        
        if (mode === 'pressure') { // Map pressure to Potential phi
            type = 0;
            channel = 2;
            scale = 0.2;
        } else if (mode === 'curl') {
            // Potential flow is irrotational, curl is 0 everywhere (except singularities)
            // But we can show it anyway
            // We didn't compute curl in data.
            // Let's just show velocity
            type = 1;
        }
        
        this.renderer.drawTexture(this.texture, type, scale, channel);
    }
    
    getProbe(x, y) {
        const i = Math.floor(x * this.width);
        const j = Math.floor(y * this.height);
        const idx = (j * this.width + i) * 4;
        if (idx < 0 || idx >= this.data.length) return { u: 0, v: 0, val: 0 };
        
        return {
            u: this.data[idx],
            v: this.data[idx+1],
            val: this.data[idx+2] // Phi
        };
    }
}
