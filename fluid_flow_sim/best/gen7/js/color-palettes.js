/**
 * Color Palettes for Scientific Visualization
 * Contains various colormaps for flow visualization
 */

const ColorPalettes = {
    /**
     * Viridis colormap - perceptually uniform
     */
    viridis: [
        [0.267004, 0.004874, 0.329415],
        [0.282327, 0.140926, 0.457517],
        [0.253935, 0.265254, 0.529983],
        [0.206756, 0.371758, 0.553117],
        [0.163625, 0.471133, 0.558148],
        [0.127568, 0.566949, 0.550556],
        [0.134692, 0.658636, 0.517649],
        [0.266941, 0.748751, 0.440573],
        [0.477504, 0.821444, 0.318195],
        [0.741388, 0.873449, 0.149561],
        [0.993248, 0.906157, 0.143936]
    ],

    /**
     * Plasma colormap
     */
    plasma: [
        [0.050383, 0.029803, 0.527975],
        [0.254627, 0.013882, 0.615419],
        [0.417642, 0.000564, 0.658390],
        [0.562738, 0.051545, 0.641509],
        [0.692840, 0.165141, 0.564522],
        [0.798216, 0.280197, 0.469538],
        [0.881443, 0.392529, 0.383229],
        [0.949217, 0.517763, 0.295662],
        [0.988260, 0.652325, 0.211364],
        [0.988648, 0.809579, 0.145357],
        [0.940015, 0.975158, 0.131326]
    ],

    /**
     * Inferno colormap
     */
    inferno: [
        [0.001462, 0.000466, 0.013866],
        [0.087411, 0.044556, 0.224813],
        [0.232077, 0.059889, 0.437695],
        [0.416331, 0.090203, 0.432943],
        [0.578304, 0.148039, 0.404411],
        [0.735683, 0.215906, 0.330245],
        [0.865006, 0.316822, 0.226055],
        [0.954506, 0.468744, 0.099874],
        [0.987622, 0.645320, 0.039886],
        [0.964394, 0.843848, 0.273391],
        [0.988362, 0.998364, 0.644924]
    ],

    /**
     * Magma colormap
     */
    magma: [
        [0.001462, 0.000466, 0.013866],
        [0.078815, 0.054184, 0.211667],
        [0.232077, 0.059889, 0.437695],
        [0.390384, 0.100379, 0.501864],
        [0.550287, 0.161158, 0.505719],
        [0.716387, 0.214982, 0.474625],
        [0.868793, 0.287728, 0.409303],
        [0.967327, 0.439703, 0.359630],
        [0.994738, 0.624350, 0.427397],
        [0.996369, 0.808378, 0.563536],
        [0.987053, 0.991438, 0.749504]
    ],

    /**
     * Turbo colormap - rainbow-like but perceptually better
     */
    turbo: [
        [0.190, 0.072, 0.232],
        [0.255, 0.292, 0.698],
        [0.135, 0.524, 0.893],
        [0.090, 0.722, 0.810],
        [0.227, 0.874, 0.592],
        [0.522, 0.957, 0.344],
        [0.809, 0.955, 0.205],
        [0.973, 0.831, 0.168],
        [0.993, 0.600, 0.160],
        [0.933, 0.350, 0.146],
        [0.762, 0.137, 0.156]
    ],

    /**
     * Cool-warm diverging colormap
     */
    coolwarm: [
        [0.230, 0.299, 0.754],
        [0.350, 0.450, 0.850],
        [0.500, 0.600, 0.920],
        [0.670, 0.740, 0.960],
        [0.820, 0.850, 0.980],
        [0.970, 0.970, 0.970],
        [0.980, 0.830, 0.800],
        [0.960, 0.680, 0.600],
        [0.920, 0.520, 0.420],
        [0.850, 0.350, 0.280],
        [0.705, 0.016, 0.150]
    ],

    /**
     * Jet colormap (classic, not perceptually uniform)
     */
    jet: [
        [0.000, 0.000, 0.500],
        [0.000, 0.000, 1.000],
        [0.000, 0.500, 1.000],
        [0.000, 1.000, 1.000],
        [0.500, 1.000, 0.500],
        [1.000, 1.000, 0.000],
        [1.000, 0.500, 0.000],
        [1.000, 0.000, 0.000],
        [0.500, 0.000, 0.000]
    ],

    /**
     * Grayscale
     */
    grayscale: [
        [0.0, 0.0, 0.0],
        [0.1, 0.1, 0.1],
        [0.2, 0.2, 0.2],
        [0.3, 0.3, 0.3],
        [0.4, 0.4, 0.4],
        [0.5, 0.5, 0.5],
        [0.6, 0.6, 0.6],
        [0.7, 0.7, 0.7],
        [0.8, 0.8, 0.8],
        [0.9, 0.9, 0.9],
        [1.0, 1.0, 1.0]
    ],

    /**
     * Get color from palette at normalized position [0, 1]
     */
    getColor(paletteName, t) {
        const palette = this[paletteName] || this.viridis;
        t = MathUtils.clamp(t, 0, 1);
        
        const n = palette.length - 1;
        const idx = t * n;
        const i = Math.floor(idx);
        const f = idx - i;
        
        if (i >= n) {
            const c = palette[n];
            return { r: c[0], g: c[1], b: c[2] };
        }
        
        const c0 = palette[i];
        const c1 = palette[i + 1];
        
        return {
            r: MathUtils.lerp(c0[0], c1[0], f),
            g: MathUtils.lerp(c0[1], c1[1], f),
            b: MathUtils.lerp(c0[2], c1[2], f)
        };
    },

    /**
     * Get color as CSS string
     */
    getColorCSS(paletteName, t, alpha = 1) {
        const c = this.getColor(paletteName, t);
        const r = Math.round(c.r * 255);
        const g = Math.round(c.g * 255);
        const b = Math.round(c.b * 255);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * Get color as hex string
     */
    getColorHex(paletteName, t) {
        const c = this.getColor(paletteName, t);
        const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
        const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
        const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    },

    /**
     * Create gradient string for CSS
     */
    createGradientCSS(paletteName, direction = 'to right') {
        const palette = this[paletteName] || this.viridis;
        const stops = palette.map((c, i) => {
            const r = Math.round(c[0] * 255);
            const g = Math.round(c[1] * 255);
            const b = Math.round(c[2] * 255);
            const pct = (i / (palette.length - 1)) * 100;
            return `rgb(${r}, ${g}, ${b}) ${pct}%`;
        }).join(', ');
        
        return `linear-gradient(${direction}, ${stops})`;
    },

    /**
     * Create ImageData array for a color bar
     */
    createColorBar(paletteName, width, height, horizontal = true) {
        const data = new Uint8ClampedArray(width * height * 4);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const t = horizontal ? x / (width - 1) : y / (height - 1);
                const c = this.getColor(paletteName, t);
                const idx = (y * width + x) * 4;
                data[idx] = Math.round(c.r * 255);
                data[idx + 1] = Math.round(c.g * 255);
                data[idx + 2] = Math.round(c.b * 255);
                data[idx + 3] = 255;
            }
        }
        
        return data;
    },

    /**
     * Available palette names
     */
    getAvailablePalettes() {
        return ['viridis', 'plasma', 'inferno', 'magma', 'turbo', 'coolwarm', 'jet', 'grayscale'];
    },

    /**
     * Streamline colors for different elements
     */
    elementColors: {
        uniform: '#58a6ff',
        source: '#3fb950',
        sink: '#f85149',
        doublet: '#a371f7',
        vortex: '#d29922'
    },

    /**
     * Get element color
     */
    getElementColor(type) {
        return this.elementColors[type] || '#ffffff';
    }
};

// Export for use in other modules
window.ColorPalettes = ColorPalettes;
