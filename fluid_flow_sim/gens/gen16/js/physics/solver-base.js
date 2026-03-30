// solver-base.js — Abstract solver interface contract

export class SolverBase {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.paused = false;
    }

    /** Initialize GPU resources */
    init(gpu, width, height, params) { throw new Error('Not implemented'); }

    /** Advance simulation one step */
    step() { throw new Error('Not implemented'); }

    /** Reset to initial conditions */
    reset() { throw new Error('Not implemented'); }

    /** Resize simulation domain */
    resize(width, height) { throw new Error('Not implemented'); }

    /** Update obstacle mask from body list */
    updateObstacleMask(bodies) { throw new Error('Not implemented'); }

    /** Set inlet velocity (lattice units) */
    setInletVelocity(ux, uy) { throw new Error('Not implemented'); }

    /** Set kinematic viscosity (lattice units) */
    setViscosity(nu) { throw new Error('Not implemented'); }

    /** Get macroscopic flow texture: RGBA32F = (ux, uy, rho, curl) */
    getFlowTexture() { throw new Error('Not implemented'); }

    /** Get obstacle mask texture: RGBA8 = (solid, bodyId, nx, ny) */
    getObstacleTexture() { throw new Error('Not implemented'); }

    /** Destroy GPU resources */
    destroy() { throw new Error('Not implemented'); }
}
