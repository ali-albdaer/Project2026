/**
 * Visualization and rendering utilities for fluid flow simulation
 */

class FlowRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Simulation domain
        this.domain = { xMin: -4, xMax: 4, yMin: -3, yMax: 3 };
        this.scale = 1;
        
        // Visualization settings
        this.showGrid = false;
        this.showBoundary = true;
        this.showVectors = false;
        this.vectorScale = 0.1;
        this.streamlineDensity = 10;
        
        // Color mapping
        this.colorMap = 'viridis';
        this.valueRange = { min: 0, max: 1 };
        this.autoScale = true;
        
        // Performance optimization
        this.gridResolution = 100;
        this.computeGrid = true;
        this.cachedData = null;
        
        this.setupTransform();
        this.initializeColorMaps();
    }

    setupTransform() {
        const aspectRatio = this.width / this.height;
        const domainAspect = (this.domain.xMax - this.domain.xMin) / 
                            (this.domain.yMax - this.domain.yMin);
        
        if (aspectRatio > domainAspect) {
            // Canvas is wider than domain
            this.scale = this.height / (this.domain.yMax - this.domain.yMin);
            const totalWidth = (this.domain.xMax - this.domain.xMin) * this.scale;
            this.offsetX = (this.width - totalWidth) / 2;
            this.offsetY = 0;
        } else {
            // Canvas is taller than domain
            this.scale = this.width / (this.domain.xMax - this.domain.xMin);
            const totalHeight = (this.domain.yMax - this.domain.yMin) * this.scale;
            this.offsetX = 0;
            this.offsetY = (this.height - totalHeight) / 2;
        }
    }

    worldToScreen(x, y) {
        return {
            x: this.offsetX + (x - this.domain.xMin) * this.scale,
            y: this.offsetY + this.height - (y - this.domain.yMin) * this.scale
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: this.domain.xMin + (screenX - this.offsetX) / this.scale,
            y: this.domain.yMin + (this.height - screenY - this.offsetY) / this.scale
        };
    }

    initializeColorMaps() {
        this.colorMaps = {
            viridis: [
                [0.267, 0.004, 0.329], [0.282, 0.140, 0.457], [0.253, 0.265, 0.529],
                [0.206, 0.371, 0.553], [0.163, 0.471, 0.558], [0.127, 0.566, 0.550],
                [0.134, 0.658, 0.517], [0.267, 0.739, 0.441], [0.478, 0.821, 0.318],
                [0.741, 0.873, 0.149], [0.993, 0.906, 0.144]
            ],
            plasma: [
                [0.050, 0.030, 0.529], [0.302, 0.019, 0.615], [0.508, 0.006, 0.675],
                [0.718, 0.215, 0.475], [0.863, 0.389, 0.262], [0.940, 0.595, 0.093],
                [0.988, 0.809, 0.145], [0.980, 0.906, 0.379], [0.987, 0.991, 0.749]
            ],
            jet: [
                [0, 0, 0.5], [0, 0, 1], [0, 0.5, 1], [0, 1, 1],
                [0.5, 1, 0.5], [1, 1, 0], [1, 0.5, 0], [1, 0, 0], [0.5, 0, 0]
            ],
            coolwarm: [
                [0.230, 0.299, 0.754], [0.706, 0.016, 0.150], [0.865, 0.865, 0.865],
                [0.706, 0.016, 0.150], [0.230, 0.299, 0.754]
            ],
            rainbow: [
                [0.5, 0, 1], [0, 0, 1], [0, 0.5, 1], [0, 1, 1],
                [0, 1, 0.5], [0, 1, 0], [0.5, 1, 0], [1, 1, 0],
                [1, 0.5, 0], [1, 0, 0]
            ]
        };
    }

    interpolateColor(colorMap, t) {
        t = Math.max(0, Math.min(1, t));
        const colors = this.colorMaps[colorMap] || this.colorMaps.viridis;
        const scaled = t * (colors.length - 1);
        const index = Math.floor(scaled);
        const fraction = scaled - index;
        
        if (index >= colors.length - 1) {
            return colors[colors.length - 1];
        }
        
        const c1 = colors[index];
        const c2 = colors[index + 1];
        
        return [
            c1[0] + fraction * (c2[0] - c1[0]),
            c1[1] + fraction * (c2[1] - c1[1]),
            c1[2] + fraction * (c2[2] - c1[2])
        ];
    }

    getColor(value, colorMap = this.colorMap) {
        const normalized = this.autoScale ? 
            (value - this.valueRange.min) / (this.valueRange.max - this.valueRange.min) :
            value;
        
        const rgb = this.interpolateColor(colorMap, normalized);
        return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
    }

    computeFieldData(flowField, visualMode) {
        const nx = this.gridResolution;
        const ny = Math.round(nx * (this.domain.yMax - this.domain.yMin) / 
                              (this.domain.xMax - this.domain.xMin));
        
        const dx = (this.domain.xMax - this.domain.xMin) / (nx - 1);
        const dy = (this.domain.yMax - this.domain.yMin) / (ny - 1);
        
        const data = [];
        let minValue = Infinity;
        let maxValue = -Infinity;

        for (let j = 0; j < ny; j++) {
            const row = [];
            for (let i = 0; i < nx; i++) {
                const x = this.domain.xMin + i * dx;
                const y = this.domain.yMin + j * dy;
                
                let value = 0;
                
                switch (visualMode) {
                    case 'velocity':
                        const vel = flowField.getVelocity(x, y);
                        value = MathUtils.magnitude(vel);
                        break;
                    case 'pressure':
                        value = flowField.getPressure ? flowField.getPressure(x, y) : 0;
                        break;
                    case 'vorticity':
                        value = MathUtils.vorticity(flowField, x, y);
                        break;
                    case 'potential':
                        value = flowField.getVelocityPotential ? flowField.getVelocityPotential(x, y) : 0;
                        break;
                    case 'stream-function':
                        value = flowField.getStreamFunction ? flowField.getStreamFunction(x, y) : 0;
                        break;
                    default:
                        const velocity = flowField.getVelocity(x, y);
                        value = MathUtils.magnitude(velocity);
                }
                
                row.push(value);
                minValue = Math.min(minValue, value);
                maxValue = Math.max(maxValue, value);
            }
            data.push(row);
        }

        if (this.autoScale) {
            this.valueRange = { min: minValue, max: maxValue };
        }

        return { data, nx, ny, dx, dy, minValue, maxValue };
    }

    renderScalarField(flowField, visualMode) {
        const fieldData = this.computeFieldData(flowField, visualMode);
        const { data, nx, ny } = fieldData;
        
        const imageData = this.ctx.createImageData(this.width, this.height);
        const pixels = imageData.data;

        for (let screenY = 0; screenY < this.height; screenY++) {
            for (let screenX = 0; screenX < this.width; screenX++) {
                const world = this.screenToWorld(screenX, screenY);
                
                // Skip points outside domain
                if (world.x < this.domain.xMin || world.x > this.domain.xMax ||
                    world.y < this.domain.yMin || world.y > this.domain.yMax) {
                    continue;
                }

                // Bilinear interpolation
                const fx = (world.x - this.domain.xMin) / (this.domain.xMax - this.domain.xMin) * (nx - 1);
                const fy = (world.y - this.domain.yMin) / (this.domain.yMax - this.domain.yMin) * (ny - 1);
                
                const i0 = Math.floor(fx);
                const j0 = Math.floor(fy);
                const i1 = Math.min(i0 + 1, nx - 1);
                const j1 = Math.min(j0 + 1, ny - 1);
                
                const wx = fx - i0;
                const wy = fy - j0;
                
                if (i0 >= 0 && j0 >= 0 && i1 < nx && j1 < ny) {
                    const value = MathUtils.bilinearInterpolation(
                        fx, fy, i0, i1, j0, j1,
                        data[j0][i0], data[j0][i1], data[j1][i0], data[j1][i1]
                    );
                    
                    const rgb = this.interpolateColor(this.colorMap, 
                        (value - this.valueRange.min) / (this.valueRange.max - this.valueRange.min));
                    
                    const pixelIndex = (screenY * this.width + screenX) * 4;
                    pixels[pixelIndex] = Math.round(rgb[0] * 255);     // R
                    pixels[pixelIndex + 1] = Math.round(rgb[1] * 255); // G
                    pixels[pixelIndex + 2] = Math.round(rgb[2] * 255); // B
                    pixels[pixelIndex + 3] = 255;                      // A
                }
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    renderStreamlines(flowField) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1;

        const numStreamlines = this.streamlineDensity;
        const seeds = [];
        
        // Generate seed points
        for (let i = 0; i < numStreamlines; i++) {
            for (let j = 0; j < numStreamlines; j++) {
                const x = this.domain.xMin + (this.domain.xMax - this.domain.xMin) * i / (numStreamlines - 1);
                const y = this.domain.yMin + (this.domain.yMax - this.domain.yMin) * j / (numStreamlines - 1);
                seeds.push({ x, y });
            }
        }

        seeds.forEach(seed => {
            this.renderSingleStreamline(flowField, seed.x, seed.y);
        });
    }

    renderSingleStreamline(flowField, startX, startY, color = 'rgba(255, 255, 255, 0.8)') {
        const points = MathUtils.integrateStreamline(flowField, startX, startY, 0.01, 1000, true);
        
        if (points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;

        const startScreen = this.worldToScreen(points[0].x, points[0].y);
        this.ctx.moveTo(startScreen.x, startScreen.y);

        for (let i = 1; i < points.length; i++) {
            const screen = this.worldToScreen(points[i].x, points[i].y);
            
            // Check if point is still in view
            if (screen.x < 0 || screen.x > this.width || 
                screen.y < 0 || screen.y > this.height) {
                break;
            }
            
            this.ctx.lineTo(screen.x, screen.y);
        }

        this.ctx.stroke();
    }

    renderVelocityVectors(flowField) {
        const spacing = 20; // pixels between vectors
        
        this.ctx.strokeStyle = 'rgba(100, 255, 218, 0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(100, 255, 218, 0.9)';

        for (let screenX = spacing; screenX < this.width; screenX += spacing) {
            for (let screenY = spacing; screenY < this.height; screenY += spacing) {
                const world = this.screenToWorld(screenX, screenY);
                
                if (world.x < this.domain.xMin || world.x > this.domain.xMax ||
                    world.y < this.domain.yMin || world.y > this.domain.yMax) {
                    continue;
                }

                const velocity = flowField.getVelocity(world.x, world.y);
                const magnitude = MathUtils.magnitude(velocity);
                
                if (magnitude < 1e-6) continue;

                // Scale vector for display
                const scaledVel = MathUtils.scale(velocity, this.vectorScale * this.scale);
                
                this.ctx.beginPath();
                this.ctx.moveTo(screenX, screenY);
                this.ctx.lineTo(screenX + scaledVel.x, screenY - scaledVel.y);
                this.ctx.stroke();

                // Arrow head
                const angle = Math.atan2(-scaledVel.y, scaledVel.x);
                const headLength = 5;
                
                this.ctx.beginPath();
                this.ctx.moveTo(screenX + scaledVel.x, screenY - scaledVel.y);
                this.ctx.lineTo(
                    screenX + scaledVel.x - headLength * Math.cos(angle - Math.PI / 6),
                    screenY - scaledVel.y + headLength * Math.sin(angle - Math.PI / 6)
                );
                this.ctx.moveTo(screenX + scaledVel.x, screenY - scaledVel.y);
                this.ctx.lineTo(
                    screenX + scaledVel.x - headLength * Math.cos(angle + Math.PI / 6),
                    screenY - scaledVel.y + headLength * Math.sin(angle + Math.PI / 6)
                );
                this.ctx.stroke();
            }
        }
    }

    renderGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;

        const gridSpacing = 1; // world units
        
        // Vertical lines
        for (let x = Math.ceil(this.domain.xMin); x <= this.domain.xMax; x += gridSpacing) {
            const startScreen = this.worldToScreen(x, this.domain.yMin);
            const endScreen = this.worldToScreen(x, this.domain.yMax);
            
            this.ctx.beginPath();
            this.ctx.moveTo(startScreen.x, startScreen.y);
            this.ctx.lineTo(endScreen.x, endScreen.y);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = Math.ceil(this.domain.yMin); y <= this.domain.yMax; y += gridSpacing) {
            const startScreen = this.worldToScreen(this.domain.xMin, y);
            const endScreen = this.worldToScreen(this.domain.xMax, y);
            
            this.ctx.beginPath();
            this.ctx.moveTo(startScreen.x, startScreen.y);
            this.ctx.lineTo(endScreen.x, endScreen.y);
            this.ctx.stroke();
        }
    }

    renderBoundaries(flowField) {
        // Render cylinder boundary for cylinder flows
        if (flowField.parameters && (flowField.parameters.R || flowField.constructor.name.includes('Cylinder'))) {
            const R = flowField.parameters.R || 1;
            const x0 = flowField.parameters.x0 || 0;
            const y0 = flowField.parameters.y0 || 0;
            
            const center = this.worldToScreen(x0, y0);
            const radius = R * this.scale;
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
            this.ctx.stroke();
        }

        // Render channel walls for Poiseuille/Couette flows
        if (flowField.parameters && flowField.parameters.h) {
            const h = flowField.parameters.h;
            
            const topLeft = this.worldToScreen(this.domain.xMin, h);
            const topRight = this.worldToScreen(this.domain.xMax, h);
            const bottomLeft = this.worldToScreen(this.domain.xMin, -h);
            const bottomRight = this.worldToScreen(this.domain.xMax, -h);
            
            this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            this.ctx.lineWidth = 3;
            
            // Top wall
            this.ctx.beginPath();
            this.ctx.moveTo(topLeft.x, topLeft.y);
            this.ctx.lineTo(topRight.x, topRight.y);
            this.ctx.stroke();
            
            // Bottom wall
            this.ctx.beginPath();
            this.ctx.moveTo(bottomLeft.x, bottomLeft.y);
            this.ctx.lineTo(bottomRight.x, bottomRight.y);
            this.ctx.stroke();
        }
    }

    render(flowField, visualMode) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render based on visualization mode
        switch (visualMode) {
            case 'streamlines':
                this.renderStreamlines(flowField);
                break;
            case 'velocity-vectors':
                this.renderVelocityVectors(flowField);
                break;
            default:
                this.renderScalarField(flowField, visualMode);
                break;
        }

        // Overlay elements
        if (this.showGrid) {
            this.renderGrid();
        }

        if (this.showBoundary) {
            this.renderBoundaries(flowField);
        }

        if (visualMode === 'velocity-vectors' && this.showVectors) {
            this.renderVelocityVectors(flowField);
        }
    }

    renderColorBar(canvas, colorMap, minValue, maxValue) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        const imageData = ctx.createImageData(width, height);
        const pixels = imageData.data;

        for (let y = 0; y < height; y++) {
            const t = 1 - y / (height - 1); // Flip vertically
            const rgb = this.interpolateColor(colorMap, t);
            
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                pixels[index] = Math.round(rgb[0] * 255);     // R
                pixels[index + 1] = Math.round(rgb[1] * 255); // G
                pixels[index + 2] = Math.round(rgb[2] * 255); // B
                pixels[index + 3] = 255;                      // A
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.setupTransform();
    }

    setDomain(xMin, xMax, yMin, yMax) {
        this.domain = { xMin, xMax, yMin, yMax };
        this.setupTransform();
    }
}

// Export for use in other modules
window.FlowRenderer = FlowRenderer;