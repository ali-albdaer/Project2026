// Visualization Engine
class FlowVisualizer {
    constructor(canvas, simulator) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.simulator = simulator;
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Visualization settings
        this.showStreamlines = true;
        this.showPotentialLines = false;
        this.showVelocityField = false;
        this.showColorMap = false;
        this.showGrid = false;
        this.colorQuantity = 'velocity';
        this.colorPalette = 'viridis';
        
        // NS-specific visualization
        this.nsVisualization = 'streamlines';
        this.showVectorsNS = false;
    }

    clear() {
        this.ctx.fillStyle = '#0a0e27';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw grid
    drawGrid() {
        if (!this.showGrid) return;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 0.5;
        
        const gridSpacing = 50;
        
        for (let x = 0; x < this.width; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.height; y += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    // Render color map
    renderColorMap() {
        if (!this.showColorMap) return;
        
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        
        let minVal = Infinity;
        let maxVal = -Infinity;
        
        // First pass: find min and max
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const value = this.getQuantityValue(x, y);
                minVal = Math.min(minVal, value);
                maxVal = Math.max(maxVal, value);
            }
        }
        
        // Avoid division by zero
        if (maxVal - minVal < 0.001) {
            maxVal = minVal + 1;
        }
        
        // Second pass: render
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const value = this.getQuantityValue(x, y);
                const normalized = (value - minVal) / (maxVal - minVal);
                
                const color = this.getColorFromPalette(normalized);
                data[idx] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
                data[idx + 3] = 180; // Alpha
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    getQuantityValue(x, y) {
        if (this.simulator instanceof PotentialFlow) {
            const vel = this.simulator.getVelocity(x, y);
            
            switch (this.colorQuantity) {
                case 'velocity':
                    return vel.magnitude;
                case 'pressure':
                    return this.simulator.getPressureCoefficient(x, y, 10);
                case 'vorticity':
                    return Math.abs(this.simulator.getVorticity(x, y));
                default:
                    return vel.magnitude;
            }
        } else if (this.simulator instanceof NavierStokesSolver) {
            switch (this.colorQuantity) {
                case 'velocity':
                    return this.simulator.getVelocity(x, y).magnitude;
                case 'pressure':
                    return this.simulator.getPressure(x, y);
                case 'vorticity':
                    return Math.abs(this.simulator.getVorticity(x, y));
                case 'density':
                    return this.simulator.getDensity(x, y);
                case 'temperature':
                    return this.simulator.getTemperature(x, y);
                default:
                    return this.simulator.getVelocity(x, y).magnitude;
            }
        }
        
        return 0;
    }

    getColorFromPalette(value) {
        const palette = ColorMaps[this.colorPalette] || ColorMaps.viridis;
        const index = Math.floor(Math.max(0, Math.min(0.999, value)) * palette.length);
        return palette[index];
    }

    // Draw streamlines
    drawStreamlines() {
        if (!this.showStreamlines) return;
        
        if (this.simulator instanceof PotentialFlow) {
            this.drawPotentialStreamlines();
        } else if (this.simulator instanceof NavierStokesSolver) {
            this.drawNSStreamlines();
        }
    }

    drawPotentialStreamlines() {
        const integrator = new StreamlineIntegrator(this.simulator);
        const streamlines = integrator.generateStreamlines(30, 3, 500);
        
        this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        this.ctx.lineWidth = 1.5;
        
        for (const streamline of streamlines) {
            if (streamline.length < 2) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(streamline[0][0], streamline[0][1]);
            
            for (let i = 1; i < streamline.length; i++) {
                this.ctx.lineTo(streamline[i][0], streamline[i][1]);
            }
            
            this.ctx.stroke();
        }
    }

    drawNSStreamlines() {
        const numStreamlines = 25;
        const dt = 1.5;
        const maxSteps = 500;
        
        this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        this.ctx.lineWidth = 1.5;
        
        for (let i = 0; i < numStreamlines; i++) {
            const y0 = (i + 0.5) * this.height / numStreamlines;
            const streamline = this.integrateNSStreamline(10, y0, dt, maxSteps);
            
            if (streamline.length < 2) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(streamline[0][0], streamline[0][1]);
            
            for (let j = 1; j < streamline.length; j++) {
                this.ctx.lineTo(streamline[j][0], streamline[j][1]);
            }
            
            this.ctx.stroke();
        }
    }

    integrateNSStreamline(x0, y0, dt, maxSteps) {
        const points = [[x0, y0]];
        let x = x0;
        let y = y0;
        
        for (let i = 0; i < maxSteps; i++) {
            const vel = this.simulator.getVelocity(x, y);
            const speed = vel.magnitude;
            
            if (speed < 0.01) break;
            
            x += dt * vel.u / speed;
            y += dt * vel.v / speed;
            
            if (x < 0 || x > this.width || y < 0 || y > this.height) break;
            
            points.push([x, y]);
        }
        
        return points;
    }

    // Draw potential lines (equipotential lines)
    drawPotentialLines() {
        if (!this.showPotentialLines || !(this.simulator instanceof PotentialFlow)) return;
        
        this.ctx.strokeStyle = 'rgba(255, 150, 100, 0.5)';
        this.ctx.lineWidth = 1;
        
        const numLevels = 20;
        const step = 2;
        
        // Sample potential values to find range
        let minPhi = Infinity;
        let maxPhi = -Infinity;
        
        for (let y = 0; y < this.height; y += step) {
            for (let x = 0; x < this.width; x += step) {
                const phi = this.simulator.getPotentialFunction(x, y);
                minPhi = Math.min(minPhi, phi);
                maxPhi = Math.max(maxPhi, phi);
            }
        }
        
        // Draw contour lines using marching squares
        for (let i = 0; i < numLevels; i++) {
            const level = minPhi + (i / numLevels) * (maxPhi - minPhi);
            this.drawContour(level, step, (x, y) => this.simulator.getPotentialFunction(x, y));
        }
    }

    // Simple contour drawing
    drawContour(level, step, valueFunction) {
        for (let y = 0; y < this.height - step; y += step) {
            for (let x = 0; x < this.width - step; x += step) {
                const v1 = valueFunction(x, y);
                const v2 = valueFunction(x + step, y);
                const v3 = valueFunction(x + step, y + step);
                const v4 = valueFunction(x, y + step);
                
                // Check if contour crosses this cell
                const crosses = (v1 - level) * (v2 - level) < 0 ||
                               (v2 - level) * (v3 - level) < 0 ||
                               (v3 - level) * (v4 - level) < 0 ||
                               (v4 - level) * (v1 - level) < 0;
                
                if (crosses) {
                    this.ctx.fillStyle = 'rgba(255, 150, 100, 0.5)';
                    this.ctx.fillRect(x, y, step, step);
                }
            }
        }
    }

    // Draw velocity vectors
    drawVelocityField() {
        if (!this.showVelocityField) return;
        
        const spacing = 30;
        const scale = 5;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.7)';
        this.ctx.fillStyle = 'rgba(255, 255, 100, 0.7)';
        this.ctx.lineWidth = 1.5;
        
        for (let y = spacing / 2; y < this.height; y += spacing) {
            for (let x = spacing / 2; x < this.width; x += spacing) {
                const vel = this.simulator.getVelocity(x, y);
                
                if (vel.magnitude < 0.1) continue;
                
                const dx = vel.u * scale;
                const dy = vel.v * scale;
                
                // Draw arrow
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + dx, y + dy);
                this.ctx.stroke();
                
                // Draw arrowhead
                const angle = Math.atan2(dy, dx);
                const headLength = 5;
                
                this.ctx.beginPath();
                this.ctx.moveTo(x + dx, y + dy);
                this.ctx.lineTo(
                    x + dx - headLength * Math.cos(angle - Math.PI / 6),
                    y + dy - headLength * Math.sin(angle - Math.PI / 6)
                );
                this.ctx.lineTo(
                    x + dx - headLength * Math.cos(angle + Math.PI / 6),
                    y + dy - headLength * Math.sin(angle + Math.PI / 6)
                );
                this.ctx.lineTo(x + dx, y + dy);
                this.ctx.fill();
            }
        }
    }

    // Draw obstacles (for Navier-Stokes)
    drawObstacles() {
        if (!(this.simulator instanceof NavierStokesSolver)) return;
        
        // Draw geometries with better visualization
        for (const geom of this.simulator.geometries) {
            this.drawGeometry(geom);
        }
    }

    drawGeometry(geom) {
        const { type, params } = geom;
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(150, 150, 150, 0.9)';
        this.ctx.strokeStyle = 'rgba(200, 200, 200, 1)';
        this.ctx.lineWidth = 2;

        switch (type) {
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(params.x, params.y, params.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
            
            case 'rectangle':
                this.ctx.fillRect(
                    params.x - params.width / 2,
                    params.y - params.height / 2,
                    params.width,
                    params.height
                );
                this.ctx.strokeRect(
                    params.x - params.width / 2,
                    params.y - params.height / 2,
                    params.width,
                    params.height
                );
                break;
            
            case 'ellipse':
                this.ctx.beginPath();
                this.ctx.ellipse(params.x, params.y, params.a, params.b, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
            
            case 'airfoil':
                this.drawAirfoil(params);
                break;
        }

        this.ctx.restore();
    }

    drawAirfoil(params) {
        const chord = params.chord || 100;
        const x0 = params.x - chord / 2;
        const y0 = params.y;
        
        this.ctx.beginPath();
        
        // Upper surface
        for (let i = 0; i <= 50; i++) {
            const x = i / 50;
            const t = 0.12;
            const yt = 5 * t * chord * (0.2969 * Math.sqrt(x) - 0.1260 * x - 
                       0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
            
            if (i === 0) {
                this.ctx.moveTo(x0 + x * chord, y0 - yt);
            } else {
                this.ctx.lineTo(x0 + x * chord, y0 - yt);
            }
        }
        
        // Lower surface
        for (let i = 50; i >= 0; i--) {
            const x = i / 50;
            const t = 0.12;
            const yt = 5 * t * chord * (0.2969 * Math.sqrt(x) - 0.1260 * x - 
                       0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
            
            this.ctx.lineTo(x0 + x * chord, y0 + yt);
        }
        
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }

    // Draw flow elements (for potential flow)
    drawFlowElements() {
        if (!(this.simulator instanceof PotentialFlow)) return;
        
        for (const flow of this.simulator.flows) {
            const { type, params } = flow;
            
            this.ctx.save();
            this.ctx.translate(params.x, params.y);
            
            switch (type) {
                case 'source':
                    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                
                case 'sink':
                    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                
                case 'vortex':
                    this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
                    this.ctx.stroke();
                    break;
                
                case 'doublet':
                    this.ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
                    this.ctx.fillRect(-6, -6, 12, 12);
                    break;
            }
            
            this.ctx.restore();
        }
    }

    // Main render function
    render() {
        this.clear();
        this.drawGrid();
        
        if (this.simulator instanceof NavierStokesSolver) {
            this.renderNavierStokes();
        } else {
            this.renderPotentialFlow();
        }
    }

    renderPotentialFlow() {
        if (this.showColorMap) {
            this.renderColorMap();
        }
        
        this.drawStreamlines();
        this.drawPotentialLines();
        this.drawVelocityField();
        this.drawFlowElements();
    }

    renderNavierStokes() {
        // Always show some visualization based on selected mode
        switch (this.nsVisualization) {
            case 'streamlines':
                this.drawNSStreamlines();
                break;
            
            case 'velocity':
            case 'pressure':
            case 'vorticity':
            case 'temperature':
            case 'density':
                this.renderNSColorMap(this.nsVisualization);
                break;
        }
        
        // Optionally overlay velocity vectors
        if (this.showVectorsNS) {
            this.drawVelocityField();
        }
        
        // Always draw obstacles on top
        this.drawObstacles();
        
        // Draw heat sources if any
        this.drawHeatSources();
    }

    renderNSColorMap(quantity) {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        
        let minVal = Infinity;
        let maxVal = -Infinity;
        
        // Sample to find range
        for (let y = 0; y < this.height; y += 2) {
            for (let x = 0; x < this.width; x += 2) {
                const value = this.getNSQuantityValue(x, y, quantity);
                minVal = Math.min(minVal, value);
                maxVal = Math.max(maxVal, value);
            }
        }
        
        // Avoid division by zero
        if (maxVal - minVal < 0.001) {
            maxVal = minVal + 1;
        }
        
        // Render
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const value = this.getNSQuantityValue(x, y, quantity);
                const normalized = (value - minVal) / (maxVal - minVal);
                
                const color = this.getColorFromPalette(normalized);
                data[idx] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
                data[idx + 3] = 200;
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    getNSQuantityValue(x, y, quantity) {
        switch (quantity) {
            case 'velocity':
                return this.simulator.getVelocity(x, y).magnitude;
            case 'pressure':
                return this.simulator.getPressure(x, y);
            case 'vorticity':
                return this.simulator.getVorticity(x, y);
            case 'temperature':
                return this.simulator.getTemperature(x, y);
            case 'density':
                return this.simulator.getDensity(x, y);
            default:
                return this.simulator.getVelocity(x, y).magnitude;
        }
    }

    drawHeatSources() {
        if (!(this.simulator instanceof NavierStokesSolver)) return;
        
        for (const source of this.simulator.heatSources) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
            this.ctx.strokeStyle = 'rgba(255, 150, 50, 1)';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(source.x, source.y, source.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }
}
