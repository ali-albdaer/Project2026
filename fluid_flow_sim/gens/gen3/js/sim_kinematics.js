class KinematicsSim {
    constructor(renderer) {
        this.renderer = renderer;
        this.width = 128;
        this.height = 128;
        this.data = new Float32Array(this.width * this.height * 4); // RGBA
        this.texture = renderer.createTexture(this.width, this.height, null);
        
        this.uFunc = (x, y, t) => 0;
        this.vFunc = (x, y, t) => 0;
        
        this.time = 0;
    }

    updateEquations(uStr, vStr) {
        this.uFunc = MathParser.compile(uStr);
        this.vFunc = MathParser.compile(vStr);
    }

    update(dt) {
        this.time += dt;
        
        // Evaluate field on CPU
        // Map pixel coordinates to -Math.PI to Math.PI or similar range
        const range = 2 * Math.PI;
        
        for (let j = 0; j < this.height; j++) {
            for (let i = 0; i < this.width; i++) {
                const x = (i / this.width - 0.5) * range * 2; // -2PI to 2PI
                const y = (j / this.height - 0.5) * range * 2;
                
                const u = this.uFunc(x, y, this.time);
                const v = this.vFunc(x, y, this.time);
                
                // Store in texture: R=u, G=v, B=0, A=1
                const idx = (j * this.width + i) * 4;
                this.data[idx] = u;
                this.data[idx + 1] = v;
                this.data[idx + 2] = 0;
                this.data[idx + 3] = 1;
            }
        }
        
        // Upload to GPU
        const gl = this.renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.data);
    }

    draw(mode) {
        // Mode: 'velocity', 'divergence', 'curl'
        // Since we only have velocity in texture, we need to compute div/curl in shader or here.
        // For simplicity, let's compute derived fields here if needed, or just use shader derivatives?
        // Shader derivatives (dFdx, dFdy) are screen space, might be noisy.
        // Let's compute a separate texture for scalar fields if requested?
        // Or just reuse the renderer's ability to draw velocity.
        
        // If mode is divergence or curl, we should probably compute it.
        // But for now, let's just support velocity visualization.
        // To support div/curl, we can compute them into the B and A channels!
        
        // Let's update the update loop to compute div and curl.
        
        // Need gradients. Central difference.
        const w = this.width;
        const h = this.height;
        const dx = (4 * Math.PI) / w; // Based on range above
        
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const idx = (j * w + i) * 4;
                
                // Neighbors
                const i_plus = (i + 1) % w;
                const i_minus = (i - 1 + w) % w;
                const j_plus = (j + 1) % h;
                const j_minus = (j - 1 + h) % h;
                
                const idx_ip = (j * w + i_plus) * 4;
                const idx_im = (j * w + i_minus) * 4;
                const idx_jp = (j_plus * w + i) * 4;
                const idx_jm = (j_minus * w + i) * 4;
                
                const u_ip = this.data[idx_ip];
                const u_im = this.data[idx_im];
                const v_jp = this.data[idx_jp + 1];
                const v_jm = this.data[idx_jm + 1];
                
                const v_ip = this.data[idx_ip + 1];
                const v_im = this.data[idx_im + 1];
                const u_jp = this.data[idx_jp];
                const u_jm = this.data[idx_jm];

                // Div = du/dx + dv/dy
                const dudx = (u_ip - u_im) / (2 * dx);
                const dvdy = (v_jp - v_jm) / (2 * dx);
                const div = dudx + dvdy;
                
                // Curl = dv/dx - du/dy
                const dvdx = (v_ip - v_im) / (2 * dx);
                const dudy = (u_jp - u_jm) / (2 * dx);
                const curl = dvdx - dudy;
                
                this.data[idx + 2] = div; // B channel
                this.data[idx + 3] = curl; // A channel
            }
        }
        
        // Re-upload
        const gl = this.renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, this.data);

        let type = 1; // Velocity
        let scale = 0.2;
        let channel = 0;
        
        if (mode === 'divergence') {
            type = 0;
            channel = 2; // B channel
            scale = 0.5;
        } else if (mode === 'curl') {
            type = 0;
            channel = 3; // A channel
            scale = 0.5;
        }
        
        this.renderer.drawTexture(this.texture, type, scale, channel);
    }
    
    getProbe(x, y) {
        // x, y in 0..1
        const i = Math.floor(x * this.width);
        const j = Math.floor(y * this.height);
        const idx = (j * this.width + i) * 4;
        if (idx < 0 || idx >= this.data.length) return { u: 0, v: 0, div: 0, curl: 0 };
        
        return {
            u: this.data[idx],
            v: this.data[idx+1],
            div: this.data[idx+2],
            curl: this.data[idx+3]
        };
    }
}
