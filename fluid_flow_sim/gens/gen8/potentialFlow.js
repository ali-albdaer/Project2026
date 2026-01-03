// Potential Flow Superposition Engine
class PotentialFlow {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.flows = [];
        this.centerX = width / 2;
        this.centerY = height / 2;
    }

    // Add a flow element
    addFlow(type, params) {
        this.flows.push({ type, params, id: Date.now() });
    }

    // Remove a flow element
    removeFlow(id) {
        this.flows = this.flows.filter(f => f.id !== id);
    }

    // Clear all flows
    clearFlows() {
        this.flows = [];
    }

    // Calculate velocity at a point
    getVelocity(x, y) {
        let u = 0;
        let v = 0;

        for (const flow of this.flows) {
            const vel = this.getFlowVelocity(flow, x, y);
            u += vel.u;
            v += vel.v;
        }

        return { u, v, magnitude: Math.sqrt(u * u + v * v) };
    }

    // Get velocity contribution from a single flow element
    getFlowVelocity(flow, x, y) {
        const { type, params } = flow;
        const dx = x - params.x;
        const dy = y - params.y;
        const r2 = dx * dx + dy * dy;
        const r = Math.sqrt(r2);

        if (r < 0.1) return { u: 0, v: 0 };

        switch (type) {
            case 'uniform':
                return {
                    u: params.U * Math.cos(params.angle * Math.PI / 180),
                    v: params.U * Math.sin(params.angle * Math.PI / 180)
                };

            case 'source':
            case 'sink':
                const m = type === 'sink' ? -params.m : params.m;
                return {
                    u: m * dx / (2 * Math.PI * r2),
                    v: m * dy / (2 * Math.PI * r2)
                };

            case 'vortex':
                return {
                    u: -params.Gamma * dy / (2 * Math.PI * r2),
                    v: params.Gamma * dx / (2 * Math.PI * r2)
                };

            case 'doublet':
                const cosTheta = dx / r;
                const sinTheta = dy / r;
                const kappa = params.kappa;
                return {
                    u: -kappa * (cosTheta * cosTheta - sinTheta * sinTheta) / (2 * Math.PI * r2),
                    v: -kappa * (2 * cosTheta * sinTheta) / (2 * Math.PI * r2)
                };

            default:
                return { u: 0, v: 0 };
        }
    }

    // Calculate stream function ψ at a point
    getStreamFunction(x, y) {
        let psi = 0;

        for (const flow of this.flows) {
            psi += this.getFlowStreamFunction(flow, x, y);
        }

        return psi;
    }

    // Get stream function contribution from a single flow
    getFlowStreamFunction(flow, x, y) {
        const { type, params } = flow;
        const dx = x - params.x;
        const dy = y - params.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        const theta = Math.atan2(dy, dx);

        if (r < 0.1) return 0;

        switch (type) {
            case 'uniform':
                const angle = params.angle * Math.PI / 180;
                return params.U * (Math.sin(angle) * dx - Math.cos(angle) * dy);

            case 'source':
            case 'sink':
                const m = type === 'sink' ? -params.m : params.m;
                return m * theta / (2 * Math.PI);

            case 'vortex':
                return -params.Gamma * Math.log(r) / (2 * Math.PI);

            case 'doublet':
                return -params.kappa * Math.sin(theta) / (2 * Math.PI * r);

            default:
                return 0;
        }
    }

    // Calculate potential function φ at a point
    getPotentialFunction(x, y) {
        let phi = 0;

        for (const flow of this.flows) {
            phi += this.getFlowPotentialFunction(flow, x, y);
        }

        return phi;
    }

    // Get potential function contribution from a single flow
    getFlowPotentialFunction(flow, x, y) {
        const { type, params } = flow;
        const dx = x - params.x;
        const dy = y - params.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        const theta = Math.atan2(dy, dx);

        if (r < 0.1) return 0;

        switch (type) {
            case 'uniform':
                const angle = params.angle * Math.PI / 180;
                return params.U * (Math.cos(angle) * dx + Math.sin(angle) * dy);

            case 'source':
            case 'sink':
                const m = type === 'sink' ? -params.m : params.m;
                return m * Math.log(r) / (2 * Math.PI);

            case 'vortex':
                return params.Gamma * theta / (2 * Math.PI);

            case 'doublet':
                return -params.kappa * Math.cos(theta) / (2 * Math.PI * r);

            default:
                return 0;
        }
    }

    // Load preset scenarios
    loadScenario(scenarioName) {
        this.clearFlows();

        switch (scenarioName) {
            case 'halfBody':
                // Uniform flow + source = half body
                this.addFlow('uniform', { U: 10, angle: 0, x: this.centerX, y: this.centerY });
                this.addFlow('source', { m: 500, x: this.centerX, y: this.centerY });
                break;

            case 'cylinder':
                // Uniform flow + doublet = flow over cylinder
                this.addFlow('uniform', { U: 10, angle: 0, x: this.centerX, y: this.centerY });
                this.addFlow('doublet', { kappa: 2000, x: this.centerX, y: this.centerY });
                break;

            case 'rotatingCylinder':
                // Uniform flow + doublet + vortex = Magnus effect
                this.addFlow('uniform', { U: 10, angle: 0, x: this.centerX, y: this.centerY });
                this.addFlow('doublet', { kappa: 2000, x: this.centerX, y: this.centerY });
                this.addFlow('vortex', { Gamma: 300, x: this.centerX, y: this.centerY });
                break;

            case 'rankineOval':
                // Uniform flow + source + sink = Rankine oval
                this.addFlow('uniform', { U: 10, angle: 0, x: this.centerX, y: this.centerY });
                this.addFlow('source', { m: 500, x: this.centerX - 50, y: this.centerY });
                this.addFlow('sink', { m: 500, x: this.centerX + 50, y: this.centerY });
                break;
        }
    }

    // Get pressure coefficient
    getPressureCoefficient(x, y, U_inf) {
        const vel = this.getVelocity(x, y);
        if (U_inf === 0) return 0;
        return 1 - (vel.magnitude * vel.magnitude) / (U_inf * U_inf);
    }

    // Get vorticity (for potential flow, this should be zero except at singularities)
    getVorticity(x, y) {
        const epsilon = 0.5;
        const v1 = this.getVelocity(x + epsilon, y);
        const v2 = this.getVelocity(x - epsilon, y);
        const v3 = this.getVelocity(x, y + epsilon);
        const v4 = this.getVelocity(x, y - epsilon);
        
        const dvdx = (v3.v - v4.v) / (2 * epsilon);
        const dudy = (v1.u - v2.u) / (2 * epsilon);
        
        return dvdx - dudy;
    }
}

