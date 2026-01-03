export const Utils = {
    // Generate a texture from a colormap function
    createColormapTexture: (gl, name) => {
        const width = 256;
        const data = new Uint8Array(width * 4);
        for (let i = 0; i < width; i++) {
            const t = i / (width - 1);
            const color = Utils.getColormapColor(name, t);
            data[i * 4] = color[0] * 255;
            data[i * 4 + 1] = color[1] * 255;
            data[i * 4 + 2] = color[2] * 255;
            data[i * 4 + 3] = 255;
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    },

    getColormapColor: (name, t) => {
        // Simple implementation of Viridis and others
        // t is 0..1
        if (name === 'viridis') return Utils.viridis(t);
        if (name === 'magma') return Utils.magma(t);
        if (name === 'grayscale') return [t, t, t];
        return Utils.viridis(t);
    },

    // Viridis approximation
    viridis: (t) => {
        const c0 = [0.267004, 0.004874, 0.329415];
        const c1 = [0.127568, 0.566949, 0.550556];
        const c2 = [0.993248, 0.906157, 0.143936];
        
        if (t < 0.5) {
            const tt = t * 2;
            return [
                c0[0] * (1 - tt) + c1[0] * tt,
                c0[1] * (1 - tt) + c1[1] * tt,
                c0[2] * (1 - tt) + c1[2] * tt
            ];
        } else {
            const tt = (t - 0.5) * 2;
            return [
                c1[0] * (1 - tt) + c2[0] * tt,
                c1[1] * (1 - tt) + c2[1] * tt,
                c1[2] * (1 - tt) + c2[2] * tt
            ];
        }
    },

    magma: (t) => {
        // Rough approximation
        return [
            t,
            t * t,
            t * t * t * 0.5 + 0.5 * t
        ];
    },

    // Complex number helpers
    Complex: class {
        constructor(re, im) {
            this.re = re;
            this.im = im;
        }
        add(c) { return new Utils.Complex(this.re + c.re, this.im + c.im); }
        sub(c) { return new Utils.Complex(this.re - c.re, this.im - c.im); }
        mul(c) { return new Utils.Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re); }
        div(c) {
            const d = c.re * c.re + c.im * c.im;
            return new Utils.Complex((this.re * c.re + this.im * c.im) / d, (this.im * c.re - this.re * c.im) / d);
        }
        abs() { return Math.sqrt(this.re * this.re + this.im * this.im); }
        arg() { return Math.atan2(this.im, this.re); }
    }
};
