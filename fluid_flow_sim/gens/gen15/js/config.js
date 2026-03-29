// ────────────────────────────────────────────
// config.js — Constants, lattice data, defaults
// ────────────────────────────────────────────

// D2Q9 lattice definition
export const D2Q9 = {
    // Direction vectors [ex, ey] for each of 9 velocities
    //  6 2 5
    //   \|/
    //  3-0-1
    //   /|\
    //  7 4 8
    ex: [0, 1, 0, -1, 0, 1, -1, -1, 1],
    ey: [0, 0, 1, 0, -1, 1, 1, -1, -1],

    // Weights
    w: [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36],

    // Opposite direction index
    opp: [0, 3, 4, 1, 2, 7, 8, 5, 6],

    // Speed of sound squared
    cs2: 1 / 3,
    cs4: 1 / 9,
};

// Cell type flags
export const CELL = {
    FLUID: 0,
    SOLID: 1,
    INLET: 2,
    OUTLET: 3,
};

// Solver types
export const SOLVER_TYPE = {
    LBM: 'lbm',
    PROJECTION: 'projection',
};

// Collision operators (LBM)
export const COLLISION = {
    BGK: 'bgk',
    TRT: 'trt',
    MRT: 'mrt',
};

// Body shape types
export const SHAPE = {
    CIRCLE: 'circle',
    CYLINDER: 'cylinder',
    RECTANGLE: 'rectangle',
    FLAT_PLATE: 'flat_plate',
    ELLIPSE: 'ellipse',
    AIRFOIL: 'airfoil',
    TRIANGLE: 'triangle',
    SEMICIRCLE: 'semicircle',
    HEXAGON: 'hexagon',
    OGIVE: 'ogive',
    ROUNDED_RECT: 'rounded_rect',
    I_BEAM: 'i_beam',
    T_BEAM: 't_beam',
};

// Display field options
export const FIELD = {
    VELOCITY: 'velocity',
    PRESSURE: 'pressure',
    VORTICITY: 'vorticity',
    DENSITY: 'density',
    UX: 'ux',
    UY: 'uy',
};

// Colormap options
export const COLORMAP = {
    VIRIDIS: 'viridis',
    MAGMA: 'magma',
    INFERNO: 'inferno',
    PLASMA: 'plasma',
    JET: 'jet',
    COOLWARM: 'coolwarm',
    GRAYSCALE: 'grayscale',
};

// Turbulence model
export const TURB_MODEL = {
    NONE: 'none',
    SMAGORINSKY: 'smagorinsky',
};

// Boundary layer display
export const BL_TYPE = {
    DELTA: 'delta',
    DELTA_STAR: 'delta_star',
    THETA: 'theta',
};

// Default simulation configuration
export const DEFAULT_CONFIG = {
    // Grid
    nx: 256,
    ny: 128,
    minRes: 64,
    maxRes: 1024,

    // Solver
    solverType: SOLVER_TYPE.LBM,
    collision: COLLISION.BGK,
    turbModel: TURB_MODEL.NONE,
    smagorinskyCs: 0.1,

    // Flow (lattice units for LBM)
    uInf: 0.08,           // inlet velocity magnitude (lattice units)
    uInfFunction: null,    // custom u(x,y) string, null = uniform
    viscosity: 0.02,       // kinematic viscosity (lattice units)
    density: 1.0,          // reference density

    // Physical units (for display / NS projection solver)
    physicalU: 1.0,        // m/s
    physicalL: 1.0,        // m (characteristic length)
    physicalNu: 1.5e-5,    // m²/s (air at 20°C)
    physicalRho: 1.225,    // kg/m³

    // Simulation control
    paused: false,
    stepsPerFrame: 4,
    maxStepsPerFrame: 20,

    // Boundary conditions
    periodicY: false,
    gravityEnabled: false,
    gravity: 9.81,

    // Display
    field: FIELD.VELOCITY,
    colormap: COLORMAP.VIRIDIS,
    showBodies: true,
    showBoundaryLayer: false,
    blDelta: true,
    blDeltaStar: false,
    blTheta: false,
    probeEnabled: false,

    // Monitor
    monitorVisible: false,
    monitorUpdateInterval: 10, // frames

    // UI
    sidebarVisible: true,
    uiVisible: true,
};

// Keybind definitions
export const KEYBINDS = {
    'Tab': { action: 'toggleSidebar', label: 'Toggle Sidebar' },
    ' ': { action: 'togglePause', label: 'Pause / Resume' },
    'r': { action: 'reset', label: 'Reset Simulation' },
    's': { action: 'singleStep', label: 'Single Step' },
    'p': { action: 'toggleProbe', label: 'Toggle Probe' },
    'm': { action: 'toggleMonitor', label: 'Toggle Monitor' },
    'h': { action: 'toggleUI', label: 'Hide / Show UI' },
    '1': { action: 'togglePanel1', label: 'Simulation Settings' },
    '2': { action: 'togglePanel2', label: 'Flow Settings' },
    '3': { action: 'togglePanel3', label: 'Body Settings' },
    '4': { action: 'togglePanel4', label: 'Visual Settings' },
    'Delete': { action: 'deleteBody', label: 'Remove Selected Body' },
    'Escape': { action: 'cancel', label: 'Cancel / Deselect' },
    '=': { action: 'speedUp', label: 'Increase Speed' },
    '-': { action: 'speedDown', label: 'Decrease Speed' },
};

// Shape display names for UI
export const SHAPE_NAMES = {
    [SHAPE.CIRCLE]: 'Circle',
    [SHAPE.CYLINDER]: 'Cylinder',
    [SHAPE.RECTANGLE]: 'Rectangle',
    [SHAPE.FLAT_PLATE]: 'Flat Plate',
    [SHAPE.ELLIPSE]: 'Ellipse',
    [SHAPE.AIRFOIL]: 'NACA Airfoil',
    [SHAPE.TRIANGLE]: 'Triangle',
    [SHAPE.SEMICIRCLE]: 'Semicircle',
    [SHAPE.HEXAGON]: 'Hexagon',
    [SHAPE.OGIVE]: 'Ogive',
    [SHAPE.ROUNDED_RECT]: 'Rounded Rectangle',
    [SHAPE.I_BEAM]: 'I-Beam',
    [SHAPE.T_BEAM]: 'T-Beam',
};

// Default shape parameters
export const SHAPE_DEFAULTS = {
    [SHAPE.CIRCLE]: { radius: 12 },
    [SHAPE.CYLINDER]: { radius: 12 },
    [SHAPE.RECTANGLE]: { width: 30, height: 15 },
    [SHAPE.FLAT_PLATE]: { length: 40, thickness: 1 },
    [SHAPE.ELLIPSE]: { a: 20, b: 10 },
    [SHAPE.AIRFOIL]: { naca: '2412', chord: 40, aoa: 5 },
    [SHAPE.TRIANGLE]: { base: 24, height: 20 },
    [SHAPE.SEMICIRCLE]: { radius: 15 },
    [SHAPE.HEXAGON]: { radius: 14 },
    [SHAPE.OGIVE]: { length: 40, radius: 60 },
    [SHAPE.ROUNDED_RECT]: { width: 30, height: 15, cornerRadius: 5 },
    [SHAPE.I_BEAM]: { width: 20, height: 30, flangeThickness: 4, webThickness: 4 },
    [SHAPE.T_BEAM]: { width: 20, height: 25, flangeThickness: 4, webThickness: 4 },
};