// Streamline integration using RK4
class StreamlineIntegrator {
    constructor(potentialFlow) {
        this.potentialFlow = potentialFlow;
    }

    // Integrate streamline from starting point
    integrateStreamline(x0, y0, dt, maxSteps, forward = true) {
        const points = [[x0, y0]];
        let x = x0;
        let y = y0;
        const dir = forward ? 1 : -1;

        for (let i = 0; i < maxSteps; i++) {
            const vel = this.potentialFlow.getVelocity(x, y);
            const speed = vel.magnitude;

            if (speed < 0.01) break;

            // RK4 integration
            const k1u = vel.u / speed;
            const k1v = vel.v / speed;

            const vel2 = this.potentialFlow.getVelocity(x + dir * dt * k1u / 2, y + dir * dt * k1v / 2);
            const k2u = vel2.u / (vel2.magnitude || 1);
            const k2v = vel2.v / (vel2.magnitude || 1);

            const vel3 = this.potentialFlow.getVelocity(x + dir * dt * k2u / 2, y + dir * dt * k2v / 2);
            const k3u = vel3.u / (vel3.magnitude || 1);
            const k3v = vel3.v / (vel3.magnitude || 1);

            const vel4 = this.potentialFlow.getVelocity(x + dir * dt * k3u, y + dir * dt * k3v);
            const k4u = vel4.u / (vel4.magnitude || 1);
            const k4v = vel4.v / (vel4.magnitude || 1);

            x += dir * dt * (k1u + 2 * k2u + 2 * k3u + k4u) / 6;
            y += dir * dt * (k1v + 2 * k2v + 2 * k3v + k4v) / 6;

            // Check boundaries
            if (x < 0 || x > this.potentialFlow.width || y < 0 || y > this.potentialFlow.height) {
                break;
            }

            points.push([x, y]);
        }

        return points;
    }

    // Generate multiple streamlines
    generateStreamlines(numLines, dt = 2, maxSteps = 1000) {
        const streamlines = [];
        const width = this.potentialFlow.width;
        const height = this.potentialFlow.height;

        // Generate starting points along left edge
        for (let i = 0; i < numLines; i++) {
            const y = (i + 0.5) * height / numLines;
            const forward = this.integrateStreamline(10, y, dt, maxSteps, true);
            streamlines.push(forward);
        }

        return streamlines;
    }
}
