// presets.js — Predefined simulation scenarios with tuned parameters

export const SCENARIOS = [
    {
        name: 'Karman Vortex Street',
        desc: 'Cylinder at Re ~150, alternating vortex shedding',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.01,
        },
        bodies: [
            { type: 'CIRCLE', x: 0.25, y: 0.5, params: { radius: 0.035 } }
        ]
    },
    {
        name: 'Flat Plate BL',
        desc: 'Boundary layer development over a flat plate',
        settings: {
            solver: 'lbm',
            resolution: 512,
            substeps: 6,
            inletUx: 0.06,
            inletUy: 0,
            viscosity: 0.02,
        },
        bodies: [
            { type: 'FLAT_PLATE', x: 0.45, y: 0.5, params: { length: 0.35, thickness: 0.004 } }
        ]
    },
    {
        name: 'NACA 0012 Airfoil',
        desc: 'Symmetric airfoil at moderate angle of attack',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.008,
        },
        bodies: [
            { type: 'AIRFOIL', x: 0.35, y: 0.5, rotation: -0.1,
              params: { chord: 0.18, thickness: 0.12, camber: 0, camberPos: 0.4 } }
        ]
    },
    {
        name: 'NACA 2412 Cambered',
        desc: 'Cambered airfoil showing asymmetric pressure distribution',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.008,
        },
        bodies: [
            { type: 'AIRFOIL', x: 0.35, y: 0.5, rotation: -0.05,
              params: { chord: 0.18, thickness: 0.12, camber: 0.02, camberPos: 0.4 } }
        ]
    },
    {
        name: 'High Re Turbulent Wake',
        desc: 'Cylinder at high Re with turbulent wake structures',
        settings: {
            solver: 'lbm',
            resolution: 512,
            substeps: 12,
            inletUx: 0.12,
            inletUy: 0,
            viscosity: 0.003,
        },
        bodies: [
            { type: 'CIRCLE', x: 0.2, y: 0.5, params: { radius: 0.04 } }
        ]
    },
    {
        name: 'Bluff Body Separation',
        desc: 'Rectangle in cross-flow showing separation and recirculation',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.008,
        },
        bodies: [
            { type: 'RECTANGLE', x: 0.3, y: 0.5, params: { width: 0.04, height: 0.08 } }
        ]
    },
    {
        name: 'Tandem Cylinders',
        desc: 'Two cylinders showing wake interaction effects',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.01,
        },
        bodies: [
            { type: 'CIRCLE', x: 0.22, y: 0.5, params: { radius: 0.03 } },
            { type: 'CIRCLE', x: 0.4, y: 0.5, params: { radius: 0.03 } }
        ]
    },
    {
        name: 'Wedge Supersonic Analog',
        desc: 'Sharp wedge showing oblique wave-like patterns at high speed',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 10,
            inletUx: 0.14,
            inletUy: 0,
            viscosity: 0.005,
        },
        bodies: [
            { type: 'WEDGE', x: 0.3, y: 0.5, params: { length: 0.14, halfAngle: 0.25 } }
        ]
    },
    {
        name: 'Ogive Nose',
        desc: 'Streamlined ogive shape with minimal separation',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.008,
        },
        bodies: [
            { type: 'OGIVE', x: 0.3, y: 0.5, params: { length: 0.15, radius: 0.25 } }
        ]
    },
    {
        name: 'Multi-Body Array',
        desc: 'Three hexagons in staggered arrangement',
        settings: {
            solver: 'lbm',
            resolution: 384,
            substeps: 8,
            inletUx: 0.08,
            inletUy: 0,
            viscosity: 0.01,
        },
        bodies: [
            { type: 'HEXAGON', x: 0.2, y: 0.4, params: { radius: 0.025 } },
            { type: 'HEXAGON', x: 0.2, y: 0.6, params: { radius: 0.025 } },
            { type: 'HEXAGON', x: 0.35, y: 0.5, params: { radius: 0.025 } },
        ]
    },
];
